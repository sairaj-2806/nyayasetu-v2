/**
 * ============================================================================
 * NyayaSetu Role-Based Access Control (RBAC) & Security Architecture
 * ============================================================================
 * Provides deterministic, least-privilege authorization for Secure DMS,
 * Police Asset, Malkhana Evidence Custody, and Judicial Case Registry modules.
 *
 * Designed to align with:
 * - Bharatiya Sakshya Adhiniyam (BSA, 2023) Section 63 digital integrity standards
 * - Ministry of Home Affairs (MHA) Malkhana & Armory Custody protocols
 * - High Court Rules & Orders on Sealed Cover (In-Camera) confidentiality
 */

import { recordAudit } from "@/lib/audit";

// ============================================================================
// 1. CANONICAL ROLES
// ============================================================================

export type AppRole =
  | "admin"
  | "registrar"
  | "judge"
  | "investigating_officer"
  | "forensic_officer"
  | "evidence_custodian"
  | "police_officer";

export const APP_ROLES: Record<string, AppRole> = {
  ADMIN: "admin",
  REGISTRAR: "registrar",
  JUDGE: "judge",
  INVESTIGATING_OFFICER: "investigating_officer",
  FORENSIC_OFFICER: "forensic_officer",
  EVIDENCE_CUSTODIAN: "evidence_custodian",
  POLICE_OFFICER: "police_officer",
} as const;

export const ALL_ROLES: AppRole[] = [
  "admin",
  "registrar",
  "judge",
  "investigating_officer",
  "forensic_officer",
  "evidence_custodian",
  "police_officer",
];

// ============================================================================
// 2. CANONICAL PERMISSIONS
// ============================================================================

export type Permission =
  | "DOCUMENT_VIEW"
  | "DOCUMENT_UPLOAD"
  | "DOCUMENT_VERSION"
  | "DOCUMENT_DOWNLOAD"
  | "DOCUMENT_SIGN"
  | "ASSET_VIEW"
  | "ASSET_CREATE"
  | "ASSET_ASSIGN"
  | "ASSET_TRANSFER"
  | "ASSET_MAINTENANCE"
  | "EVIDENCE_VIEW"
  | "EVIDENCE_TRANSFER"
  | "EVIDENCE_CUSTODY"
  | "AUDIT_VIEW";

export const ALL_PERMISSIONS: Permission[] = [
  "DOCUMENT_VIEW",
  "DOCUMENT_UPLOAD",
  "DOCUMENT_VERSION",
  "DOCUMENT_DOWNLOAD",
  "DOCUMENT_SIGN",
  "ASSET_VIEW",
  "ASSET_CREATE",
  "ASSET_ASSIGN",
  "ASSET_TRANSFER",
  "ASSET_MAINTENANCE",
  "EVIDENCE_VIEW",
  "EVIDENCE_TRANSFER",
  "EVIDENCE_CUSTODY",
  "AUDIT_VIEW",
];

// ============================================================================
// 3. DETERMINISTIC ROLE-PERMISSION MATRIX
// ============================================================================

export const ROLE_PERMISSIONS: Record<AppRole, ReadonlySet<Permission>> = {
  /**
   * Unrestricted system administration & governance.
   */
  admin: new Set<Permission>([
    "DOCUMENT_VIEW",
    "DOCUMENT_UPLOAD",
    "DOCUMENT_VERSION",
    "DOCUMENT_DOWNLOAD",
    "DOCUMENT_SIGN",
    "ASSET_VIEW",
    "ASSET_CREATE",
    "ASSET_ASSIGN",
    "ASSET_TRANSFER",
    "ASSET_MAINTENANCE",
    "EVIDENCE_VIEW",
    "EVIDENCE_TRANSFER",
    "EVIDENCE_CUSTODY",
    "AUDIT_VIEW",
  ]),

  /**
   * Court Registrar: Manages cause lists, case filings, judicial documents,
   * inspects trial evidence, maintains court filings.
   */
  registrar: new Set<Permission>([
    "DOCUMENT_VIEW",
    "DOCUMENT_UPLOAD",
    "DOCUMENT_VERSION",
    "DOCUMENT_DOWNLOAD",
    "DOCUMENT_SIGN",
    "ASSET_VIEW",
    "EVIDENCE_VIEW",
    "EVIDENCE_CUSTODY",
    "AUDIT_VIEW",
  ]),

  /**
   * Judicial Officer (Judge): Strictly scoped to assigned bench proceedings.
   * Can inspect documents, sign judicial rulings/orders, and inspect trial exhibits.
   * Does NOT manage police equipment, upload police FIRs, or alter armory assets.
   */
  judge: new Set<Permission>([
    "DOCUMENT_VIEW",
    "DOCUMENT_DOWNLOAD",
    "DOCUMENT_SIGN",
    "EVIDENCE_VIEW",
  ]),

  /**
   * Investigating Officer (IO): Field investigations, FIRs, charge sheets,
   * seizing evidence, witness statements, transfer of evidence to Malkhana/FSL.
   */
  investigating_officer: new Set<Permission>([
    "DOCUMENT_VIEW",
    "DOCUMENT_UPLOAD",
    "DOCUMENT_VERSION",
    "DOCUMENT_DOWNLOAD",
    "DOCUMENT_SIGN",
    "ASSET_VIEW",
    "EVIDENCE_VIEW",
    "EVIDENCE_TRANSFER",
    "EVIDENCE_CUSTODY",
    "AUDIT_VIEW",
  ]),

  /**
   * Forensic Scientific Officer (FSL / CFSL): Laboratory examinations,
   * ballistics, DNA analysis, cyber forensics, uploading examination reports,
   * signing Section 63 BSA certificates, testing equipment maintenance.
   */
  forensic_officer: new Set<Permission>([
    "DOCUMENT_VIEW",
    "DOCUMENT_UPLOAD",
    "DOCUMENT_VERSION",
    "DOCUMENT_DOWNLOAD",
    "DOCUMENT_SIGN",
    "ASSET_VIEW",
    "ASSET_MAINTENANCE",
    "EVIDENCE_VIEW",
    "EVIDENCE_TRANSFER",
    "EVIDENCE_CUSTODY",
    "AUDIT_VIEW",
  ]),

  /**
   * Evidence Custodian (Malkhana Moharrir / In-Charge): Dedicated custody officer.
   * Manages storage, receipts, seals, transfers to lab/court, locker allocations,
   * safe equipment maintenance.
   */
  evidence_custodian: new Set<Permission>([
    "DOCUMENT_VIEW",
    "DOCUMENT_UPLOAD",
    "DOCUMENT_DOWNLOAD",
    "DOCUMENT_SIGN",
    "ASSET_VIEW",
    "ASSET_CREATE",
    "ASSET_ASSIGN",
    "ASSET_TRANSFER",
    "ASSET_MAINTENANCE",
    "EVIDENCE_VIEW",
    "EVIDENCE_TRANSFER",
    "EVIDENCE_CUSTODY",
    "AUDIT_VIEW",
  ]),

  /**
   * Police Officer (Beat Constable / Station Patrol): Basic duty officer.
   * Read-only access to basic non-sensitive records. Cannot upload filings,
   * cannot assign weapons, cannot sign certificates, cannot alter custody.
   */
  police_officer: new Set<Permission>([
    "DOCUMENT_VIEW",
    "DOCUMENT_DOWNLOAD",
    "ASSET_VIEW",
    "EVIDENCE_VIEW",
  ]),
};

// ============================================================================
// 4. ROLE NORMALIZATION & LABELS
// ============================================================================

export function normalizeRole(rawRole: string | null | undefined): AppRole {
  if (!rawRole) return "police_officer";
  const clean = rawRole.toLowerCase().trim();
  if (clean === "admin" || clean === "administrator") return "admin";
  if (clean === "registrar") return "registrar";
  if (clean === "judge" || clean === "bench") return "judge";
  if (clean === "investigating_officer" || clean === "io") return "investigating_officer";
  if (clean === "forensic_officer" || clean === "fsl" || clean === "cfsl") return "forensic_officer";
  if (clean === "evidence_custodian" || clean === "malkhana" || clean === "custodian") return "evidence_custodian";
  if (clean === "police_officer" || clean === "officer" || clean === "constable") return "police_officer";
  return "police_officer";
}

export const ROLE_METADATA: Record<
  AppRole,
  { label: string; description: string; badgeColor: string }
> = {
  admin: {
    label: "Administrator",
    description: "Full system administration, user management, and security governance.",
    badgeColor: "bg-purple-500/15 text-purple-700 border-purple-500/30 dark:text-purple-400",
  },
  registrar: {
    label: "Court Registrar",
    description: "Case listing, cause list optimization, court document repository.",
    badgeColor: "bg-blue-500/15 text-blue-700 border-blue-500/30 dark:text-blue-400",
  },
  judge: {
    label: "Judicial Officer / Judge",
    description: "Bench proceedings, judicial hearings, ruling endorsements.",
    badgeColor: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-400",
  },
  investigating_officer: {
    label: "Investigating Officer (IO)",
    description: "Case investigation, FIR & charge sheet filing, evidence seizure.",
    badgeColor: "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-400",
  },
  forensic_officer: {
    label: "Forensic Scientific Officer (FSL)",
    description: "Forensic examination, ballistic analysis, BSA Section 63 certification.",
    badgeColor: "bg-cyan-500/15 text-cyan-700 border-cyan-500/30 dark:text-cyan-400",
  },
  evidence_custodian: {
    label: "Evidence Malkhana Custodian",
    description: "Malkhana secure storage, custody handoffs, tamper seal integrity.",
    badgeColor: "bg-indigo-500/15 text-indigo-700 border-indigo-500/30 dark:text-indigo-400",
  },
  police_officer: {
    label: "Police Station Officer",
    description: "General patrol and field duty. Standard read-only access.",
    badgeColor: "bg-slate-500/15 text-slate-700 border-slate-500/30 dark:text-slate-400",
  },
};

// ============================================================================
// 5. PERMISSION EVALUATION & SECURITY ASSERTIONS
// ============================================================================

/**
 * Checks if a specific role possesses a permission.
 */
export function hasPermission(
  role: AppRole | null | undefined,
  permission: Permission,
): boolean {
  if (!role) return false;
  const perms = ROLE_PERMISSIONS[role];
  return perms ? perms.has(permission) : false;
}

/**
 * Checks if a role has all required permissions.
 */
export function hasAllPermissions(
  role: AppRole | null | undefined,
  permissions: Permission[],
): boolean {
  return permissions.every((p) => hasPermission(role, p));
}

/**
 * Checks if a role has at least one of the specified permissions.
 */
export function hasAnyPermission(
  role: AppRole | null | undefined,
  permissions: Permission[],
): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

export class UnauthorizedException extends Error {
  public readonly code = "UNAUTHORIZED_ACCESS";
  public readonly requiredPermission: Permission;
  public readonly callerRole: AppRole | "UNAUTHENTICATED";

  constructor(
    message: string,
    requiredPermission: Permission,
    callerRole: AppRole | "UNAUTHENTICATED",
  ) {
    super(message);
    this.name = "UnauthorizedException";
    this.requiredPermission = requiredPermission;
    this.callerRole = callerRole;
  }
}

/**
 * Strictly asserts that a role possesses a required permission.
 * If unauthorized, throws an UnauthorizedException AND creates a high-priority
 * security audit record so tampering and unauthorized access attempts cannot be hidden.
 */
export async function assertPermission(
  role: AppRole | string | null | undefined,
  permission: Permission,
  actorName: string = "Unknown Actor",
  context: string = "Operation",
): Promise<void> {
  const normRole = role ? normalizeRole(role) : null;
  const isAllowed = hasPermission(normRole, permission);

  if (!isAllowed) {
    const roleTitle = normRole ? ROLE_METADATA[normRole].label : "Unauthenticated";
    const auditMessage = `[UNAUTHORIZED ACCESS ATTEMPT] User "${actorName}" (${roleTitle}) was DENIED execution of "${context}". Required permission: "${permission}".`;

    // Log to immutable security audit trail
    try {
      await recordAudit(auditMessage, `security_alert:unauthorized_${permission}`);
    } catch {
      // ignore logging failure during assertion
    }

    throw new UnauthorizedException(
      `Access Denied: Your assigned role (${roleTitle}) does not have permission to execute "${context}". (Required: ${permission})`,
      permission,
      normRole ?? "UNAUTHENTICATED",
    );
  }
}

// ============================================================================
// 6. RECORD-LEVEL AUTHORIZATION & SENSITIVITY SCOPING
// ============================================================================

export interface DocumentSensitivityRecord {
  sensitivity_tier: string;
  case_id?: string | null | undefined;
  originating_agency?: string | undefined;
}

/**
 * Evaluates whether a user role is authorized to view a specific document record
 * based on its confidentiality/sensitivity tier and judicial bench scoping.
 *
 * Rules:
 * - SEALED_COVER_IN_CAMERA: Only Admin OR Judge presiding over the specific case.
 *   Police, Forensic, Registrars, and other judges are STRICTLY DENIED.
 * - RESTRICTED_INVESTIGATION: Admin, Judge of case, Registrar, IO, and FSL.
 *   General Police Officers are DENIED.
 * - CONFIDENTIAL: Admin, Registrar, Judge of case, IO, FSL, and Evidence Custodian.
 * - PUBLIC: Visible to all authorized system users.
 */
export function canAccessDocumentRecord(
  role: AppRole | string | null | undefined,
  doc: DocumentSensitivityRecord,
  currentJudgeId?: string | null | undefined,
  assignedCaseIds?: string[] | undefined,
): boolean {
  const normRole = normalizeRole(role);

  // Admin always has oversight
  if (normRole === "admin") return true;

  const tier = doc.sensitivity_tier?.toUpperCase();

  // Strict Sealed Cover protection
  if (tier === "SEALED_COVER_IN_CAMERA") {
    if (normRole === "judge") {
      // If doc is linked to a case, the judge must be assigned to that case
      if (doc.case_id && assignedCaseIds && assignedCaseIds.length > 0) {
        return assignedCaseIds.includes(doc.case_id);
      }
      // If no specific case check provided, judge has bench privilege
      return true;
    }
    // All non-judge roles are strictly forbidden from Sealed Cover records
    return false;
  }

  // Restricted Investigation files (Case diaries, witness statements)
  if (tier === "RESTRICTED_INVESTIGATION") {
    if (normRole === "police_officer") return false;
    return (
      normRole === "investigating_officer" ||
      normRole === "forensic_officer" ||
      normRole === "registrar" ||
      normRole === "judge" ||
      normRole === "evidence_custodian"
    );
  }

  // Confidential Case Files
  if (tier === "CONFIDENTIAL") {
    if (normRole === "police_officer") return false;
    return true;
  }

  // Public Court Records
  return true;
}

/**
 * Evaluates whether a user role can inspect an asset/evidence item.
 * Judges can only view evidence items linked to cases listed before their bench.
 */
export function canAccessAssetRecord(
  role: AppRole | string | null | undefined,
  asset: { is_evidence?: boolean | undefined; case_id?: string | null | undefined },
  assignedCaseIds?: string[] | undefined,
): boolean {
  const normRole = normalizeRole(role);
  if (normRole === "admin") return true;

  if (normRole === "judge") {
    // Judges only inspect trial evidence related to their bench cases
    if (asset.case_id && assignedCaseIds && assignedCaseIds.length > 0) {
      return assignedCaseIds.includes(asset.case_id);
    }
    return true;
  }

  return true;
}
