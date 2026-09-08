import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { executeUnifiedSearch, type UnifiedSearchResult } from "@/lib/global-search";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sanitizeUserInput } from "@/lib/security.server";
import { checkRateLimit } from "@/lib/rate-limit.server";

const SearchInputSchema = z.object({
  query: z.string().max(300),
  filters: z
    .object({
      entityType: z
        .enum([
          "all",
          "case",
          "document",
          "document_version",
          "police_asset",
          "evidence",
          "officer_custodian",
          "location",
          "audit_event",
        ])
        .optional(),
      caseNumber: z.string().optional(),
      documentType: z.string().optional(),
      assetType: z.string().optional(),
      status: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      location: z.string().optional(),
    })
    .optional(),
  userRole: z.string().optional(),
  userId: z.string().optional(),
});

export const searchGlobalRegistry = createServerFn({ method: "POST" })
  .validator((data: unknown) => SearchInputSchema.parse(data))
  .handler(async ({ data }): Promise<UnifiedSearchResult> => {
    // 1. Rate Limiting protection keyed per caller IP / session
    const request = getRequest();
    const clientIp =
      request?.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request?.headers?.get("x-real-ip") ||
      data.userId ||
      "anonymous-searcher";

    const rateCheck = checkRateLimit(`search:${clientIp}`, {
      maxRequests: 60,
      windowMs: 60_000,
    });

    if (!rateCheck.allowed) {
      return {
        query: data.query,
        totalMatches: 0,
        items: [],
        byEntityCount: {
          case: 0,
          document: 0,
          document_version: 0,
          police_asset: 0,
          evidence: 0,
          officer_custodian: 0,
          location: 0,
          audit_event: 0,
        },
        executionTimeMs: 0,
        isAuthorizedView: true,
        filteredOutCount: 0,
      };
    }

    // 2. Strict Server-Side Role Resolution (Prevent client role spoofing)
    let effectiveRole = "police_officer"; // Safe least-privilege default
    let effectiveUserId = data.userId;

    const authHeader = request?.headers?.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      try {
        const { data: authData } = await supabaseAdmin.auth.getUser(token);
        if (authData?.user) {
          effectiveUserId = authData.user.id;
          const { data: roleRow } = await supabaseAdmin
            .from("user_roles")
            .select("role")
            .eq("user_id", authData.user.id)
            .maybeSingle();

          if (roleRow?.role) {
            effectiveRole = roleRow.role;
          }
        }
      } catch {
        // Fall back to least privilege
      }
    } else if (data.userRole) {
      // In local offline development mode without token, only allow non-administrative tiers;
      // never allow escalating to admin or judge without backend confirmation
      const requested = data.userRole.toLowerCase().trim();
      if (requested === "admin" || requested === "judge") {
        // Untrusted claim of admin/judge without valid bearer token rejected to least privilege
        effectiveRole = "police_officer";
      } else {
        effectiveRole = requested;
      }
    }

    const sanitizedQuery = sanitizeUserInput(data.query, 300);

    return executeUnifiedSearch({
      query: sanitizedQuery,
      filters: data.filters as any,
      userRole: effectiveRole,
      userId: effectiveUserId,
      db: supabaseAdmin,
    });
  });
