import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  getOfflineStaffSession,
  cacheStaffCredentialsLocally,
} from "@/lib/offline-auth";
import {
  AppRole,
  hasPermission,
  normalizeRole,
  ROLE_METADATA,
} from "@/lib/rbac";

export type StaffRole = AppRole;

export type CurrentStaff = {
  id: string;
  email: string;
  fullName: string;
  role: StaffRole;
  /** Judge record linked to this login, when the account is a bench account. */
  judgeId: string | null;
  judgeName: string | null;
  isOfflineSession?: boolean;
};

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

          const has = (r: string) => roles?.some((row) => row.role === r) ?? false;
          let role: StaffRole = "police_officer";

          if (has("admin")) {
            role = "admin";
          } else if (has("judge") || bench?.id) {
            role = "judge";
          } else if (has("investigating_officer")) {
            role = "investigating_officer";
          } else if (has("forensic_officer")) {
            role = "forensic_officer";
          } else if (has("evidence_custodian")) {
            role = "evidence_custodian";
          } else if (has("police_officer")) {
            role = "police_officer";
          } else if (has("registrar")) {
            role = "registrar";
          } else if (roles?.[0]?.role) {
            role = normalizeRole(roles[0].role);
          }

          const staffInfo: CurrentStaff = {
            id: user.id,
            email: user.email ?? "",
            fullName: profile?.full_name?.trim() || (user.email ?? "").split("@")[0] || "Staff",
            role,
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
        return {
          id: offlineSession.id,
          email: offlineSession.email,
          fullName: offlineSession.fullName,
          role: normalizeRole(offlineSession.role),
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
  // Legacy / Judicial registry permissions
  canManageRegistry: boolean;
  canManageSettings: boolean;
  canSchedule: boolean;
  canEditAvailability: boolean;
  isJudge: boolean;

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
    canManageRegistry: normRole === "admin",
    canManageSettings: normRole === "admin",
    canSchedule: normRole === "admin" || normRole === "registrar",
    canEditAvailability: normRole === "admin" || normRole === "registrar",
    isJudge: normRole === "judge",

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
};
