import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { BacklogCase } from "@/lib/backlog-simulation";
import { checkRateLimit } from "@/lib/rate-limit.server";
import { getEffectiveRoles } from "@/lib/server-auth";
import { hasAnyPermission, normalizeRole } from "@/lib/rbac";

/**
 * SEC-12: Server function to fetch active cases for the Backlog Simulator.
 * Strictly authenticated. Restricts internal case metrics, priority scores,
 * and statutory deadlines to authorized registry staff and judicial officers.
 */
export const getBacklogSimulationCases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BacklogCase[]> => {
    try {
      const userId = context.userId;
      const request = getRequest();
      const clientIp =
        request?.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request?.headers?.get("x-real-ip") ||
        "anonymous";

      const rateCheck = checkRateLimit(`backlog-sim:${userId}:${clientIp}`, {
        maxRequests: 30,
        windowMs: 60_000,
      });
      if (!rateCheck.allowed) {
        throw new Error("Rate limit exceeded. Please wait before refreshing simulation data.");
      }

      const userRoles = await getEffectiveRoles(userId);
      if (userRoles.length === 0) {
        // Fail closed: Unassigned users have zero clearance to inspect court backlog metrics
        return [];
      }

      const primaryRole = userRoles[0];
      const isAuthorized =
        primaryRole === "admin" ||
        primaryRole === "registrar" ||
        primaryRole === "judge";

      if (!isAuthorized) {
        return [];
      }

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data, error } = await supabaseAdmin
        .from("cases")
        .select(
          "id, case_number, filing_date, priority_score, priority_tier, statutory_limitation_deadline",
        )
        .neq("status", "disposed")
        .order("filing_date", { ascending: true });

      if (error) {
        console.error("Database query error in getBacklogSimulationCases:", error);
        return [];
      }
      return (data ?? []) as BacklogCase[];
    } catch (err) {
      console.error("Failed to load backlog cases:", err);
      return [];
    }
  });
