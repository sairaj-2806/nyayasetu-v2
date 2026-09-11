import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { executeUnifiedSearch, type UnifiedSearchResult } from "@/lib/global-search";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAuthenticatedUser, getEffectiveRoles } from "@/lib/server-auth";
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
  // Ignored on server: roles and IDs are derived strictly from authenticated session token
  userRole: z.string().optional(),
  userId: z.string().optional(),
});

export const searchGlobalRegistry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => SearchInputSchema.parse(data))
  .handler(async ({ context, data }): Promise<UnifiedSearchResult> => {
    // 1. Assert authenticated identity strictly from token context (Never trust client input)
    const authenticatedUserId = requireAuthenticatedUser(context);

    // 2. Rate Limiting protection keyed per authenticated user & client IP
    const request = getRequest();
    const clientIp =
      request?.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request?.headers?.get("x-real-ip") ||
      "ip-unknown";

    const rateCheck = checkRateLimit(`search:${authenticatedUserId}:${clientIp}`, {
      maxRequests: 60,
      windowMs: 60_000,
    });

    if (!rateCheck.allowed) {
      throw new Error(
        "Rate limit exceeded: Too many global registry searches. Please wait a minute.",
      );
    }

    // 3. Strict Server-Side Role Resolution from authoritative Supabase database
    // Fail-closed: unassigned / unknown accounts receive "unassigned" least privilege
    const dbRoles = await getEffectiveRoles(authenticatedUserId);
    const effectiveRole = dbRoles[0] || "unassigned";

    const sanitizedQuery = sanitizeUserInput(data.query, 300);

    return executeUnifiedSearch({
      query: sanitizedQuery,
      filters: data.filters as any,
      userRole: effectiveRole,
      userId: authenticatedUserId,
      db: supabaseAdmin,
    });
  });
