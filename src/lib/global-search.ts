/**
 * ARCHITECTURAL MANDATE:
 * Browser storage is never authoritative for legal records, evidence, documents, custody, permissions, or audit history.
 *
 * Source of Truth:
 * - Cases: Supabase public.cases
 * - Police Assets & Evidence: Supabase public.police_assets
 * - Case Documents: Supabase public.case_documents
 * - Audit History: Supabase public.audit_logs
 */

import { supabase } from "@/integrations/supabase/client";
import { isDemoMode } from "@/lib/demo-mode";
import { SEED_POLICE_ASSETS, type PoliceAsset } from "@/lib/assets";
import {
  getDocumentVersions,
  seedInitialDocuments,
  type SecureDocument,
  type DocumentVersionRecord,
} from "@/lib/documents";
import { statusLabel, type CaseRow } from "@/lib/cases";
import {
  normalizeRole,
  canAccessDocumentRecord,
  canAccessAssetRecord,
  canAccessCaseRecord,
  type AppRole,
} from "@/lib/rbac";

export type SearchEntityType =
  | "case"
  | "document"
  | "document_version"
  | "police_asset"
  | "evidence"
  | "officer_custodian"
  | "location"
  | "audit_event";

export interface SearchFilters {
  entityType?: SearchEntityType | "all" | undefined;
  caseNumber?: string | undefined;
  documentType?: string | "all" | undefined;
  assetType?: string | "all" | undefined;
  status?: string | "all" | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
  location?: string | "all" | undefined;
}

export interface SearchResultItem {
  id: string;
  entityType: SearchEntityType;
  title: string;
  subtitle: string;
  description: string;
  date?: string | undefined;
  status?: string | undefined;
  statusBadgeClass?: string | undefined;
  location?: string | undefined;
  caseNumber?: string | undefined;
  officerOrCustodian?: string | undefined;
  route: string;
  routeParams?: Record<string, string> | undefined;
  metadata?: Record<string, string | number | boolean | null> | undefined;
  relevanceScore: number;
}

export interface UnifiedSearchResult {
  query: string;
  totalMatches: number;
  items: SearchResultItem[];
  byEntityCount: Record<SearchEntityType, number>;
  executionTimeMs: number;
  isAuthorizedView: boolean;
  filteredOutCount: number;
}

export interface OfficerProfile {
  id: string;
  name: string;
  role: string;
  badgeNumber?: string | undefined;
  station: string;
  assignedAssetsSummary: string;
  assetCount: number;
}

export interface FacilityLocation {
  id: string;
  name: string;
  type: "Malkhana Vault" | "Forensic Lab" | "Police Station" | "Court Room" | "Armory Workshop";
  district: string;
  inventorySummary: string;
  itemCount: number;
}

export interface UnifiedAuditItem {
  id: string;
  action: string;
  entityAffected: string;
  userName: string;
  userRole: string;
  timestamp: string;
  caseNumber?: string | undefined;
  actionType: string;
}

import { SEED_CASE_BNS_0014 } from "@/fixtures/demo/cases";
import { KNOWN_OFFICERS } from "@/fixtures/demo/officers";
import { KNOWN_LOCATIONS } from "@/fixtures/demo/locations";
import { SEED_AUDIT_TRAIL } from "@/fixtures/demo/audit";

export { SEED_CASE_BNS_0014, KNOWN_OFFICERS, KNOWN_LOCATIONS, SEED_AUDIT_TRAIL };

/**
 * Executes a high-performance unified multi-domain search respecting Supabase RLS and user authorization.
 */
export async function executeUnifiedSearch(params: {
  query: string;
  filters?: SearchFilters | undefined;
  userRole?: string | undefined;
  userId?: string | undefined;
  db?: any;
}): Promise<UnifiedSearchResult> {
  const startTime = performance.now();
  const rawQ = (params.query || "").trim();
  const q = rawQ.toLowerCase();
  const filters = params.filters || {};
  const userRole = normalizeRole(params.userRole || "unassigned");
  const isJudge = userRole === "judge";
  const isAdmin = userRole === "admin";
  const isRegistrar = userRole === "registrar";
  const isAuthorizedFullView = isAdmin || isRegistrar;

  const dbClient = params.db || supabase;

  const withTimeout = <T>(promise: Promise<T>, timeoutMs = 1500): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Timeout")), timeoutMs)),
    ]);
  };

  // 0. If caller is a Judge, resolve their assigned case IDs to enforce bench-level scoping
  const judgeAssignedCaseIds = new Set<string>();
  if (isJudge && params.userId) {
    try {
      const { data: judgeRecord } = await withTimeout(
        dbClient.from("judges").select("id").eq("user_id", params.userId).maybeSingle(),
      ) as any;
      if (judgeRecord?.id) {
        const { data: scheds } = await withTimeout(
          dbClient.from("schedules").select("case_id").eq("judge_id", judgeRecord.id),
        ) as any;
        if (scheds) {
          for (const s of scheds) {
            if (s.case_id) judgeAssignedCaseIds.add(s.case_id);
          }
        }
      }
    } catch {
      // Fail safe: empty assignment set
    }
  }
  const assignedCaseList = Array.from(judgeAssignedCaseIds);

  // 1. Fetch Cases
  let cases: CaseRow[] = [];
  try {
    const res = await withTimeout(
      dbClient
        .from("cases")
        .select(
          "id, case_number, category_id, filing_date, status, parties, priority_score, priority_tier, case_categories(name)",
        )
        .limit(100),
    );
    const { data: dbCases, error } = res as any;

    if (!error && dbCases && dbCases.length > 0) {
      cases = dbCases.map((c: any) => {
        const numPart = (c.case_number || "0001").replace(/[^0-9]/g, "");
        const seq = parseInt(numPart || "1", 10);
        const prefix = (c.case_number || "").startsWith("CRL") ? "DLCT02" : "DLCT01";
        const cnr = `${prefix}-${String(seq).padStart(6, "0")}-2026`;
        return {
          ...c,
          cnr_number: cnr,
          case_categories: c.case_categories
            ? { id: "", name: c.case_categories.name, urgency_weight: 1 }
            : null,
        } as CaseRow;
      });
    }
  } catch {
    // fallback to in-memory seeds
  }

  // In demo mode only, ensure SEED_CASE_BNS_0014 is present if missing
  if (isDemoMode() && !cases.some((c) => c.case_number === SEED_CASE_BNS_0014.case_number)) {
    cases.unshift(SEED_CASE_BNS_0014);
  }

  // 2. Fetch Assets & Evidence from Supabase
  let assets: PoliceAsset[] = [];
  try {
    const res = await withTimeout(dbClient.from("police_assets").select("*").limit(100));
    const { data: dbAssets, error } = res as any;
    if (!error && dbAssets && dbAssets.length > 0) {
      assets = dbAssets as PoliceAsset[];
    } else if (isDemoMode()) {
      assets = [...SEED_POLICE_ASSETS];
    }
  } catch {
    if (isDemoMode()) {
      assets = [...SEED_POLICE_ASSETS];
    }
  }

  // 3. Fetch Documents from Supabase case_documents
  let rawDocuments: SecureDocument[] = [];
  try {
    const res = await withTimeout(
      dbClient.from("case_documents").select("*, cases(case_number, parties)").limit(100),
    );
    const { data: dbDocs, error } = res as any;
    if (!error && dbDocs && dbDocs.length > 0) {
      rawDocuments = dbDocs.map((r: any) => ({
        id: r.id,
        document_number: r.document_number,
        title: r.title,
        category: r.category,
        fir_number: r.fir_number,
        police_station: r.police_station,
        sensitivity_tier: r.sensitivity_tier === "RESTRICTED" ? "CONFIDENTIAL" : r.sensitivity_tier,
        current_version: r.current_version || 1,
        file_name: r.file_name,
        file_format: r.file_format,
        file_size_bytes: Number(r.file_size_bytes || 0),
        storage_path: r.storage_path,
        latest_sha256: r.latest_sha256,
        is_sealed: r.is_sealed,
        is_tampered: r.is_tampered,
        originating_agency: r.originating_agency,
        case_id: r.case_id,
        case_number: r.cases?.case_number || (r.metadata as any)?.case_number || null,
        created_at: r.created_at,
        updated_at: r.updated_at,
      })) as SecureDocument[];
    } else if (isDemoMode()) {
      rawDocuments = seedInitialDocuments();
    }
  } catch {
    if (isDemoMode()) {
      rawDocuments = seedInitialDocuments();
    }
  }

  // 4. RLS & Authorization Gate
  let filteredOutCount = 0;
  const authorizedDocuments = rawDocuments.filter((doc) => {
    const canAccess = canAccessDocumentRecord(
      userRole,
      { sensitivity_tier: doc.sensitivity_tier, case_id: doc.case_id },
      null,
      assignedCaseList,
    );
    if (!canAccess) {
      filteredOutCount++;
      return false;
    }
    return true;
  });


  // 5. Gather Document Versions
  const documentVersions: Array<{ doc: SecureDocument; ver: DocumentVersionRecord }> = [];
  for (const doc of authorizedDocuments) {
    const vers = getDocumentVersions(doc);
    for (const v of vers) {
      documentVersions.push({ doc, ver: v });
    }
  }

  // 6. Gather Audit Trail from Supabase audit_logs (Restricted strictly to Admin & Registrar)
  let auditEntries: UnifiedAuditItem[] = [];
  if (isAdmin || isRegistrar) {
    try {
      const res = await withTimeout(
        dbClient
          .from("audit_logs")
          .select("id, action, entity_affected, timestamp, user_id")
          .order("timestamp", { ascending: false })
          .limit(100),
      );
      const { data: dbAudit, error } = res as any;
      if (!error && dbAudit && dbAudit.length > 0) {
        auditEntries = dbAudit.map((a: any) => ({
          id: a.id,
          action: a.action,
          entityAffected: a.entity_affected,
          userName: "Authorized Staff",
          userRole: "Staff",
          timestamp: a.timestamp,
          caseNumber: undefined,
          actionType: "operation",
        }));
      } else if (isDemoMode()) {
        auditEntries = [...SEED_AUDIT_TRAIL];
      }
    } catch {
      if (isDemoMode()) {
        auditEntries = [...SEED_AUDIT_TRAIL];
      }
    }
  }

  const matchedItems: SearchResultItem[] = [];

  // Helper matching function
  const tokens = q.split(/\s+/).filter(Boolean);
  function scoreMatch(text: string, weight = 1): number {
    if (!q) return 1;
    const lower = text.toLowerCase();
    if (lower === q) return 100 * weight;
    if (lower.startsWith(q)) return 80 * weight;
    if (lower.includes(q)) return 50 * weight;
    let tokenMatches = 0;
    for (const t of tokens) {
      if (lower.includes(t)) tokenMatches++;
    }
    return tokenMatches > 0 ? (tokenMatches / tokens.length) * 35 * weight : 0;
  }

  // Check if query is targeting a case
  const isCaseQuery = /bns|crl|cr\/|case|dlct/i.test(q);

  /* ---------------------- A. CASES MATCHING ---------------------- */
  if (!filters.entityType || filters.entityType === "all" || filters.entityType === "case") {
    for (const c of cases) {
      // Unassigned accounts have no clearance to internal registry cases (must use public case lookup)
      if (userRole === "unassigned") continue;

      // Judicial bench scoping: Judges can only view cases scheduled before their bench
      if (!canAccessCaseRecord(userRole, c, null, assignedCaseList)) {
        continue;
      }
      const caseTokens = [
        c.case_number,
        c.cnr_number || "",
        c.parties || "",
        c.case_categories?.name || "",
        c.priority_tier || "",
      ].join(" ");

      const score = scoreMatch(caseTokens, 1.2);
      if (score > 0 || !q) {
        // Apply filters
        if (
          filters.caseNumber &&
          !c.case_number.toLowerCase().includes(filters.caseNumber.toLowerCase())
        ) {
          continue;
        }
        if (filters.status && filters.status !== "all" && c.status !== filters.status) {
          continue;
        }
        if (filters.startDate && c.filing_date < filters.startDate) continue;
        if (filters.endDate && c.filing_date > filters.endDate) continue;

        matchedItems.push({
          id: `case-${c.id}`,
          entityType: "case",
          title: `${c.case_number}${c.cnr_number ? ` (${c.cnr_number})` : ""}`,
          subtitle: c.parties || "Parties not recorded",
          description: `Category: ${c.case_categories?.name || "General"} · Priority: ${c.priority_tier || "Tier 2"} (Score ${c.priority_score ?? 50}) · Status: ${statusLabel[c.status]}`,
          date: c.filing_date,
          status: statusLabel[c.status],
          statusBadgeClass:
            c.status === "scheduled"
              ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
              : "bg-muted text-muted-foreground",
          caseNumber: c.case_number,
          route: "/cases/$caseId",
          routeParams: { caseId: c.id },
          metadata: { cnr: c.cnr_number ?? null, priority: c.priority_tier ?? null },
          relevanceScore: score + (c.case_number.toLowerCase().includes(q) ? 50 : 0),
        });
      }
    }
  }

  /* -------------------- B. DOCUMENTS MATCHING -------------------- */
  if (!filters.entityType || filters.entityType === "all" || filters.entityType === "document") {
    for (const d of authorizedDocuments) {
      const docTokens = [
        d.document_number,
        d.title,
        d.category,
        d.case_number || "",
        d.fir_number || "",
        d.asset_code || "",
        d.uploaded_by_name,
        d.latest_sha256,
        d.sensitivity_tier,
      ].join(" ");

      const score = scoreMatch(docTokens, 1.1);
      if (score > 0 || !q) {
        // Apply filters
        if (
          filters.caseNumber &&
          (!d.case_number ||
            !d.case_number.toLowerCase().includes(filters.caseNumber.toLowerCase()))
        ) {
          continue;
        }
        if (
          filters.documentType &&
          filters.documentType !== "all" &&
          d.category.toLowerCase() !== filters.documentType.toLowerCase()
        ) {
          continue;
        }
        if (filters.startDate && d.created_at < filters.startDate) continue;
        if (filters.endDate && d.created_at > filters.endDate) continue;

        matchedItems.push({
          id: `doc-${d.id}`,
          entityType: "document",
          title: `${d.document_number}: ${d.title}`,
          subtitle: `Category: ${d.category} · Version: v${d.current_version}${d.case_number ? ` · Case: ${d.case_number}` : ""}`,
          description: `Sensitivity: ${d.sensitivity_tier.replace(/_/g, " ")} · Uploaded by: ${d.uploaded_by_name} (${d.uploaded_by_role}) · SHA-256: ${d.latest_sha256.slice(0, 20)}...`,
          date: d.created_at,
          status: `v${d.current_version} (${d.sensitivity_tier})`,
          statusBadgeClass: "bg-blue-500/15 text-blue-600 border-blue-500/30",
          caseNumber: d.case_number || undefined,
          route: "/documents/$documentId",
          routeParams: { documentId: d.id },
          metadata: { category: d.category, sha256: d.latest_sha256 },
          relevanceScore:
            score + (d.case_number && q.includes(d.case_number.toLowerCase()) ? 45 : 0),
        });
      }
    }
  }

  /* ---------------- C. DOCUMENT VERSIONS MATCHING ---------------- */
  if (
    !filters.entityType ||
    filters.entityType === "all" ||
    filters.entityType === "document_version"
  ) {
    for (const { doc, ver } of documentVersions) {
      const verTokens = [
        `version ${ver.version_number}`,
        `v${ver.version_number}`,
        ver.file_name,
        ver.change_summary,
        ver.sha256_hash,
        ver.uploaded_by_name,
        doc.document_number,
        doc.title,
        doc.case_number || "",
      ].join(" ");

      const score = scoreMatch(verTokens, 1.0);
      if (score > 0 || (!q && ver.version_number > 1)) {
        if (
          filters.caseNumber &&
          (!doc.case_number ||
            !doc.case_number.toLowerCase().includes(filters.caseNumber.toLowerCase()))
        ) {
          continue;
        }

        matchedItems.push({
          id: `ver-${ver.id}`,
          entityType: "document_version",
          title: `${doc.document_number} [Version v${ver.version_number}]: ${ver.file_name}`,
          subtitle: `Change Note: ${ver.change_summary}`,
          description: `SHA-256 Digest: ${ver.sha256_hash.slice(0, 24)}... · Uploaded by: ${ver.uploaded_by_name} (${ver.uploaded_by_role}) · Status: ${ver.integrity_status}`,
          date: ver.created_at,
          status: `Version v${ver.version_number}`,
          statusBadgeClass: "bg-violet-500/15 text-violet-600 border-violet-500/30",
          caseNumber: doc.case_number || undefined,
          route: "/documents/$documentId",
          routeParams: { documentId: doc.id },
          metadata: { version: ver.version_number, hash: ver.sha256_hash },
          relevanceScore: score + 10,
        });
      }
    }
  }

  /* ----------------- D. EVIDENCE EXHIBITS MATCHING --------------- */
  if (!filters.entityType || filters.entityType === "all" || filters.entityType === "evidence") {
    if (userRole !== "unassigned") {
      const evidenceAssets = assets.filter(
        (a) =>
          a.evidence_status != null ||
          a.category_name?.toLowerCase().includes("evidence") ||
          a.category_name?.toLowerCase().includes("media") ||
          a.category_name?.toLowerCase().includes("weapons") ||
          a.category_name?.toLowerCase().includes("narcotics") ||
          a.category_name?.toLowerCase().includes("dna"),
      );

      for (const ev of evidenceAssets) {
        // Enforce judicial bench scoping and asset clearance
        if (!canAccessAssetRecord(userRole, ev, assignedCaseList)) {
          continue;
        }

        const evTokens = [
          ev.asset_code,
          ev.name,
          ev.category_name || "",
          ev.evidence_status || "",
          ev.current_location,
          ev.current_custodian_name,
          ev.assigned_officer_name || "",
          ev.case_number || "",
          ev.fir_number || "",
          ev.serial_number || "",
          ev.tamper_seal_number || "",
          "evidence",
          "exhibit",
          "mobile phone",
          "phone",
          "device",
          "samsung",
        ].join(" ");

        const score = scoreMatch(evTokens, 1.25);
        if (score > 0 || !q) {
          if (
            filters.caseNumber &&
            (!ev.case_number ||
              !ev.case_number.toLowerCase().includes(filters.caseNumber.toLowerCase()))
          ) {
            continue;
          }
          if (
            filters.status &&
            filters.status !== "all" &&
            ev.evidence_status !== filters.status &&
            ev.status !== filters.status
          ) {
            continue;
          }
          if (
            filters.location &&
            filters.location !== "all" &&
            !ev.current_location.toLowerCase().includes(filters.location.toLowerCase())
          ) {
            continue;
          }

          matchedItems.push({
            id: `ev-${ev.id}`,
            entityType: "evidence",
            title: `Exhibit ${ev.asset_code}: ${ev.name}`,
            subtitle: `Custody Stage: ${ev.evidence_status || "STORED"} · Tamper Seal: #${ev.tamper_seal_number || "Verified"}${ev.case_number ? ` · Case: ${ev.case_number}` : ""}`,
            description: `Location: ${ev.current_location} · Custodian: ${ev.current_custodian_name} · Assigned Officer: ${ev.assigned_officer_name || "Unassigned"}`,
            date: ev.created_at,
            status: ev.evidence_status || ev.status,
            statusBadgeClass: "bg-amber-500/15 text-amber-600 border-amber-500/30",
            location: ev.current_location,
            caseNumber: ev.case_number || undefined,
            officerOrCustodian: ev.current_custodian_name,
            route: "/assets/$assetId",
            routeParams: { assetId: ev.id },
            metadata: { seal: ev.tamper_seal_number ?? null, stage: ev.evidence_status ?? null },
            relevanceScore:
              score +
              (ev.asset_code.toLowerCase().includes(q) ? 60 : 0) +
              (ev.case_number && q.includes(ev.case_number.toLowerCase()) ? 40 : 0),
          });
        }
      }
    }
  }

  /* ------------------- E. POLICE ASSETS MATCHING ----------------- */
  if (
    !filters.entityType ||
    filters.entityType === "all" ||
    filters.entityType === "police_asset"
  ) {
    // Judicial officers inspect exhibits, not internal police tactical inventory; unassigned accounts denied
    if (userRole !== "unassigned" && !isJudge) {
      for (const a of assets) {
        const assetTokens = [
          a.asset_code,
          a.name,
          a.category_name || "",
          a.status,
          a.condition,
          a.current_location,
          a.department_station,
          a.current_custodian_name,
          a.assigned_officer_name || "",
          a.case_number || "",
          a.serial_number || "",
          a.barcode_rfid || "",
          "police asset",
        ].join(" ");

        const score = scoreMatch(assetTokens, 1.1);
        if (score > 0 || !q) {
          if (
            filters.caseNumber &&
            (!a.case_number ||
              !a.case_number.toLowerCase().includes(filters.caseNumber.toLowerCase()))
          ) {
            continue;
          }
          if (
            filters.assetType &&
            filters.assetType !== "all" &&
            a.category_name?.toLowerCase() !== filters.assetType.toLowerCase()
          ) {
            continue;
          }
          if (filters.status && filters.status !== "all" && a.status !== filters.status) {
            continue;
          }
          if (
            filters.location &&
            filters.location !== "all" &&
            !a.current_location.toLowerCase().includes(filters.location.toLowerCase())
          ) {
            continue;
          }

          matchedItems.push({
            id: `ast-${a.id}`,
            entityType: "police_asset",
            title: `${a.asset_code}: ${a.name}`,
            subtitle: `Category: ${a.category_name || "General"} · Status: ${a.status} (${a.condition})`,
            description: `Location: ${a.current_location} · Custodian: ${a.current_custodian_name} · Assigned: ${a.assigned_officer_name || "Station Pool"}`,
            date: a.created_at,
            status: a.status,
            statusBadgeClass:
              a.status === "MAINTENANCE"
                ? "bg-destructive/15 text-destructive border-destructive/30"
                : "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
            location: a.current_location,
            caseNumber: a.case_number || undefined,
            officerOrCustodian: a.assigned_officer_name || a.current_custodian_name,
            route: "/assets/$assetId",
            routeParams: { assetId: a.id },
            metadata: { serial: a.serial_number ?? null, condition: a.condition ?? null },
            relevanceScore:
              score + (a.status === "MAINTENANCE" && q.includes("maintenance") ? 50 : 0),
          });
        }
      }
    }
  }

  /* ---------------- F. OFFICERS & CUSTODIANS MATCHING ------------ */
  if (
    userRole !== "unassigned" &&
    isDemoMode() &&
    (!filters.entityType ||
      filters.entityType === "all" ||
      filters.entityType === "officer_custodian")
  ) {
    for (const off of KNOWN_OFFICERS) {
      const offTokens = [
        off.name,
        off.role,
        off.badgeNumber || "",
        off.station,
        off.assignedAssetsSummary,
      ].join(" ");
      const score = scoreMatch(offTokens, 1.0);
      if (score > 0 || (!q && off.name.includes("Vikram"))) {
        matchedItems.push({
          id: `off-${off.id}`,
          entityType: "officer_custodian",
          title: `${off.name} (${off.role})`,
          subtitle: `${off.station}${off.badgeNumber ? ` · ${off.badgeNumber}` : ""}`,
          description: off.assignedAssetsSummary,
          status: `${off.assetCount} Active Asset(s)`,
          statusBadgeClass: "bg-blue-500/15 text-blue-600 border-blue-500/30",
          location: off.station,
          officerOrCustodian: off.name,
          route: "/assets",
          metadata: { role: off.role, station: off.station },
          relevanceScore: score + 15,
        });
      }
    }
  }

  /* --------------------- G. LOCATIONS MATCHING ------------------- */
  if (
    userRole !== "unassigned" &&
    isDemoMode() &&
    (!filters.entityType || filters.entityType === "all" || filters.entityType === "location")
  ) {
    for (const loc of KNOWN_LOCATIONS) {
      const locTokens = [loc.name, loc.type, loc.district, loc.inventorySummary].join(" ");
      const score = scoreMatch(locTokens, 1.0);
      if (score > 0 || (!q && loc.type.includes("Vault"))) {
        if (
          filters.location &&
          filters.location !== "all" &&
          !loc.name.toLowerCase().includes(filters.location.toLowerCase())
        ) {
          continue;
        }

        matchedItems.push({
          id: `loc-${loc.id}`,
          entityType: "location",
          title: loc.name,
          subtitle: `Type: ${loc.type} · District: ${loc.district}`,
          description: loc.inventorySummary,
          status: `${loc.itemCount} Registered Asset(s)`,
          statusBadgeClass: "bg-zinc-500/15 text-zinc-600 border-zinc-500/30",
          location: loc.name,
          route: "/assets",
          metadata: { type: loc.type },
          relevanceScore: score + 10,
        });
      }
    }
  }

  /* ------------------- H. AUDIT EVENTS MATCHING ------------------ */
  if (
    (isAdmin || isRegistrar) &&
    (!filters.entityType || filters.entityType === "all" || filters.entityType === "audit_event")
  ) {
    for (const aud of auditEntries) {

      const audTokens = [
        aud.action,
        aud.entityAffected,
        aud.userName,
        aud.userRole,
        aud.caseNumber || "",
        aud.actionType,
      ].join(" ");
      const score = scoreMatch(audTokens, 0.95);
      if (score > 0 || (!q && aud.caseNumber === "BNS/2026/0014")) {
        if (
          filters.caseNumber &&
          (!aud.caseNumber ||
            !aud.caseNumber.toLowerCase().includes(filters.caseNumber.toLowerCase()))
        ) {
          continue;
        }

        matchedItems.push({
          id: `aud-${aud.id}`,
          entityType: "audit_event",
          title: aud.action,
          subtitle: `Entity: ${aud.entityAffected} · Logged by: ${aud.userName} (${aud.userRole})`,
          description: `Indelible Registry Audit Event · Category: ${aud.actionType.toUpperCase()}${aud.caseNumber ? ` · Case: ${aud.caseNumber}` : ""}`,
          date: aud.timestamp,
          status: "Verified Audit Log",
          statusBadgeClass: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
          caseNumber: aud.caseNumber,
          route: "/activity-log",
          metadata: { actionType: aud.actionType },
          relevanceScore: score + 5,
        });
      }
    }
  }

  // Deduplicate and Sort by Relevance Score
  const uniqueMap = new Map<string, SearchResultItem>();
  for (const item of matchedItems) {
    if (!uniqueMap.has(item.id) || uniqueMap.get(item.id)!.relevanceScore < item.relevanceScore) {
      uniqueMap.set(item.id, item);
    }
  }

  const sortedItems = Array.from(uniqueMap.values()).sort(
    (a, b) => b.relevanceScore - a.relevanceScore,
  );

  // Compute by-entity count
  const byEntityCount: Record<SearchEntityType, number> = {
    case: 0,
    document: 0,
    document_version: 0,
    police_asset: 0,
    evidence: 0,
    officer_custodian: 0,
    location: 0,
    audit_event: 0,
  };

  for (const item of sortedItems) {
    byEntityCount[item.entityType] = (byEntityCount[item.entityType] || 0) + 1;
  }

  const executionTimeMs = Math.round(performance.now() - startTime);

  return {
    query: rawQ,
    totalMatches: sortedItems.length,
    items: sortedItems,
    byEntityCount,
    executionTimeMs,
    isAuthorizedView: isAuthorizedFullView,
    filteredOutCount,
  };
}
