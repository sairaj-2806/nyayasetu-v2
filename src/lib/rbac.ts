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
  | "police_officer"
  | "legal_officer"
  | "document_officer"
  | "unassigned";

export const APP_ROLES: Record<string, AppRole> = {
  ADMIN: "admin",
  REGISTRAR: "registrar",
  JUDGE: "judge",
  INVESTIGATING_OFFICER: "investigating_officer",
  FORENSIC_OFFICER: "forensic_officer",
  EVIDENCE_CUSTODIAN: "evidence_custodian",
  POLICE_OFFICER: "police_officer",
  LEGAL_OFFICER: "legal_officer",
  DOCUMENT_OFFICER: "document_officer",
  UNASSIGNED: "unassigned",
} as const;

export const ALL_ROLES: AppRole[] = [
  "admin",
  "registrar",
  "judge",
  "investigating_officer",
  "forensic_officer",
  "evidence_custodian",
  "police_officer",
  "legal_officer",
  "document_officer",
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

  /**
   * Legal Officer / Public Prosecutor:
   * Reviews charge sheets, trial filings, prosecution notices, authorized documents & evidence.
   */
  legal_officer: new Set<Permission>([
    "DOCUMENT_VIEW",
    "DOCUMENT_DOWNLOAD",
    "DOCUMENT_SIGN",
    "EVIDENCE_VIEW",
    "AUDIT_VIEW",
  ]),

  /**
   * Document & Records Vault Officer:
   * Manages secure vault, version history, upload queue, digital integrity and signatures.
   */
  document_officer: new Set<Permission>([
    "DOCUMENT_VIEW",
    "DOCUMENT_UPLOAD",
    "DOCUMENT_VERSION",
    "DOCUMENT_DOWNLOAD",
    "DOCUMENT_SIGN",
    "AUDIT_VIEW",
  ]),

  /**
   * Unassigned Account: Pending verification.
   * STRICTLY ZERO PRIVILEGED PERMISSIONS.
   */
  unassigned: new Set<Permission>([]),
};

// ============================================================================
// 4. ROLE NORMALIZATION & LABELS
// ============================================================================

export function normalizeRole(rawRole: string | null | undefined): AppRole {
  if (!rawRole) return "unassigned";
  const clean = rawRole.toLowerCase().trim();
  if (clean === "admin" || clean === "administrator") return "admin";
  if (clean === "registrar") return "registrar";
  if (clean === "judge" || clean === "bench") return "judge";
  if (clean === "investigating_officer" || clean === "io") return "investigating_officer";
  if (clean === "forensic_officer" || clean === "fsl" || clean === "cfsl")
    return "forensic_officer";
  if (clean === "evidence_custodian" || clean === "malkhana" || clean === "custodian")
    return "evidence_custodian";
  if (
    clean === "legal_officer" ||
    clean === "prosecutor" ||
    clean === "legal" ||
    clean === "advocate" ||
    clean === "counsel"
  )
    return "legal_officer";
  if (
    clean === "document_officer" ||
    clean === "records" ||
    clean === "records_officer" ||
    clean === "document" ||
    clean === "vault"
  )
    return "document_officer";
  if (clean === "police_officer" || clean === "officer" || clean === "constable")
    return "police_officer";
  return "unassigned";
}

export const ROLE_METADATA: Record<
  AppRole,
  { label: string; description: string; badgeColor: string; defaultWorkspace: string }
> = {
  admin: {
    label: "Administrator",
    description: "Full system administration, user management, and security governance.",
    badgeColor: "bg-purple-500/15 text-purple-700 border-purple-500/30 dark:text-purple-400",
    defaultWorkspace: "admin",
  },
  registrar: {
    label: "Court Registrar",
    description: "Case listing, cause list optimization, court document repository.",
    badgeColor: "bg-blue-500/15 text-blue-700 border-blue-500/30 dark:text-blue-400",
    defaultWorkspace: "court",
  },
  judge: {
    label: "Judicial Officer / Judge",
    description: "Bench proceedings, judicial hearings, ruling endorsements.",
    badgeColor: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-400",
    defaultWorkspace: "court",
  },
  investigating_officer: {
    label: "Investigating Officer (IO)",
    description: "Case investigation, FIR & charge sheet filing, evidence seizure.",
    badgeColor: "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-400",
    defaultWorkspace: "investigation",
  },
  forensic_officer: {
    label: "Forensic Scientific Officer (FSL)",
    description: "Forensic examination, ballistic analysis, BSA Section 63 certification.",
    badgeColor: "bg-cyan-500/15 text-cyan-700 border-cyan-500/30 dark:text-cyan-400",
    defaultWorkspace: "forensic",
  },
  evidence_custodian: {
    label: "Evidence Malkhana Custodian",
    description: "Malkhana secure storage, custody handoffs, tamper seal integrity.",
    badgeColor: "bg-indigo-500/15 text-indigo-700 border-indigo-500/30 dark:text-indigo-400",
    defaultWorkspace: "evidence",
  },
  police_officer: {
    label: "Police Station Officer",
    description: "General patrol and field duty. Standard read-only access.",
    badgeColor: "bg-slate-500/15 text-slate-700 border-slate-500/30 dark:text-slate-400",
    defaultWorkspace: "police",
  },
  legal_officer: {
    label: "Legal Officer / Public Prosecutor",
    description: "Prosecution review, court filings, legal notices, and exhibit scrutiny.",
    badgeColor: "bg-teal-500/15 text-teal-700 border-teal-500/30 dark:text-teal-400",
    defaultWorkspace: "legal",
  },
  document_officer: {
    label: "Document & Records Vault Officer",
    description: "Secure Document Vault management, cryptographic verification, and version control.",
    badgeColor: "bg-sky-500/15 text-sky-700 border-sky-500/30 dark:text-sky-400",
    defaultWorkspace: "documents",
  },
  unassigned: {
    label: "Unassigned Account",
    description: "Account pending administrative verification and statutory role assignment.",
    badgeColor: "bg-red-500/15 text-red-700 border-red-500/30 dark:text-red-400",
    defaultWorkspace: "court",
  },
};

/**
 * Validates whether a specific role has authorization to enter a chosen workspace.
 * Prevents unauthorized users from accessing sensitive workspaces.
 */
export function canAccessWorkspace(
  role: AppRole | string | null | undefined,
  workspaceKey: string,
): boolean {
  const normRole = normalizeRole(role);
  if (normRole === "unassigned") return false;
  if (normRole === "admin") return true; // Admins have oversight across all workspaces

  switch (workspaceKey.toLowerCase()) {
    case "police":
      return (
        normRole === "police_officer" ||
        normRole === "investigating_officer" ||
        normRole === "evidence_custodian"
      );
    case "investigation":
      return normRole === "investigating_officer";
    case "forensic":
      return normRole === "forensic_officer";
    case "court":
      return normRole === "judge" || normRole === "registrar";
    case "legal":
      return normRole === "legal_officer";
    case "evidence":
      return normRole === "evidence_custodian";
    case "documents":
      return normRole === "document_officer" || normRole === "registrar";
    case "admin":
      return false;
    case "public":
      return true;
    default:
      return false;
  }
}

// ============================================================================
// 5. PERMISSION EVALUATION & SECURITY ASSERTIONS
// ============================================================================

/**
 * Checks if a specific role possesses a permission.
 */
export function hasPermission(role: AppRole | null | undefined, permission: Permission): boolean {
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
 * Asserts that the role possesses the required permission, or throws an UnauthorizedException.
 */
export async function assertPermission(
  role: AppRole | string | null | undefined,
  permission: Permission,
  userName?: string | undefined,
  contextAction?: string | undefined,
): Promise<void> {
  const normRole = normalizeRole(role);
  const authorized = hasPermission(normRole, permission);

  if (!authorized) {
    const actor = userName || "Unknown Actor";
    const context = contextAction || "Action";

    // Non-blocking audit log of unauthorized access attempt
    try {
      await recordAudit(
        `ACCESS_DENIED: User ${actor} (${normRole}) attempted '${permission}' for '${context}'.`,
        "SYSTEM_RBAC_GATEWAY",
        "UNAUTHORIZED_ACCESS_ATTEMPT",
      );
    } catch {
      // ignore
    }

    throw new UnauthorizedException(
      `Permission Denied: Your assigned role '${normRole}' lacks the required '${permission}' clearance.`,
      permission,
      normRole,
    );
  }
}

// ============================================================================
// 6. RECORD-LEVEL SECURITY & SENSITIVITY CLEARANCE
// ============================================================================

export interface DocumentSensitivityRecord {
  sensitivity_tier?: string | undefined;
  case_id?: string | null | undefined;
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
 * - CONFIDENTIAL: Admin, Registrar, Judge of case, IO, FSL, Legal Officer, and Evidence Custodian.
 *   General Police Officers and unassigned accounts are DENIED.
 * - PUBLIC: Visible to all authorized system users.
 */
export function canAccessDocumentRecord(
  role: AppRole | string | null | undefined,
  doc: DocumentSensitivityRecord,
  currentJudgeId?: string | null | undefined,
  assignedCaseIds?: string[] | undefined,
): boolean {
  const normRole = normalizeRole(role);

  // Unassigned accounts fail closed
  if (normRole === "unassigned") {
    return doc.sensitivity_tier?.toUpperCase() === "PUBLIC";
  }

  // Admin always has oversight
  if (normRole === "admin") return true;

  const tier = doc.sensitivity_tier?.toUpperCase();

  // Strict Sealed Cover protection (High Court In-Camera Rules)
  if (tier === "SEALED_COVER_IN_CAMERA") {
    if (normRole === "judge") {
      // If doc is linked to a case, the judge must be assigned to that case
      if (doc.case_id && assignedCaseIds && assignedCaseIds.length > 0) {
        return assignedCaseIds.includes(doc.case_id);
      }
      return true;
    }
    // All non-judge roles (including registrars and police) are strictly forbidden
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
    return (
      normRole === "registrar" ||
      normRole === "judge" ||
      normRole === "investigating_officer" ||
      normRole === "forensic_officer" ||
      normRole === "evidence_custodian" ||
      normRole === "legal_officer" ||
      normRole === "document_officer"
    );
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
  if (normRole === "unassigned") return false;
  if (normRole === "admin" || normRole === "registrar") return true;

  if (normRole === "judge") {
    // Judges only inspect trial evidence related to their bench cases
    if (asset.case_id && assignedCaseIds && assignedCaseIds.length > 0) {
      return assignedCaseIds.includes(asset.case_id);
    }
    // Judges do not inspect police armory weapons or non-case equipment
    return Boolean(asset.case_id);
  }

  return true;
}

/**
 * Evaluates whether a user role can inspect a court case record.
 * Fails closed for unassigned accounts.
 */
export function canAccessCaseRecord(
  role: AppRole | string | null | undefined,
  caseRecord: { id: string; judge_id?: string | null | undefined },
  currentJudgeId?: string | null | undefined,
  assignedCaseIds?: string[] | undefined,
): boolean {
  const normRole = normalizeRole(role);
  if (normRole === "unassigned") return false;
  if (normRole === "admin" || normRole === "registrar") return true;

  if (normRole === "judge") {
    if (assignedCaseIds && assignedCaseIds.length > 0) {
      return assignedCaseIds.includes(caseRecord.id);
    }
    if (currentJudgeId && caseRecord.judge_id) {
      return caseRecord.judge_id === currentJudgeId;
    }
    return true;
  }

  // Police, Forensic, Legal officers can view cases for official prosecution/filing duties
  return [
    "police_officer",
    "investigating_officer",
    "forensic_officer",
    "evidence_custodian",
    "legal_officer",
    "document_officer",
  ].includes(normRole);
}
