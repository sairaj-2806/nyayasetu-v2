# ⚖️ NyayaSetu (न्यायसेतु)

### Unified AI-Assisted Smart Court Case Scheduling, Secure Digital Evidence & Cause-List Optimisation Platform

**Smart India Hackathon (SIH) 2026 | Built for Indian District Courts, Taluka Benches, Police Stations & Malkhana Vaults**

[![Live Web Platform](https://img.shields.io/badge/Live%20Portal-Workers.dev-2563eb?style=for-the-badge&logo=cloudflare&logoColor=white)](https://nyaysetu.sujal309206.workers.dev)
[![Desktop App](<https://img.shields.io/badge/Desktop%20App-Windows%20x64%20(Electron)-059669?style=for-the-badge&logo=windows&logoColor=white>)](#-native-desktop-app-electron)
[![React 19](https://img.shields.io/badge/React%2019-TanStack%20Start-61dafb?style=for-the-badge&logo=react&logoColor=black)](https://tanstack.com/start)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind%20CSS-v4.2-38bdf8?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Supabase Postgres](https://img.shields.io/badge/Database-Supabase%20Postgres%20%2B%20RLS-3ecf8e?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com)
[![Cloudflare R2](https://img.shields.io/badge/Storage-Cloudflare%20R2%20Vault-f38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://www.cloudflare.com/developer-platform/r2/)
[![Statutory Compliance](https://img.shields.io/badge/Compliance-BSA%20§63%20|%20BNSS%20|%20BNS-8b5cf6?style=for-the-badge)](https://www.indiacode.nic.in)

---

## 📌 Executive Summary

India's judicial ecosystem grapples with a backlog exceeding **50 million pending court cases**. Beyond sheer caseload volume, the daily operational bottleneck lies in **manual scheduling inefficiencies, siloed police-court records, and avoidable adjournments**:

- Over **50,000 hearings are adjourned daily** across Indian district and taluka courts due to administrative clashes, judge leave, courtroom unavailability, or missing evidence.
- Court registrars spend **2 to 3 hours every morning** manually compiling cause lists on paper or spreadsheets.
- A sudden judge illness or infrastructure closure causes all listed hearings to collapse, leaving traveling litigants stranded.
- Evidence exhibits and case documents frequently lack cryptographic chain-of-custody verification under modern statutory standards (**Bharatiya Sakshya Adhiniyam, 2023 §63**).

**NyayaSetu (न्यायसेतु)** is an enterprise-grade, deterministic, and explainable digital justice platform. It bridges court registries, judicial benches, police stations, forensic laboratories, and citizens. It optimizes court hearing schedules using a **hard-constraint satisfaction solver**, **8-factor statutory priority scoring**, and **zero-risk digital twin simulations**, while providing an unbroken cryptographic **Secure Document Vault (Cloudflare R2)** and **Malkhana Evidence Custody Register** with strict human-in-the-loop judicial oversight.

---

## 🌐 Live Deployments & Distribution

- **Production Cloudflare Workers Deployment**: [https://nyaysetu.sujal309206.workers.dev](https://nyaysetu.sujal309206.workers.dev)
- **Public Multilingual Case Status Portal**: [https://nyaysetu.sujal309206.workers.dev/case-status](https://nyaysetu.sujal309206.workers.dev/case-status) _(Zero login required; search by 16-digit CNR or Case Number)_
- **Native Windows Desktop Installer**: Packaged NSIS executable (`in.gov.nyayasetu.desktop`) with integrated offline fallback support.

---

## 🏛️ Unified 9-Persona Workspaces & Access Control

NyayaSetu provides dedicated, least-privilege workspaces tailored to each stakeholder in the criminal and civil justice lifecycle:

```
                                  ┌─────────────────────────────────────────┐
                                  │      NYAYASETU UNIFIED JUSTICE CORE     │
                                  └────────────────────┬────────────────────┘
                                                       │
         ┌──────────────────┬──────────────────────────┼──────────────────────────┬──────────────────┐
         │                  │                          │                          │                  │
         ▼                  ▼                          ▼                          ▼                  ▼
  ┌──────────────┐   ┌──────────────┐          ┌──────────────┐            ┌──────────────┐   ┌──────────────┐
  │    POLICE    │   │INVESTIGATION │          │   JUDICIAL   │            │   FORENSIC   │   │   MALKHANA   │
  │  STATION &   │   │  OFFICER &   │          │  REGISTRY &  │            │  LABORATORY  │   │   EVIDENCE   │
  │    PATROL    │   │  CYBER CELL  │          │    BENCH     │            │ (CFSL / FSL) │   │  CUSTODIAN   │
  └──────────────┘   └──────────────┘          └───────┬──────┘            └──────────────┘   └──────────────┘
                                                       │
                               ┌───────────────────────┴───────────────────────┐
                               │                                               │
                               ▼                                               ▼
                        ┌──────────────┐                                ┌──────────────┐
                        │ PROSECUTION  │                                │ PUBLIC CASE  │
                        │   & LEGAL    │                                │    LOOKUP    │
                        │   COUNSEL    │                                │  (CITIZENS)  │
                        └──────────────┘                                └──────────────┘
```

| Workspace                     | Primary Role            | Scope & Key Capabilities                                                                                                                 |
| ----------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Judicial / Court Registry** | `registrar`, `admin`    | Case intake, constraint-based smart scheduling, 3-stage cause list generation, conflict scanning, What-If simulation, governance reports |
| **Judge Bench Portal**        | `judge`                 | Self-scoped daily cause list, bench hearing calendar, direct case pull-in (`/bench`), judicial directives                                |
| **Criminal Investigation**    | `investigating_officer` | Case diary logging under BNSS, digital FIR filings, crime scene seizure memos, witness statement recording                               |
| **Forensic Laboratory**       | `forensic_officer`      | Exhibit examination queue, ballistics/DNA/cyber extraction reports, BSA §63 digital certificates                                         |
| **Malkhana Vault Custody**    | `evidence_custodian`    | Biometric vault locker inventory, tamper transit seals, two-officer custody handover, unbroken chain verification                        |
| **Police Station & Patrol**   | `police_officer`        | Assigned weapons, body-worn cameras, patrol vehicles, duty rosters, field equipment maintenance logs                                     |
| **Legal & Prosecution**       | `legal_officer`         | Charge sheet scrutiny, criminal evidence inspection, trial filings, legal notice archives, hearing schedules                             |
| **Documents & Records Vault** | `document_officer`      | Immutable multi-version document repository, SHA-256 cryptographic watchdog, digital signatures, sealed-cover management                 |
| **System Administration**     | `admin`                 | Least-Privilege RBAC management (14 permissions), priority weight tuner, system audit log, security integrity alerts                     |
| **Public Citizen Portal**     | Litigant / Citizen      | No-login multilingual case tracking (`/case-status`) across English, Hindi, and Marathi by CNR/Case number                               |

---

## 🔑 Pre-Seeded Official Demo Credentials

For live evaluation and judging, the following pre-configured official credentials are built into the sign-in portal (`/auth`):

| Workspace            | Official Account Email           | Password           | Designation & Bench                 |
| -------------------- | -------------------------------- | ------------------ | ----------------------------------- |
| **Administration**   | `admin@courts.gov`               | `Admin#2026`       | System Administrator (Full Control) |
| **Court Registry**   | `registrar@courts.gov`           | `Registrar#2026`   | Judicial Registry In-Charge         |
| **Judicial Bench**   | `judge.kapoor@delhicourts.gov`   | `Judge#2026`       | Hon'ble Bench (Courtroom 1)         |
| **Investigation**    | `io.sharma@delhipolice.gov`      | `Investigate#2026` | Inspector (Special Cell / BNSS)     |
| **Forensic Lab**     | `fsl.mehta@cfsl.gov`             | `Forensic#2026`    | Ballistics & Cyber Expert (CFSL)    |
| **Evidence Custody** | `malkhana.singh@delhipolice.gov` | `Evidence#2026`    | Malkhana Moharrir (Vault Officer)   |
| **Prosecution**      | `prosecutor.mehta@justice.gov`   | `Prosecutor#2026`  | Chief Public Prosecutor             |
| **Records Vault**    | `records.gupta@courts.gov`       | `Records#2026`     | Record Room Officer (DMS)           |
| **Police Station**   | `beat.verma@delhipolice.gov`     | `Police#2026`      | Beat Constable (Station Duty)       |

---

## ✨ 12 Core Architectural Pillars

### 1. 🧠 Deterministic Multi-Constraint Scheduling Engine

NyayaSetu models court scheduling as a **mathematical constraint satisfaction and optimization problem** (similar to aerospace operations), not an opaque neural network:

- **6 Hard Constraints (Disqualifying Rules)**:
  1. 🟢 **Judge Availability Verification**: Zero scheduling during approved leave or off-bench duties.
  2. 🟢 **Courtroom Operational Status**: Hall verified open and functional.
  3. 🟢 **Zero Double-Booking**: Guarantees zero concurrent clash for any judge or courtroom.
  4. 🟢 **Duration Fit Check**: Case estimated duration ($\le$ slot duration).
  5. 🟢 **Workload Ceiling Enforcement**: Enforces daily hearing threshold per judge.
  6. 🟢 **Gazetted Court Sitting Check**: Enforces court calendar sitting rules (excludes Sundays & gazetted holidays).
- **4 Soft Preferences (Ranking Weights)**:
  1. 📊 **Subject-Matter Specialisation**: Matches POCSO, Commercial, Civil, Labour, or Criminal benches.
  2. 📊 **Balanced Workload Distribution**: Prevents judicial burnout across district benches.
  3. 📊 **Statutory Urgency & Priority Tier**: Weighs GoI statutory mandates and trial age.
  4. 📊 **Courtroom Slot Utilisation**: Maximises court facility density without time spills.

---

### 2. 🧾 Explainable Decision Receipts (`<DecisionReceiptCard />`)

Every scheduling recommendation generates an **audit-ready, machine-readable Decision Receipt**:

- **Anti-Black-Box AI**: Judges and registry officials see an itemized receipt showing every passed hard constraint with a green checkmark (`✓`) and a transparent mathematical breakdown of soft factor points.
- **Explainability Statement**: Clearly declares the exact legal and administrative reasons why a specific date, bench, and courtroom were ranked #1.

---

### 3. 🎯 Direct Alternative Selection & Custom Judicial Directives

- **Direct Alternative Selection**: Registrars can inspect Candidate Options 2, 3, or 4 and schedule them with a single click.
- **Custom / Judge's Directive Modal (`CustomJudicialScheduleModal`)**:
  - Allows judges or registrars to fix a hearing date under judicial order (_"Urgent Mention allowed by Bench"_, _"Part-heard matter fixed per Bench order"_).
  - **Live Pre-Flight Conflict Checking**: Validates constraints in real time before confirmation.
  - **Immutable Compliance Logging**: Judicial override justifications are written to the audit log for Supreme Court compliance.
- **Judge's Bench Portal (`/bench`)**: Dedicated **Direct Bench Listing** tab allowing presiding judges to search open registry cases and pull them directly onto their bench.

---

### 4. 🔮 Zero-Risk What-If Simulation Sandbox (Digital Twin)

- Deep-clones the active registry in memory to model emergency disruptions (e.g., sudden judge illness or courtroom infrastructure failure).
- Traces all affected hearings in real time, generates conflict-free alternative slots across available benches, and allows the registrar to **commit reallocations to the live database in 60 seconds**.
- Protects traveling litigants from last-minute wasted court visits.

---

### 5. 🏛️ 8-Factor Statutory Priority Scoring Engine

Computes a transparent 0–100 urgency score aligned with Government of India mandates:

- **Fast Track Special Court (FTSC) / POCSO Act matters**
- **Senior Citizen litigants (age 60+)**
- **Long-pending property disputes (pending 5+ years per 14th Finance Commission guidelines)**
- **Statutory Limitation Act deadlines approaching**
- **Historical adjournment count & case pendency duration**
- **Category baseline weightings & administrative priority boost**
- Groups cases into **Tier 1 (Critical)**, **Tier 2 (Moderate)**, and **Tier 3 (Routine)**.

---

### 6. 📋 3-Stage Procedural Cause List Optimizer

Generates balanced daily cause lists organized into judicial sitting stages:

- **Stage 1 (Morning | 10:30 AM – 11:30 AM)**: Urgent Mentions, Bail Applications & Fresh Admissions.
- **Stage 2 (Midday | 11:30 AM – 01:30 PM)**: Contested Arguments, Framing of Issues & Evidence Examination.
- **Stage 3 (Afternoon | 02:30 PM – 04:30 PM)**: Final Orders, Pronouncements & Miscellaneous Disposals.
- Features **"Why This Order"** legal basis drawer explaining the procedural ranking of every case on the board.

---

### 7. 🔒 Secure Digital Document Management System (DMS) & Cloudflare R2 Vault

- **Cloudflare R2 Object Storage**: Private encrypted cloud vault (`VAULT_BUCKET`: `nyayasetu-vault`) storing petitions, charge sheets, FIRs, and forensic reports with streaming access.
- **Cryptographic SHA-256 Watchdog**: Calculates and verifies file digests on upload and access to detect tampering or corruption.
- **Interactive Tamper Simulation**: Allows evaluators to simulate document tampering and watch the watchdog instantly flag cryptographic mismatches.
- **Immutable Multi-Version History**: Retains V1, V2, V3... with side-by-side version comparison and visual diffing.
- **Digital Signatures & BSA 2023 §63 Certificates**: Enforces cryptographic signing of court orders and police filings.
- **Confidentiality Tiers**: Public, Restricted, Confidential, and **Sealed Cover (In-Camera)** with RBAC protection.

---

### 8. 📦 Malkhana Criminal Evidence & Chain-of-Custody Register

- **Bharatiya Sakshya Adhiniyam (BSA, 2023) §63 Alignment**: Full lifecycle management of physical and digital criminal evidence exhibits.
- **Biometric Malkhana Vault & Locker Tracking**: Real-time locker inventory management with tamper-evident transit seal numbers.
- **Two-Officer Dual-Acknowledgement Protocol**: Outgoing and incoming custodial transfers require cryptographic verification.
- **Unbroken Custody Verification**: One-click algorithm verifies whether the chain of custody from crime scene seizure to court presentation remains unbroken.
- **Status Progression**: `Seized at Scene` $\rightarrow$ `Registered` $\rightarrow$ `Sealed in Vault` $\rightarrow$ `Malkhana Stored` $\rightarrow$ `Dispatched to Lab` $\rightarrow$ `Presented in Court` $\rightarrow$ `Disposed`.

---

### 9. 🛡️ Police Tactical Assets & Fleet Lifecycle Tracker

- Manages police station armory, service weapons, body-worn surveillance cameras, forensic test kits, and patrol vehicles.
- Tracks equipment checkout, condition inspections (_Operational_, _Under Maintenance_, _Decommissioned_), and scheduled calibrations.
- Aligned with Ministry of Home Affairs (MHA) police armory regulations.

---

### 10. 💬 Grounded AI Judicial & Investigation Copilot (`/ai-assistant`)

- Resilient dual-tier LLM architecture: **Google Gemini 3.5 Flash** with automatic failover to **Groq Cloud LLaMA 3.3 70B**.
- Grounded directly in live registry data: answers questions regarding case dossiers, pending bail petitions, judge workloads, evidence chain status, and statutory procedural rules under BNS, BNSS, and BSA.

---

### 11. ⚠️ Real-Time Conflict Scanner & Backlog Simulator

- **8 Distinct Conflict Types Scanned**:
  1. Judge Double-Booking
  2. Courtroom Double-Booking
  3. Judge Unavailability / Leave
  4. Courtroom Closure / Maintenance
  5. Hearing Slot Overlap
  6. Case Duration Overflow
  7. Judge Workload Ceiling Breach
  8. Gazetted Holiday / Non-Sitting Day Clash
- **Backlog Simulator**: Deterministic mathematical modeling comparing traditional **FIFO (First-In, First-Out)** listing vs. **NyayaSetu Priority-Based Optimization** over 6-month and 12-month disposal horizons.

---

### 12. 🌐 Dual-Engine Full-Page Hindi Translation & Public Citizen Portal

- **Instant DOM TreeWalker Engine**: Translates 500+ Indian legal, procedural, and administrative terms instantly without server latency.
- **Seamless Dynamic Translation Layer**: Translates dynamic case summaries and party names in the background.
- **Lossless Toggle (`EN ⇄ हिं`)**: Accessible to district court staff and regional litigants across the entire platform.
- **Public Portal (`/case-status`)**: Litigants enter their 16-digit CNR or Case Number to check hearing dates, courtroom numbers, and cause list positions in English, Hindi, or Marathi.

---

## 🛠️ Technology Stack

| Layer                       | Technology                         | Rationale & Implementation                                                          |
| --------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------- |
| **Frontend Framework**      | **React 19**                       | Concurrent rendering, modern hooks, server components                               |
| **Fullstack Engine**        | **TanStack Start & Nitro**         | Isomorphic server functions, lightning-fast SSR                                     |
| **Client Routing & State**  | **TanStack Router & Query**        | 100% type-safe file-based routing, cache invalidation                               |
| **Desktop Application**     | **Electron & Electron Builder**    | Native Windows desktop app (`in.gov.nyayasetu.desktop`) with offline cache fallback |
| **Styling & Design System** | **Tailwind CSS v4**                | Modern theme tokens, dark/light modes, high-density judicial UI                     |
| **UI Primitives & Icons**   | **Radix UI & Lucide React**        | Accessible dialogs, popovers, dropdowns, and judicial icons                         |
| **Database & Security**     | **Supabase PostgreSQL**            | Row Level Security (RLS) policies, database triggers, realtime                      |
| **Object Storage**          | **Cloudflare R2**                  | Private encrypted vault (`VAULT_BUCKET`) for legal documents                        |
| **Charts & Analytics**      | **Recharts**                       | Judicial workload distributions, pendency graphs, asset lifecycles                  |
| **PDF Generation**          | **jsPDF & jsPDF-AutoTable**        | Official NyayaSetu court-branded cause lists and audit certificates                 |
| **AI Intelligence**         | **Google Gemini 3.5 Flash & Groq** | Resilient dual-tier grounded LLM assistant                                          |
| **Language & Typings**      | **TypeScript (Strict Mode)**       | 100% type safety with zero type errors, Zod schema validation                       |

---

## 📂 Project Architecture

```
court-scheduler-pro/
├── electron/                       # Native Desktop Application
│   ├── main.cjs                    # Electron main process & IPC handlers
│   ├── preload.cjs                 # Secure preload script & context bridge
│   └── offline.html                # High-fidelity offline fallback screen
├── public/                         # Public static assets & court branding
│   ├── nyayasetu-logo.png          # Official NyayaSetu seal mark
│   └── favicon.svg
├── src/
│   ├── components/                 # Reusable UI & judicial components
│   │   ├── app-sidebar.tsx         # Role-aware sidebar with i18n support
│   │   ├── decision-receipt-card.tsx # Deterministic AI explainability receipt
│   │   ├── recommendation-panel.tsx  # Smart scheduling candidate cards
│   │   ├── custom-judicial-schedule-modal.tsx # Judge manual listing modal
│   │   ├── chat-markdown.tsx       # Grounded Copilot response renderer
│   │   ├── top-bar.tsx             # Global search trigger & EN/HI switcher
│   │   └── ui/                     # Radix UI + Tailwind design primitives
│   ├── routes/                     # TanStack Router file-based route tree
│   │   ├── __root.tsx              # Root HTML shell & global providers
│   │   ├── index.tsx               # Unified 9-Workspace Portal Landing Page
│   │   ├── auth.tsx                # Role-based workspace authentication portal
│   │   ├── case-status.tsx         # Zero-login public citizen case lookup
│   │   └── _authenticated/         # Protected routes guarded by auth & RBAC
│   │       ├── dashboard.tsx       # Live metrics, readiness check & impact banner
│   │       ├── smart-scheduling.tsx # Multi-constraint scheduling workbench
│   │       ├── cause-list.tsx      # 3-Stage procedural cause list optimizer
│   │       ├── calendar.tsx        # Registry trial calendar & PDF export
│   │       ├── conflicts.tsx       # 8-type real-time clash scanner
│   │       ├── what-if-simulation.tsx # Zero-risk digital twin disruption sandbox
│   │       ├── backlog-simulator.tsx # FIFO vs Priority disposal comparison
│   │       ├── bench.tsx           # Judge portal & direct bench listing
│   │       ├── ai-assistant.tsx    # Grounded AI Judicial & Investigation Copilot
│   │       ├── search.tsx          # Global multi-entity registry search
│   │       ├── cases/              # Case intake, dossiers & adjournment tracking
│   │       ├── documents/          # Secure DMS, R2 vault & SHA-256 integrity
│   │       ├── evidence/           # Malkhana evidence registry & custody chain
│   │       ├── assets/             # Police armory, weapons & fleet lifecycle
│   │       ├── reports.tsx         # Turnaround, utilisation & compliance analytics
│   │       ├── activity-log.tsx    # Immutable cryptographic audit trail
│   │       ├── governance.tsx      # AI acceptance rates & regulatory compliance
│   │       ├── admin.tsx           # User accounts & RBAC permission matrix
│   │       └── priority-settings.tsx # Statutory priority weight tuner
│   ├── lib/                        # Core algorithms, business logic & server functions
│   │   ├── scheduling.ts           # Multi-constraint satisfaction solver
│   │   ├── priority.ts             # 8-factor statutory priority scoring engine
│   │   ├── conflicts.ts            # Conflict detection engine & occupancy models
│   │   ├── simulation.ts           # What-If digital twin simulation logic
│   │   ├── documents.ts            # Secure DMS client queries & mutations
│   │   ├── documents.functions.ts  # Cloudflare R2 server functions & streaming
│   │   ├── evidence-custody.ts     # Malkhana chain-of-custody verification
│   │   ├── assets.ts               # Police tactical asset lifecycle management
│   │   ├── assistant.ts            # Grounded AI Copilot prompt engineering
│   │   ├── rbac.ts                 # Least-Privilege Role-Based Access Control
│   │   ├── audit.ts                # Immutable audit log recorder
│   │   ├── i18n.tsx                # Dual-engine Hindi/English translation system
│   │   ├── pdf.ts                  # Branded cause-list PDF generator
│   │   └── why-this-order.ts       # Legal basis explanation generator
│   └── styles.css                  # Tailwind CSS v4 design tokens & animations
├── docs/                           # SIH reports, architecture & security audits
│   ├── nyayasetu_sih_report.md     # Comprehensive SIH strategy & evaluation guide
│   ├── AI_TRANSPARENCY_REPORT.md   # Supreme Court AI alignment & explainability
│   └── SECURITY_FINDINGS_REPORT.md # Penetration testing & BSA §63 audit
├── wrangler.json                   # Cloudflare Workers & R2 bucket bindings
├── package.json                    # Project dependencies & build scripts
└── vite.config.ts                  # Vite 8 + TanStack Start bundler configuration
```

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites

- **Node.js**: `v20.x` or higher
- **npm** (or **pnpm** / **bun**)
- **Git**

### 2. Installation & Configuration

```bash
# Clone the repository
git clone https://github.com/SujalJaveri/NyaySetu.git
cd NyaySetu

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
```

Configure your `.env` file with your credentials:

```env
# Supabase Configuration
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="your-anon-key"
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_PUBLISHABLE_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# AI Copilot Keys
GEMINI_API_KEY="your-gemini-api-key"
GROQ_API_KEY="your-groq-api-key"
```

### 3. Run Web Application

```bash
# Start Vite development server
npm run dev
```

Open **`http://localhost:3000`** in your browser.

### 4. Run Native Desktop App (Electron)

```bash
# Launch Electron desktop window pointing to your dev server
npm run electron:dev

# Package standalone Windows executable
npm run electron:build
```

Packaged binaries will be created in `dist-electron/`.

### 5. Deploy to Cloudflare Workers

```bash
# Build the production bundle with SSR patches
npm run build

# Deploy to Cloudflare Workers with R2 bindings
npx wrangler deploy
```

---

## 🏆 Smart India Hackathon (SIH) 2026 Live Demo Guide

To demonstrate the full power of NyayaSetu during a **5-minute live evaluation**, follow this curated walkthrough:

### Act 1: The Crisis & Real-Time Dashboard (00:00 – 00:45)

1. Open the [Dashboard](https://nyaysetu.sujal309206.workers.dev/dashboard).
2. Point out the **Live Animated Impact Banner** (_Conflicts Prevented_, _Tier 1 Cases Prioritised_, _Recommendations Issued_).
3. Click the **"EN | हिं"** language toggle in the top bar: demonstrate how 500+ legal terms across the entire interface instantly switch to Hindi for district court staff.

### Act 2: Zero-Risk What-If Disruption Sandbox (00:45 – 01:45)

1. Navigate to `/what-if-simulation`.
2. Click **"Load Demo Scenario"**: simulates Judge Arvind Mehta taking emergency leave for tomorrow with 3 active hearings listed.
3. Click **"Run Disruption Simulation"**: watch the digital twin trace affected hearings and propose conflict-free alternative slots in under 2 seconds.
4. Highlight: _"Disruptions that normally cause 50+ people to travel in vain are resolved before litigants even leave home."_

### Act 3: Multi-Constraint Scheduling & Decision Receipts (01:45 – 03:00)

1. Navigate to `/smart-scheduling`.
2. Click **"Load Demo Case"**: selects a Tier 1 FTSC POCSO case pending for 550+ days.
3. Click **"Run Scheduling Engine"**: watch 200+ combinations evaluated in milliseconds.
4. Highlight the **Decision Receipt Card**: show the green checkmarks across all 6 hard constraints and the mathematical soft factor breakdown.
5. Click **"Custom / Judge's Directive"**: demonstrate how a judge or registrar can manually assign a case with real-time pre-flight conflict warnings and mandatory audit notes.

### Act 4: Secure DMS & Malkhana Evidence Chain (03:00 – 04:00)

1. Navigate to `/documents`: show Cloudflare R2 private vault integration and the **SHA-256 Cryptographic Watchdog**.
2. Click **"Simulate Tamper"**: watch the system immediately detect file tampering and trigger a security alert.
3. Navigate to `/evidence`: demonstrate the **Malkhana Vault Register**, two-officer handovers, and generate an unbroken **BSA §63 Chain-of-Custody Certificate**.

### Act 5: Judge Bench, Public Citizen Lookup & Governance (04:00 – 05:00)

1. Switch to the Judge Bench View (`/bench`): show self-scoped cause lists and the Direct Bench Listing drawer.
2. Open `/case-status` in an incognito window: demonstrate zero-login public case tracking with 16-digit CNR search.
3. Conclude on `/governance`: show the AI acceptance rate metrics, human override logs, and full compliance with Supreme Court AI draft guidelines.
4. Deliver the closing statement:
   > _"NyayaSetu is what happens when you apply mathematical constraint satisfaction and cryptographic security to India's judicial backlog — and make every single decision explain itself."_

---

## 📜 Statutory & Legal Standards Alignment

NyayaSetu is architected to comply with India's newly enacted legal codes and judicial directives:

- **Bharatiya Sakshya Adhiniyam (BSA), 2023 §63**: Electronic records integrity verification, SHA-256 cryptographic digests, and tamper-evident digital custody receipts.
- **Bharatiya Nagarik Suraksha Sanhita (BNSS), 2023**: Digital FIR intake, case diary timestamps, and mandatory timelines.
- **Bharatiya Nyaya Sanhita (BNS), 2023**: Modernised criminal offence categorisation.
- **Supreme Court of India AI Draft Guidelines**: Zero black-box autonomous judicial decision-making; mandatory human-in-the-loop registrar confirmation; transparent explanation receipts.
- **POCSO Act & Fast Track Special Court (FTSC) Central Directives**: Automatic Tier 1 statutory priority boost.

---

## 📄 License & Attribution

Developed for the **Smart India Hackathon (SIH) 2026**.  
Built by **Team NyayaSetu** for the modernization of Indian District & Taluka Judiciary, Police Stations, and Malkhana Vaults.
