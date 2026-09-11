import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { queryLLM } from "@/lib/ai.server";
import { checkRateLimit } from "@/lib/rate-limit.server";
import { sanitizeUserInput, detectPromptInjection } from "@/lib/security.server";

const Input = z.object({ breakdownText: z.string().min(1).max(4000) });

const ADVISORY_NOTICE =
  "\n\n[Advisory: This summary is an automated priority explanation for registry information only and does not supersede judicial orders.]";

const SYSTEM_PROMPT = [
  "You rephrase an already-computed court case priority breakdown into one short paragraph",
  "for a non-technical reader.",
  "Strict rules: use ONLY the factors and point values given. Never add, remove, reweight,",
  "re-rank or speculate about any factor. Describe only the statutory categories listed.",
  "Keep it under 90 words, plain English, neutral registry tone.",
].join(" ");

const FALLBACK_SUMMARY = `Prioritised based on statutory urgency criteria, limitation period, and listing constraints as detailed in the official breakdown.`;

/**
 * Convenience server function for natural-language priority breakdown summary.
 * The structured statutory breakdown is always rendered deterministically on the client.
 */
export const summarisePriorityOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => Input.parse(data))
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const req = getRequest();
    const clientIp =
      req?.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req?.headers?.get("x-real-ip") ||
      "anonymous";

    const rateCheck = checkRateLimit(`why-order:${userId}:${clientIp}`, {
      maxRequests: 30,
      windowMs: 60_000,
    });
    if (!rateCheck.allowed) {
      return { summary: FALLBACK_SUMMARY + ADVISORY_NOTICE };
    }

    const cleanInput = sanitizeUserInput(data.breakdownText, 4000);
    const injection = detectPromptInjection(cleanInput);
    if (injection.isSuspicious) {
      return { summary: FALLBACK_SUMMARY + ADVISORY_NOTICE };
    }

    try {
      const summary = await queryLLM([
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: cleanInput },
      ]);
      return {
        summary: (summary || FALLBACK_SUMMARY) + ADVISORY_NOTICE,
      };
    } catch {
      return {
        summary: FALLBACK_SUMMARY + ADVISORY_NOTICE,
      };
    }
  });
