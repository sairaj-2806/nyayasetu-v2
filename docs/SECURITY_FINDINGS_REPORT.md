# NyayaSetu Comprehensive Security Review & Vulnerability Audit Report

**Date**: September 8, 2026  
**Auditor**: Antigravity Security Analysis Agent  
**Scope**: Full application stack with specific focus on Secure DMS, Police Asset Management, Evidence Custody, Unified Audit Trail, and What-If Digital Twin Simulation modules.  
**Classification**: CONFIDENTIAL / RESTRICTED — JUDICIAL REPOSITORY SECURITY ASSESSMENT

---

## Executive Summary

A comprehensive, defense-in-depth security audit was conducted across 30+ technical security vectors within the NyayaSetu platform following the introduction of the Secure DMS, Police Asset, and Evidence Custody modules.

The architecture demonstrates strong foundational security engineering in many areas:

- Server-side secrets (`SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`) are properly segregated from Vite client bundles.
- PostgreSQL RLS enforces strict immutable protections (`NO UPDATE`, `NO DELETE`) on `audit_logs` and `document_versions`.
- Cryptographic SHA-256 integrity verification, Merkle leaf computation, and digital signature status binding comply with Bharatiya Sakshya Adhiniyam (BSA, 2023) Section 63 standards.
- Database access uses Supabase query builders parameterized against SQL injection, and React JSX avoids XSS attack vectors.

However, **6 Critical and High Severity Vulnerabilities** and **6 Medium Severity Risks** were identified across server function trust boundaries, IDOR URL parameters, document download permissions, evidence transfer authorization, AI prompt scoping, and rate limiter design.

---

## Audit Findings Matrix by Severity

| ID         | Category                                 |   Severity   | Vulnerability Description                                                                         |  Status   |
| :--------- | :--------------------------------------- | :----------: | :------------------------------------------------------------------------------------------------ | :-------: |
| **SEC-01** | Server Functions / Broken Access Control | **CRITICAL** | Caller Role Spoofing & IDOR in `searchGlobalRegistry` server function via `supabaseAdmin` bypass  | Confirmed |
| **SEC-02** | Document Access / Data Exposure          |   **HIGH**   | Unauthorized Document Download via `downloadDocumentFile` bypassing sensitivity clearance         | Confirmed |
| **SEC-03** | AI Security / Authorization Leakage      |   **HIGH**   | AI Assistant Authorization Leakage & Global Cross-Tenant Snapshot Cache in `askRegistryAssistant` | Confirmed |
| **SEC-04** | Evidence Custody / Authorization         |   **HIGH**   | Missing Permission Assertion in `dispatchEvidenceTransfer` and `acknowledgeEvidenceReceipt`       | Confirmed |
| **SEC-05** | IDOR / Record-Level Access               |   **HIGH**   | Client-Side IDOR on `/assets/$assetId` and Document Detail Memory Leakage via URL alteration      | Confirmed |
| **SEC-06** | Denial of Service / Rate Limiting        |   **HIGH**   | Shared Global Rate Limiter Buckets causing platform-wide DoS in Assistant and Public Lookup       | Confirmed |
| **SEC-07** | File Upload / Storage Security           |  **MEDIUM**  | Unsanitized File Names in Document Vault Storage Paths (Path Traversal Risk)                      | Confirmed |
| **SEC-08** | File Upload / Validation                 |  **MEDIUM**  | Missing Maximum File Size and MIME Type Validation in `uploadSecureDocument`                      | Confirmed |
| **SEC-09** | AI Prompt Injection                      |  **MEDIUM**  | Unsanitized Parameter Interpolation into AI Scheduling Explanation Prompt                         | Confirmed |
| **SEC-10** | Database RLS / State Machine             |  **MEDIUM**  | Supabase RLS Policy allows non-admin users to update Asset Status to `RETIRED` or `LOST`          | Confirmed |
| **SEC-11** | Privilege Escalation / Fail-Open         |   **LOW**    | Fallback to `"registrar"` role for unassigned users in `useCurrentStaff` and route guards         | Confirmed |
| **SEC-12** | Information Disclosure / API             |   **LOW**    | Unauthenticated `getBacklogSimulationCases` server function exposes active case priority data     | Confirmed |

---

## Detailed Vulnerability Analysis

### [SEC-01] CRITICAL: Caller Role Spoofing & IDOR in `searchGlobalRegistry`

- **Impacted File**: `src/lib/global-search.functions.ts` (lines 32–45)
- **Vulnerability Vector**: API / Server Functions & Authorization Bypass
- **Description**:  
  `searchGlobalRegistry` is declared as a public server function without the `requireSupabaseAuth` middleware. The input validator schema (`SearchInputSchema`) allows the client to supply `userRole` and `userId` directly in the request JSON payload. The server handler then immediately executes `executeUnifiedSearch` utilizing `supabaseAdmin` (the PostgreSQL service-role client that completely bypasses Row Level Security).
- **Attack Scenario**:  
  A low-privileged user (or unauthenticated actor) issues a direct HTTP POST request to the server function endpoint passing:
  ```json
  { "query": "", "userRole": "admin", "userId": "00000000-0000-0000-0000-000000000000" }
  ```
  The endpoint responds with all Sealed Cover (In-Camera) documents, restricted witness statements, confidential police evidence exhibits, and complete system audit logs, completely bypassing RLS.
- **Recommended Remediation**:
  1. Add `.middleware([requireSupabaseAuth])` to `searchGlobalRegistry`.
  2. Derive `userRole` and `userId` exclusively from the authenticated JWT claims in `context`, discarding any client-supplied role strings.

---

### [SEC-02] HIGH: Unauthorized Document Download via `downloadDocumentFile`

- **Impacted File**: `src/lib/documents.ts` (lines 1610–1642)
- **Vulnerability Vector**: Document Access & Unauthorized Downloads
- **Description**:  
  `downloadDocumentFile` receives a `documentId` and checks `await assertPermission(payload.userRole, "DOCUMENT_DOWNLOAD")`. Because `DOCUMENT_DOWNLOAD` is granted to almost all authenticated staff roles (police officers, registrars, custodians), the function verifies broad download capability but **fails to invoke `canAccessDocumentRecord(payload.userRole, doc)`**.
- **Attack Scenario**:  
  A police officer or court clerk requests to download a file with `sensitivity_tier: "SEALED_COVER_IN_CAMERA"` or `"RESTRICTED_INVESTIGATION"` by providing its ID. Because the user possesses `DOCUMENT_DOWNLOAD`, the system yields the complete canonical document content, effectively leaking in-camera judicial filings and protected witness statements.
- **Recommended Remediation**:
  Enforce `canAccessDocumentRecord(payload.userRole, doc, ...)` inside `downloadDocumentFile`. If access is disallowed, reject the request with `UnauthorizedException` and log an audit security alert.

---

### [SEC-03] HIGH: AI Assistant Authorization Leakage & Shared Cross-Tenant Cache

- **Impacted File**: `src/lib/assistant.functions.ts` (lines 62–64)
- **Vulnerability Vector**: AI Authorization Leakage & Cross-Session Memory Contamination
- **Description**:
  1. **Global Cache Contamination**: `cachedSnapshot` is stored as a global module variable on the server. When a Judge queries the assistant, `cachedSnapshot` caches all `SEALED_COVER_IN_CAMERA` documents for 60 seconds. Subsequent queries by any clerk, police officer, or litigant receive this cached Judge snapshot because the cache check only checks timestamp expiration, not caller authorization.
  2. **Prompt Data Leakage**: Lines 354–366 hardcode full evidence chain-of-custody details (e.g. `EV-1045`, High-Security Locker #12, CFSL cyber extraction logs) directly into the LLM system prompt. Any user querying the AI can extract sensitive evidence locker numbers and custodian identities.
- **Recommended Remediation**:
  1. Key the snapshot cache by user clearance tier (e.g., `cachedSnapshot_judge`, `cachedSnapshot_staff`).
  2. Ensure the LLM system prompt redacts sealed documents and restricted evidence unless the caller's verified role possesses authorized clearance.
  3. Require authentication for `askRegistryAssistant`.

---

### [SEC-04] HIGH: Missing Permission Verification in Evidence Custody Handover

- **Impacted File**: `src/lib/evidence-custody.ts` (lines 114–197)
- **Vulnerability Vector**: Evidence Custody & Transfer Authorization
- **Description**:  
  `dispatchEvidenceTransfer` receives `releasingOfficerName: string` and does NOT accept or verify an `actorRole`. It does not call `assertPermission(..., "EVIDENCE_TRANSFER")` and hardcodes `userRole: "investigating_officer"` into the audit trail.  
  Similarly, `acknowledgeEvidenceReceipt` updates the current custodian and location of physical evidence without verifying whether the acknowledging user has `EVIDENCE_CUSTODY` or `EVIDENCE_TRANSFER` clearance.
- **Attack Scenario**:  
  A rogue user or beat constable can trigger `dispatchEvidenceTransfer` or `acknowledgeEvidenceReceipt`, reassigning evidence exhibits to arbitrary officers or fictitious locations without having evidence custodian clearance.
- **Recommended Remediation**:
  1. Add `releasingOfficerRole` and `receivingOfficerRole` to the payloads.
  2. Call `await assertPermission(payload.releasingOfficerRole, "EVIDENCE_TRANSFER", ...)` in `dispatchEvidenceTransfer`.
  3. Call `await assertPermission(payload.receivingOfficerRole, "EVIDENCE_CUSTODY", ...)` in `acknowledgeEvidenceReceipt`.

---

### [SEC-05] HIGH: Client-Side IDOR on `/assets/$assetId` and Document Detail Cache

- **Impacted Files**:
  - `src/routes/_authenticated/assets/$assetId.tsx` (lines 173–180)
  - `src/routes/_authenticated/documents/$documentId.tsx` (lines 868–876)
- **Vulnerability Vector**: IDOR Risks (URL ID Tampering)
- **Description**:
  - In `/assets/$assetId`, when a user changes the URL ID to another asset (e.g., `/assets/ast_ev_01`), the page loads `policeAssetDetailQuery(assetId)` and displays all weapon serials, armory locations, and custody logs. It never calls `canAccessAssetRecord(staffRole, asset, assignedCaseIds)`. As a result, Judges (who are restricted solely to trial exhibits for cases on their bench) can inspect any police armory asset or unlinked criminal evidence.
  - In `/documents/$documentId`, `detailQuery.data` fetches the document content into React Query cache before `canAccessDocumentRecord` evaluates authorization in JSX. Even if JSX renders an "Access Denied" overlay, the sensitive content is present in the client's browser memory / query cache.
- **Recommended Remediation**:
  1. Enforce `canAccessAssetRecord` in `_authenticated/assets/$assetId.tsx` and render a 403 Forbidden guard if the asset is restricted.
  2. Move document access checks into `secureDocumentDetailQuery` so unauthorized document bodies are never sent or cached in the browser.

---

### [SEC-06] HIGH: Shared Global Rate Limiter Buckets (Denial of Service)

- **Impacted Files**:
  - `src/lib/assistant.functions.ts` (line 68)
  - `src/lib/case-status.functions.ts` (line 40)
- **Vulnerability Vector**: Rate Limiting & Denial of Service
- **Description**:  
  In `askRegistryAssistant`, the sliding-window limiter is called with a static string:
  ```ts
  checkRateLimit("assistant-global-session", { maxRequests: 30, windowMs: 60_000 });
  ```
  In `lookupCaseStatus`, it is called with:
  ```ts
  checkRateLimit("public-case-lookup", { maxRequests: 60, windowMs: 60_000 });
  ```
  Because the identifier is a fixed constant, **all users worldwide share a single 30 or 60 request bucket**.
- **Attack Scenario**:  
  A single script sending 30 requests to the AI assistant or 60 requests to the public case lookup consumes the quota, immediately locking out every judge, court registrar, police officer, and litigant across the entire court system for the remainder of the minute.
- **Recommended Remediation**:
  Key the rate limiter on client IP (from request headers `x-forwarded-for`, `x-real-ip`) or user ID from the auth context:
  ```ts
  const clientKey = context?.userId || request?.headers.get("x-forwarded-for") || "anonymous";
  ```

---

### [SEC-07] MEDIUM: Unsanitized File Names in Vault Paths (Path Traversal Risk)

- **Impacted File**: `src/lib/documents.ts` (lines 1045)
- **Vulnerability Vector**: Path Traversal & Storage Security
- **Description**:  
  In `uploadSecureDocument` and `createNewDocumentVersion`, `storage_path` is constructed via string interpolation:
  ```ts
  storage_path: `secure/documents/${docNumber}_${payload.fileName}`;
  ```
  If `payload.fileName` contains path traversal characters (`../../`, `..\\`, null bytes, or URL-encoded slashes), it can escape the intended `secure/documents/` folder.
- **Recommended Remediation**:
  Sanitize `fileName` by stripping directory separators (`/`, `\`), path traversal patterns (`..`), and non-alphanumeric characters (except `.` and `-`).

---

### [SEC-08] MEDIUM: Missing Maximum File Size and MIME Type Validation

- **Impacted File**: `src/lib/documents.ts` (lines 982–1007)
- **Vulnerability Vector**: File Upload Validation & File Size Limits
- **Description**:  
  `uploadSecureDocument` accepts `fileSizeBytes` and `fileFormat` directly from caller input without enforcing an upper boundary (e.g. 50MB) or checking file format against an approved whitelist (e.g., `PDF`, `PDF/A`, `DOCX`, `TIFF`, `PNG`, `JPG`). Unrestricted upload sizes could exhaust storage or browser memory.
- **Recommended Remediation**:
  Add validation rejecting files larger than 50MB (`MAX_DOCUMENT_SIZE_BYTES = 50 * 1024 * 1024`) and enforcing a strict whitelist of permitted judicial file types.

---

### [SEC-09] MEDIUM: Unsanitized AI Scheduling Explanation Prompt

- **Impacted File**: `src/lib/explain-candidate.functions.ts` (lines 121–139)
- **Vulnerability Vector**: AI Prompt Injection & Rate Limiting
- **Description**:  
  `explainSchedulingRecommendation` receives `data.parties` and `data.caseNumber` from the client and interpolates them directly into the LLM prompt without passing them through `sanitizeUserInput` or checking `detectPromptInjection`. Additionally, the endpoint has no rate limiting, allowing automated scripts to exhaust backend AI token quotas.
- **Recommended Remediation**:
  1. Apply `sanitizeUserInput(data.parties)` and `sanitizeUserInput(data.caseNumber)`.
  2. Implement client/session rate limiting on `explainSchedulingRecommendation`.

---

### [SEC-10] MEDIUM: Supabase RLS Allows Non-Admin to Retire or Mark Assets Lost

- **Impacted File**: `supabase/migrations/20260908150000_harden_rbac_dms_assets_evidence.sql` (lines 252–264)
- **Vulnerability Vector**: PostgreSQL Row Level Security (RLS)
- **Description**:  
  The RLS policy `"Hardened update police assets"` permits any authenticated user with `ASSET_ASSIGN`, `ASSET_TRANSFER`, or `ASSET_MAINTENANCE` to execute an `UPDATE` on `public.police_assets`. However, the business logic dictates that decommissioning an asset (`status = 'RETIRED'`) or marking an item lost (`status = 'LOST'`) requires an administrator (`requiresAdmin: true`).  
  A user with `ASSET_ASSIGN` can send a direct Supabase REST query updating an asset's status to `RETIRED` or `LOST`, bypassing the client-side state machine check.
- **Recommended Remediation**:
  Update the RLS `WITH CHECK` expression on `public.police_assets` to ensure that if `NEW.status IN ('RETIRED', 'LOST')`, the caller must satisfy `public.has_role(auth.uid(), 'admin'::public.app_role)`.

---

### [SEC-11] LOW: Fallback to `"registrar"` for Unassigned Users in `useCurrentStaff`

- **Impacted Files**:
  - `src/hooks/use-current-staff.ts` (line 43)
  - `src/routes/_authenticated/activity-log.tsx` (line 247)
  - `src/routes/_authenticated/assets/$assetId.tsx` (line 177)
- **Vulnerability Vector**: Privilege Escalation & Least Privilege (Fail-Closed)
- **Description**:  
  When an authenticated user has no record in `user_roles`, `useCurrentStaff` defaults `let role: StaffRole = "registrar";`. Furthermore, several route components contain `staff.data?.role || "registrar"`.  
  Court Registrar is a high-privilege administrative persona with access to all court filings, evidence custody, and audit trails. Defaulting unassigned users to `"registrar"` violates the principle of least privilege.
- **Recommended Remediation**:
  Default unassigned users to `"police_officer"` (read-only baseline role) or `null` (no privileged permissions).

---

### [SEC-12] LOW: Unauthenticated `getBacklogSimulationCases` Server Function

- **Impacted File**: `src/lib/backlog.functions.ts` (lines 9–30)
- **Vulnerability Vector**: Sensitive Data Exposure / Public Server Functions
- **Description**:  
  `getBacklogSimulationCases` uses `supabaseAdmin` to query all active cases, exposing case numbers, filing dates, priority scores, and statutory limitation deadlines without authentication or rate limiting.
- **Recommended Remediation**:
  Add `.middleware([requireSupabaseAuth])` or apply client IP rate limiting and filter out internal priority metadata.

---

## Technical Domain Audits & Validated Controls

| Domain                         |  Status  | Verified Technical Controls                                                                                                                                               |
| :----------------------------- | :------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Authentication**             | **PASS** | Supabase Auth handles email/password and JWT validation. Passwords are never stored in plaintext.                                                                         |
| **Document Version Integrity** | **PASS** | Immutable version tree (v1, v2, v3); SHA-256 digests computed dynamically; Section 63 BSA compliance verified; tamper simulation correctly triggers `INTEGRITY_MISMATCH`. |
| **Digital Signature Metadata** | **PASS** | Signatures strictly bind to `(documentId, versionNumber)` and content hash. Cleared disclaimers state platform keystore is preparation for CCA Class 3 DSC tokens.        |
| **Audit Trail Manipulation**   | **PASS** | PostgreSQL migration `20260908160000_extend_audit_logs.sql` contains explicit `NO UPDATE` and `NO DELETE` RLS policies.                                                   |
| **Environment & Secrets**      | **PASS** | `SUPABASE_SERVICE_ROLE_KEY` is not prefixed with `VITE_` and is referenced only in `client.server.ts`. No server keys leak into client JS.                                |
| **SQL Injection**              | **PASS** | All database calls use Supabase query builders with parameterized inputs. No raw SQL concatenation.                                                                       |
| **XSS Prevention**             | **PASS** | Standard React JSX escaping applies across all UI components. No use of `dangerouslySetInnerHTML`.                                                                        |
| **Public Routes**              | **PASS** | Public `/case-status` correctly redacts sensitive party names, contact info, and internal priority weights.                                                               |

---

## Action Plan for Remediation

Upon approval from the user, the remediation will be executed sequentially:

1. **Remediate Server Function Spoofing & Auth**:
   - Add `requireSupabaseAuth` to `searchGlobalRegistry` and derive `userRole`/`userId` from server context.
   - Key rate limiters by client IP / user ID instead of static global strings.
2. **Remediate Document & Storage Protections**:
   - Add `canAccessDocumentRecord` enforcement into `downloadDocumentFile`.
   - Add file name path traversal sanitization and size limits in `uploadSecureDocument`.
3. **Remediate Evidence & Asset Handover Verification**:
   - Add permission assertions (`EVIDENCE_TRANSFER`, `EVIDENCE_CUSTODY`) into `dispatchEvidenceTransfer` and `acknowledgeEvidenceReceipt`.
   - Add `canAccessAssetRecord` check into `/assets/$assetId` route.
4. **Harden AI Assistant & LLM Pipelines**:
   - Split AI assistant cache by user authorization scope and redact confidential custody details.
   - Sanitize parameters in `explain-candidate.functions.ts`.
5. **Harden Role Fallbacks**:
   - Replace `"registrar"` fallback with least-privilege `"police_officer"`.
