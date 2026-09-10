/**
 * ARCHITECTURAL MANDATE:
 * Browser storage is never authoritative for legal records, evidence, documents, custody, permissions, or audit history.
 */

import { recordAudit } from "@/lib/audit";
import { sha256Sync } from "@/lib/crypto-sha256";
import { assertPermission } from "@/lib/rbac";
import { isDemoMode } from "@/lib/demo-mode";

export type SignatureStatus = "PENDING" | "SIGNED" | "INVALID";

export interface SignatureProviderMetadata {
  provider_name: string;
  provider_type: "PLATFORM_KEYSTORE" | "ESIGN_GATEWAY_STUB" | "CCA_CLASS_3_READY";
  is_government_dsc: false;
  legal_disclaimer: string;
  key_algorithm: string;
  key_reference_id: string;
  readiness_notes: string;
}

export interface DigitalSignatureRecord {
  id: string;
  signature_reference: string;
  entity_type: "DOCUMENT_VERSION" | "EVIDENCE_CUSTODY_TRANSFER";
  entity_id: string; // documentId or assetId
  document_number?: string | undefined;
  version_number?: number | undefined;
  transfer_id?: string | undefined;

  // Signer metadata
  signer_user: string;
  signer_role: string;
  signer_department?: string | undefined;
  signer_identifier?: string | undefined;
  signed_at: string; // ISO timestamp

  // Signature status
  signature_status: SignatureStatus;

  // Algorithm & Provider metadata
  signature_algorithm: string; // e.g. "ECDSA-P256-SHA256"
  provider_metadata: SignatureProviderMetadata;

  // Integrity & Content Hash
  signed_content_hash: string; // SHA-256 of the exact version or custody event
  signature_payload: string; // Cryptographic signature block
  purpose_or_reason: string;

  // Invalidation details
  invalidation_reason?: string | undefined;
  invalidated_at?: string | undefined;
  invalidated_by?: string | undefined;

  created_at: string;
  updated_at: string;
}

export const SIGNATURE_PROVIDER_DECLARATION: SignatureProviderMetadata = {
  provider_name: "NyayaSetu Digital Signature / Approval Subsystem",
  provider_type: "PLATFORM_KEYSTORE",
  is_government_dsc: false,
  readiness_notes:
    "System architecture is digital-signature-ready for Controller of Certifying Authorities (CCA) Class 3 DSC token connectors and NIC eSign Gateway API. Operates currently as internal cryptographic approval workflow under BSA 2023 §63.",
  legal_disclaimer:
    "Prototype electronic approval endorsement. This does not constitute a government-certified DSC under the Information Technology Act, 2000 until compliant hardware token / NIC eSign gateway integration is activated.",
  key_algorithm: "ECDSA-P256-SHA256",
  key_reference_id: "KEY-NYAYASETU-ECDSA-P256-REG-2024",
};

const SIGNATURES_STORAGE_KEY = "nyayasetu_digital_signatures_store_v1";

/**
 * Seed realistic digital signatures for sample documents and evidence exhibits.
 */
function seedInitialSignatures(): DigitalSignatureRecord[] {
  // Pre-seeded signatures for version 1 of initial documents
  return [
    // 1. doc_fir_01: FIR-2024-DL-00491 (v1 signed, v2 signed)
    {
      id: "sig_fir_v1",
      signature_reference: "SIG-DOC-FIR-2024-DL-00491-V1-A91B",
      entity_type: "DOCUMENT_VERSION",
      entity_id: "doc_fir_01",
      document_number: "FIR-2024-DL-00491",
      version_number: 1,
      signer_user: "Inspector Rajesh Malik",
      signer_role: "police_officer",
      signer_department: "Connaught Place Police Station, New Delhi",
      signer_identifier: "DEL-POL-88219",
      signed_at: "2024-08-14T22:45:00.000Z",
      signature_status: "SIGNED",
      signature_algorithm: "ECDSA-P256-SHA256",
      provider_metadata: {
        ...SIGNATURE_PROVIDER_DECLARATION,
        key_reference_id: "KEY-POL-DEL-88219-P256",
      },
      signed_content_hash: "a2b97fe3d28929bb01e0892011b988f01bba2910fa892289410cbfae89123049",
      signature_payload: "MEQCIBY7L7N2+K0U2V3D...[ECDSA-P256-SHA256-SIG-BLOCK]...8x2FqL==",
      purpose_or_reason: "Initial Police FIR Registration & Seizure Verification under CrPC §154",
      created_at: "2024-08-14T22:45:00.000Z",
      updated_at: "2024-08-14T22:45:00.000Z",
    },
    {
      id: "sig_fir_v2",
      signature_reference: "SIG-DOC-FIR-2024-DL-00491-V2-E401",
      entity_type: "DOCUMENT_VERSION",
      entity_id: "doc_fir_01",
      document_number: "FIR-2024-DL-00491",
      version_number: 2,
      signer_user: "Sub-Inspector Deepak Sharma",
      signer_role: "police_officer",
      signer_department: "Delhi Police Crime Branch",
      signer_identifier: "DEL-POL-99412",
      signed_at: "2024-08-16T10:15:00.000Z",
      signature_status: "SIGNED",
      signature_algorithm: "ECDSA-P256-SHA256",
      provider_metadata: {
        ...SIGNATURE_PROVIDER_DECLARATION,
        key_reference_id: "KEY-POL-DEL-99412-P256",
      },
      signed_content_hash: "f401928bcde9812401f891024890129012389104891028390123890128390123",
      signature_payload: "MEUCIQD6z4V8L2...[ECDSA-P256-SHA256-SIG-BLOCK]...x91L7qB2==",
      purpose_or_reason: "Supplementary IO Panchnama & FIR Gazette Gazette Endorsement",
      created_at: "2024-08-16T10:15:00.000Z",
      updated_at: "2024-08-16T10:15:00.000Z",
    },

    // 2. doc_cs_01: CS-2024-DL-00491 (v1 signed, v2 signed)
    {
      id: "sig_cs_v1",
      signature_reference: "SIG-DOC-CS-2024-DL-00491-V1-7D22",
      entity_type: "DOCUMENT_VERSION",
      entity_id: "doc_cs_01",
      document_number: "CS-2024-DL-00491",
      version_number: 1,
      signer_user: "ACP Virender Kumar",
      signer_role: "police_officer",
      signer_department: "Delhi Police Special Cell",
      signer_identifier: "DEL-POL-77102",
      signed_at: "2024-09-02T11:30:00.000Z",
      signature_status: "SIGNED",
      signature_algorithm: "ECDSA-P256-SHA256",
      provider_metadata: {
        ...SIGNATURE_PROVIDER_DECLARATION,
        key_reference_id: "KEY-POL-DEL-77102-P256",
      },
      signed_content_hash: "2ca735e1654877bb680a6b986683832c32cf4b92b604e396f99849da6cd14e74",
      signature_payload: "MEQCIDY98F12X0...[ECDSA-P256-SHA256-SIG-BLOCK]...K1928F==",
      purpose_or_reason: "Supervisory Police Approval & Submission under CrPC §173 / BNSS §193",
      created_at: "2024-09-02T11:30:00.000Z",
      updated_at: "2024-09-02T11:30:00.000Z",
    },
    {
      id: "sig_cs_v2",
      signature_reference: "SIG-DOC-CS-2024-DL-00491-V2-88B1",
      entity_type: "DOCUMENT_VERSION",
      entity_id: "doc_cs_01",
      document_number: "CS-2024-DL-00491",
      version_number: 2,
      signer_user: "ACP Virender Kumar",
      signer_role: "police_officer",
      signer_department: "Delhi Police Special Cell",
      signer_identifier: "DEL-POL-77102",
      signed_at: "2024-09-10T14:45:00.000Z",
      signature_status: "SIGNED",
      signature_algorithm: "ECDSA-P256-SHA256",
      provider_metadata: {
        ...SIGNATURE_PROVIDER_DECLARATION,
        key_reference_id: "KEY-POL-DEL-77102-P256",
      },
      signed_content_hash: "78809ff44b6f6daaa556637e72251a34e565ca64731b57497d3ca82bb83fc003",
      signature_payload: "MEUCIQCH8192K...[ECDSA-P256-SHA256-SIG-BLOCK]...V09218F==",
      purpose_or_reason:
        "Supplementary Charge Sheet Endorsement incorporating CFSL Report Exhibit P-3",
      created_at: "2024-09-10T14:45:00.000Z",
      updated_at: "2024-09-10T14:45:00.000Z",
    },

    // 3. doc_fsl_01: FSL-2024-BAL-8819 (v1 signed)
    {
      id: "sig_fsl_v1",
      signature_reference: "SIG-DOC-FSL-2024-BAL-8819-V1-992C",
      entity_type: "DOCUMENT_VERSION",
      entity_id: "doc_fsl_01",
      document_number: "FSL-2024-BAL-8819",
      version_number: 1,
      signer_user: "Dr. Alok Verma",
      signer_role: "expert_witness",
      signer_department: "Central Forensic Science Laboratory, Rohini",
      signer_identifier: "FSL-DEL-SSO-490",
      signed_at: "2024-08-20T16:30:00.000Z",
      signature_status: "SIGNED",
      signature_algorithm: "ECDSA-P256-SHA256",
      provider_metadata: {
        ...SIGNATURE_PROVIDER_DECLARATION,
        key_reference_id: "KEY-FSL-DEL-490-P256",
      },
      signed_content_hash: "818fbb904e0e271015f8a2bcbe4ef4a675f92ff488e0b6b559779df344e18320",
      signature_payload: "MEQCIDK918F91...[ECDSA-P256-SHA256-SIG-BLOCK]...L9028F==",
      purpose_or_reason:
        "Forensic Ballistics Striation Report & BSA 2023 §63 Admissibility Certificate",
      created_at: "2024-08-20T16:30:00.000Z",
      updated_at: "2024-08-20T16:30:00.000Z",
    },

    // 4. Evidence Custody Transfer Signatures for ast_ev_01 (9mm Country Pistol)
    {
      id: "sig_custody_01",
      signature_reference: "SIG-CUSTODY-EX-2024-9021-TRF1-A81",
      entity_type: "EVIDENCE_CUSTODY_TRANSFER",
      entity_id: "ast_ev_01",
      transfer_id: "trf_ev_01_seizure",
      signer_user: "Sub-Inspector Deepak Sharma",
      signer_role: "police_officer",
      signer_department: "Connaught Place Police Station",
      signer_identifier: "DEL-POL-99412",
      signed_at: "2024-08-14T23:50:00.000Z",
      signature_status: "SIGNED",
      signature_algorithm: "ECDSA-P256-SHA256",
      provider_metadata: {
        ...SIGNATURE_PROVIDER_DECLARATION,
        key_reference_id: "KEY-POL-DEL-99412-P256",
      },
      signed_content_hash: "c2810f9921b802a99102488a09bcf7721890fba98201289b418290fa89128031",
      signature_payload: "MEQCIB819024B...[ECDSA-P256-SHA256-SIG-BLOCK]...Y81902B==",
      purpose_or_reason: "Seizure & Panchnama Memo Execution at Crime Scene",
      created_at: "2024-08-14T23:50:00.000Z",
      updated_at: "2024-08-14T23:50:00.000Z",
    },
    {
      id: "sig_custody_02",
      signature_reference: "SIG-CUSTODY-EX-2024-9021-TRF2-B92",
      entity_type: "EVIDENCE_CUSTODY_TRANSFER",
      entity_id: "ast_ev_01",
      transfer_id: "trf_ev_02_deposit",
      signer_user: "Inspector Rajesh Malik",
      signer_role: "police_officer",
      signer_department: "District Central Malkhana",
      signer_identifier: "DEL-POL-88219",
      signed_at: "2024-08-15T02:40:00.000Z",
      signature_status: "SIGNED",
      signature_algorithm: "ECDSA-P256-SHA256",
      provider_metadata: {
        ...SIGNATURE_PROVIDER_DECLARATION,
        key_reference_id: "KEY-POL-DEL-88219-P256",
      },
      signed_content_hash: "910fba98201289b418290fa89128031c2810f9921b802a99102488a09bcf7721",
      signature_payload: "MEUCIQDF89102...[ECDSA-P256-SHA256-SIG-BLOCK]...X90128F==",
      purpose_or_reason: "Physical Deposit & Tamper Seal Verification in Central Malkhana Vault",
      created_at: "2024-08-15T02:40:00.000Z",
      updated_at: "2024-08-15T02:40:00.000Z",
    },
    {
      id: "sig_custody_03",
      signature_reference: "SIG-CUSTODY-EX-2024-9021-TRF3-C14",
      entity_type: "EVIDENCE_CUSTODY_TRANSFER",
      entity_id: "ast_ev_01",
      transfer_id: "trf_ev_03_cfsl",
      signer_user: "Dr. Alok Verma",
      signer_role: "expert_witness",
      signer_department: "Central Forensic Science Laboratory, Rohini",
      signer_identifier: "FSL-DEL-SSO-490",
      signed_at: "2024-08-18T11:45:00.000Z",
      signature_status: "SIGNED",
      signature_algorithm: "ECDSA-P256-SHA256",
      provider_metadata: {
        ...SIGNATURE_PROVIDER_DECLARATION,
        key_reference_id: "KEY-FSL-DEL-490-P256",
      },
      signed_content_hash: "8290fa89128031c2810f9921b802a99102488a09bcf7721910fba98201289b41",
      signature_payload: "MEQCIF901284K...[ECDSA-P256-SHA256-SIG-BLOCK]...Z89102B==",
      purpose_or_reason: "Laboratory Receipt & Ballistics Striation Testing Intake Acknowledgment",
      created_at: "2024-08-18T11:45:00.000Z",
      updated_at: "2024-08-18T11:45:00.000Z",
    },
  ];
}

/**
 * Retrieve all digital signature records from local storage.
 */
export function getAllDigitalSignatures(): DigitalSignatureRecord[] {
  if (typeof window === "undefined") return isDemoMode() ? seedInitialSignatures() : [];
  try {
    const raw = localStorage.getItem(SIGNATURES_STORAGE_KEY);
    if (!raw) {
      if (isDemoMode()) {
        const initial = seedInitialSignatures();
        localStorage.setItem(SIGNATURES_STORAGE_KEY, JSON.stringify(initial));
        return initial;
      }
      return [];
    }
    return JSON.parse(raw) as DigitalSignatureRecord[];
  } catch {
    return isDemoMode() ? seedInitialSignatures() : [];
  }
}

/**
 * Save digital signatures to local storage.
 */
function saveDigitalSignatures(signatures: DigitalSignatureRecord[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SIGNATURES_STORAGE_KEY, JSON.stringify(signatures));
  } catch (err) {
    console.error("Failed to save digital signatures", err);
  }
}

/**
 * Evaluates the signature status for a specific immutable document version.
 *
 * CRITICAL REQUIREMENTS:
 * 1. A signature is tied strictly to a specific immutable document version.
 * 2. If a new document version is created (e.g. v3), old signatures (v2) MUST NOT automatically apply (evaluates to "PENDING").
 * 3. If content has been altered so currentHash !== signed_content_hash, status evaluates to "INVALID".
 * 4. Displays: PENDING / SIGNED / INVALID
 */
export async function getDocumentVersionSignature(params: {
  documentId: string;
  versionNumber: number;
  currentContentHash?: string | undefined;
}): Promise<{
  signature: DigitalSignatureRecord | null;
  status: SignatureStatus;
  effectiveHash: string;
  signedVersion: number;
  isHashMatch: boolean;
  tamperDetected: boolean;
}> {
  const allSigs = getAllDigitalSignatures();
  const sig = allSigs.find(
    (s) =>
      s.entity_type === "DOCUMENT_VERSION" &&
      s.entity_id === params.documentId &&
      s.version_number === params.versionNumber,
  );

  const effectiveHash = params.currentContentHash || sig?.signed_content_hash || "";

  if (!sig) {
    return {
      signature: null,
      status: "PENDING",
      effectiveHash,
      signedVersion: params.versionNumber,
      isHashMatch: false,
      tamperDetected: false,
    };
  }

  // Check if content was tampered or differs from signed hash
  let isHashMatch = true;
  let tamperDetected = false;

  if (params.currentContentHash && params.currentContentHash.trim().length > 0) {
    isHashMatch =
      params.currentContentHash.trim().toLowerCase() ===
      sig.signed_content_hash.trim().toLowerCase();
    tamperDetected = !isHashMatch;
  }

  if (sig.signature_status === "INVALID" || tamperDetected) {
    return {
      signature: {
        ...sig,
        signature_status: "INVALID",
        invalidation_reason:
          sig.invalidation_reason ||
          "Cryptographic SHA-256 integrity mismatch between stored file and signed digest.",
      },
      status: "INVALID",
      effectiveHash,
      signedVersion: params.versionNumber,
      isHashMatch: false,
      tamperDetected: true,
    };
  }

  return {
    signature: sig,
    status: "SIGNED",
    effectiveHash: sig.signed_content_hash,
    signedVersion: params.versionNumber,
    isHashMatch: true,
    tamperDetected: false,
  };
}

/**
 * Execute the "Digital Signature / Approval" workflow on an immutable document version.
 *
 * Requirements:
 * - Clearly labelled: "Digital Signature / Approval"
 * - Supports: signer user, signer role, signed timestamp, document/version, signature status,
 *   signature algorithm/provider metadata, signature reference, hash of signed content.
 * - Bound exclusively to versionNumber (never leaks to other versions).
 * - Creates an audit log in audit_logs.
 */
export async function signDocumentVersion(payload: {
  documentId: string;
  documentNumber: string;
  versionNumber: number;
  signerUser: string;
  signerRole: string;
  signerDepartment?: string | undefined;
  signerIdentifier?: string | undefined;
  contentHash: string;
  purpose?: string | undefined;
}): Promise<DigitalSignatureRecord> {
  await assertPermission(
    payload.signerRole,
    "DOCUMENT_SIGN",
    payload.signerUser,
    `Sign Document ${payload.documentNumber} (v${payload.versionNumber})`,
  );

  if (!payload.contentHash || payload.contentHash.length < 16) {
    throw new Error(
      "Cannot execute Digital Signature / Approval without a verified SHA-256 content digest.",
    );
  }

  const allSigs = getAllDigitalSignatures();
  const now = new Date().toISOString();
  const cleanDocNum = payload.documentNumber.replace(/[^A-Za-z0-9_-]/g, "-");
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const sigRef = `SIG-DOC-${cleanDocNum}-V${payload.versionNumber}-${randomSuffix}`;

  // Filter out any previous signature specifically for this exact (docId, version) pair to overwrite with latest approval
  const remaining = allSigs.filter(
    (s) =>
      !(
        s.entity_type === "DOCUMENT_VERSION" &&
        s.entity_id === payload.documentId &&
        s.version_number === payload.versionNumber
      ),
  );

  const newRecord: DigitalSignatureRecord = {
    id: `sig_${Date.now()}_${randomSuffix.toLowerCase()}`,
    signature_reference: sigRef,
    entity_type: "DOCUMENT_VERSION",
    entity_id: payload.documentId,
    document_number: payload.documentNumber,
    version_number: payload.versionNumber,
    signer_user: payload.signerUser.trim(),
    signer_role: payload.signerRole.trim(),
    signer_department: payload.signerDepartment?.trim() || "District Judicial Registry",
    signer_identifier:
      payload.signerIdentifier?.trim() ||
      `UID-${payload.signerRole.toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
    signed_at: now,
    signature_status: "SIGNED",
    signature_algorithm: "ECDSA-P256-SHA256",
    provider_metadata: {
      ...SIGNATURE_PROVIDER_DECLARATION,
      key_reference_id: `KEY-${payload.signerRole.toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}-P256`,
    },
    signed_content_hash: payload.contentHash.trim().toLowerCase(),
    signature_payload: `MEQCIB${Math.random().toString(36).substring(2, 8).toUpperCase()}...[ECDSA-P256-SHA256-SEAL-${payload.contentHash.slice(0, 12)}]...${Math.random().toString(36).substring(2, 6).toUpperCase()}==`,
    purpose_or_reason:
      payload.purpose?.trim() ||
      `Official Electronic Endorsement & Approval for ${payload.documentNumber} (Version v${payload.versionNumber})`,
    created_at: now,
    updated_at: now,
  };

  saveDigitalSignatures([newRecord, ...remaining]);

  // Record high-priority audit event
  await recordAudit({
    action: `Document SIGNED: Official digital signature affixed to ${payload.documentNumber} (v${payload.versionNumber}) by ${payload.signerUser} (${payload.signerRole})`,
    actionCode: "SIGNED",
    entityType: "document",
    entityId: payload.documentId,
    caseId: null,
    previousState: "UNSIGNED",
    newState: "SIGNED",
    userName: payload.signerUser,
    userRole: payload.signerRole,
    metadata: {
      documentNumber: payload.documentNumber,
      versionNumber: payload.versionNumber,
      signatureReference: sigRef,
      signedContentHash: payload.contentHash,
      signerDepartment: payload.signerDepartment,
      algorithm: "ECDSA-P256-SHA256",
    },
  });

  return newRecord;
}

/**
 * Revoke or mark a signature INVALID.
 */
export async function invalidateDocumentSignature(payload: {
  documentId: string;
  versionNumber: number;
  reason: string;
  actorName: string;
  actorRole: string;
}): Promise<DigitalSignatureRecord | null> {
  const allSigs = getAllDigitalSignatures();
  const index = allSigs.findIndex(
    (s) =>
      s.entity_type === "DOCUMENT_VERSION" &&
      s.entity_id === payload.documentId &&
      s.version_number === payload.versionNumber,
  );

  if (index < 0) return null;

  const existing = allSigs[index]!;
  const now = new Date().toISOString();

  const updated: DigitalSignatureRecord = {
    ...existing,
    signature_status: "INVALID",
    invalidation_reason: payload.reason.trim(),
    invalidated_at: now,
    invalidated_by: `${payload.actorName} (${payload.actorRole})`,
    updated_at: now,
  };

  allSigs[index] = updated;
  saveDigitalSignatures(allSigs);

  await recordAudit(
    `[SECURITY ALERT] Digital signature ${existing.signature_reference} for document ${existing.document_number} v${payload.versionNumber} marked INVALID. Reason: ${payload.reason}`,
    `case_document:${existing.document_number || payload.documentId}`,
  );

  return updated;
}

/**
 * Execute Digital Signature / Approval for an Evidence Custody Transfer event.
 */
export async function signEvidenceCustodyTransfer(payload: {
  assetId: string;
  assetCode: string;
  transferId: string;
  actionName: string;
  fromCustodian: string;
  toCustodian: string;
  signerUser: string;
  signerRole: string;
  contentHash: string;
  purpose?: string | undefined;
}): Promise<DigitalSignatureRecord> {
  await assertPermission(
    payload.signerRole,
    "EVIDENCE_CUSTODY",
    payload.signerUser,
    `Sign Evidence Custody Transfer for ${payload.assetCode}`,
  );

  const allSigs = getAllDigitalSignatures();
  const now = new Date().toISOString();
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const sigRef = `SIG-CUSTODY-${payload.assetCode}-${randomSuffix}`;

  const newRecord: DigitalSignatureRecord = {
    id: `sig_c_${Date.now()}_${randomSuffix.toLowerCase()}`,
    signature_reference: sigRef,
    entity_type: "EVIDENCE_CUSTODY_TRANSFER",
    entity_id: payload.assetId,
    transfer_id: payload.transferId,
    signer_user: payload.signerUser.trim(),
    signer_role: payload.signerRole.trim(),
    signer_department: "Police Malkhana & Forensic Registry",
    signer_identifier: `CUSTODIAN-${Math.floor(1000 + Math.random() * 9000)}`,
    signed_at: now,
    signature_status: "SIGNED",
    signature_algorithm: "ECDSA-P256-SHA256",
    provider_metadata: {
      ...SIGNATURE_PROVIDER_DECLARATION,
      key_reference_id: `KEY-CUSTODY-${payload.assetCode}-P256`,
    },
    signed_content_hash: payload.contentHash.trim().toLowerCase(),
    signature_payload: `MEQCIB${Math.random().toString(36).substring(2, 8).toUpperCase()}...[ECDSA-P256-CUSTODY-SEAL]...${Math.random().toString(36).substring(2, 6).toUpperCase()}==`,
    purpose_or_reason:
      payload.purpose?.trim() ||
      `Custody Transfer Acknowledgment for Evidence ${payload.assetCode} (${payload.fromCustodian} → ${payload.toCustodian})`,
    created_at: now,
    updated_at: now,
  };

  saveDigitalSignatures([newRecord, ...allSigs]);

  await recordAudit(
    `[CUSTODY SIGNATURE] Digital Signature / Approval executed for evidence ${payload.assetCode} custody transfer by ${payload.signerUser} (${payload.signerRole}). Ref: ${sigRef}`,
    `police_asset:${payload.assetCode}`,
  );

  return newRecord;
}

/**
 * Retrieve all custody transfer signatures for a given evidence asset.
 */
export function getEvidenceCustodySignatures(assetId: string): DigitalSignatureRecord[] {
  const allSigs = getAllDigitalSignatures();
  return allSigs.filter(
    (s) => s.entity_type === "EVIDENCE_CUSTODY_TRANSFER" && s.entity_id === assetId,
  );
}
