/**
 * Server Functions for Controlled Document Collaboration & Sharing
 * Smart India Hackathon 2026 - Problem Statement SIH26190
 *
 * Implements server-side authorization, rate limiting, and immutable audit trails
 * for time-bounded document collaboration grants and immediate revocations.
 */

import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { checkRateLimit } from "@/lib/rate-limit.server";
import { getEffectiveRoles } from "@/lib/server-auth";
import {
  addDocumentShare,
  getSharesForDocument,
  updateDocumentShare,
  type DocumentShareRecord,
  type SharePermission,
} from "@/lib/document-shares";

const ShareInputSchema = z.object({
  documentId: z.string().min(1),
  recipientType: z.enum(["USER", "ROLE", "DEPARTMENT"]),
  recipientRole: z.string().min(1),
  recipientName: z.string().min(1),
  recipientId: z.string().optional(),
  caseScope: z.string().optional(),
  permissions: z.array(z.enum(["VIEW", "DOWNLOAD", "COMMENT", "EDIT", "SHARE"])).min(1),
  expiresAt: z.string().min(1),
  reason: z.string().min(5),
});

const RevokeInputSchema = z.object({
  shareId: z.string().min(1),
  documentId: z.string().min(1),
  reason: z.string().min(5),
});

export const createDocumentShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => ShareInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const req = getRequest();
    const clientIp = req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";

    const rate = checkRateLimit(`doc-share:${userId}:${clientIp}`, {
      maxRequests: 30,
      windowMs: 60_000,
    });
    if (!rate.allowed) throw new Error("Rate limit exceeded for document sharing operations.");

    const userRoles = await getEffectiveRoles(userId);
    const isAuthorizedGrantor =
      userRoles.includes("admin") ||
      userRoles.includes("registrar") ||
      userRoles.includes("investigating_officer") ||
      userRoles.includes("legal_officer") ||
      userRoles.includes("judge");

    if (!isAuthorizedGrantor) {
      throw new Error(
        "Access Denied: Your role does not have authorization to grant collaboration access.",
      );
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .eq("id", userId)
      .maybeSingle();

    const grantorName = profile?.full_name || "Authorized Officer";
    const grantorRole = userRoles[0] || "unassigned";

    // Fetch document details
    const { data: doc } = await supabaseAdmin
      .from("case_documents")
      .select("id, document_number, title")
      .or(`id.eq.${data.documentId},document_number.eq.${data.documentId}`)
      .maybeSingle();

    const docId = doc?.id || data.documentId;
    const docNum = doc?.document_number || data.documentId;

    const shareRecord: DocumentShareRecord = {
      id: `share-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      document_id: docId,
      document_number: docNum,
      recipient_type: data.recipientType,
      recipient_id: data.recipientId,
      recipient_name: data.recipientName,
      recipient_role: data.recipientRole,
      case_scope: data.caseScope,
      permissions: data.permissions as SharePermission[],
      granted_by: userId,
      granted_by_name: grantorName,
      granted_by_role: grantorRole,
      granted_at: new Date().toISOString(),
      expires_at: data.expiresAt,
      is_revoked: false,
      reason: data.reason,
      created_at: new Date().toISOString(),
    };

    addDocumentShare(shareRecord);

    // Audit log
    try {
      await (supabaseAdmin.from("audit_logs") as any).insert({
        user_id: userId,
        action: `DOCUMENT_SHARE_GRANTED: Access to ${docNum} granted to [${data.recipientRole} / ${data.recipientName}] with permissions [${data.permissions.join(", ")}]. Expiration: ${data.expiresAt}. Reason: "${data.reason}".`,
        entity_affected: `document_share:${shareRecord.id}`,
        timestamp: new Date().toISOString(),
      });
    } catch {
      // Non-blocking
    }

    return { success: true, share: shareRecord };
  });

export const revokeDocumentShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => RevokeInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const req = getRequest();
    const clientIp = req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";

    const rate = checkRateLimit(`doc-revoke:${userId}:${clientIp}`, {
      maxRequests: 30,
      windowMs: 60_000,
    });
    if (!rate.allowed) throw new Error("Rate limit exceeded for document revoke operations.");

    const userRoles = await getEffectiveRoles(userId);
    const isAuthorizedRevoker =
      userRoles.includes("admin") ||
      userRoles.includes("registrar") ||
      userRoles.includes("investigating_officer") ||
      userRoles.includes("judge");

    if (!isAuthorizedRevoker) {
      throw new Error(
        "Access Denied: Your role is not authorized to revoke document sharing grants.",
      );
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .eq("id", userId)
      .maybeSingle();

    const revokerName = profile?.full_name || "Authorized Officer";

    const updated = updateDocumentShare(data.shareId, {
      is_revoked: true,
      revoked_at: new Date().toISOString(),
      revoked_by_name: revokerName,
      revocation_reason: data.reason,
    });

    if (!updated) {
      throw new Error("Share record not found or already purged.");
    }

    // Audit log
    try {
      await (supabaseAdmin.from("audit_logs") as any).insert({
        user_id: userId,
        action: `DOCUMENT_SHARE_REVOKED: Sharing grant ${data.shareId} for document ${data.documentId} revoked immediately by ${revokerName}. Reason: "${data.reason}".`,
        entity_affected: `document_share:${data.shareId}`,
        timestamp: new Date().toISOString(),
      });
    } catch {
      // Non-blocking
    }

    return { success: true, shareId: data.shareId, revokedAt: new Date().toISOString() };
  });

export const getDocumentShares = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ documentId: z.string().min(1) }).parse(data))
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const userRoles = await getEffectiveRoles(userId);
    if (userRoles.length === 0) throw new Error("Access Denied: Unassigned account.");

    const shares = getSharesForDocument(data.documentId);
    return { shares };
  });
