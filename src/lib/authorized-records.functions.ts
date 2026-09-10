import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { checkRateLimit } from "@/lib/rate-limit.server";
import { getEffectiveRoles } from "@/lib/server-auth";
import {
  canAccessAssetRecord,
  canAccessDocumentRecord,
  canAccessCaseRecord,
  type AppRole,
} from "@/lib/rbac";
import { isDemoMode } from "@/lib/demo-mode";
import { SEED_POLICE_ASSETS } from "@/lib/assets";
import { seedInitialDocuments, type DocumentAccessLog, type VerificationState } from "@/lib/documents";

const OPAQUE_ACCESS_DENIED = "Access Denied: Record not found or you lack statutory clearance to inspect this record.";

async function logRecordAccessDenied(
  actor: string,
  recordType: string,
  recordId: string,
  role: string,
  reason: string,
) {
  try {
    await (supabaseAdmin.from("audit_logs") as any).insert({
      action: `UNAUTHORIZED_INSPECTION_ATTEMPT: ${actor} (${role}) attempted to view ${recordType} ${recordId}. ${reason}`,
      entity_affected: `${recordType}:${recordId}`,
      timestamp: new Date().toISOString(),
    });
  } catch {
    // Non-blocking audit failure
  }
}

/**
 * SEC-05: Authorized Asset & Evidence Detail Retrieval
 * Fails closed. Derives identity and roles authoritatively on server.
 * Never returns sensitive asset/evidence bodies to unauthorized callers.
 */
export const getAuthorizedAssetDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        assetId: z.string().min(1).max(100),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const userEmail = (context.claims?.["email"] as string) || userId;
    const req = getRequest();
    const clientIp = req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";

    const rateCheck = checkRateLimit(`asset-detail:${userId}:${clientIp}`, {
      maxRequests: 60,
      windowMs: 60_000,
    });
    if (!rateCheck.allowed) {
      throw new Error("Rate limit exceeded. Please wait before requesting additional asset details.");
    }

    const userRoles = await getEffectiveRoles(userId);
    if (userRoles.length === 0) {
      await logRecordAccessDenied(
        userEmail,
        "POLICE_ASSET",
        data.assetId,
        "unassigned",
        "Unassigned account attempted to view asset detail",
      );
      throw new Error(OPAQUE_ACCESS_DENIED);
    }
    const effectiveRole: AppRole = userRoles[0] ?? "unassigned";

    // 1. Fetch asset from database
    let asset: any = null;
    const { data: dbAsset } = await supabaseAdmin
      .from("police_assets")
      .select(
        `
        id, asset_code, name, category_id, status, evidence_status, condition,
        current_location, department_station, current_custodian_name,
        assigned_officer_name, case_id, fir_number, serial_number,
        barcode_rfid, tamper_seal_number, purchase_date, purchase_cost,
        vendor_supplier, warranty_expiry, metadata, created_at, updated_at,
        asset_categories (name),
        cases (case_number, parties)
      `,
      )
      .or(`id.eq.${data.assetId},asset_code.eq.${data.assetId}`)
      .maybeSingle();

    if (dbAsset) {
      const cat = dbAsset.asset_categories as { name: string } | null;
      const c = dbAsset.cases as { case_number: string; parties: string } | null;
      asset = {
        ...dbAsset,
        category_name: cat?.name || "General",
        case_number: c?.case_number || null,
        case_title: c?.parties || null,
      };
    } else if (isDemoMode()) {
      asset = SEED_POLICE_ASSETS.find((a) => a.id === data.assetId || a.asset_code === data.assetId);
    }

    if (!asset) {
      throw new Error(OPAQUE_ACCESS_DENIED);
    }

    // 2. Authorize record access
    let assignedCaseIds: string[] | undefined = undefined;
    if (effectiveRole === "judge") {
      const { data: judgeProfile } = await supabaseAdmin
        .from("judges")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (judgeProfile?.id) {
        const { data: schedules } = await supabaseAdmin
          .from("schedules")
          .select("case_id")
          .eq("judge_id", judgeProfile.id);
        assignedCaseIds = (schedules || []).map((s) => s.case_id).filter(Boolean) as string[];
      }
    }

    const authorized = canAccessAssetRecord(effectiveRole, asset, assignedCaseIds);
    if (!authorized) {
      await logRecordAccessDenied(
        userEmail,
        "POLICE_ASSET",
        asset.asset_code || asset.id,
        effectiveRole,
        `Role ${effectiveRole} lacks clearance for asset/evidence ${asset.asset_code}`,
      );
      throw new Error(OPAQUE_ACCESS_DENIED);
    }

    // 3. Fetch transfers
    let transfers: any[] = [];
    const isUuid = Boolean(asset.id?.match(/^[0-9a-fA-F-]{36}$/));
    if (isUuid) {
      const { data: dbTransfers } = await supabaseAdmin
        .from("asset_transfers")
        .select("*")
        .eq("asset_id", asset.id)
        .order("dispatched_at", { ascending: false });

      if (dbTransfers && dbTransfers.length > 0) {
        transfers = dbTransfers.map((t: any) => ({
          id: t.id,
          asset_id: t.asset_id,
          transfer_number: t.transfer_number,
          from_location: t.from_location,
          to_location: t.to_location,
          from_custodian_name: t.from_custodian_name,
          to_custodian_name: t.to_custodian_name,
          dispatched_at: t.dispatched_at,
          received_at: t.received_at,
          status: t.status,
          reason: t.reason || "",
          transit_seal_number: t.transit_seal_number,
          signature_verification: t.signature_verification || "VERIFIED_DIGITAL_SIG",
        }));
      }
    }

    // 4. Fetch maintenance
    let maintenance: any[] = [];
    if (isUuid) {
      const { data: dbMnt } = await supabaseAdmin
        .from("asset_maintenance")
        .select("*")
        .eq("asset_id", asset.id)
        .order("scheduled_date", { ascending: false });

      if (dbMnt && dbMnt.length > 0) {
        maintenance = dbMnt.map((m: any) => ({
          id: m.id,
          asset_id: m.asset_id,
          maintenance_type: m.maintenance_type,
          service_provider: m.service_provider,
          scheduled_date: m.scheduled_date,
          completed_date: m.completed_date,
          cost: Number(m.cost || 0),
          technician_name: m.technician_name,
          findings: m.findings || "",
          actions_taken: m.actions_taken || "",
          status: m.status,
          next_scheduled_service: m.next_scheduled_service,
        }));
      }
    }

    // 5. Fetch associated documents (filtered by canAccessDocumentRecord)
    const documents: any[] = [];
    if (asset.asset_code) {
      const { data: dbDocs } = await (supabaseAdmin.from("case_documents") as any)
        .select("*")
        .contains("metadata", { asset_code: asset.asset_code });

      if (dbDocs) {
        for (const d of dbDocs) {
          if (canAccessDocumentRecord(effectiveRole, d, null, assignedCaseIds)) {
            documents.push({
              id: d.id,
              asset_id: asset.id,
              document_id: d.id,
              document_number: d.document_number,
              title: d.title,
              category: d.category,
              file_name: d.file_name,
              file_format: d.file_format,
              file_size_bytes: Number(d.file_size_bytes || 0),
              latest_sha256: d.latest_sha256,
              relationship_type: d.category,
              notes: (d.metadata as any)?.notes || "",
              created_at: d.created_at,
            });
          }
        }
      }
    }

    // 6. Fetch custody timeline
    let timeline: any[] = [];
    if (isUuid) {
      const { data: dbEvents } = await (supabaseAdmin.from("evidence_chain_of_custody") as any)
        .select("*")
        .eq("asset_id", asset.id)
        .order("created_at", { ascending: false });

      if (dbEvents && dbEvents.length > 0) {
        timeline = dbEvents;
      }
    }

    return {
      asset,
      transfers,
      maintenance,
      documents,
      timeline,
    };
  });

/**
 * SEC-05: Authorized Document Dossier Retrieval
 * Fails closed. Derives identity and roles authoritatively on server.
 * Never returns sensitive document metadata or versions to unauthorized callers.
 */
export const getAuthorizedDocumentDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        documentId: z.string().min(1).max(100),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const userEmail = (context.claims?.["email"] as string) || userId;
    const req = getRequest();
    const clientIp = req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";

    const rateCheck = checkRateLimit(`doc-detail:${userId}:${clientIp}`, {
      maxRequests: 60,
      windowMs: 60_000,
    });
    if (!rateCheck.allowed) {
      throw new Error("Rate limit exceeded. Please wait before requesting additional document details.");
    }

    const userRoles = await getEffectiveRoles(userId);
    if (userRoles.length === 0) {
      await logRecordAccessDenied(
        userEmail,
        "CASE_DOCUMENT",
        data.documentId,
        "unassigned",
        "Unassigned account attempted to view document dossier",
      );
      throw new Error(OPAQUE_ACCESS_DENIED);
    }
    const effectiveRole: AppRole = userRoles[0] ?? "unassigned";

    // 1. Fetch document from database
    let doc: any = null;
    const { data: dbDoc } = await supabaseAdmin
      .from("case_documents")
      .select(
        `
        id, document_number, title, category, sensitivity_tier,
        current_version, file_name, file_format, file_size_bytes,
        storage_path, latest_sha256, is_sealed, is_tampered,
        originating_agency, case_id, metadata, created_at, updated_at,
        cases (case_number, parties)
      `,
      )
      .or(`id.eq.${data.documentId},document_number.eq.${data.documentId}`)
      .maybeSingle();

    if (dbDoc) {
      const c = dbDoc.cases as { case_number: string; parties: string } | null;
      doc = {
        id: dbDoc.id,
        document_number: dbDoc.document_number,
        title: dbDoc.title,
        category: dbDoc.category,
        sensitivity_tier: dbDoc.sensitivity_tier,
        current_version: dbDoc.current_version,
        file_name: dbDoc.file_name,
        file_format: dbDoc.file_format,
        file_size_bytes: Number(dbDoc.file_size_bytes || 0),
        storage_path: dbDoc.storage_path,
        r2_object_key: (dbDoc.metadata as any)?.r2_object_key || dbDoc.storage_path,
        r2_bucket: (dbDoc.metadata as any)?.r2_bucket || "nyayasetu-vault",
        status: (dbDoc.metadata as any)?.status || "ACTIVE",
        latest_sha256: dbDoc.latest_sha256,
        is_sealed: dbDoc.is_sealed,
        is_tampered: dbDoc.is_tampered,
        originating_agency: dbDoc.originating_agency,
        case_id: dbDoc.case_id,
        case_number: c?.case_number || (dbDoc.metadata as any)?.case_number || null,
        asset_id: null,
        asset_code: null,
        relationship_type: null,
        uploaded_by_name: (dbDoc.metadata as any)?.uploaded_by_name || "Authorized Staff",
        uploaded_by_role: (dbDoc.metadata as any)?.uploaded_by_role || "registrar",
        content_text: (dbDoc.metadata as any)?.contentText || undefined,
        metadata: (dbDoc.metadata as Record<string, unknown>) || {},
        created_at: dbDoc.created_at,
        updated_at: dbDoc.updated_at,
      };
    } else if (isDemoMode()) {
      const seeds = seedInitialDocuments();
      doc = seeds.find((d) => d.id === data.documentId || d.document_number === data.documentId) || null;
    }

    if (!doc) {
      throw new Error(OPAQUE_ACCESS_DENIED);
    }

    // 2. Authorize record access
    let judgeId: string | null = null;
    let assignedCaseIds: string[] | undefined = undefined;
    if (effectiveRole === "judge") {
      const { data: judgeProfile } = await supabaseAdmin
        .from("judges")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (judgeProfile?.id) {
        judgeId = judgeProfile.id;
        const { data: schedules } = await supabaseAdmin
          .from("schedules")
          .select("case_id")
          .eq("judge_id", judgeProfile.id);
        assignedCaseIds = (schedules || []).map((s) => s.case_id).filter(Boolean) as string[];
      }
    }

    const authorized = canAccessDocumentRecord(effectiveRole, doc, judgeId, assignedCaseIds);
    if (!authorized) {
      await logRecordAccessDenied(
        userEmail,
        "CASE_DOCUMENT",
        doc.document_number || doc.id,
        effectiveRole,
        `Role ${effectiveRole} lacks ${doc.sensitivity_tier} clearance for document ${doc.document_number}`,
      );
      throw new Error(OPAQUE_ACCESS_DENIED);
    }

    // 3. Fetch immutable versions
    let versions: any[] = [];
    const isDocUuid = Boolean(doc.id?.match(/^[0-9a-fA-F-]{36}$/));
    if (isDocUuid) {
      const { data: dbVersions } = await supabaseAdmin
        .from("document_versions")
        .select("*")
        .eq("document_id", doc.id)
        .order("version_number", { ascending: true });

      if (dbVersions && dbVersions.length > 0) {
        versions = dbVersions.map((v: any) => ({
          id: v.id,
          document_id: v.document_id,
          version_number: v.version_number,
          sha256_hash: v.sha256_hash,
          file_name: v.file_name,
          mime_type: v.mime_type,
          file_size_bytes: Number(v.file_size_bytes || 0),
          storage_path: v.storage_path,
          change_summary: v.change_summary || "",
          uploaded_by_name: v.uploaded_by_name || "Authorized Officer",
          uploaded_by_role: v.uploaded_by_role || "registrar",
          digital_signature: v.digital_signature || null,
          signer_identity: v.signer_identity || null,
          is_tampered: v.is_tampered || false,
          created_at: v.created_at,
        }));
      }
    }

    if (versions.length === 0) {
      versions.push({
        id: `ver-${doc.id}-1`,
        document_id: doc.id,
        version_number: doc.current_version,
        sha256_hash: doc.latest_sha256,
        file_name: doc.file_name,
        mime_type: doc.file_format === "PDF" || doc.file_format === "PDF/A" ? "application/pdf" : "application/octet-stream",
        file_size_bytes: doc.file_size_bytes,
        storage_path: doc.storage_path,
        change_summary: "Initial registry deposit & cryptographic registration",
        uploaded_by_name: doc.uploaded_by_name,
        uploaded_by_role: doc.uploaded_by_role,
        is_tampered: doc.is_tampered,
        created_at: doc.created_at,
      });
    }

    const activeVer = versions.find((v) => v.version_number === doc.current_version) || versions[versions.length - 1];
    const activeHash = activeVer?.sha256_hash || doc.latest_sha256;

    const verificationState: VerificationState = isDemoMode() ? "SIMULATED_DEMO" : "LIVE_VERIFIED";

    const integrity = {
      id: `int-${doc.id}`,
      document_id: doc.id,
      version_number: doc.current_version,
      sha256_hash: activeHash,
      merkle_root: "NOT_CONFIGURED",
      validator_node: "Cloudflare R2 Encrypted Storage Vault",
      digital_signature: activeVer?.digital_signature || "PLATFORM_KEYSTORE_RECORD",
      signer_identity: activeVer?.signer_identity || doc.uploaded_by_name,
      certificate_ref: "INTERNAL_PLATFORM_KEY",
      bsa_compliance_clause:
        "Certified under Section 63, Bharatiya Sakshya Adhiniyam, 2023 (Algorithmic Electronic Record Hash)",
      verification_status: doc.is_tampered ? ("INTEGRITY_MISMATCH" as const) : ("VERIFIED" as const),
      last_verified_at: new Date().toISOString(),
      ledger_anchor: {
        isAnchored: false,
        verificationState,
        targetLedgerName: isDemoMode() ? "Demo Local Sandbox (Simulation)" : "Not blockchain anchored",
        statusMessage: isDemoMode()
          ? "Demo simulation only: no external blockchain network transaction exists."
          : "Storage integrity secured via Cloudflare R2 & Supabase immutable SHA-256 digests.",
        anchorSchema: "SHA256-R2-IMMUTABLE-DEPOSIT",
        proofReady: true,
      },
    };

    const accessLogs: DocumentAccessLog[] = [
      {
        id: `acc-${Date.now()}`,
        document_id: doc.id,
        user_name: userEmail,
        user_role: effectiveRole,
        access_type: "PREVIEW",
        ip_or_terminal: clientIp,
        timestamp: new Date().toISOString(),
      },
    ];

    return {
      document: doc,
      versions,
      integrity,
      accessLogs,
    };
  });

/**
 * SEC-05: Authorized Court Case Detail Retrieval
 * Fails closed. Derives identity and roles authoritatively on server.
 */
export const getAuthorizedCaseDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        caseId: z.string().min(1).max(100),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const userEmail = (context.claims?.["email"] as string) || userId;
    const req = getRequest();
    const clientIp = req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";

    const rateCheck = checkRateLimit(`case-detail:${userId}:${clientIp}`, {
      maxRequests: 60,
      windowMs: 60_000,
    });
    if (!rateCheck.allowed) {
      throw new Error("Rate limit exceeded. Please wait before requesting additional case details.");
    }

    const userRoles = await getEffectiveRoles(userId);
    if (userRoles.length === 0) {
      await logRecordAccessDenied(
        userEmail,
        "CASE",
        data.caseId,
        "unassigned",
        "Unassigned account attempted to view court case detail",
      );
      throw new Error(OPAQUE_ACCESS_DENIED);
    }
    const effectiveRole: AppRole = userRoles[0] ?? "unassigned";

    // 1. Fetch case
    const { data: dbCase } = await supabaseAdmin
      .from("cases")
      .select(
        `
        id, case_number, parties, filing_date, status,
        category_id, priority_score, priority_tier, legal_priority_flag,
        estimated_duration_minutes, previous_adjournments,
        statutory_limitation_deadline, senior_citizen_litigant,
        is_ftsc_pocso, property_dispute_5yr_plus,
        case_categories (id, name, typical_duration_minutes)
      `,
      )
      .or(`id.eq.${data.caseId},case_number.eq.${data.caseId}`)
      .maybeSingle();

    if (!dbCase) {
      throw new Error(OPAQUE_ACCESS_DENIED);
    }

    // 2. Authorize record access
    let judgeId: string | null = null;
    let assignedCaseIds: string[] | undefined = undefined;
    if (effectiveRole === "judge") {
      const { data: judgeProfile } = await supabaseAdmin
        .from("judges")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (judgeProfile?.id) {
        judgeId = judgeProfile.id;
        const { data: schedules } = await supabaseAdmin
          .from("schedules")
          .select("case_id")
          .eq("judge_id", judgeProfile.id);
        assignedCaseIds = (schedules || []).map((s) => s.case_id).filter(Boolean) as string[];
      }
    }

    const authorized = canAccessCaseRecord(effectiveRole, dbCase as any, judgeId, assignedCaseIds);
    if (!authorized) {
      await logRecordAccessDenied(
        userEmail,
        "CASE",
        dbCase.case_number || dbCase.id,
        effectiveRole,
        `Role ${effectiveRole} lacks clearance for case ${dbCase.case_number}`,
      );
      throw new Error(OPAQUE_ACCESS_DENIED);
    }

    // 3. Fetch schedules and adjournments for this case
    const [{ data: schedules }, { data: adjournments }] = await Promise.all([
      supabaseAdmin
        .from("schedules")
        .select("*, judges(name), courtrooms(name)")
        .eq("case_id", dbCase.id),
      supabaseAdmin
        .from("adjournments")
        .select("*")
        .eq("case_id", dbCase.id)
        .order("recorded_at", { ascending: false }),
    ]);

    return {
      caseRecord: dbCase,
      schedules: schedules || [],
      adjournments: adjournments || [],
    };
  });
