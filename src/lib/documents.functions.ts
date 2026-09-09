import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  computeSha256,
  deleteR2Object,
  generateR2ObjectKey,
  getR2Object,
  putR2Object,
  sanitizeFilename,
  VAULT_BUCKET_NAME,
} from "@/lib/r2.server";

export type SupportedDocumentFormat =
  | "PDF"
  | "PDF/A"
  | "DOCX"
  | "DOC"
  | "TIFF"
  | "TIF"
  | "PNG"
  | "JPG"
  | "JPEG";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/x-pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "image/tiff",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "text/plain",
]);

const ALLOWED_EXTENSIONS = new Set([
  "pdf",
  "docx",
  "doc",
  "tiff",
  "tif",
  "png",
  "jpg",
  "jpeg",
  "txt",
]);

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB statutory archive limit

/** Roles authorized to deposit documents into the secure legal vault */
const AUTHORIZED_UPLOAD_ROLES = new Set([
  "admin",
  "registrar",
  "police_officer",
  "police_staff",
  "investigating_officer",
  "forensic_officer",
  "evidence_custodian",
  "judge",
]);

/**
 * Validates whether the role can view a document given its sensitivity tier.
 */
function checkDocumentSensitivityAccess(
  userRoles: string[],
  sensitivityTier: string,
  isAssignedJudge: boolean,
): boolean {
  const normalizedTier = (sensitivityTier || "PUBLIC").toUpperCase();
  const isAdminOrRegistrar = userRoles.includes("admin") || userRoles.includes("registrar");

  if (isAdminOrRegistrar) return true;

  if (normalizedTier === "PUBLIC") return true;

  if (normalizedTier === "CONFIDENTIAL") {
    return (
      userRoles.includes("judge") ||
      userRoles.includes("police_officer") ||
      userRoles.includes("police_staff") ||
      userRoles.includes("investigating_officer") ||
      userRoles.includes("forensic_officer") ||
      userRoles.includes("evidence_custodian")
    );
  }

  if (normalizedTier === "RESTRICTED" || normalizedTier === "RESTRICTED_INVESTIGATION") {
    return (
      userRoles.includes("police_officer") ||
      userRoles.includes("investigating_officer") ||
      userRoles.includes("forensic_officer") ||
      userRoles.includes("evidence_custodian") ||
      (userRoles.includes("judge") && isAssignedJudge)
    );
  }

  if (normalizedTier === "SEALED_COVER_IN_CAMERA") {
    // Strictly judicial bench assigned to case, or registrar
    return (userRoles.includes("judge") && isAssignedJudge) || userRoles.includes("registrar");
  }

  return true;
}

/**
 * Helper to write an audit entry into public.audit_logs via Supabase admin.
 */
async function recordAuditTrail(params: {
  userId: string | null;
  action: string;
  actionCode: string;
  entityType: string;
  entityId: string;
  caseId: string | null;
  metadata: Record<string, unknown>;
  success?: boolean;
}) {
  try {
    const entityAffectedJson = JSON.stringify({
      entity_type: params.entityType,
      entity_id: params.entityId,
      case_id: params.caseId,
      action_code: params.actionCode,
      success: params.success !== false,
      metadata: params.metadata,
    });

    await supabaseAdmin.from("audit_logs").insert({
      user_id: params.userId,
      action: params.action,
      entity_affected: entityAffectedJson,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("[recordAuditTrail] Failed to write to public.audit_logs:", err);
  }
}

/**
 * Converts a Base64 string to Uint8Array safely across Node & Edge environments.
 */
function base64ToUint8Array(base64: string): Uint8Array {
  // Strip data URL prefixes if provided (e.g. data:application/pdf;base64,...)
  const cleanBase64 = base64.replace(/^data:[^;]+;base64,/, "");
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(cleanBase64, "base64"));
  }
  const binaryString = atob(cleanBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Converts a Uint8Array to Base64 string safely across Node & Edge environments.
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

// ============================================================================
// 1. SECURE UPLOAD ENDPOINT (Cloudflare Worker -> R2 -> Supabase Metadata)
// ============================================================================

export type DocumentMetadataMap = Record<string, string | number | boolean | null>;

export interface UploadDocumentInput {
  fileBase64: string;
  fileName: string;
  fileType?: string | undefined;
  fileSizeBytes?: number | undefined;
  title: string;
  category: string;
  sensitivityTier: "PUBLIC" | "CONFIDENTIAL" | "RESTRICTED" | "RESTRICTED_INVESTIGATION" | "SEALED_COVER_IN_CAMERA";
  caseId?: string | undefined;
  caseNumber?: string | undefined;
  firNumber?: string | undefined;
  policeStation?: string | undefined;
  originatingAgency?: string | undefined;
  notes?: string | undefined;
  contentText?: string | undefined;
  clientSha256?: string | undefined;
}

export interface UploadDocumentOutput {
  id: string;
  document_number: string;
  title: string;
  category: string;
  fir_number: string | null;
  police_station: string;
  sensitivity_tier: string;
  file_name: string;
  file_format: string;
  file_size_bytes: number;
  r2_object_key: string;
  r2_bucket: string;
  sha256: string;
  case_id: string | null;
  case_number: string | null;
  uploaded_by: string;
  uploaded_at: string;
  status: string;
  metadata: DocumentMetadataMap;
}

export const uploadDocumentToR2 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: UploadDocumentInput) => {
    if (!input?.fileBase64 || !input.fileBase64.trim()) {
      throw new Error("File content (Base64) is required for upload to Cloudflare R2.");
    }
    if (!input?.fileName || !input.fileName.trim()) {
      throw new Error("File attachment name is required.");
    }
    if (!input?.title || !input.title.trim()) {
      throw new Error("Document title is required.");
    }
    return input;
  })
  .handler(async ({ data, context }): Promise<UploadDocumentOutput> => {
    const userId = context.userId;

    // 1. Fetch user roles & profiles to verify permissions
    const [{ data: rolesData }, { data: profileData }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
      supabaseAdmin.from("profiles").select("id, full_name").eq("id", userId).maybeSingle(),
    ]);

    const userRoles = (rolesData || []).map((r) => r.role);
    const hasUploadPerm = userRoles.some((r) => AUTHORIZED_UPLOAD_ROLES.has(r));

    if (!hasUploadPerm && userRoles.length > 0) {
      throw new Error(
        `Access Denied: Your assigned roles (${userRoles.join(", ")}) do not have permission to deposit documents into the secure vault.`,
      );
    }

    const userName = profileData?.full_name || "Authorized Staff";

    // 2. Validate file size and format server-side
    const rawExt = (data.fileName.split(".").pop() || "").toLowerCase();
    const cleanFormat = (data.fileType || rawExt || "pdf").toUpperCase();

    if (!ALLOWED_EXTENSIONS.has(rawExt) && rawExt !== "") {
      throw new Error(
        `File extension '.${rawExt}' is not permitted in the secure judicial archive. Allowed extensions: PDF, DOCX, TIFF, PNG, JPG, TXT.`,
      );
    }

    // Decode file bytes
    const fileBytes = base64ToUint8Array(data.fileBase64);
    const actualSizeBytes = fileBytes.byteLength;

    if (actualSizeBytes === 0) {
      throw new Error("The uploaded file is empty (0 bytes).");
    }

    if (actualSizeBytes > MAX_FILE_SIZE_BYTES) {
      throw new Error(
        `File size exceeds statutory archive limit of 50 MB (Actual size: ${(actualSizeBytes / (1024 * 1024)).toFixed(2)} MB).`,
      );
    }

    // 3. Compute server-side cryptographic SHA-256 digest
    const serverSha256 = await computeSha256(fileBytes);
    if (data.clientSha256 && data.clientSha256.trim().toLowerCase() !== serverSha256.toLowerCase()) {
      console.warn(
        `[Upload Integrity Warning] Client SHA-256 (${data.clientSha256}) differed from server calculated digest (${serverSha256}). Using authoritative server hash.`,
      );
    }

    // 4. Resolve & verify target case if provided
    let verifiedCaseId: string | null = null;
    let verifiedCaseNumber: string | null = null;
    const requestedCase = (data.caseNumber || data.caseId || "").trim();

    if (requestedCase && requestedCase !== "unassigned") {
      // Look up case by ID or case_number in public.cases
      const { data: caseRow } = await supabaseAdmin
        .from("cases")
        .select("id, case_number")
        .or(`id.eq.${requestedCase.match(/^[0-9a-fA-F-]{36}$/) ? requestedCase : "00000000-0000-0000-0000-000000000000"},case_number.eq.${requestedCase}`)
        .maybeSingle();

      if (caseRow) {
        verifiedCaseId = caseRow.id;
        verifiedCaseNumber = caseRow.case_number;
      } else {
        // Fallback: use sanitized string for case identifier
        verifiedCaseNumber = requestedCase;
      }
    }

    // 5. Generate unique document ID and sanitized filename
    const docUuid = crypto.randomUUID();
    const documentId = `doc_${docUuid.replace(/-/g, "").slice(0, 10)}`;
    const safeFilename = sanitizeFilename(data.fileName);

    const docPrefix = (data.category || "DOC").replace(/[^a-zA-Z0-9]/g, "-").toUpperCase().slice(0, 4);
    const docNumber = `DOC-${docPrefix}-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // 6. Generate canonical R2 object key:
    // `cases/{caseId}/documents/{documentId}/{safeFilename}`
    const r2CaseFolder = verifiedCaseNumber || verifiedCaseId || "unassigned";
    const r2ObjectKey = generateR2ObjectKey({
      caseId: r2CaseFolder,
      documentId,
      safeFilename,
    });

    const now = new Date().toISOString();
    const mimeType =
      rawExt === "pdf"
        ? "application/pdf"
        : rawExt === "png"
          ? "image/png"
          : rawExt === "jpg" || rawExt === "jpeg"
            ? "image/jpeg"
            : rawExt === "tiff" || rawExt === "tif"
              ? "image/tiff"
              : "application/octet-stream";

    // 7. Put actual file bytes into Cloudflare R2
    try {
      await putR2Object(r2ObjectKey, fileBytes, {
        httpMetadata: {
          contentType: mimeType,
          contentDisposition: `attachment; filename="${safeFilename}"`,
        },
        customMetadata: {
          documentId,
          docUuid,
          caseId: r2CaseFolder,
          originalFilename: data.fileName,
          uploadedBy: userId,
          uploadedAt: now,
          sha256: serverSha256,
          category: data.category,
          sensitivityTier: data.sensitivityTier,
        },
        sha256: serverSha256,
      });
    } catch (r2Error: any) {
      console.error("[uploadDocumentToR2] Failed to put object into Cloudflare R2:", r2Error);
      throw new Error(`Cloudflare R2 Storage Error: ${r2Error?.message || "Failed to write file to R2 bucket."}`);
    }

    // 8. Save document metadata to Supabase (after R2 upload succeeds)
    // Map sensitivity tier to DB enum public.document_sensitivity_tier ('PUBLIC' | 'RESTRICTED' | 'SEALED_COVER_IN_CAMERA')
    let dbSensitivity = "PUBLIC";
    if (data.sensitivityTier === "SEALED_COVER_IN_CAMERA") dbSensitivity = "SEALED_COVER_IN_CAMERA";
    else if (
      data.sensitivityTier === "CONFIDENTIAL" ||
      data.sensitivityTier === "RESTRICTED" ||
      data.sensitivityTier === "RESTRICTED_INVESTIGATION"
    ) {
      dbSensitivity = "RESTRICTED";
    }

    const metadataPayload: DocumentMetadataMap = {
      document_id: documentId,
      doc_uuid: docUuid,
      case_id: verifiedCaseId || r2CaseFolder,
      case_number: verifiedCaseNumber || r2CaseFolder,
      file_name: safeFilename,
      file_type: cleanFormat,
      file_size: actualSizeBytes,
      r2_object_key: r2ObjectKey,
      r2_bucket: VAULT_BUCKET_NAME,
      uploaded_by: userId,
      uploaded_by_name: userName,
      uploaded_at: now,
      document_category: data.category,
      status: "ACTIVE",
      sha256: serverSha256,
      notes: data.notes || "",
      bsa_section_63: true,
    };

    let createdRecord: any = null;

    try {
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from("case_documents")
        .insert({
          id: docUuid,
          case_id: verifiedCaseId,
          document_number: docNumber,
          title: data.title.trim(),
          category: data.category,
          fir_number: data.firNumber?.trim() || null,
          police_station: data.policeStation?.trim() || "District Police Central Division",
          sensitivity_tier: dbSensitivity as any,
          current_version: 1,
          file_name: safeFilename,
          file_format: cleanFormat,
          file_size_bytes: actualSizeBytes,
          storage_path: r2ObjectKey,
          latest_sha256: serverSha256,
          is_sealed: data.sensitivityTier === "SEALED_COVER_IN_CAMERA",
          is_tampered: false,
          originating_agency: data.originatingAgency?.trim() || "State Criminal Registry & CCTNS Portal",
          created_by: userId.match(/^[0-9a-fA-F-]{36}$/) ? userId : null,
          metadata: metadataPayload,
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }
      createdRecord = inserted;

      // Also create version record in document_versions
      try {
        await supabaseAdmin.from("document_versions").insert({
          document_id: docUuid,
          version_number: 1,
          file_name: safeFilename,
          file_size_bytes: actualSizeBytes,
          storage_path: r2ObjectKey,
          sha256_hash: serverSha256,
          uploaded_by: userId.match(/^[0-9a-fA-F-]{36}$/) ? userId : null,
          change_summary: "Initial filing deposited to Cloudflare R2 vault",
          created_at: now,
        });
      } catch (verErr) {
        console.warn("[uploadDocumentToR2] document_versions insert warning:", verErr);
      }
    } catch (dbError: any) {
      // Transactional rollback: Clean up newly uploaded R2 object
      console.error("[uploadDocumentToR2] Supabase insert failed. Rolling back R2 object:", dbError);
      try {
        await deleteR2Object(r2ObjectKey);
        console.log(`[R2 Rollback] Successfully cleaned up orphaned R2 object: ${r2ObjectKey}`);
      } catch (cleanupErr) {
        console.error(`[R2 Rollback Failed] Could not clean up ${r2ObjectKey}:`, cleanupErr);
      }
      throw new Error(
        `Database Metadata Error: Failed to save document record (${dbError?.message || "Internal database error"}). R2 upload rolled back.`,
      );
    }

    // 9. Record universal audit trail
    await recordAuditTrail({
      userId,
      action: `DOCUMENT_UPLOADED: ${safeFilename} (${docNumber}) stored in private R2 vault. Case: ${r2CaseFolder}. SHA-256: ${serverSha256}.`,
      actionCode: "DOCUMENT_UPLOADED",
      entityType: "document",
      entityId: docUuid,
      caseId: r2CaseFolder,
      metadata: {
        documentNumber: docNumber,
        r2ObjectKey,
        r2Bucket: VAULT_BUCKET_NAME,
        fileSizeBytes: actualSizeBytes,
        sha256: serverSha256,
        category: data.category,
        sensitivityTier: data.sensitivityTier,
      },
      success: true,
    });

    return {
      id: docUuid,
      document_number: docNumber,
      title: data.title.trim(),
      category: data.category,
      fir_number: data.firNumber || null,
      police_station: data.policeStation || "",
      sensitivity_tier: data.sensitivityTier,
      file_name: safeFilename,
      file_format: cleanFormat,
      file_size_bytes: actualSizeBytes,
      r2_object_key: r2ObjectKey,
      r2_bucket: VAULT_BUCKET_NAME,
      sha256: serverSha256,
      case_id: verifiedCaseId,
      case_number: verifiedCaseNumber,
      uploaded_by: userName,
      uploaded_at: now,
      status: "ACTIVE",
      metadata: metadataPayload,
    };
  });

// ============================================================================
// 2. SECURE DOWNLOAD & VIEW ENDPOINT (Cloudflare Worker -> R2 -> Stream/Bytes)
// ============================================================================

export interface GetDocumentFileInput {
  documentId: string;
  versionNumber?: number | undefined;
  action: "VIEW" | "DOWNLOAD";
}

export interface GetDocumentFileOutput {
  base64: string;
  contentType: string;
  fileName: string;
  fileSizeBytes: number;
  sha256: string;
  documentId: string;
  documentNumber: string;
  versionNumber: number;
  r2ObjectKey: string;
}

export const getDocumentFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: GetDocumentFileInput) => {
    if (!input?.documentId || !input.documentId.trim()) {
      throw new Error("Document ID is required to retrieve file.");
    }
    return input;
  })
  .handler(async ({ data, context }): Promise<GetDocumentFileOutput> => {
    const userId = context.userId;

    // 1. Fetch user roles & profile
    const [{ data: rolesData }, { data: profileData }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
      supabaseAdmin.from("profiles").select("id, full_name").eq("id", userId).maybeSingle(),
    ]);

    const userRoles = (rolesData || []).map((r) => r.role);
    const userName = profileData?.full_name || "Authorized Staff";

    // 2. Find document in Supabase case_documents
    const isUuid = Boolean(data.documentId.match(/^[0-9a-fA-F-]{36}$/));
    const { data: docRecord, error: docError } = await supabaseAdmin
      .from("case_documents")
      .select("*")
      .or(isUuid ? `id.eq.${data.documentId},document_number.eq.${data.documentId}` : `document_number.eq.${data.documentId}`)
      .maybeSingle();

    if (docError || !docRecord) {
      throw new Error(`Document "${data.documentId}" not found in legal vault registry.`);
    }

    // 3. Permission & Case Clearance Verification
    // Check if user is assigned judge for this case
    let isAssignedJudge = false;
    if (userRoles.includes("judge") && docRecord.case_id) {
      const { data: judgeProfile } = await supabaseAdmin
        .from("judges")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (judgeProfile) {
        const { data: schedule } = await supabaseAdmin
          .from("schedules")
          .select("id")
          .eq("case_id", docRecord.case_id)
          .eq("judge_id", judgeProfile.id)
          .maybeSingle();
        if (schedule) isAssignedJudge = true;
      }
    }

    const hasAccess = checkDocumentSensitivityAccess(userRoles, docRecord.sensitivity_tier, isAssignedJudge);
    if (!hasAccess) {
      // Record unauthorized inspection security alert
      await recordAuditTrail({
        userId,
        action: `UNAUTHORIZED_ACCESS_ATTEMPT: Access denied to ${docRecord.document_number} (${docRecord.sensitivity_tier}) by role [${userRoles.join(", ")}].`,
        actionCode: "UNAUTHORIZED_ACCESS_ATTEMPT",
        entityType: "document",
        entityId: docRecord.id,
        caseId: docRecord.case_id,
        metadata: {
          documentNumber: docRecord.document_number,
          sensitivityTier: docRecord.sensitivity_tier,
          attemptedBy: userName,
        },
        success: false,
      });

      throw new Error(
        `Access Denied: Your authenticated role does not possess statutory clearance to access ${docRecord.sensitivity_tier} records.`,
      );
    }

    // 4. Resolve R2 Object Key
    let objectKey = docRecord.storage_path;
    let targetFileName = docRecord.file_name;
    let targetSha256 = docRecord.latest_sha256;
    const versionNum = data.versionNumber || docRecord.current_version || 1;

    // If a specific version was requested and it's not v1, inspect document_versions
    if (data.versionNumber && data.versionNumber !== docRecord.current_version) {
      const { data: verRecord } = await supabaseAdmin
        .from("document_versions")
        .select("*")
        .eq("document_id", docRecord.id)
        .eq("version_number", data.versionNumber)
        .maybeSingle();

      if (verRecord && verRecord.storage_path) {
        objectKey = verRecord.storage_path;
        targetFileName = verRecord.file_name;
        targetSha256 = verRecord.sha256_hash;
      }
    }

    if (!objectKey) {
      throw new Error(`Document ${docRecord.document_number} does not have a valid Cloudflare R2 storage key.`);
    }

    // 5. Retrieve object bytes from Cloudflare R2
    const r2Obj = await getR2Object(objectKey);
    if (!r2Obj) {
      throw new Error(
        `Storage Error: Object "${objectKey}" could not be retrieved from Cloudflare R2 vault. It may have been archived or moved.`,
      );
    }

    const fileArrayBuffer = await r2Obj.arrayBuffer();
    const fileBytes = new Uint8Array(fileArrayBuffer);
    const base64Content = uint8ArrayToBase64(fileBytes);

    const ext = (targetFileName.split(".").pop() || "").toLowerCase();
    const contentType =
      r2Obj.httpMetadata?.contentType ||
      (ext === "pdf"
        ? "application/pdf"
        : ext === "png"
          ? "image/png"
          : ext === "jpg" || ext === "jpeg"
            ? "image/jpeg"
            : ext === "tiff" || ext === "tif"
              ? "image/tiff"
              : "application/octet-stream");

    // 6. Record audit log for Document Viewed or Downloaded
    const auditActionCode = data.action === "DOWNLOAD" ? "DOCUMENT_DOWNLOADED" : "DOCUMENT_VIEWED";
    await recordAuditTrail({
      userId,
      action: `${auditActionCode}: ${targetFileName} (v${versionNum}, ${docRecord.document_number}) ${data.action === "DOWNLOAD" ? "downloaded" : "inspected"} from private R2 vault. Case: ${docRecord.case_id || "Unassigned"}.`,
      actionCode: auditActionCode,
      entityType: "document",
      entityId: docRecord.id,
      caseId: docRecord.case_id,
      metadata: {
        documentNumber: docRecord.document_number,
        version: versionNum,
        r2ObjectKey: objectKey,
        action: data.action,
        userName,
        fileSizeBytes: fileBytes.byteLength,
        sha256: targetSha256,
      },
      success: true,
    });

    return {
      base64: base64Content,
      contentType,
      fileName: targetFileName,
      fileSizeBytes: fileBytes.byteLength,
      sha256: targetSha256,
      documentId: docRecord.id,
      documentNumber: docRecord.document_number,
      versionNumber: versionNum,
      r2ObjectKey: objectKey,
    };
  });

// ============================================================================
// 3. SECURE DOCUMENT DELETE (Cloudflare Worker -> R2 -> Supabase Metadata)
// ============================================================================

export interface DeleteDocumentInput {
  documentId: string;
  reason?: string | undefined;
}

export const deleteDocumentFromR2 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: DeleteDocumentInput) => {
    if (!input?.documentId) throw new Error("Document ID is required.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const userId = context.userId;

    // Only admin and registrar can delete documents
    const { data: rolesData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const roles = (rolesData || []).map((r) => r.role);
    if (!roles.includes("admin") && !roles.includes("registrar")) {
      throw new Error("Access Denied: Only administrators or registrars can archive or delete documents.");
    }

    const isUuid = Boolean(data.documentId.match(/^[0-9a-fA-F-]{36}$/));
    const { data: docRecord } = await supabaseAdmin
      .from("case_documents")
      .select("*")
      .or(isUuid ? `id.eq.${data.documentId},document_number.eq.${data.documentId}` : `document_number.eq.${data.documentId}`)
      .maybeSingle();

    if (!docRecord) {
      throw new Error("Document not found.");
    }

    // 1. Delete from Cloudflare R2
    if (docRecord.storage_path) {
      try {
        await deleteR2Object(docRecord.storage_path);
      } catch (err) {
        console.warn("[deleteDocumentFromR2] R2 delete warning:", err);
      }
    }

    // 2. Mark document as deleted / archived in Supabase
    const existingMeta =
      typeof docRecord.metadata === "object" &&
      docRecord.metadata !== null &&
      !Array.isArray(docRecord.metadata)
        ? (docRecord.metadata as Record<string, unknown>)
        : {};

    await supabaseAdmin
      .from("case_documents")
      .update({
        metadata: {
          ...existingMeta,
          status: "DELETED",
          deleted_at: new Date().toISOString(),
          deleted_by: userId,
          deletion_reason: data.reason || "Administrative disposal",
        },
      })
      .eq("id", docRecord.id);

    // 3. Audit trail
    await recordAuditTrail({
      userId,
      action: `DOCUMENT_DELETED: ${docRecord.file_name} (${docRecord.document_number}) archived and removed from R2 vault. Reason: ${data.reason || "Administrative disposal"}.`,
      actionCode: "DOCUMENT_DELETED",
      entityType: "document",
      entityId: docRecord.id,
      caseId: docRecord.case_id,
      metadata: {
        documentNumber: docRecord.document_number,
        r2ObjectKey: docRecord.storage_path,
        reason: data.reason,
      },
      success: true,
    });

    return { success: true, documentId: docRecord.id };
  });
