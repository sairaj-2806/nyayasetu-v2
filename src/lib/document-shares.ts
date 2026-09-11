/**
 * Controlled Document Collaboration & Sharing Engine
 * Smart India Hackathon 2026 - Problem Statement SIH26190
 *
 * Implements server-authoritative, time-bounded, revocable collaboration
 * across investigating officers, forensic examiners, prosecutors, and judicial registry.
 */

import { z } from "zod";

export type SharePermission = "VIEW" | "DOWNLOAD" | "COMMENT" | "EDIT" | "SHARE";

export interface DocumentShareRecord {
  id: string;
  document_id: string;
  document_number: string;
  recipient_type: "USER" | "ROLE" | "DEPARTMENT";
  recipient_id?: string | undefined;
  recipient_name: string;
  recipient_role: string;
  case_scope?: string | undefined;
  permissions: SharePermission[];
  granted_by: string;
  granted_by_name: string;
  granted_by_role: string;
  granted_at: string;
  expires_at: string;
  is_revoked: boolean;
  revoked_at?: string | undefined;
  revoked_by_name?: string | undefined;
  revocation_reason?: string | undefined;
  reason: string;
  created_at: string;
}

export const SHARE_PERMISSIONS: {
  permission: SharePermission;
  label: string;
  description: string;
}[] = [
  {
    permission: "VIEW",
    label: "View Only",
    description: "Read-only inspection of cryptographic record",
  },
  {
    permission: "DOWNLOAD",
    label: "Download Vault Stream",
    description: "Export authenticated binary from R2 vault",
  },
  {
    permission: "COMMENT",
    label: "Add Legal Notes",
    description: "Append procedural observations without altering hash",
  },
  {
    permission: "EDIT",
    label: "Draft New Version",
    description: "Propose supplementary version (vN+1) with fresh hash",
  },
  {
    permission: "SHARE",
    label: "Delegate Access",
    description: "Re-grant time-bounded access within case scope",
  },
];

export const AUTHORIZED_RECIPIENT_ROLES = [
  { role: "investigating_officer", label: "Investigating Officer (IO)" },
  { role: "forensic_officer", label: "Forensic Science Examiner (FSL)" },
  { role: "legal_officer", label: "Public Prosecutor / Legal Officer" },
  { role: "evidence_custodian", label: "Malkhana Evidence Custodian" },
  { role: "registrar", label: "Court Registrar" },
  { role: "judge", label: "Judicial Magistrate / Presiding Judge" },
  { role: "auditor", label: "Compliance & Security Auditor" },
];

// In-memory server-side registry of document shares
const _documentSharesStore = new Map<string, DocumentShareRecord[]>();

/**
 * Checks whether an active, unexpired, unrevoked share grant exists for the given user/role.
 */
export function checkActiveShareGrant(
  docId: string,
  userId: string,
  userRoles: string[],
  requiredPermission: SharePermission,
): { allowed: boolean; share?: DocumentShareRecord; reason?: string } {
  const shares = _documentSharesStore.get(docId) || [];
  const now = new Date();

  for (const s of shares) {
    const isTargetUser = s.recipient_type === "USER" && s.recipient_id === userId;
    const isTargetRole = s.recipient_type === "ROLE" && userRoles.includes(s.recipient_role);

    if (isTargetUser || isTargetRole) {
      if (s.is_revoked) {
        return { allowed: false, share: s, reason: "SHARE_REVOKED" };
      }
      if (new Date(s.expires_at) < now) {
        return { allowed: false, share: s, reason: "SHARE_EXPIRED" };
      }
      if (s.permissions.includes(requiredPermission)) {
        return { allowed: true, share: s };
      }
    }
  }

  return { allowed: false, reason: "NO_ACTIVE_SHARE" };
}

export function getSharesForDocument(docId: string): DocumentShareRecord[] {
  return _documentSharesStore.get(docId) || [];
}

export function addDocumentShare(share: DocumentShareRecord): void {
  const current = _documentSharesStore.get(share.document_id) || [];
  _documentSharesStore.set(share.document_id, [...current, share]);
}

export function updateDocumentShare(
  shareId: string,
  updates: Partial<DocumentShareRecord>,
): boolean {
  for (const [docId, shares] of _documentSharesStore.entries()) {
    const idx = shares.findIndex((s) => s.id === shareId);
    if (idx !== -1) {
      const existing = shares[idx]!;
      shares[idx] = { ...existing, ...updates };
      _documentSharesStore.set(docId, shares);
      return true;
    }
  }
  return false;
}
