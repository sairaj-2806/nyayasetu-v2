# NyayaSetu — Architectural Blueprint & Final Product Audit

### Smart India Hackathon 2026 — Problem Statement SIH26190

**Organization:** Ministry of Home Affairs (MHA)  
**Department:** National Crime Records Bureau (NCRB), Women Safety Division  
**Category:** Software | **Theme:** Blockchain & Cybersecurity  
**Primary Product Identity:** Secure Intelligent Digital Document & Evidence Management Platform for Legal and Investigation Workflows

---

## 1. Executive Summary & Problem-Solution Fit

### 1.1 The Challenge (SIH26190)

Legal, police, and forensic institutions across Indian district and taluka courts process tens of thousands of sensitive records daily—including First Information Reports (FIRs), Crime Scene Panchnamas, Section 180 BNSS witness statements, CFSL digital forensic extractions, Section 193 BNSS charge sheets, and judicial orders. Historically, these workflows face acute vulnerabilities:

- **Physical degradation and tampering risks:** Paper case files and unsealed evidence registers are vulnerable to illicit alteration, page substitution, and custody breaks.
- **Evidentiary inadmissibility:** Under Section 63 of the Bharatiya Sakshya Adhiniyam (BSA, 2023), electronic records require strict cryptographic proof, device origin tracking, and continuous chain-of-custody verification to be admissible in court.
- **Information silos and leaky boundaries:** Lack of fine-grained access control leads to unauthorized disclosures of sensitive sealed-cover documents or premature leakage of ongoing investigation records.
- **Absence of version transparency:** Traditional document stores overwrite files without retaining cryptographic proof of prior states, compromising judicial audit trails.

### 1.2 The NyayaSetu Solution

**NyayaSetu** ("Bridge of Justice") is an institutional-grade, zero-trust digital document and evidence vault designed specifically for Indian law enforcement, forensic laboratories, public prosecutors, and district judiciaries. NyayaSetu establishes a deterministic, tamper-evident digital lifecycle for legal records from inception to final archival.

```
LEGAL / INVESTIGATION RECORD
             ↓
     SECURE INGESTION (MIME, Magic Bytes, Traversal Prevention)
             ↓
    VALIDATION & CLASSIFICATION (Public → Sealed-Cover)
             ↓
CRYPTOGRAPHIC INTEGRITY (SHA-256 Hash Chaining & Sec 63 BSA)
             ↓
 SECURE STORAGE (Server-Generated Keys & Short-Lived Signed URLs)
             ↓
    AUTHORIZED ACCESS (Fail-Closed Multi-Tier RBAC & RLS)
             ↓
CONTROLLED COLLABORATION (Scoped Grants & Immediate Revocation)
             ↓
  VERSION MANAGEMENT (v1 → v2 → vN with Immutable Audit Proof)
             ↓
EVIDENCE & MALKHANA CUSTODY (Monotonic 9-Stage Custody Ledger)
             ↓
AI-ASSISTED AUTHORIZED RETRIEVAL (NyayaSetu Assistant with Zero Bypass)
             ↓
      AUDIT & ARCHIVAL (Tamper-Evident Immutable Ledger)
```

---

## 2. Core Architecture & Security Model

### 2.1 Multi-Tier Zero-Trust Authorization Pipeline

In NyayaSetu, neither the client browser nor any AI model determines access authorization. Every document request, preview, download, and search filter evaluates through an 8-stage zero-trust pipeline:

```
AUTHENTICATION
      ↓
   IDENTITY (Verified Session Token from Supabase Auth)
      ↓
     ROLE (Admin, Investigating Officer, Forensic Officer, Evidence Custodian, Legal Officer, Judge, Auditor, Public)
      ↓
  PERMISSION (Can View, Can Download, Can Create Version, Can Share, Can Revoke)
      ↓
  CASE SCOPE (Assigned Police Station / Judicial Bench / Prosecution Roster)
      ↓
SENSITIVITY / CLEARANCE (PUBLIC, INTERNAL, CONFIDENTIAL, RESTRICTED, SEALED_COVER_IN_CAMERA)
      ↓
RESOURCE AUTHORIZATION (Document-specific Policy & Active Time-Bound Grants)
      ↓
DATABASE / STORAGE (PostgreSQL Row Level Security & Private Cloud Storage)
      ↓
  AUDIT LEDGER (Immutable Cryptographic Audit Entry)
```

### 2.2 Strict Boundary Principles

- **No Client Trust:** Server functions (`src/lib/*.functions.ts`) explicitly reject client-supplied `userId`, `userRole`, `caseScope`, `clearanceLevel`, or raw storage keys. Identity is derived solely from the cryptographically verified JWT session.
- **Fail-Closed Fallback:** Any unrecognized user, missing role, expired session, or unassigned case file automatically defaults to `DENIED` with an immediate `ACCESS_DENIED` security alert logged to the Audit Center.
- **Short-Lived Signed URLs:** The storage bucket is completely private. Files are accessible only via server-generated, time-limited signed URLs (120-second TTL) produced after access verification.
- **Path Traversal Shield:** Raw user-supplied filenames are never used to construct object keys. Keys follow the immutable format:
  `secure/documents/{documentId}/{versionId}/{server-generated-uuid}`
  All path traversal sequences (`../`, null bytes, control characters, URL encoded `%2e%2e%2f`) are rejected at ingestion.

---

## 3. Flagship Document Management System (DMS)

### 3.1 Document Categories & Classification

NyayaSetu natively categorizes all core Indian legal and police documents:

1. **FIR (First Information Report):** Registered u/s 173 BNSS with Zero-FIR territorial tracking.
2. **Police Crime Scene Report & Panchnama:** Site inspection and seizure memos executed u/s 105 BNSS.
3. **Witness Statements:** Evidentiary depositions recorded u/s 180 BNSS with tamper seals.
4. **Forensic Reports:** CFSL/FSL cyber, chemical, and ballistic extraction certificates u/s 39 BSA.
5. **Police Charge Sheet / Final Report:** Comprehensive indictment submitted u/s 193 BNSS within 60/90 days.
6. **Court Filings & Pleadings:** Bail applications, interim petitions, and standing counsel responses.
7. **Evidence Records:** Seizure memos linked to physical exhibits in Malkhana custody.
8. **Judgments & Orders:** Bail determinations, charge framing orders, and final trial decrees.

### 3.2 Document Lifecycle & Version Control

Official legal records are **never overwritten**. When an amendment or supplementary charge sheet is filed:

1. The prior version (`v1`) remains permanently frozen with its original SHA-256 hash.
2. A new version (`v2`) is created with a recorded change reason, modifying officer identity, and independent SHA-256 hash.
3. The platform displays side-by-side version comparison and highlights integrity deltas.
4. An immutable `DOCUMENT_VERSION_CREATED` audit event is published.

### 3.3 Cryptographic Integrity Verification (Section 63 BSA, 2023)

The platform displays a transparent, four-point cryptographic verification card:

- **SHA-256 Digest:** Live recalculated file hash compared against the registration ledger.
- **Version Chain Status:** Verified cryptographic lineage linking current version back to inception.
- **Digital Proof / Signature:** System manager certificate formatted for Section 63 BSA electronic admissibility.
- **Audit Verification Link:** Direct correlation with the immutable server audit entry.
- **Plain Language Statement:** _"The retrieved record matches its recorded integrity state and conforms to Section 63 BSA electronic evidence requirements."_

---

## 4. Controlled Collaboration Engine

Collaboration across institutional boundaries (Police ➔ CFSL ➔ Prosecution ➔ Bench) is governed by **Time-Bound Controlled Grants**:

- **Granular Permissions:** `VIEW`, `DOWNLOAD`, `COMMENT`, `EDIT`, `SHARE`.
- **Case & Document Scope:** Explicitly restricted to designated case dockets.
- **Expiration Enforcement:** Grants contain strict ISO timestamps. Expired shares fail-closed and trigger an `EXPIRED_SHARE_ACCESS_ATTEMPTED` security notice.
- **Immediate Server-Side Revocation:** Revoking a grant instantly terminates all active signed URLs and locks storage access at the server boundary without client caching.

---

## 5. Malkhana Evidence & Chain of Custody (P0 Hero)

Physical property and digital evidence exhibits (mobile devices, hard drives, contraband, weapons) are managed through a monotonic 9-stage custody protocol:
`COLLECTED` ➔ `REGISTERED` ➔ `VERIFIED` ➔ `STORED` ➔ `TRANSFERRED` ➔ `RECEIVED` ➔ `EXAMINED` ➔ `PRESENTED` ➔ `ARCHIVED`

### Evidentiary Safeguards:

- **Tamper Seals:** Verified physical barcoded seals (`MHA-EV-XXXX-A`) verified at every handoff.
- **Dual-Party Custody Transfer:** Custody cannot be reassigned unilaterally. Initiated by Transferring Custodian, validated by Receiving Custodian with location verification (e.g., Central Malkhana Vault B Locker #12).
- **BSA Section 63 Extraction Proofs:** Forensic disk images store SHA-256 hashes taken at seizure and matched post-examination to prove zero bit-level tampering.

---

## 6. NyayaSetu Assistant (AI Investigation & Document Intelligence)

### 6.1 Architectural Mandate

The AI Assistant is an informational decision-support and document intelligence tool. It follows a strict security pipeline:

```
USER PROMPT
     ↓
AUTHENTICATION & ROLE RESOLUTION
     ↓
AUTHORIZATION-AWARE CONTEXT INGESTION (RLS-Filtered DB Records)
     ↓
PROMPT INJECTION SANITIZATION (Rejection of system overrides)
     ↓
GROUNDED LLM INFERENCE (Strict Indian Law + Case Records Context)
     ↓
SOURCE-GROUNDED CITATIONS ([DOC-xxxx vX, Case NYS-xxxx, Exhibit EV-xxxx])
     ↓
CLIENT RENDERING
```

### 6.2 Strict AI Safety Boundaries

- **No Authorization Bypass:** The AI model never sees records outside the current user's clearance tier.
- **No Autonomous Verdicts:** The model is strictly prohibited from determining guilt, issuing judicial verdicts, or predicting trial outcomes.
- **No Data Mutations:** The model cannot alter records, grant permissions, or change evidence custody.

---

## 7. Audit & Security Center

The platform maintains an immutable audit ledger covering 17 critical event types. Ordinary users cannot edit, truncate, or delete audit logs.

- **Real-Time Security Event Center:** Detects and flags unauthorized document download attempts, tampered seal reports, expired share accesses, and brute-force query anomalies.
- **Export & Compliance:** Exportable audit certificates with digital signing for judicial scrutiny.

---

## 8. Case & Hearing Operations (P2 Supporting Workflow)

The platform preserves the existing Smart Scheduling, Conflict Detection, and What-If Simulation capabilities as **Case & Hearing Operations** subordinate to the DMS hero:

- **Case Dossier Integration:** Connects case files directly to pleadings, forensic exhibits, and hearing schedules.
- **Deterministic Scheduling:** Soft-constraint optimization respecting judge specialization, bench working hours, and statutory limitation deadlines under human registrar supervision.

---

## 9. Scalability, Limitations & Future Roadmap

### 9.1 Scalability

- **Stateless Server Functions:** Built on TanStack Start + Nitro engine with isomorphic type-safety.
- **Cloud Object Storage:** Decoupled storage engine with horizontal scaling for petabyte-scale forensic disk images.
- **Database Indexing:** B-Tree and GIN indexes on case numbers, document hashes, and audit timestamps.

### 9.2 Limitations & Roadmap

- **Hardware Security Modules (HSM):** Currently uses software-backed SHA-256 and platform digital signatures. Roadmap includes integration with FIPS 140-2 Level 3 Hardware Security Modules for state-level key management.
- **Offline Sync (Electron):** High-speed local cache with cryptographic reconciliation when reconnecting from remote police outposts.
- **National e-Courts & CCTNS Bridge:** Standardized API endpoints formatted for seamless integration with the Inter-operable Criminal Justice System (ICJS).
