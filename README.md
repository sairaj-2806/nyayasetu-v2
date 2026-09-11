# ⚖️ NyayaSetu (न्यायसेतु)

## Secure Digital Document & Evidence Management Platform for Legal and Investigation Workflows

**Smart India Hackathon (SIH) 2026 | Problem Statement SIH26190**

- **Organization:** Ministry of Home Affairs (MHA)
- **Department:** National Crime Records Bureau (NCRB), Women Safety Division
- **Category:** Software
- **Theme:** Blockchain & Cybersecurity
- **Primary Positioning:** _"NyayaSetu secures the complete lifecycle of sensitive legal and investigation records—from ingestion and verification to controlled access, versioning, collaboration, evidence custody, intelligent retrieval and complete auditability."_

[![Live Web Platform](https://img.shields.io/badge/Live%20Portal-Workers.dev-2563eb?style=for-the-badge&logo=cloudflare&logoColor=white)](https://nyaysetu.sujal309206.workers.dev)
[![Desktop App](<https://img.shields.io/badge/Desktop%20App-Windows%20x64%20(Electron)-059669?style=for-the-badge&logo=windows&logoColor=white>)](#-desktop--offline-capability-electron)
[![React 19](https://img.shields.io/badge/React%2019-TanStack%20Start-61dafb?style=for-the-badge&logo=react&logoColor=black)](https://tanstack.com/start)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind%20CSS-v4.2-38bdf8?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Supabase Postgres](https://img.shields.io/badge/Database-Supabase%20Postgres%20%2B%20RLS-3ecf8e?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com)
[![Statutory Compliance](https://img.shields.io/badge/Compliance-BSA%20§63%20|%20BNSS%20|%20BNS-8b5cf6?style=for-the-badge)](https://www.indiacode.nic.in)

---

## 📌 Executive Summary (SIH26190 Alignment)

Law enforcement agencies, forensic science laboratories, state prosecution departments, and district judiciaries handle vast quantities of highly sensitive, confidential, and legally determinative documents. In critical cases—especially offenses against women, minors, and state security—the integrity and traceability of investigation documents are paramount.

Traditional paper records and basic cloud storage solutions suffer from severe structural vulnerabilities:

1. **Evidentiary Inadmissibility:** Electronic records often fail the statutory requirements of **Section 63 of the Bharatiya Sakshya Adhiniyam (BSA, 2023)** due to missing cryptographic provenance, unverified device origin, and untracked file transfers.
2. **Unauthorized Modifications & Incomplete Versioning:** File overwrites erase historical states without retaining cryptographic proof of previous filings.
3. **Leaky Access Boundaries & Siloed Custody:** Sensitive sealed-cover forensic reports risk unauthorized inspection or premature disclosure.
4. **Broken Chains of Custody:** Physical property seized under Section 105 BNSS panchnamas frequently lacks verifiable, two-party signed handover trails between the crime scene, police station, forensic lab, and court Malkhana.

**NyayaSetu** directly solves Problem Statement **SIH26190** by delivering an enterprise-grade, zero-trust digital document vault and evidence management system that enforces end-to-end confidentiality, tamper-evident cryptographic verification, immutable version control, controlled multi-party collaboration, and complete auditability.

---

## 🏛️ System Architecture & Product Hierarchy

NyayaSetu is architected around a strict functional hierarchy where **the Secure Document Management System (DMS) is the core hero**:

```
┌─────────────────────────────────────────────────────────────────────────┐
│              NYAYASETU SECURE DOCUMENT & EVIDENCE VAULT (P0)            │
│  - Secure Digital Vault       - Document Lifecycle & Version Control    │
│  - Multi-Tier Authorization   - Cryptographic Integrity (Sec 63 BSA)    │
│  - Evidence & Custody Chain   - Controlled Collaboration & Revocation   │
│  - Unified Authorized Search  - Immutable Audit & Security Center       │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────────────────┐
│                  AI & INVESTIGATION INTELLIGENCE (P1)                   │
│  - NyayaSetu Assistant (Grounded, Zero-Bypass Legal AI)                 │
│  - Secure Case Dossier & Evidentiary Relationship Graph                 │
│  - Unified Chronological Investigation Timeline                         │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────────────────┐
│              CASE & HEARING OPERATIONS (P2 SUPPORTING WORKFLOW)         │
│  - Case Dossier & Hearing Schedules - Procedural Cause-Lists            │
│  - Conflict Scanning & Solver       - What-If Simulation Engine         │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────────────────┐
│                 INFRASTRUCTURE & INTEGRATION (P3)                       │
│  - Evidence & Asset Management      - Electron Desktop / Offline Engine │
│  - Multilingual Public Case Status  - Governance Reports                │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🛡️ Zero-Trust Security & Authorization Architecture

NyayaSetu operates under a strict **Zero-Trust Defense-in-Depth** model. Neither the client browser nor any AI model determines authorization:

```
AUTHENTICATION (Supabase Auth Verified JWT Session)
      ↓
   IDENTITY (Cryptographically derived server-side)
      ↓
     ROLE (Admin, Investigating Officer, Forensic Officer, Evidence Custodian, Legal Officer, Judge, Auditor)
      ↓
  PERMISSION (Can View, Can Download, Can Create Version, Can Share, Can Revoke)
      ↓
  CASE SCOPE (Jurisdictional Police Station / Designated Judicial Bench)
      ↓
SENSITIVITY CLEARANCE (PUBLIC, INTERNAL, CONFIDENTIAL, RESTRICTED, SEALED_COVER_IN_CAMERA)
      ↓
RESOURCE AUTHORIZATION (Document-specific policy + Active time-bound collaboration grants)
      ↓
DATABASE / STORAGE (PostgreSQL RLS Policies & Private Cloud Object Storage with 120s Signed URLs)
      ↓
  AUDIT LEDGER (Immutable cryptographically timestamped audit event)
```

### Critical Security Boundaries

- **Private Storage Architecture:** All document objects reside in private buckets. Short-lived signed URLs (120-second TTL) are issued only after authorization. No public document URLs exist.
- **Path Traversal Prevention:** Storage keys follow the server-generated format:
  `secure/documents/{documentId}/{versionId}/{generated-object-id}`.
  Raw user-provided filenames are never used as storage keys. All traversal patterns (`../`, null bytes, control chars, URL encoded traversals) are strictly blocked.
- **Fail-Closed RBAC & RLS:** Unknown roles, expired sessions, or unassigned case dockets immediately fail closed with an `ACCESS_DENIED` security alert.
- **Audit Immutability:** Ordinary users and officers cannot modify, truncate, or delete audit records.

---

## ✨ Flagship Capabilities (SIH26190 Core)

### 1. 📁 Secure Document Vault & Ingestion Pipeline

- **Supported Categories:** FIRs, Crime Scene Panchnamas, Section 180 BNSS Witness Statements, CFSL Forensic Reports, Section 193 BNSS Charge Sheets, Court Filings, Seizure Memos, Judgments.
- **Ingestion Validation:** Multi-stage inspection verifying MIME type, magic bytes, file size limits, and sanitizing filename metadata.

### 2. 🔐 Document Classification & Sensitivity Tiers

Every document is categorized under one of 5 clearance tiers:

- `PUBLIC`: Accessible for public legal notices or disposed cause-lists.
- `INTERNAL`: Police station or court administrative records.
- `CONFIDENTIAL`: Active case dockets, pleadings, and interim applications.
- `RESTRICTED`: Sensitive investigation diaries and preliminary forensic reports.
- `SEALED_COVER_IN_CAMERA`: POCSO statements, state security records, and protected witness identities accessible exclusively by the Presiding Judge and designated Lead IO.

### 3. 📜 Version Control & Document Lifecycle

- **Strict Version Chain:** Documents progress monotonically (`v1` ➔ `v2` ➔ `v3` ➔ `vN`).
- **Never Overwrite:** Official versions are permanently preserved with their original SHA-256 digests.
- **Side-by-Side Comparison:** Interactive visual diff and hash verification across versions.

### 4. 🔏 Cryptographic Integrity (Section 63 BSA, 2023)

- **Tamper-Evident Architecture:** Displays real-time SHA-256 hash validation, version chain lineage, digital signature metadata, and direct link to the server audit record.
- **Admissible Certification:** Generates printable Section 63 BSA electronic evidence compliance certificates with hash logs and custodian signatures.

### 5. 🤝 Controlled Collaboration & Instant Revocation

- **Scoped Grants:** Share access with designated officers (`VIEW`, `DOWNLOAD`, `COMMENT`, `EDIT`, `SHARE`).
- **Time Expiration:** Automatic expiration enforced at the server boundary.
- **One-Click Revocation:** Instantly invalidates all active signed URLs and logs an immediate audit event.

### 6. 📦 Evidence & Malkhana Chain of Custody

- **Monotonic 9-Stage Custody:** `COLLECTED` ➔ `REGISTERED` ➔ `VERIFIED` ➔ `STORED` ➔ `TRANSFERRED` ➔ `RECEIVED` ➔ `EXAMINED` ➔ `PRESENTED` ➔ `ARCHIVED`.
- **Physical Tamper Seals:** Barcoded tamper seals (`MHA-EV-XXXX-A`) verified at every transfer.
- **Dual-Party Handover:** Requires explicit acceptance from the receiving custodian before location transfer is formalized.

### 7. 🔍 Unified Authorized Search

- Case-aware search across documents, versions, evidence exhibits, and cases.
- **Pre-Filtering:** Authorization and sensitivity filters run server-side before results reach the client.

### 8. 🤖 NyayaSetu Assistant (Grounded AI Intelligence)

- **Authoritative Scope:** Natural language retrieval across Indian Law (BNS 2023, BNSS 2023, BSA 2023), active case dossiers, and custody ledgers.
- **Source-Grounded Citations:** Explicitly references authorized records (`Sources: [DOC-xxxx vX, Case NYS-xxxx, Exhibit EV-xxxx]`).
- **Strict Guardrails:** Operates under human supervision; strictly prohibited from determining guilt, predicting verdicts, altering records, or bypassing clearance.

### 9. 📊 Secure Case Dossier & Evidentiary Relationship Graph

- Maps the complete evidentiary pipeline from inception to trial:
  `FIR` ➔ `Investigation Panchnama` ➔ `Witness Statements` ➔ `Seized Exhibits` ➔ `Forensic Reports` ➔ `Charge Sheet` ➔ `Court Filings` ➔ `Judicial Orders`.

### 10. 📅 Case & Hearing Operations (Supporting Workflow)

- Preserves deterministic court scheduling, judge availability optimization, conflict scanning, and What-If simulations under human registrar oversight.

---

## 🔑 Pre-Seeded Official Demo Credentials

For live evaluation and competition review, use the pre-configured accounts in the sign-in portal (`/auth`):

| Role / Persona                 | Email Address                    | Password           | Designation & Scope                               |
| :----------------------------- | :------------------------------- | :----------------- | :------------------------------------------------ |
| **System Admin**               | `admin@courts.gov`               | `Admin#2026`       | Security Center, user roles, system audit logs    |
| **Investigating Officer (IO)** | `io.sharma@delhipolice.gov`      | `Investigate#2026` | Inspector (Special Cell / BNSS investigation)     |
| **Forensic Officer**           | `fsl.mehta@cfsl.gov`             | `Forensic#2026`    | Ballistics & Cyber Forensic Expert (CFSL)         |
| **Evidence Custodian**         | `malkhana.singh@delhipolice.gov` | `Evidence#2026`    | Malkhana Moharrir (Vault & Custody Officer)       |
| **Court Registrar**            | `registrar@courts.gov`           | `Registrar#2026`   | Case intake, procedural cause-lists               |
| **Judicial Bench (Judge)**     | `judge.kapoor@delhicourts.gov`   | `Judge#2026`       | Hon'ble Bench (Courtroom 1 / In-Camera Clearance) |
| **Public Prosecutor**          | `prosecutor.mehta@justice.gov`   | `Prosecutor#2026`  | State Public Prosecutor (Sessions Division)       |
| **Auditor**                    | `records.gupta@courts.gov`       | `Records#2026`     | Judicial Auditor & Compliance Inspector           |

---

## 🚀 Quickstart & Local Development

### Prerequisites

- Node.js 20+
- npm 10+

### Setup & Run

```bash
# 1. Clone repository
git clone https://github.com/sairaj-2806/nyayasetu-v2.git
cd nyayasetu-v2

# 2. Install dependencies
npm install

# 3. Verify TypeScript compilation
npx tsc --noEmit

# 4. Start local development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Run Security & Regression Test Suite

```bash
# Execute automated security regression test suite (70/70 checks)
node scripts/test-security-regression.mjs

# Build production bundle
npm run build
```

---

## 🖥️ Desktop & Offline Capability (Electron)

NyayaSetu includes an Electron container configured with hardened security settings:

- `contextIsolation = true`, `nodeIntegration = false`, minimal preload bridge.
- Encrypted local cache for emergency access during network disconnections at remote police outposts.

```bash
# Launch desktop client in development
npm run electron:dev

# Build Windows x64 NSIS installer
npm run electron:build
```

---

## 📚 Official SIH26190 Documentation

- **[SIH26190 Final Product Audit](docs/SIH26190_FINAL_PRODUCT_AUDIT.md):** Complete architectural audit, security model, and lifecycle analysis.
- **[SIH26190 Requirement Mapping Matrix](docs/SIH26190_REQUIREMENT_MAPPING.md):** Detailed compliance matrix mapping every official PS requirement to the codebase.
- **[Security Remediation Report](docs/SECURITY_REMEDIATION_REPORT.md):** Technical analysis of SEC-01 through SEC-12 zero-trust hardening.

---

## ⚖️ Statutory Governance & Standards

NyayaSetu complies with the latest Indian criminal jurisprudence enactments:

- **Bharatiya Nagarik Suraksha Sanhita (BNSS, 2023):** Sections 105 (Mandatory electronic search/seizure recordings), 173 (FIR/Zero-FIR), 180 (Witness statements), 193 (Charge sheets).
- **Bharatiya Sakshya Adhiniyam (BSA, 2023):** Sections 57 & 61 (Electronic records as primary evidence), Section 63 (Electronic evidence admissibility certification & hash verification).
- **Bharatiya Nyaya Sanhita (BNS, 2023):** Substantive legal categories and offense classification.
