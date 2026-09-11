import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getOfflineStaffSession, cacheStaffCredentialsLocally } from "@/lib/offline-auth";
import { AppRole, hasPermission, normalizeRole, ROLE_METADATA } from "@/lib/rbac";

export type StaffRole = AppRole;

export type CurrentStaff = {
  id: string;
  email: string;
  fullName: string;
  role: StaffRole;
  /** All authorized roles assigned to this user */
  assignedRoles: StaffRole[];
  /** Judge record linked to this login, when the account is a bench account. */
  judgeId: string | null;
  judgeName: string | null;
  isOfflineSession?: boolean;
};

export function setUserActiveRole(newRole: StaffRole) {
  if (typeof window !== "undefined") {
    sessionStorage.setItem("nyayasetu:active-role", newRole);
  }
}

export function useCurrentStaff() {
  return useQuery<CurrentStaff | null>({
    queryKey: ["current-staff"],
    queryFn: async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const user = userData?.user;

        if (user) {
          const [{ data: profile }, { data: roles }, { data: bench }] = await Promise.all([
            supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
            supabase.from("user_roles").select("role").eq("user_id", user.id),
            supabase.from("judges").select("id, name").eq("user_id", user.id).maybeSingle(),
          ]);

          const rawAssigned = (roles?.map((row) => normalizeRole(row.role)) || []).filter(
            (r): r is StaffRole => r !== "unassigned",
          );
          if (bench?.id && !rawAssigned.includes("judge")) {
            rawAssigned.push("judge");
          }
          const assignedRoles: StaffRole[] =
            rawAssigned.length > 0 ? Array.from(new Set(rawAssigned)) : ["unassigned"];

          let defaultRole: StaffRole = assignedRoles[0] ?? "unassigned";
          if (assignedRoles.includes("admin")) defaultRole = "admin";
          else if (assignedRoles.includes("judge")) defaultRole = "judge";
          else if (assignedRoles.includes("registrar")) defaultRole = "registrar";
          else if (assignedRoles.includes("investigating_officer"))
            defaultRole = "investigating_officer";
          else if (assignedRoles.includes("forensic_officer")) defaultRole = "forensic_officer";
          else if (assignedRoles.includes("evidence_custodian")) defaultRole = "evidence_custodian";
          else if (assignedRoles.includes("legal_officer")) defaultRole = "legal_officer";
          else if (assignedRoles.includes("document_officer")) defaultRole = "document_officer";
          else if (assignedRoles.includes("police_officer")) defaultRole = "police_officer";
          else defaultRole = "unassigned";

          // Deterministic role: assigned role without client-side spoofing
          const activeRole = defaultRole;

          const staffInfo: CurrentStaff = {
            id: user.id,
            email: user.email ?? "",
            fullName: profile?.full_name?.trim() || (user.email ?? "").split("@")[0] || "Staff",
            role: activeRole,
            assignedRoles,
            judgeId: bench?.id ?? null,
            judgeName: bench?.name ?? null,
            isOfflineSession: false,
          };

          // Cache metadata to local vault for future offline logins
          cacheStaffCredentialsLocally(staffInfo);

          return staffInfo;
        }
      } catch (err) {
        console.warn("Unable to fetch online staff profile, checking offline vault", err);
      }

      // Check offline session
      const offlineSession = getOfflineStaffSession();
      if (offlineSession) {
        const norm = normalizeRole(offlineSession.role);
        return {
          id: offlineSession.id,
          email: offlineSession.email,
          fullName: offlineSession.fullName,
          role: norm,
          assignedRoles: [norm],
          judgeId: offlineSession.judgeId,
          judgeName: offlineSession.judgeName,
          isOfflineSession: true,
        };
      }

      return null;
    },
    staleTime: 60_000,
    networkMode: "offlineFirst",
  });
}

/**
 * UI-level permission gates. These mirror the database RLS policies so unauthorised
 * roles never see an action they cannot complete.
 */
export type StaffPermissions = {
  isAdmin: boolean;
  // Legacy / Judicial registry permissions
  canManageRegistry: boolean;
  canManageSettings: boolean;
  canSchedule: boolean;
  canEditAvailability: boolean;
  isJudge: boolean;
  isLegalOfficer: boolean;
  isDocumentOfficer: boolean;
  isInvestigatingOfficer: boolean;
  isForensicOfficer: boolean;
  isEvidenceCustodian: boolean;
  isPoliceOfficer: boolean;

  // Granular DMS, Asset, Evidence & Audit permissions
  canViewDocuments: boolean;
  canUploadDocuments: boolean;
  canVersionDocuments: boolean;
  canDownloadDocuments: boolean;
  canSignDocuments: boolean;
  canViewAssets: boolean;
  canCreateAssets: boolean;
  canAssignAssets: boolean;
  canTransferAssets: boolean;
  canMaintainAssets: boolean;
  canViewEvidence: boolean;
  canTransferEvidence: boolean;
  canCustodyEvidence: boolean;
  canViewAudit: boolean;
};

export function permissionsFor(role: StaffRole | null | undefined): StaffPermissions {
  const normRole = role ? normalizeRole(role) : null;
  return {
    isAdmin: normRole === "admin",
    canManageRegistry: normRole === "admin",
    canManageSettings: normRole === "admin",
    canSchedule: normRole === "admin" || normRole === "registrar",
    canEditAvailability: normRole === "admin" || normRole === "registrar",
    isJudge: normRole === "judge",
    isLegalOfficer: normRole === "legal_officer",
    isDocumentOfficer: normRole === "document_officer",
    isInvestigatingOfficer: normRole === "investigating_officer",
    isForensicOfficer: normRole === "forensic_officer",
    isEvidenceCustodian: normRole === "evidence_custodian",
    isPoliceOfficer: normRole === "police_officer",

    // Granular permissions
    canViewDocuments: hasPermission(normRole, "DOCUMENT_VIEW"),
    canUploadDocuments: hasPermission(normRole, "DOCUMENT_UPLOAD"),
    canVersionDocuments: hasPermission(normRole, "DOCUMENT_VERSION"),
    canDownloadDocuments: hasPermission(normRole, "DOCUMENT_DOWNLOAD"),
    canSignDocuments: hasPermission(normRole, "DOCUMENT_SIGN"),
    canViewAssets: hasPermission(normRole, "ASSET_VIEW"),
    canCreateAssets: hasPermission(normRole, "ASSET_CREATE"),
    canAssignAssets: hasPermission(normRole, "ASSET_ASSIGN"),
    canTransferAssets: hasPermission(normRole, "ASSET_TRANSFER"),
    canMaintainAssets: hasPermission(normRole, "ASSET_MAINTENANCE"),
    canViewEvidence: hasPermission(normRole, "EVIDENCE_VIEW"),
    canTransferEvidence: hasPermission(normRole, "EVIDENCE_TRANSFER"),
    canCustodyEvidence: hasPermission(normRole, "EVIDENCE_CUSTODY"),
    canViewAudit: hasPermission(normRole, "AUDIT_VIEW"),
  };
}

/** Convenience hook: current staff permissions (all false until the role is known). */
export function usePermissions(): StaffPermissions & { ready: boolean } {
  const staff = useCurrentStaff();
  return { ...permissionsFor(staff.data?.role), ready: !staff.isLoading };
}

export const roleLabel: Record<StaffRole, string> = {
  admin: ROLE_METADATA.admin.label,
  registrar: ROLE_METADATA.registrar.label,
  judge: ROLE_METADATA.judge.label,
  investigating_officer: ROLE_METADATA.investigating_officer.label,
  forensic_officer: ROLE_METADATA.forensic_officer.label,
  evidence_custodian: ROLE_METADATA.evidence_custodian.label,
  police_officer: ROLE_METADATA.police_officer.label,
  legal_officer: ROLE_METADATA.legal_officer.label,
  document_officer: ROLE_METADATA.document_officer.label,
  auditor: ROLE_METADATA.auditor.label,
  unassigned: ROLE_METADATA.unassigned.label,
};
