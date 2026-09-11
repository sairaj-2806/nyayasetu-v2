/**
 * ARCHITECTURAL MANDATE:
 * Browser storage is never authoritative for legal records, evidence, documents, custody, permissions, or audit history.
 *
 * Source of Truth:
 * - Authoritative Audit Trail: Supabase public.audit_logs
 */

import { supabase } from "@/integrations/supabase/client";
import { isDemoMode } from "@/lib/demo-mode";

/**
 * ============================================================================
 * NyayaSetu Unified Audit & Compliance Trail Engine
 * ============================================================================
 * Extends the platform audit trail to provide immutable accountability across:
 * - Judicial Cases & Cause-list Scheduling decisions
 * - Secure Document Management System (DMS) & Cryptographic Verifications
 * - Police Armory & Fleet Asset Lifecycle
 * - Malkhana Evidence Chain of Custody & BSA Section 63 Digital Proofs
 * - Security & Integrity Alerts (tamper mismatch, unauthorized attempts)
 *
 * Every significant operation records:
 * actor/user, timestamp, action, entity type, entity ID, case ID, previous state,
 * new state, and rich cryptographic metadata.
 */

// ============================================================================
// 1. CANONICAL AUDIT DOMAINS & ACTION CODES
// ============================================================================

export type AuditDomain =
  | "case"
  | "document"
  | "asset"
  | "evidence"
  | "security"
  | "user"
  | "schedule"
  | "recommendation"
  | "availability"
  | "simulation"
  | "registry"
  | "settings"
  | "other";

export type AuditActionType =
  | "case"
  | "schedule"
  | "recommendation"
  | "availability"
  | "simulation"
  | "registry"
  | "settings"
  | "document"
  | "asset"
  | "evidence"
  | "security"
  | "other";

// 7 Required Document Events
export type DocumentAuditEvent =
  | "UPLOADED"
  | "VIEWED"
  | "DOWNLOADED"
  | "VERSION_CREATED"
  | "SIGNED"
  | "INTEGRITY_VERIFIED"
  | "INTEGRITY_MISMATCH";

// 10 Required Police Asset Events
export type AssetAuditEvent =
  | "CREATED"
  | "ASSIGNED"
  | "UNASSIGNED"
  | "TRANSFERRED"
  | "RECEIVED"
  | "MAINTENANCE_STARTED"
  | "MAINTENANCE_COMPLETED"
  | "RETURNED"
  | "RETIRED"
  | "MARKED_LOST";

// 10 Required Evidence Events
export type EvidenceAuditEvent =
  | "SEIZED"
  | "REGISTERED"
  | "SEALED"
  | "STORED"
  | "TRANSFERRED"
  | "RECEIVED"
  | "FORENSIC_STARTED"
  | "FORENSIC_COMPLETED"
  | "COURT_SUBMITTED"
  | "DISPOSED";

export type CanonicalAuditEventCode =
  | DocumentAuditEvent
  | AssetAuditEvent
  | EvidenceAuditEvent
  | "SCHEDULED"
  | "LISTED"
  | "REASSIGNED"
  | "SIMULATION_APPLIED"
  | "AVAILABILITY_CHANGED"
  | "SETTINGS_UPDATED"
  | "ACCOUNT_CREATED"
  | "ACCOUNT_ROLE_CHANGED"
  | "UNAUTHORIZED_ACCESS_ATTEMPT";

// ============================================================================
// 2. DATA STRUCTURES & ROW SCHEMAS
// ============================================================================

export type AuditLogRow = {
  id: string;
  user_id: string | null;
  action: string;
  entity_affected: string;
  timestamp: string;
};

export interface DetailedAuditPayload {
  action: string;
  actionCode?: string | CanonicalAuditEventCode;
  entityType:
    | "case"
    | "document"
    | "asset"
    | "evidence"
    | "security"
    | "user"
    | "schedule"
    | "registry"
    | "settings"
    | "other";
  entityId: string;
  caseId?: string | null;
  previousState?: string | null;
  newState?: string | null;
  metadata?: Record<string, unknown>;
  userId?: string;
  userName?: string;
  userRole?: string;
  isSecurityAlert?: boolean;
}

export type AuditLogEntry = AuditLogRow & {
  userName: string;
  userRole: string;
  domain: AuditDomain;
  actionType: AuditActionType;
  actionCode: string;
  entityType: string;
  entityId: string;
  caseId?: string | null;
  previousState?: string | null;
  newState?: string | null;
  metadata?: Record<string, unknown>;
  entityLabel: string;
  isSecurityAlert?: boolean;
};

export const AUDIT_DOMAINS: { value: AuditDomain; label: string; description: string }[] = [
  {
    value: "case",
    label: "Cases & Registry",
    description: "Case registration, stage progression, CNR lookup",
  },
  {
    value: "document",
    label: "Secure DMS",
    description: "Uploads, version creation, digital signatures, hash audits",
  },
  {
    value: "asset",
    label: "Police Assets",
    description: "Armory weapons, police vehicles, ballistic body gear lifecycle",
  },
  {
    value: "evidence",
    label: "Evidence & Custody",
    description: "BSA-2023 panchnama seizures, malkhana, FSL, and court exhibits",
  },
  {
    value: "security",
    label: "Security & Integrity Alerts",
    description: "Integrity mismatches, broken seals, unauthorized access flags",
  },
  {
    value: "user",
    label: "User Management",
    description: "Account creation, role elevation, password modifications",
  },
  {
    value: "schedule",
    label: "Cause Lists & Scheduling",
    description: "Automated listings, judge room allocations, adjournments",
  },
  {
    value: "recommendation",
    label: "Smart Recommendations",
    description: "Listing recommendations approved or modified by registrar",
  },
  {
    value: "simulation",
    label: "What-If Simulations",
    description: "Backlog stress-testing and courtroom capacity simulations",
  },
  {
    value: "availability",
    label: "Judge Availability",
    description: "Bench leaves, courtroom maintenance reservations",
  },
  {
    value: "settings",
    label: "Priority Settings",
    description: "System priority weightings and institutional rules",
  },
  {
    value: "other",
    label: "Other Operations",
    description: "System level and miscellaneous audit records",
  },
];

export const AUDIT_ACTION_TYPES: { value: AuditActionType; label: string }[] = [
  { value: "case", label: "Case record" },
  { value: "document", label: "Document Management" },
  { value: "asset", label: "Police Asset" },
  { value: "evidence", label: "Evidence Custody" },
  { value: "security", label: "Security & Integrity" },
  { value: "schedule", label: "Schedule created / modified" },
  { value: "recommendation", label: "Scheduling recommendation decision" },
  { value: "availability", label: "Availability change" },
  { value: "simulation", label: "What-If Simulation applied" },
  { value: "registry", label: "Judge / courtroom registry" },
  { value: "settings", label: "Priority Score settings" },
  { value: "other", label: "Other" },
];

export const auditActionLabel: Record<AuditActionType, string> = Object.fromEntries(
  AUDIT_ACTION_TYPES.map((t) => [t.value, t.label]),
) as Record<AuditActionType, string>;

// ============================================================================
// 3. PARSING & CLASSIFICATION ENGINE
// ============================================================================

interface StructuredEntityPayload {
  entity_type?: string;
  entity_id?: string;
  case_id?: string | null;
  previous_state?: string | null;
  new_state?: string | null;
  action_code?: string;
  metadata?: Record<string, unknown>;
  is_security_alert?: boolean;
}

/**
 * Parses either JSON-encoded entity payload or tokenized strings like:
 * "case_document:DOC-2026-0014" or "police_asset:AST-001" or "case:CASE-2026-0001 schedule:xyz"
 */
export function parseEntityAffected(raw: string): {
  entityType: string;
  entityId: string;
  caseId: string | null;
  previousState: string | null;
  newState: string | null;
  metadata: Record<string, unknown>;
  isSecurityAlert: boolean;
  actionCode?: string | undefined;
} {
  const trimmed = (raw || "").trim();
  if (!trimmed) {
    return {
      entityType: "other",
      entityId: "—",
      caseId: null,
      previousState: null,
      newState: null,
      metadata: {},
      isSecurityAlert: false,
    };
  }

  // Case 1: JSON payload
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed) as StructuredEntityPayload;
      return {
        entityType: parsed.entity_type || "other",
        entityId: parsed.entity_id || "—",
        caseId: parsed.case_id || null,
        previousState: parsed.previous_state || null,
        newState: parsed.new_state || null,
        metadata: parsed.metadata || {},
        isSecurityAlert: !!parsed.is_security_alert,
        actionCode: parsed.action_code,
      };
    } catch {
      // Fall through to regex/token parser
    }
  }

  // Case 2: Token string parsing
  let entityType = "other";
  let entityId = "—";
  let caseId: string | null = null;
  let previousState: string | null = null;
  let newState: string | null = null;
  let isSecurityAlert = false;
  const metadata: Record<string, unknown> = {};

  const tokens = trimmed.split(/\s+(?=[a-z_]+:)/i);
  for (const token of tokens) {
    const [key = "", ...valParts] = token.split(":");
    const val = valParts.join(":").trim();
    const k = key.toLowerCase();

    if (k === "case_document" || k === "document") {
      entityType = "document";
      entityId = val;
    } else if (k === "police_asset" || k === "asset") {
      entityType = "asset";
      entityId = val;
    } else if (k === "evidence" || k === "malkhana") {
      entityType = "evidence";
      entityId = val;
    } else if (k === "case") {
      entityType = "case";
      entityId = val;
      caseId = val;
    } else if (k === "case_id" || k === "case_number") {
      caseId = val;
    } else if (k === "prev" || k === "previous_state") {
      previousState = val;
    } else if (k === "new" || k === "new_state") {
      newState = val;
    } else if (k === "security_alert") {
      entityType = "security";
      entityId = val;
      isSecurityAlert = true;
    } else if (k === "user" || k === "user_accounts") {
      entityType = "user";
      entityId = val || "user_accounts";
    } else if (k === "schedule") {
      entityType = "schedule";
      entityId = val;
    } else if (k === "judge" || k === "courtroom") {
      entityType = "registry";
      entityId = val;
    } else if (k === "settings") {
      entityType = "settings";
      entityId = val;
    } else {
      metadata[k] = val;
    }
  }

  if (entityId === "—" && tokens.length > 0 && tokens[0]) {
    entityId = tokens[0];
  }

  return { entityType, entityId, caseId, previousState, newState, metadata, isSecurityAlert };
}

/**
 * Derives a fine-grained action code and domain from the recorded text.
 */
export function extractActionDetails(
  action: string,
  entityType: string,
): {
  domain: AuditDomain;
  actionType: AuditActionType;
  actionCode: string;
  isSecurityAlert: boolean;
} {
  const upper = action.toUpperCase();
  const lower = action.toLowerCase();

  let domain: AuditDomain = "other";
  let actionCode = "OPERATION";
  let isSecurity = false;

  // 1. Security Alert Detection
  if (
    upper.includes("INTEGRITY_MISMATCH") ||
    upper.includes("TAMPER_SEAL_COMPROMISED") ||
    upper.includes("UNAUTHORIZED") ||
    upper.includes("SECURITY ALERT") ||
    upper.includes("MARKED_LOST") ||
    upper.includes("TAMPERED")
  ) {
    isSecurity = true;
  }

  // 2. Exact Canonical Code Detection
  const canonicalCodes = [
    "UPLOADED",
    "VIEWED",
    "DOWNLOADED",
    "VERSION_CREATED",
    "SIGNED",
    "INTEGRITY_VERIFIED",
    "INTEGRITY_MISMATCH",
    "CREATED",
    "ASSIGNED",
    "UNASSIGNED",
    "TRANSFERRED",
    "RECEIVED",
    "MAINTENANCE_STARTED",
    "MAINTENANCE_COMPLETED",
    "RETURNED",
    "RETIRED",
    "MARKED_LOST",
    "SEIZED",
    "REGISTERED",
    "SEALED",
    "STORED",
    "FORENSIC_STARTED",
    "FORENSIC_COMPLETED",
    "COURT_SUBMITTED",
    "DISPOSED",
  ];

  for (const code of canonicalCodes) {
    if (upper.includes(code)) {
      actionCode = code;
      break;
    }
  }

  // 3. Domain determination
  if (isSecurity || entityType === "security" || upper.includes("INTEGRITY_MISMATCH")) {
    domain = "security";
  } else if (
    entityType === "evidence" ||
    upper.includes("EVIDENCE") ||
    upper.includes("MALKHANA") ||
    upper.includes("PANCHNAMA") ||
    [
      "SEIZED",
      "SEALED",
      "FORENSIC_STARTED",
      "FORENSIC_COMPLETED",
      "COURT_SUBMITTED",
      "DISPOSED",
    ].includes(actionCode)
  ) {
    domain = "evidence";
  } else if (
    entityType === "document" ||
    upper.includes("DOCUMENT") ||
    [
      "UPLOADED",
      "VERSION_CREATED",
      "SIGNED",
      "INTEGRITY_VERIFIED",
      "VIEWED",
      "DOWNLOADED",
    ].includes(actionCode)
  ) {
    domain = "document";
  } else if (
    entityType === "asset" ||
    upper.includes("POLICE ASSET") ||
    upper.includes("ARMORY") ||
    ["MAINTENANCE_STARTED", "MAINTENANCE_COMPLETED", "RETURNED", "RETIRED", "MARKED_LOST"].includes(
      actionCode,
    )
  ) {
    domain = "asset";
  } else if (lower.includes("what-if simulation")) {
    domain = "simulation";
  } else if (lower.includes("recommendation")) {
    domain = "recommendation";
  } else if (lower.includes("availability")) {
    domain = "availability";
  } else if (
    lower.includes("schedule") ||
    lower.includes("listing") ||
    lower.includes("reassign")
  ) {
    domain = "schedule";
  } else if (
    entityType === "user" ||
    lower.includes("account") ||
    lower.includes("user_accounts")
  ) {
    domain = "user";
  } else if (entityType === "case" || lower.includes("case")) {
    domain = "case";
  } else if (lower.includes("judge") || lower.includes("courtroom") || entityType === "registry") {
    domain = "registry";
  } else if (lower.includes("priority") || lower.includes("setting") || entityType === "settings") {
    domain = "settings";
  }

  // Legacy actionType mapping
  let actionType: AuditActionType = "other";
  if (domain === "simulation") actionType = "simulation";
  else if (domain === "recommendation") actionType = "recommendation";
  else if (domain === "availability") actionType = "availability";
  else if (domain === "schedule") actionType = "schedule";
  else if (domain === "case") actionType = "case";
  else if (domain === "registry") actionType = "registry";
  else if (domain === "settings") actionType = "settings";
  else if (domain === "document") actionType = "document";
  else if (domain === "asset") actionType = "asset";
  else if (domain === "evidence") actionType = "evidence";
  else if (domain === "security") actionType = "security";

  return { domain, actionType, actionCode, isSecurityAlert: isSecurity };
}

/**
 * Human-friendly entity formatter.
 */
export function formatEntity(entity: string): string {
  if (!entity.trim()) return "—";

  if (entity.trim().startsWith("{") && entity.trim().endsWith("}")) {
    try {
      const p = JSON.parse(entity) as StructuredEntityPayload;
      const parts: string[] = [];
      if (p.entity_type && p.entity_id) {
        const typeLabel = p.entity_type.charAt(0).toUpperCase() + p.entity_type.slice(1);
        parts.push(`${typeLabel}: ${p.entity_id}`);
      }
      if (p.case_id) parts.push(`Case: ${p.case_id}`);
      if (p.previous_state && p.new_state) {
        parts.push(`${p.previous_state} → ${p.new_state}`);
      } else if (p.new_state) {
        parts.push(`Status: ${p.new_state}`);
      }
      if (parts.length > 0) return parts.join(" · ");
    } catch {
      // ignore
    }
  }

  return entity
    .split(/\s+(?=[a-z_]+:)/i)
    .map((part) => {
      const [kind = "", ...rest] = part.split(":");
      const value = rest.join(":");
      if (!value) return part;
      const kindLabel = kind.charAt(0).toUpperCase() + kind.slice(1);
      const short = value.length >= 32 && value.includes("-") ? `${value.slice(0, 8)}…` : value;
      return `${kindLabel}: ${short}`;
    })
    .join(" · ");
}

export function classifyAction(action: string): AuditActionType {
  return extractActionDetails(action, "other").actionType;
}

// ============================================================================
// 4. STORAGE & AUDIT LOG WRITER
// ============================================================================

// Deprecated local storage keys retained only for backward compatibility references
const LOCAL_AUDIT_KEY = "nyayasetu_platform_audit_trail_v1";

/**
 * @deprecated Browser storage is never authoritative for legal records, evidence, documents, custody, permissions, or audit history.
 */
export function getLocalAuditEntries(): AuditLogEntry[] {
  return [];
}

/**
 * @deprecated Browser storage is never authoritative for legal records, evidence, documents, custody, permissions, or audit history.
 */
export function saveLocalAuditEntry(_entry: AuditLogEntry): void {
  // No-op: Supabase public.audit_logs is the sole authoritative persistence layer.
}

/**
 * Universal Audit Logger.
 * Accepts either:
 * 1. Detailed structured payload: recordAudit({ action, entityType, entityId, caseId, previousState, newState, metadata })
 * 2. Classic string parameters: recordAudit(action, entityAffected, userId)
 */
export async function recordAudit(
  actionOrPayload: string | DetailedAuditPayload,
  legacyEntityAffected?: string,
  legacyUserId?: string,
): Promise<void> {
  try {
    let actionText = "";
    let entityAffectedText = "";
    let uid = legacyUserId;
    let userName = "System";
    let userRole = "Staff";
    let entityType = "other";
    let entityId = "—";
    let caseId: string | null = null;
    let previousState: string | null = null;
    let newState: string | null = null;
    let actionCode = "OPERATION";
    let metadata: Record<string, unknown> = {};
    let isSecurityAlert = false;

    // Resolve current user if not supplied
    if (!uid) {
      try {
        const { data } = await supabase.auth.getUser();
        uid = data.user?.id;
        if (data.user?.email) {
          userName = data.user.email.split("@")[0] || "User";
        }
      } catch {
        // Continue with local session
      }
    }

    // Try reading offline staff cached session
    if (typeof window !== "undefined") {
      try {
        const rawStaff = localStorage.getItem("nyayasetu_offline_staff_cache");
        if (rawStaff) {
          const staffObj = JSON.parse(rawStaff);
          if (staffObj.fullName) userName = staffObj.fullName;
          if (staffObj.role) userRole = staffObj.role;
          if (!uid && staffObj.id) uid = staffObj.id;
        }
      } catch {
        // ignore
      }
    }

    if (typeof actionOrPayload === "object") {
      const p = actionOrPayload;
      actionText = p.action;
      actionCode =
        (p.actionCode as string) || p.action.split(/[:\s]/)[0]?.toUpperCase() || "OPERATION";
      entityType = p.entityType;
      entityId = p.entityId;
      caseId = p.caseId ?? null;
      previousState = p.previousState ?? null;
      newState = p.newState ?? null;
      metadata = p.metadata ?? {};
      isSecurityAlert =
        !!p.isSecurityAlert || actionCode === "INTEGRITY_MISMATCH" || actionCode === "MARKED_LOST";

      if (p.userId) uid = p.userId;
      if (p.userName) userName = p.userName;
      if (p.userRole) userRole = p.userRole;

      // Pack structured JSON for entity_affected
      const structured: StructuredEntityPayload = {
        entity_type: entityType,
        entity_id: entityId,
        case_id: caseId,
        previous_state: previousState,
        new_state: newState,
        action_code: actionCode,
        metadata,
        is_security_alert: isSecurityAlert,
      };
      entityAffectedText = JSON.stringify(structured);
    } else {
      actionText = actionOrPayload;
      entityAffectedText = legacyEntityAffected || "—";
      const parsed = parseEntityAffected(entityAffectedText);
      entityType = parsed.entityType;
      entityId = parsed.entityId;
      caseId = parsed.caseId;
      previousState = parsed.previousState;
      newState = parsed.newState;
      metadata = parsed.metadata;
      isSecurityAlert = parsed.isSecurityAlert;
    }

    const {
      domain,
      actionType,
      actionCode: derivedCode,
      isSecurityAlert: derivedSecurity,
    } = extractActionDetails(actionText, entityType);

    const now = new Date().toISOString();
    const entryId = `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const entry: AuditLogEntry = {
      id: entryId,
      user_id: uid ?? null,
      action: actionText,
      entity_affected: entityAffectedText,
      timestamp: now,
      userName,
      userRole,
      domain,
      actionType,
      actionCode: actionCode || derivedCode,
      entityType,
      entityId,
      caseId,
      previousState,
      newState,
      metadata,
      entityLabel: formatEntity(entityAffectedText),
      isSecurityAlert: isSecurityAlert || derivedSecurity,
    };

    // Insert into Supabase audit_logs (Authoritative immutable log)
    try {
      await (supabase.from("audit_logs") as any).insert({
        user_id: uid || null,
        action: actionText,
        entity_affected: entityAffectedText,
      });
    } catch (err) {
      console.warn("Could not insert audit log to Supabase", err);
    }
  } catch (err) {
    console.error("Audit log write failed", err);
  }
}

// ============================================================================
// 5. SEED DATA GENERATOR (Exhaustive verification coverage)
// ============================================================================

export function generateComprehensiveSeedAuditLogs(): AuditLogEntry[] {
  const baseDate = new Date();
  const makeTime = (minutesAgo: number) =>
    new Date(baseDate.getTime() - minutesAgo * 60000).toISOString();

  const entries: AuditLogEntry[] = [
    // --- 1. SECURITY & INTEGRITY ALERTS ---
    {
      id: "seed-audit-sec-01",
      user_id: "sec-user-01",
      userName: "Automated Integrity Sentry",
      userRole: "system_daemon",
      timestamp: makeTime(12),
      action:
        "CRITICAL ALERT: Document INTEGRITY_MISMATCH detected for DOC-2026-0014 (Charge_Sheet.pdf v1). Calculated SHA-256 does not match notarized manifest.",
      entity_affected: JSON.stringify({
        entity_type: "security",
        entity_id: "DOC-2026-0014",
        case_id: "BNS/2026/0014",
        previous_state: "VERIFIED",
        new_state: "INTEGRITY_MISMATCH",
        action_code: "INTEGRITY_MISMATCH",
        is_security_alert: true,
        metadata: {
          file_name: "Charge_Sheet.pdf",
          recorded_hash: "3fa85f647c92b8d910a2bc8e72ef0192a48b301c23f1a0e98345719082bc3411",
          calculated_hash: "9b3c4f92d8e04b1c738e4a921d7b38c201a4e591283c704f128e903bc148293a",
          verifier: "Dr. Sunita Rao (Senior Forensic Analyst)",
          alert_level: "HIGH",
        },
      }),
      domain: "security",
      actionType: "security",
      actionCode: "INTEGRITY_MISMATCH",
      entityType: "security",
      entityId: "DOC-2026-0014",
      caseId: "BNS/2026/0014",
      previousState: "VERIFIED",
      newState: "INTEGRITY_MISMATCH",
      metadata: {
        file_name: "Charge_Sheet.pdf",
        recorded_hash: "3fa85f647c92b8d910a2bc8e72ef0192a48b301c23f1a0e98345719082bc3411",
        calculated_hash: "9b3c4f92d8e04b1c738e4a921d7b38c201a4e591283c704f128e903bc148293a",
        verifier: "Dr. Sunita Rao (Senior Forensic Analyst)",
      },
      entityLabel: "Security: DOC-2026-0014 · Case: BNS/2026/0014 · VERIFIED → INTEGRITY_MISMATCH",
      isSecurityAlert: true,
    },
    {
      id: "seed-audit-sec-02",
      user_id: "sec-user-02",
      userName: "Station Armory Custodian",
      userRole: "evidence_custodian",
      timestamp: makeTime(45),
      action:
        "INCIDENT FLAGGED: Police Asset AST-009 (Glock 17 9mm #GLK-99210) MARKED_LOST during inter-district security escort duty.",
      entity_affected: JSON.stringify({
        entity_type: "asset",
        entity_id: "AST-009",
        case_id: "FIR-2026/0112",
        previous_state: "ASSIGNED",
        new_state: "LOST",
        action_code: "MARKED_LOST",
        is_security_alert: true,
        metadata: {
          serial_number: "GLK-99210",
          last_officer: "Constable Mahendra Yadav",
          last_location: "Sector 14 Police Chowki",
          investigation_ordered: true,
        },
      }),
      domain: "security",
      actionType: "security",
      actionCode: "MARKED_LOST",
      entityType: "asset",
      entityId: "AST-009",
      caseId: "FIR-2026/0112",
      previousState: "ASSIGNED",
      newState: "LOST",
      metadata: {
        serial_number: "GLK-99210",
        last_officer: "Constable Mahendra Yadav",
        last_location: "Sector 14 Police Chowki",
      },
      entityLabel: "Asset: AST-009 · Case: FIR-2026/0112 · ASSIGNED → LOST",
      isSecurityAlert: true,
    },

    // --- 2. DOCUMENT EVENTS (UPLOADED, VIEWED, DOWNLOADED, VERSION_CREATED, SIGNED, INTEGRITY_VERIFIED) ---
    {
      id: "seed-audit-doc-01",
      user_id: "doc-user-01",
      userName: "Insp. Rajesh Sharma",
      userRole: "investigating_officer",
      timestamp: makeTime(60),
      action:
        "Document UPLOADED: FIR Copy (DOC-2026-0001) registered for Case BNS/2026/0014. Cryptographic SHA-256 seal computed.",
      entity_affected: JSON.stringify({
        entity_type: "document",
        entity_id: "DOC-2026-0001",
        case_id: "BNS/2026/0014",
        previous_state: null,
        new_state: "v1",
        action_code: "UPLOADED",
        metadata: {
          file_name: "FIR_74_2026_Kotwali.pdf",
          sha256: "8e23b094f2910ba45a6c78e129304cbe65109b841a0293ec9481bcae0192384a",
          size_bytes: 419430,
          category: "FIR",
        },
      }),
      domain: "document",
      actionType: "document",
      actionCode: "UPLOADED",
      entityType: "document",
      entityId: "DOC-2026-0001",
      caseId: "BNS/2026/0014",
      previousState: null,
      newState: "v1",
      metadata: {
        file_name: "FIR_74_2026_Kotwali.pdf",
        sha256: "8e23b094f2910ba45a6c78e129304cbe65109b841a0293ec9481bcae0192384a",
        size_bytes: 419430,
      },
      entityLabel: "Document: DOC-2026-0001 · Case: BNS/2026/0014 · Status: v1",
      isSecurityAlert: false,
    },
    {
      id: "seed-audit-doc-02",
      user_id: "doc-user-02",
      userName: "Judge Ananya Deshmukh",
      userRole: "judge",
      timestamp: makeTime(85),
      action:
        "Document VIEWED: In-Camera inspection of Confessional Statement (DOC-2026-0004) under Sealed Cover protocol.",
      entity_affected: JSON.stringify({
        entity_type: "document",
        entity_id: "DOC-2026-0004",
        case_id: "BNS/2026/0014",
        action_code: "VIEWED",
        metadata: { access_type: "PREVIEW", bench_room: "Courtroom 3" },
      }),
      domain: "document",
      actionType: "document",
      actionCode: "VIEWED",
      entityType: "document",
      entityId: "DOC-2026-0004",
      caseId: "BNS/2026/0014",
      previousState: null,
      newState: null,
      metadata: { access_type: "PREVIEW", bench_room: "Courtroom 3" },
      entityLabel: "Document: DOC-2026-0004 · Case: BNS/2026/0014",
      isSecurityAlert: false,
    },
    {
      id: "seed-audit-doc-03",
      user_id: "doc-user-03",
      userName: "Court Registrar Sairaj Vairage",
      userRole: "registrar",
      timestamp: makeTime(110),
      action:
        "Document DOWNLOADED: Certified copy of Interim Bail Order (DOC-2026-0007) exported for advocate on record.",
      entity_affected: JSON.stringify({
        entity_type: "document",
        entity_id: "DOC-2026-0007",
        case_id: "NDPS/2026/0089",
        action_code: "DOWNLOADED",
        metadata: { access_type: "DOWNLOAD", watermark: "ADVOCATE_COPY_VERIFIED" },
      }),
      domain: "document",
      actionType: "document",
      actionCode: "DOWNLOADED",
      entityType: "document",
      entityId: "DOC-2026-0007",
      caseId: "NDPS/2026/0089",
      previousState: null,
      newState: null,
      metadata: { access_type: "DOWNLOAD", watermark: "ADVOCATE_COPY_VERIFIED" },
      entityLabel: "Document: DOC-2026-0007 · Case: NDPS/2026/0089",
      isSecurityAlert: false,
    },
    {
      id: "seed-audit-doc-04",
      user_id: "doc-user-04",
      userName: "Insp. Rajesh Sharma",
      userRole: "investigating_officer",
      timestamp: makeTime(140),
      action:
        "Document VERSION_CREATED: Supplementary Charge Sheet (DOC-2026-0002 v2) filed with annexed ballistic ballistics report.",
      entity_affected: JSON.stringify({
        entity_type: "document",
        entity_id: "DOC-2026-0002",
        case_id: "BNS/2026/0014",
        previous_state: "v1",
        new_state: "v2",
        action_code: "VERSION_CREATED",
        metadata: {
          file_name: "Supplementary_Charge_Sheet_v2.pdf",
          sha256: "1948ba0248c02b918a03c81290384b01e29084cba0123984cae981203847a02b",
          change_summary: "Added Annexure 4: Forensic ballistics certificate under BSA Sec 63.",
        },
      }),
      domain: "document",
      actionType: "document",
      actionCode: "VERSION_CREATED",
      entityType: "document",
      entityId: "DOC-2026-0002",
      caseId: "BNS/2026/0014",
      previousState: "v1",
      newState: "v2",
      metadata: {
        file_name: "Supplementary_Charge_Sheet_v2.pdf",
        sha256: "1948ba0248c02b918a03c81290384b01e29084cba0123984cae981203847a02b",
        change_summary: "Added Annexure 4: Forensic ballistics certificate under BSA Sec 63.",
      },
      entityLabel: "Document: DOC-2026-0002 · Case: BNS/2026/0014 · v1 → v2",
      isSecurityAlert: false,
    },
    {
      id: "seed-audit-doc-05",
      user_id: "doc-user-05",
      userName: "Judge Ananya Deshmukh",
      userRole: "judge",
      timestamp: makeTime(160),
      action:
        "Document SIGNED: Digital Judicial Signature affixed to Bail Order DOC-2026-0008. Algorithm SHA256-RSA / CCA Class 3.",
      entity_affected: JSON.stringify({
        entity_type: "document",
        entity_id: "DOC-2026-0008",
        case_id: "NDPS/2026/0089",
        previous_state: "PENDING",
        new_state: "SIGNED",
        action_code: "SIGNED",
        metadata: {
          signature_ref: "SIG-JUD-2026-0981",
          hash: "7820ba94c1209384bc01928340129bc840192834bca01923840129bc84019238",
          signer: "Hon'ble Judge Ananya Deshmukh",
          cert_issuer: "eMudhra CA - Judicial DSC",
        },
      }),
      domain: "document",
      actionType: "document",
      actionCode: "SIGNED",
      entityType: "document",
      entityId: "DOC-2026-0008",
      caseId: "NDPS/2026/0089",
      previousState: "PENDING",
      newState: "SIGNED",
      metadata: {
        signature_ref: "SIG-JUD-2026-0981",
        signer: "Hon'ble Judge Ananya Deshmukh",
        cert_issuer: "eMudhra CA - Judicial DSC",
      },
      entityLabel: "Document: DOC-2026-0008 · Case: NDPS/2026/0089 · PENDING → SIGNED",
      isSecurityAlert: false,
    },
    {
      id: "seed-audit-doc-06",
      user_id: "doc-user-06",
      userName: "Dr. Sunita Rao",
      userRole: "forensic_officer",
      timestamp: makeTime(180),
      action:
        "Document INTEGRITY_VERIFIED: Complete SHA-256 match validated for FSL Report (DOC-2026-0010 v1). Document authentic.",
      entity_affected: JSON.stringify({
        entity_type: "document",
        entity_id: "DOC-2026-0010",
        case_id: "BNS/2026/0014",
        previous_state: "PENDING_VERIFICATION",
        new_state: "VERIFIED",
        action_code: "INTEGRITY_VERIFIED",
        metadata: {
          sha256: "4c902834bc01928340192bc840192834bca01923840129bc840192381290384b",
          status: "VERIFIED",
          verifier: "Dr. Sunita Rao",
        },
      }),
      domain: "document",
      actionType: "document",
      actionCode: "INTEGRITY_VERIFIED",
      entityType: "document",
      entityId: "DOC-2026-0010",
      caseId: "BNS/2026/0014",
      previousState: "PENDING_VERIFICATION",
      newState: "VERIFIED",
      metadata: {
        sha256: "4c902834bc01928340192bc840192834bca01923840129bc840192381290384b",
        verifier: "Dr. Sunita Rao",
      },
      entityLabel:
        "Document: DOC-2026-0010 · Case: BNS/2026/0014 · PENDING_VERIFICATION → VERIFIED",
      isSecurityAlert: false,
    },

    // --- 3. POLICE ASSET EVENTS (CREATED, ASSIGNED, UNASSIGNED, TRANSFERRED, RECEIVED, MAINTENANCE_STARTED, MAINTENANCE_COMPLETED, RETURNED, RETIRED) ---
    {
      id: "seed-audit-ast-01",
      user_id: "ast-user-01",
      userName: "Armory Incharge Vikram Singh",
      userRole: "evidence_custodian",
      timestamp: makeTime(210),
      action:
        "Police Asset CREATED: Registered Glock 17 Gen 5 (AST-001) in Central Police Station Armory registry.",
      entity_affected: JSON.stringify({
        entity_type: "asset",
        entity_id: "AST-001",
        previous_state: null,
        new_state: "AVAILABLE",
        action_code: "CREATED",
        metadata: {
          category: "Firearms & Weapons",
          serial: "GLK-55420",
          location: "Central Armory Room A",
        },
      }),
      domain: "asset",
      actionType: "asset",
      actionCode: "CREATED",
      entityType: "asset",
      entityId: "AST-001",
      caseId: null,
      previousState: null,
      newState: "AVAILABLE",
      metadata: {
        category: "Firearms & Weapons",
        serial: "GLK-55420",
        location: "Central Armory Room A",
      },
      entityLabel: "Asset: AST-001 · Status: AVAILABLE",
      isSecurityAlert: false,
    },
    {
      id: "seed-audit-ast-02",
      user_id: "ast-user-02",
      userName: "Inspector Rajesh Sharma",
      userRole: "investigating_officer",
      timestamp: makeTime(240),
      action:
        "Police Asset ASSIGNED: Patrol Interceptor Bolero Neo (AST-004) officially assigned to Sub-Inspector Amit Deshmukh.",
      entity_affected: JSON.stringify({
        entity_type: "asset",
        entity_id: "AST-004",
        previous_state: "AVAILABLE",
        new_state: "ASSIGNED",
        action_code: "ASSIGNED",
        metadata: {
          assigned_officer: "SI Amit Deshmukh",
          badge: "MH-P-4421",
          registration: "MH-12-PA-9901",
        },
      }),
      domain: "asset",
      actionType: "asset",
      actionCode: "ASSIGNED",
      entityType: "asset",
      entityId: "AST-004",
      caseId: null,
      previousState: "AVAILABLE",
      newState: "ASSIGNED",
      metadata: { assigned_officer: "SI Amit Deshmukh", registration: "MH-12-PA-9901" },
      entityLabel: "Asset: AST-004 · AVAILABLE → ASSIGNED",
      isSecurityAlert: false,
    },
    {
      id: "seed-audit-ast-03",
      user_id: "ast-user-03",
      userName: "Quartermaster Manoj Kulkarni",
      userRole: "evidence_custodian",
      timestamp: makeTime(270),
      action:
        "Police Asset UNASSIGNED: Body Worn Camera AX-200 (AST-006) returned to quartermaster pool from patrolling shift.",
      entity_affected: JSON.stringify({
        entity_type: "asset",
        entity_id: "AST-006",
        previous_state: "ASSIGNED",
        new_state: "AVAILABLE",
        action_code: "UNASSIGNED",
        metadata: { returned_by: "Constable Patil", condition: "EXCELLENT" },
      }),
      domain: "asset",
      actionType: "asset",
      actionCode: "UNASSIGNED",
      entityType: "asset",
      entityId: "AST-006",
      caseId: null,
      previousState: "ASSIGNED",
      newState: "AVAILABLE",
      metadata: { returned_by: "Constable Patil", condition: "EXCELLENT" },
      entityLabel: "Asset: AST-006 · ASSIGNED → AVAILABLE",
      isSecurityAlert: false,
    },
    {
      id: "seed-audit-ast-04",
      user_id: "ast-user-04",
      userName: "Transport Officer Ramesh Rao",
      userRole: "police_officer",
      timestamp: makeTime(310),
      action:
        "Police Asset TRANSFERRED: Mobile Command Post Truck (AST-008) dispatched to Taluka Chowki for VIP bandobast.",
      entity_affected: JSON.stringify({
        entity_type: "asset",
        entity_id: "AST-008",
        previous_state: "AVAILABLE",
        new_state: "TRANSFERRED",
        action_code: "TRANSFERRED",
        metadata: {
          from_location: "HQ Garage",
          to_location: "Taluka Chowki",
          transit_seal: "TR-88192",
        },
      }),
      domain: "asset",
      actionType: "asset",
      actionCode: "TRANSFERRED",
      entityType: "asset",
      entityId: "AST-008",
      caseId: null,
      previousState: "AVAILABLE",
      newState: "TRANSFERRED",
      metadata: {
        from_location: "HQ Garage",
        to_location: "Taluka Chowki",
        transit_seal: "TR-88192",
      },
      entityLabel: "Asset: AST-008 · AVAILABLE → TRANSFERRED",
      isSecurityAlert: false,
    },
    {
      id: "seed-audit-ast-05",
      user_id: "ast-user-05",
      userName: "Station House Officer K. P. Joshi",
      userRole: "police_officer",
      timestamp: makeTime(340),
      action:
        "Police Asset RECEIVED: Mobile Command Post Truck (AST-008) acknowledged and parked at Taluka Chowki.",
      entity_affected: JSON.stringify({
        entity_type: "asset",
        entity_id: "AST-008",
        previous_state: "TRANSFERRED",
        new_state: "AVAILABLE",
        action_code: "RECEIVED",
        metadata: { recipient: "SHO K. P. Joshi", station: "Taluka Chowki" },
      }),
      domain: "asset",
      actionType: "asset",
      actionCode: "RECEIVED",
      entityType: "asset",
      entityId: "AST-008",
      caseId: null,
      previousState: "TRANSFERRED",
      newState: "AVAILABLE",
      metadata: { recipient: "SHO K. P. Joshi", station: "Taluka Chowki" },
      entityLabel: "Asset: AST-008 · TRANSFERRED → AVAILABLE",
      isSecurityAlert: false,
    },
    {
      id: "seed-audit-ast-06",
      user_id: "ast-user-06",
      userName: "Workshop Foreman Nilesh Shinde",
      userRole: "police_officer",
      timestamp: makeTime(380),
      action:
        "Police Asset MAINTENANCE_STARTED: Bulletproof Vest Tier IV (AST-011) sent to Ballistic Testing Lab for stress inspection.",
      entity_affected: JSON.stringify({
        entity_type: "asset",
        entity_id: "AST-011",
        previous_state: "AVAILABLE",
        new_state: "MAINTENANCE",
        action_code: "MAINTENANCE_STARTED",
        metadata: { provider: "State Ordnance Factory", type: "BALLISTIC_CERTIFICATION" },
      }),
      domain: "asset",
      actionType: "asset",
      actionCode: "MAINTENANCE_STARTED",
      entityType: "asset",
      entityId: "AST-011",
      caseId: null,
      previousState: "AVAILABLE",
      newState: "MAINTENANCE",
      metadata: { provider: "State Ordnance Factory", type: "BALLISTIC_CERTIFICATION" },
      entityLabel: "Asset: AST-011 · AVAILABLE → MAINTENANCE",
      isSecurityAlert: false,
    },
    {
      id: "seed-audit-ast-07",
      user_id: "ast-user-07",
      userName: "Workshop Foreman Nilesh Shinde",
      userRole: "police_officer",
      timestamp: makeTime(410),
      action:
        "Police Asset MAINTENANCE_COMPLETED: Bulletproof Vest Tier IV (AST-011) certified safe and returned to active armory.",
      entity_affected: JSON.stringify({
        entity_type: "asset",
        entity_id: "AST-011",
        previous_state: "MAINTENANCE",
        new_state: "AVAILABLE",
        action_code: "MAINTENANCE_COMPLETED",
        metadata: { certificate_no: "BALLISTIC-PASS-9902", condition: "EXCELLENT" },
      }),
      domain: "asset",
      actionType: "asset",
      actionCode: "MAINTENANCE_COMPLETED",
      entityType: "asset",
      entityId: "AST-011",
      caseId: null,
      previousState: "MAINTENANCE",
      newState: "AVAILABLE",
      metadata: { certificate_no: "BALLISTIC-PASS-9902", condition: "EXCELLENT" },
      entityLabel: "Asset: AST-011 · MAINTENANCE → AVAILABLE",
      isSecurityAlert: false,
    },
    {
      id: "seed-audit-ast-08",
      user_id: "ast-user-08",
      userName: "Sub-Inspector Amit Deshmukh",
      userRole: "police_officer",
      timestamp: makeTime(450),
      action:
        "Police Asset RETURNED: Tactical Body Armor #BA-3312 surrendered after special operation conclusion.",
      entity_affected: JSON.stringify({
        entity_type: "asset",
        entity_id: "AST-014",
        previous_state: "ASSIGNED",
        new_state: "RETURNED",
        action_code: "RETURNED",
        metadata: { reason: "Operation concluded" },
      }),
      domain: "asset",
      actionType: "asset",
      actionCode: "RETURNED",
      entityType: "asset",
      entityId: "AST-014",
      caseId: null,
      previousState: "ASSIGNED",
      newState: "RETURNED",
      metadata: { reason: "Operation concluded" },
      entityLabel: "Asset: AST-014 · ASSIGNED → RETURNED",
      isSecurityAlert: false,
    },
    {
      id: "seed-audit-ast-09",
      user_id: "ast-user-09",
      userName: "SP Logistics Division",
      userRole: "admin",
      timestamp: makeTime(500),
      action:
        "Police Asset RETIRED: Decommissioned Tata Sumo Patrol Vehicle (AST-022) condemned by RTO inspection committee.",
      entity_affected: JSON.stringify({
        entity_type: "asset",
        entity_id: "AST-022",
        previous_state: "AVAILABLE",
        new_state: "RETIRED",
        action_code: "RETIRED",
        metadata: { rto_certificate: "CONDEMN-2026/41", salvage_bid_ready: true },
      }),
      domain: "asset",
      actionType: "asset",
      actionCode: "RETIRED",
      entityType: "asset",
      entityId: "AST-022",
      caseId: null,
      previousState: "AVAILABLE",
      newState: "RETIRED",
      metadata: { rto_certificate: "CONDEMN-2026/41", salvage_bid_ready: true },
      entityLabel: "Asset: AST-022 · AVAILABLE → RETIRED",
      isSecurityAlert: false,
    },

    // --- 4. EVIDENCE CUSTODY EVENTS (SEIZED, REGISTERED, SEALED, STORED, TRANSFERRED, RECEIVED, FORENSIC_STARTED, FORENSIC_COMPLETED, COURT_SUBMITTED, DISPOSED) ---
    {
      id: "seed-audit-evi-01",
      user_id: "evi-user-01",
      userName: "Insp. Rajesh Sharma",
      userRole: "investigating_officer",
      timestamp: makeTime(550),
      action:
        "Evidence SEIZED: Apple iPhone 15 Pro (EV-1045) seized from suspect residence under Panchnama Memo #44/2026.",
      entity_affected: JSON.stringify({
        entity_type: "evidence",
        entity_id: "EV-1045",
        case_id: "BNS/2026/0014",
        previous_state: null,
        new_state: "SEIZED",
        action_code: "SEIZED",
        metadata: {
          panchnama_ref: "PANCHNAMA-BNS-2026-0014-A",
          imei: "359128091823901",
          witness_1: "Suresh P.",
          witness_2: "Vikas M.",
        },
      }),
      domain: "evidence",
      actionType: "evidence",
      actionCode: "SEIZED",
      entityType: "evidence",
      entityId: "EV-1045",
      caseId: "BNS/2026/0014",
      previousState: null,
      newState: "SEIZED",
      metadata: {
        panchnama_ref: "PANCHNAMA-BNS-2026-0014-A",
        imei: "359128091823901",
      },
      entityLabel: "Evidence: EV-1045 · Case: BNS/2026/0014 · Status: SEIZED",
      isSecurityAlert: false,
    },
    {
      id: "seed-audit-evi-02",
      user_id: "evi-user-02",
      userName: "Malkhana Moharrir Dilip Sawant",
      userRole: "evidence_custodian",
      timestamp: makeTime(570),
      action:
        "Evidence REGISTERED: Exhibit EV-1045 entered into Malkhana Register Muddimall #789/2026 with biometric receipt.",
      entity_affected: JSON.stringify({
        entity_type: "evidence",
        entity_id: "EV-1045",
        case_id: "BNS/2026/0014",
        previous_state: "SEIZED",
        new_state: "REGISTERED",
        action_code: "REGISTERED",
        metadata: { muddimall_no: "789/2026", station: "Kotwali Police Station" },
      }),
      domain: "evidence",
      actionType: "evidence",
      actionCode: "REGISTERED",
      entityType: "evidence",
      entityId: "EV-1045",
      caseId: "BNS/2026/0014",
      previousState: "SEIZED",
      newState: "REGISTERED",
      metadata: { muddimall_no: "789/2026", station: "Kotwali Police Station" },
      entityLabel: "Evidence: EV-1045 · Case: BNS/2026/0014 · SEIZED → REGISTERED",
      isSecurityAlert: false,
    },
    {
      id: "seed-audit-evi-03",
      user_id: "evi-user-03",
      userName: "Insp. Rajesh Sharma",
      userRole: "investigating_officer",
      timestamp: makeTime(600),
      action:
        "Evidence SEALED: Tamper-evident lac seal #SEAL-99014 applied in presence of independent witnesses.",
      entity_affected: JSON.stringify({
        entity_type: "evidence",
        entity_id: "EV-1045",
        case_id: "BNS/2026/0014",
        previous_state: "REGISTERED",
        new_state: "SEALED",
        action_code: "SEALED",
        metadata: { seal_number: "SEAL-99014", seal_type: "LAC_AND_RFID" },
      }),
      domain: "evidence",
      actionType: "evidence",
      actionCode: "SEALED",
      entityType: "evidence",
      entityId: "EV-1045",
      caseId: "BNS/2026/0014",
      previousState: "REGISTERED",
      newState: "SEALED",
      metadata: { seal_number: "SEAL-99014", seal_type: "LAC_AND_RFID" },
      entityLabel: "Evidence: EV-1045 · Case: BNS/2026/0014 · REGISTERED → SEALED",
      isSecurityAlert: false,
    },
    {
      id: "seed-audit-evi-04",
      user_id: "evi-user-04",
      userName: "Malkhana Moharrir Dilip Sawant",
      userRole: "evidence_custodian",
      timestamp: makeTime(620),
      action:
        "Evidence STORED: Secured in Fireproof Evidence Safe Lockbox #B-4 with biometric access controls.",
      entity_affected: JSON.stringify({
        entity_type: "evidence",
        entity_id: "EV-1045",
        case_id: "BNS/2026/0014",
        previous_state: "SEALED",
        new_state: "STORED",
        action_code: "STORED",
        metadata: { vault_room: "Malkhana Room 1", locker_no: "B-4" },
      }),
      domain: "evidence",
      actionType: "evidence",
      actionCode: "STORED",
      entityType: "evidence",
      entityId: "EV-1045",
      caseId: "BNS/2026/0014",
      previousState: "SEALED",
      newState: "STORED",
      metadata: { vault_room: "Malkhana Room 1", locker_no: "B-4" },
      entityLabel: "Evidence: EV-1045 · Case: BNS/2026/0014 · SEALED → STORED",
      isSecurityAlert: false,
    },
    {
      id: "seed-audit-evi-05",
      user_id: "evi-user-05",
      userName: "Malkhana Moharrir Dilip Sawant",
      userRole: "evidence_custodian",
      timestamp: makeTime(650),
      action:
        "Evidence TRANSFERRED: Dispatched via Secure Armed Escort to State Cyber Forensic Science Laboratory (FSL).",
      entity_affected: JSON.stringify({
        entity_type: "evidence",
        entity_id: "EV-1045",
        case_id: "BNS/2026/0014",
        previous_state: "STORED",
        new_state: "IN_TRANSIT",
        action_code: "TRANSFERRED",
        metadata: {
          from_location: "Kotwali Malkhana",
          to_location: "State FSL Cyber Wing, Pune",
          transit_seal: "TR-SEAL-88901",
          escort_officer: "HC Ramesh Pawar",
        },
      }),
      domain: "evidence",
      actionType: "evidence",
      actionCode: "TRANSFERRED",
      entityType: "evidence",
      entityId: "EV-1045",
      caseId: "BNS/2026/0014",
      previousState: "STORED",
      newState: "IN_TRANSIT",
      metadata: {
        from_location: "Kotwali Malkhana",
        to_location: "State FSL Cyber Wing, Pune",
        transit_seal: "TR-SEAL-88901",
      },
      entityLabel: "Evidence: EV-1045 · Case: BNS/2026/0014 · STORED → IN_TRANSIT",
      isSecurityAlert: false,
    },
    {
      id: "seed-audit-evi-06",
      user_id: "evi-user-06",
      userName: "Dr. Sunita Rao",
      userRole: "forensic_officer",
      timestamp: makeTime(680),
      action:
        "Evidence RECEIVED: FSL Intake Desk acknowledged receipt. Tamper seal verified intact under stereomicroscope.",
      entity_affected: JSON.stringify({
        entity_type: "evidence",
        entity_id: "EV-1045",
        case_id: "BNS/2026/0014",
        previous_state: "IN_TRANSIT",
        new_state: "STORED",
        action_code: "RECEIVED",
        metadata: {
          recipient_lab: "State Cyber FSL",
          seal_verified_intact: true,
          fsl_intake_no: "FSL-CYB-2026-440",
          signature_ref: "SIG-CUST-2026-9041",
        },
      }),
      domain: "evidence",
      actionType: "evidence",
      actionCode: "RECEIVED",
      entityType: "evidence",
      entityId: "EV-1045",
      caseId: "BNS/2026/0014",
      previousState: "IN_TRANSIT",
      newState: "STORED",
      metadata: {
        recipient_lab: "State Cyber FSL",
        seal_verified_intact: true,
        fsl_intake_no: "FSL-CYB-2026-440",
      },
      entityLabel: "Evidence: EV-1045 · Case: BNS/2026/0014 · IN_TRANSIT → STORED",
      isSecurityAlert: false,
    },
    {
      id: "seed-audit-evi-07",
      user_id: "evi-user-07",
      userName: "Dr. Sunita Rao",
      userRole: "forensic_officer",
      timestamp: makeTime(720),
      action:
        "Evidence FORENSIC_STARTED: Full bit-stream forensic disk imaging initiated in Faraday Shielded Chamber.",
      entity_affected: JSON.stringify({
        entity_type: "evidence",
        entity_id: "EV-1045",
        case_id: "BNS/2026/0014",
        previous_state: "STORED",
        new_state: "FORENSIC_EXAMINATION",
        action_code: "FORENSIC_STARTED",
        metadata: {
          requisition_no: "REQ-FSL-7712",
          test_type: "CELLEBRITE_UFDX_PHYSICAL_EXTRACTION",
          write_blocker: "Tableau T8u USB 3.0",
        },
      }),
      domain: "evidence",
      actionType: "evidence",
      actionCode: "FORENSIC_STARTED",
      entityType: "evidence",
      entityId: "EV-1045",
      caseId: "BNS/2026/0014",
      previousState: "STORED",
      newState: "FORENSIC_EXAMINATION",
      metadata: {
        requisition_no: "REQ-FSL-7712",
        test_type: "CELLEBRITE_UFDX_PHYSICAL_EXTRACTION",
      },
      entityLabel: "Evidence: EV-1045 · Case: BNS/2026/0014 · STORED → FORENSIC_EXAMINATION",
      isSecurityAlert: false,
    },
    {
      id: "seed-audit-evi-08",
      user_id: "evi-user-08",
      userName: "Dr. Sunita Rao",
      userRole: "forensic_officer",
      timestamp: makeTime(760),
      action:
        "Evidence FORENSIC_COMPLETED: Analysis report completed. SHA-256 hash certificate generated under BSA 2023 Sec 63.",
      entity_affected: JSON.stringify({
        entity_type: "evidence",
        entity_id: "EV-1045",
        case_id: "BNS/2026/0014",
        previous_state: "FORENSIC_EXAMINATION",
        new_state: "STORED",
        action_code: "FORENSIC_COMPLETED",
        metadata: {
          report_ref: "FSL-CYB-REP-2026/889",
          findings: "Extracted 14 encrypted chats, 2 cryptocurrency wallet transaction hashes.",
          certificate_hash: "28e0192384b0192834bc01928340192bc840192834bca01923840129bc840192",
        },
      }),
      domain: "evidence",
      actionType: "evidence",
      actionCode: "FORENSIC_COMPLETED",
      entityType: "evidence",
      entityId: "EV-1045",
      caseId: "BNS/2026/0014",
      previousState: "FORENSIC_EXAMINATION",
      newState: "STORED",
      metadata: {
        report_ref: "FSL-CYB-REP-2026/889",
        findings: "Extracted 14 encrypted chats, 2 cryptocurrency wallet transaction hashes.",
      },
      entityLabel: "Evidence: EV-1045 · Case: BNS/2026/0014 · FORENSIC_EXAMINATION → STORED",
      isSecurityAlert: false,
    },
    {
      id: "seed-audit-evi-09",
      user_id: "evi-user-09",
      userName: "Registrar Sairaj Vairage",
      userRole: "registrar",
      timestamp: makeTime(800),
      action:
        "Evidence COURT_SUBMITTED: Exhibit EV-1045 formally produced before Bench 2 and admitted as Prosecution Exhibit P-14.",
      entity_affected: JSON.stringify({
        entity_type: "evidence",
        entity_id: "EV-1045",
        case_id: "BNS/2026/0014",
        previous_state: "STORED",
        new_state: "COURT_SUBMISSION",
        action_code: "COURT_SUBMITTED",
        metadata: {
          courtroom: "Courtroom 2",
          presiding_judge: "Hon'ble Judge Nikit Munjal",
          exhibit_mark: "EXHIBIT_PROSECUTION_P_14",
        },
      }),
      domain: "evidence",
      actionType: "evidence",
      actionCode: "COURT_SUBMITTED",
      entityType: "evidence",
      entityId: "EV-1045",
      caseId: "BNS/2026/0014",
      previousState: "STORED",
      newState: "COURT_SUBMISSION",
      metadata: {
        courtroom: "Courtroom 2",
        presiding_judge: "Hon'ble Judge Nikit Munjal",
        exhibit_mark: "EXHIBIT_PROSECUTION_P_14",
      },
      entityLabel: "Evidence: EV-1045 · Case: BNS/2026/0014 · STORED → COURT_SUBMISSION",
      isSecurityAlert: false,
    },
    {
      id: "seed-audit-evi-10",
      user_id: "evi-user-10",
      userName: "Judge Nikit Munjal",
      userRole: "judge",
      timestamp: makeTime(850),
      action:
        "Evidence DISPOSED: Heroin Contraband Sample 50g (EV-1089) destroyed by Judicial Incineration Committee under NDPS Sec 52A.",
      entity_affected: JSON.stringify({
        entity_type: "evidence",
        entity_id: "EV-1089",
        case_id: "NDPS/2026/0089",
        previous_state: "COURT_SUBMISSION",
        new_state: "DISPOSED",
        action_code: "DISPOSED",
        metadata: {
          order_no: "NDPS-DISP-2026-04",
          committee_head: "Chief Judicial Magistrate",
          incinerator_facility: "State Waste Management Facility, Taloja",
        },
      }),
      domain: "evidence",
      actionType: "evidence",
      actionCode: "DISPOSED",
      entityType: "evidence",
      entityId: "EV-1089",
      caseId: "NDPS/2026/0089",
      previousState: "COURT_SUBMISSION",
      newState: "DISPOSED",
      metadata: {
        order_no: "NDPS-DISP-2026-04",
        committee_head: "Chief Judicial Magistrate",
      },
      entityLabel: "Evidence: EV-1089 · Case: NDPS/2026/0089 · COURT_SUBMISSION → DISPOSED",
      isSecurityAlert: false,
    },

    // --- 5. CASE & SCHEDULING OPERATIONS (Preserving legacy events) ---
    {
      id: "seed-audit-sch-01",
      user_id: "sch-user-01",
      userName: "Registrar Sairaj Vairage",
      userRole: "registrar",
      timestamp: makeTime(900),
      action:
        "AI Cause-List recommendation ACCEPTED: Scheduled Case BNS/2026/0014 in Courtroom 2 for Charge Framing.",
      entity_affected: "case:BNS/2026/0014 schedule:sch-bns-001",
      domain: "recommendation",
      actionType: "recommendation",
      actionCode: "SCHEDULED",
      entityType: "case",
      entityId: "BNS/2026/0014",
      caseId: "BNS/2026/0014",
      previousState: "PENDING_LISTING",
      newState: "SCHEDULED",
      metadata: { courtroom: "Courtroom 2", hearing_type: "Framing of Charges" },
      entityLabel: "Case: BNS/2026/0014 · Schedule: sch-bns-001",
      isSecurityAlert: false,
    },
    {
      id: "seed-audit-case-01",
      user_id: "case-user-01",
      userName: "Filing Counter Officer",
      userRole: "registrar",
      timestamp: makeTime(950),
      action:
        "Registered case CASE-2026-0001 (State of Maharashtra vs. R. Verma) under e-Courts CIS portal.",
      entity_affected: "case:CASE-2026-0001",
      domain: "case",
      actionType: "case",
      actionCode: "REGISTERED",
      entityType: "case",
      entityId: "CASE-2026-0001",
      caseId: "CASE-2026-0001",
      previousState: null,
      newState: "ACTIVE",
      metadata: { cnr: "MHPU02-004412-2026" },
      entityLabel: "Case: CASE-2026-0001",
      isSecurityAlert: false,
    },
    {
      id: "seed-audit-usr-01",
      user_id: "usr-admin-01",
      userName: "Lead Administrator",
      userRole: "admin",
      timestamp: makeTime(1020),
      action:
        "Created investigating officer account for insp.sharma@police.gov.in with biometric two-factor authentication.",
      entity_affected: "user_accounts",
      domain: "user",
      actionType: "other",
      actionCode: "ACCOUNT_CREATED",
      entityType: "user",
      entityId: "insp.sharma@police.gov.in",
      caseId: null,
      previousState: null,
      newState: "ACTIVE",
      metadata: { role_assigned: "investigating_officer" },
      entityLabel: "User: user_accounts",
      isSecurityAlert: false,
    },
  ];

  return entries;
}

// ============================================================================
// 6. REACT QUERY AUDIT LOG CONSUMER
// ============================================================================

export const auditLogQuery = {
  queryKey: ["audit-logs"],
  queryFn: async (): Promise<AuditLogEntry[]> => {
    let remoteRows: AuditLogRow[] = [];

    try {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, user_id, action, entity_affected, timestamp")
        .order("timestamp", { ascending: false })
        .limit(1000);

      if (!error && data) {
        remoteRows = data as AuditLogRow[];
      }
    } catch {
      // Continue with local entries
    }

    // Read users & profiles to resolve names
    let nameById = new Map<string, string>();
    const roleById = new Map<string, string>();

    try {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, full_name"),
        supabase.from("user_roles").select("user_id, role"),
      ]);

      nameById = new Map(
        (profiles ?? []).map((p) => [p.id, p.full_name?.trim() || "Registry staff"]),
      );
      for (const r of roles ?? []) {
        const roleStr = r.role as string;
        const label =
          roleStr === "admin"
            ? "Administrator"
            : roleStr === "judge"
              ? "Judge"
              : roleStr === "investigating_officer"
                ? "Investigating Officer"
                : roleStr === "forensic_officer"
                  ? "Forensic Officer"
                  : roleStr === "evidence_custodian"
                    ? "Evidence Custodian"
                    : roleStr === "police_officer"
                      ? "Police Officer"
                      : "Registrar";
        if (roleStr === "admin" || !roleById.has(r.user_id)) roleById.set(r.user_id, label);
      }
    } catch {
      // ignore
    }

    // Process remote rows
    const processedRemote: AuditLogEntry[] = remoteRows.map((row) => {
      const parsed = parseEntityAffected(row.entity_affected);
      const { domain, actionType, actionCode, isSecurityAlert } = extractActionDetails(
        row.action,
        parsed.entityType,
      );

      return {
        ...row,
        userName: (row.user_id && nameById.get(row.user_id)) || "System",
        userRole: (row.user_id && roleById.get(row.user_id)) || "Staff",
        domain,
        actionType,
        actionCode: parsed.actionCode || actionCode,
        entityType: parsed.entityType,
        entityId: parsed.entityId,
        caseId: parsed.caseId,
        previousState: parsed.previousState,
        newState: parsed.newState,
        metadata: parsed.metadata,
        entityLabel: formatEntity(row.entity_affected),
        isSecurityAlert: parsed.isSecurityAlert || isSecurityAlert,
      };
    });

    // In production, remote Supabase audit_logs is the authoritative source.
    if (processedRemote.length > 0) {
      return processedRemote.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );
    }

    // Only present seed fixtures if explicit DEMO_MODE is enabled
    if (isDemoMode()) {
      const seedEntries = generateComprehensiveSeedAuditLogs();
      return seedEntries.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );
    }

    return [];
  },
};

export function formatAuditTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function formatRelativeAuditTime(iso: string): string {
  try {
    const diffMs = Date.now() - new Date(iso).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return "Just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  } catch {
    return "";
  }
}
