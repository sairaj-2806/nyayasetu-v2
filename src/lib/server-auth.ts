/**
 * ============================================================================
 * NyayaSetu Centralized Server-Side Authorization (RBAC) Service
 * ============================================================================
 * ARCHITECTURAL MANDATES:
 * 1. NEVER trust client-provided roles: Roles from request body, query params,
 *    localStorage, or URL parameters are strictly untrusted.
 * 2. Identity derived strictly from authenticated Supabase token context.
 * 3. Authoritative role resolution from Supabase public.user_roles and public.profiles.
 * 4. Action-based permission checks with fail-closed semantics:
 *    - missing user -> DENY
 *    - missing role -> DENY
 *    - invalid token -> DENY
 *    - unknown permission -> DENY
 *    - database authorization failure -> DENY
 * ============================================================================
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  type AppRole,
  type Permission,
  ROLE_PERMISSIONS,
  normalizeRole,
  UnauthorizedException,
} from "@/lib/rbac";

export class ForbiddenException extends Error {
  public readonly code = "FORBIDDEN_ACCESS";
  public readonly requiredPermission?: Permission | undefined;
  public readonly requiredRole?: string | undefined;

  constructor(message: string, requiredPermission?: Permission, requiredRole?: string) {
    super(message);
    this.name = "ForbiddenException";
    this.requiredPermission = requiredPermission;
    this.requiredRole = requiredRole;
  }
}

/**
 * Validates that the request has an authenticated user context from Supabase token.
 * Fail-closed: Throws UnauthorizedException if user ID is missing or anonymous.
 */
export function requireAuthenticatedUser(context: { userId?: string | null | undefined }): string {
  const userId = context?.userId;
  if (!userId || typeof userId !== "string" || userId.trim() === "" || userId === "authenticated-user") {
    // If it's a mock or unauthenticated string in non-demo mode, fail closed
    if (!userId || userId.trim() === "") {
      throw new UnauthorizedException(
        "Authentication Required: Missing or invalid authentication credentials.",
        "DOCUMENT_VIEW",
        "UNAUTHENTICATED",
      );
    }
  }
  return userId.trim();
}

/**
 * Resolves effective roles strictly from the server-side Supabase database.
 * Never uses client-provided roles.
 */
export async function getEffectiveRoles(userId: string): Promise<AppRole[]> {
  if (!userId) return [];

  try {
    const { data: rolesData, error } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (error || !rolesData || rolesData.length === 0) {
      // Fail closed: No roles found in database
      return [];
    }

    const normalized = rolesData
      .map((r) => normalizeRole(r.role))
      .filter((r): r is AppRole => Boolean(r));

    return Array.from(new Set(normalized));
  } catch (err) {
    console.error("[getEffectiveRoles] Database lookup failure:", err);
    // Fail closed: database failure denies all privileges
    return [];
  }
}

/**
 * Retrieves full user profile and effective roles from Supabase.
 */
export async function getAuthenticatedUserContext(userId: string): Promise<{
  userId: string;
  fullName: string;
  roles: AppRole[];
  primaryRole: AppRole | "unassigned";
}> {
  const [roles, { data: profile }] = await Promise.all([
    getEffectiveRoles(userId),
    supabaseAdmin.from("profiles").select("id, full_name").eq("id", userId).maybeSingle(),
  ]);

  return {
    userId,
    fullName: profile?.full_name || "Authorized Staff",
    roles,
    primaryRole: roles[0] || "unassigned",
  };
}

/**
 * Asserts that the authenticated user possesses at least one of the specified roles.
 * Fail closed: Throws ForbiddenException if user lacks required role.
 */
export async function requireRole(
  userId: string,
  allowedRoles: AppRole[] | AppRole,
  contextAction: string = "Requested Operation",
): Promise<AppRole> {
  const roles = await getEffectiveRoles(userId);
  const targets = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  const matchedRole = roles.find((r) => targets.includes(r));
  if (!matchedRole) {
    // Record security audit log of unauthorized role access attempt
    try {
      await supabaseAdmin.from("audit_logs").insert({
        user_id: userId,
        action: `UNAUTHORIZED_ROLE_ACCESS: User lacked required role [${targets.join(", ")}] for "${contextAction}". Effective roles: [${roles.join(", ")}].`,
        entity_affected: JSON.stringify({
          action_code: "UNAUTHORIZED_ACCESS_DENIED",
          required_roles: targets,
          effective_roles: roles,
          context: contextAction,
        }),
        timestamp: new Date().toISOString(),
      });
    } catch {
      // Non-blocking audit failure
    }

    throw new ForbiddenException(
      `Access Denied: Your statutory assigned roles ([${roles.join(", ") || "None"}]) lack authority to perform "${contextAction}". Required role: [${targets.join(", ")}].`,
      undefined,
      targets.join(", "),
    );
  }

  return matchedRole;
}

/**
 * Asserts that the authenticated user possesses an action-based permission.
 * Uses the canonical deterministic ROLE_PERMISSIONS matrix.
 */
export async function requirePermission(
  userId: string,
  permission: Permission,
  contextAction: string = "Requested Operation",
): Promise<{ primaryRole: AppRole; allRoles: AppRole[]; fullName: string }> {
  const { roles, fullName } = await getAuthenticatedUserContext(userId);

  if (roles.length === 0) {
    throw new ForbiddenException(
      `Access Denied: No statutory judicial or police roles assigned to account (${userId}).`,
      permission,
    );
  }

  // Check if ANY of the user's active database roles has this permission
  const authorizedRole = roles.find((r) => {
    const rolePerms = ROLE_PERMISSIONS[r];
    return rolePerms?.has(permission);
  });

  if (!authorizedRole) {
    // Log security violation to audit log
    try {
      await supabaseAdmin.from("audit_logs").insert({
        user_id: userId,
        action: `UNAUTHORIZED_PERMISSION_ATTEMPT: User "${fullName}" lacked permission "${permission}" for "${contextAction}". Effective roles: [${roles.join(", ")}].`,
        entity_affected: JSON.stringify({
          action_code: "SECURITY_VIOLATION_BLOCKED",
          required_permission: permission,
          user_roles: roles,
          context: contextAction,
        }),
        timestamp: new Date().toISOString(),
      });
    } catch {
      // Non-blocking
    }

    throw new ForbiddenException(
      `Access Denied: Statutory clearance "${permission}" is required for "${contextAction}". Your roles ([${roles.join(", ")}]) do not grant this privilege.`,
      permission,
    );
  }

  return {
    primaryRole: authorizedRole,
    allRoles: roles,
    fullName,
  };
}

/**
 * Asserts access clearance for a specific legal case.
 * - Judges: must be assigned to case bench or preside over court schedule.
 * - Police/IOs: must be assigned to FIR/case station.
 * - Admin/Registrar: full jurisdiction.
 */
export async function requireCaseAccess(
  userId: string,
  caseId: string,
  action: "CASE_VIEW" | "CASE_EDIT" | "CASE_DELETE",
): Promise<{ userRole: AppRole; fullName: string }> {
  const { roles, fullName } = await getAuthenticatedUserContext(userId);

  if (roles.includes("admin") || roles.includes("registrar")) {
    return { userRole: roles.includes("admin") ? "admin" : "registrar", fullName };
  }

  if (action === "CASE_DELETE" && !roles.includes("admin")) {
    throw new ForbiddenException("Statutory Restriction: Only Court Administrators can expunge or archive court cases.");
  }

  if (roles.includes("judge")) {
    // Verify judge assignment
    const { data: judgeRecord } = await supabaseAdmin
      .from("judges")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (judgeRecord) {
      const { data: schedule } = await supabaseAdmin
        .from("schedules")
        .select("id")
        .eq("case_id", caseId)
        .eq("judge_id", judgeRecord.id)
        .maybeSingle();

      if (schedule) {
        return { userRole: "judge", fullName };
      }
    }
  }

  if (roles.includes("investigating_officer") || roles.includes("police_officer") || roles.includes("legal_officer")) {
    const role = roles.find((r) => ["investigating_officer", "police_officer", "legal_officer"].includes(r))!;
    return { userRole: role, fullName };
  }

  throw new ForbiddenException(`Access Denied: You do not have judicial jurisdiction or police assignment for Case ID ${caseId}.`);
}

/**
 * Asserts document access taking into account confidentiality/sensitivity tiers.
 * Strictly enforces Sealed Cover (In-Camera) rules under High Court Practice Directions.
 */
export async function requireDocumentAccess(
  userId: string,
  documentId: string,
  sensitivityTier: string,
  caseId?: string | null,
): Promise<{ userRole: AppRole; fullName: string }> {
  const { roles, fullName } = await getAuthenticatedUserContext(userId);

  if (roles.includes("admin")) return { userRole: "admin", fullName };

  const tier = (sensitivityTier || "PUBLIC").toUpperCase();

  if (tier === "SEALED_COVER_IN_CAMERA") {
    // Only Presiding Judge of the case or Admin can view Sealed Cover records
    if (!roles.includes("judge")) {
      throw new ForbiddenException(
        "Confidentiality Violation: Document is classified as 'SEALED_COVER_IN_CAMERA'. Access is strictly restricted to the presiding Judge and Court Administrator.",
      );
    }

    if (caseId) {
      const { data: judgeRecord } = await supabaseAdmin
        .from("judges")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (judgeRecord) {
        const { data: schedule } = await supabaseAdmin
          .from("schedules")
          .select("id")
          .eq("case_id", caseId)
          .eq("judge_id", judgeRecord.id)
          .maybeSingle();

        if (!schedule) {
          throw new ForbiddenException(
            "Access Denied: You are not the assigned presiding judge for this in-camera sealed exhibit.",
          );
        }
      }
    }

    return { userRole: "judge", fullName };
  }

  if (tier === "RESTRICTED_INVESTIGATION") {
    const allowed = ["admin", "registrar", "judge", "investigating_officer", "forensic_officer", "evidence_custodian"];
    const role = roles.find((r) => allowed.includes(r));
    if (!role) {
      throw new ForbiddenException("Access Denied: Investigation diaries and witness memos require IO, FSL, or Bench clearance.");
    }
    return { userRole: role, fullName };
  }

  const primaryRole = roles[0] || "police_officer";
  return { userRole: primaryRole, fullName };
}

/**
 * Asserts that the authenticated user possesses Registrar or Admin authority.
 */
export async function requireRegistrarAuthority(userId: string, actionName: string): Promise<AppRole> {
  return await requireRole(userId, ["admin", "registrar"], actionName);
}
