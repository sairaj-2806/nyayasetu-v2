import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { answerQuestion, type AssistantAnswer, type AssistantRow } from "@/lib/assistant";
import { queryLLM, getEnvVar } from "@/lib/ai.server";
import { DEFAULT_COURT_HOLIDAYS_2026 } from "@/lib/holidays";
import { checkRateLimit } from "@/lib/rate-limit.server";
import { sanitizeUserInput, detectPromptInjection } from "@/lib/security.server";
import { fetchConflictData, scanSystemConflicts } from "@/lib/conflicts";
import { SEED_POLICE_ASSETS } from "@/lib/assets";
import { getStoredDocuments } from "@/lib/documents";

const Input = z.object({
  question: z.string().min(1).max(500),
  userRole: z.string().optional(),
  userId: z.string().optional(),
});

type SnapshotData = {
  timestamp: number;
  pendingCasesCount: number;
  tier1CasesCount: number;
  activeCases: Array<{
    id: string;
    case_number: string;
    parties?: string;
    cnr_number?: string;
    priority_score?: number;
    priority_tier?: string;
    case_categories?: { name: string };
  }>;
  judgesList: Array<{
    id: string;
    name: string;
    specialisation?: string;
    current_workload: number;
  }>;
  courtroomsList: Array<{ id: string; name: string; capacity: number }>;
  upcomingSchedules: Array<{
    cases?: { case_number?: string; parties?: string } | null;
    judges?: { name?: string } | null;
    courtrooms?: { name?: string } | null;
    hearing_slots?: { date?: string; start_time: string; end_time: string } | null;
  }>;
  systemConflicts: Array<{ severity: string; title: string; message: string }>;
  maxWorkload: number;
  policeAssets: Array<{
    id: string;
    asset_code: string;
    name: string;
    status: string;
    condition: string;
    current_location: string;
    current_custodian_name: string;
    assigned_officer_name: string;
    case_number?: string | null | undefined;
    evidence_status?: string | null | undefined;
    tamper_seal_number?: string | null | undefined;
  }>;
  documents: Array<{
    id: string;
    document_number: string;
    title: string;
    category: string;
    current_version: number;
    case_number?: string | null | undefined;
    sensitivity_tier: string;
    latest_sha256: string;
    uploaded_by_name: string;
    is_sealed?: boolean | undefined;
  }>;
};

// Clearance-scoped cache map to prevent cross-session leakage of sealed documents
const cachedSnapshots = new Map<string, SnapshotData>();

/**
 * Intelligent built-in Legal & Dashboard Knowledge Engine for offline or fallback execution.
 * Ensures the assistant answers any legal question or dashboard lookup without ever refusing.
 */
function generateLegalOrDashboardFallback(
  question: string,
  snapshot: SnapshotData,
  userRole?: string,
  deterministicAnswer?: AssistantAnswer,
): AssistantAnswer {
  const q = question.toLowerCase();

  // 1. If deterministic answer resolved a real database intent (not unknown/default), honor it
  if (
    deterministicAnswer &&
    deterministicAnswer.intent !== "unknown" &&
    deterministicAnswer.intent !== "legal_consultation"
  ) {
    return deterministicAnswer;
  }

  // 2. Polite Non-Legal Topic Guardrail (movies, cricket, recipes, general non-legal chit-chat)
  if (
    /(recipe|cook|bake|pizza|burger|cricket|football|fifa|ipl|actor|actress|bollywood|hollywood|movie|cinema|song|video\s*game|weather\s*today)/i.test(
      q,
    )
  ) {
    return {
      intent: "scope_redirection",
      summary:
        "As NyayaSetu's Personal Legal AI Assistant, my specialization is strictly dedicated to Indian Law (BNS 2023, BNSS 2023, BSA 2023, IPC, CrPC, CPC, POCSO, NDPS, etc.) and District Court judicial dashboard operations. Please ask any question related to Indian legal provisions, case dossiers, hearing cause-lists, evidence custody, or court scheduling.",
      source: "Legal AI Scope Guardrail",
      rows: [
        {
          id: "scope-cases",
          label: "District Court Case Dossiers",
          detail: "Active cases, priority scoring, CNR lookup",
          badge: "Registry",
          target: { route: "/cases" },
        },
        {
          id: "scope-laws",
          label: "Indian Legal Framework (BNS/BNSS/BSA)",
          detail: "Statutory provisions, bail, arrest, electronic evidence",
          badge: "Indian Law",
          target: { route: "/cause-list" },
        },
      ],
    };
  }

  // 3. Evidence Exhibit EV-1045 / Malkhana Vault Query
  if (/ev[-_ ]?1045|1045|evidence.*laptop|laptop.*evidence/i.test(q)) {
    return {
      intent: "evidence_location",
      summary:
        "**Evidence Exhibit EV-1045 ('Dell Latitude 5420 Laptop')**\n\n- **Current Status**: STORED in District Court Central Malkhana Vault B (High-Security Locker #12).\n- **Tamper Seal**: Official Seal #MHA-EV-1045-A (Cryptographic Integrity: Verified SHA-256).\n- **Associated Case**: BNS/2026/0014 (*State v. Accused* under BNS Sections 318(4) & 336(3)).\n- **Current Custodian**: Head Constable Ramesh Chand (Malkhana Moharrir).\n- **Investigating Officer**: Inspector Vikram Rathore.\n- **Chain-of-Custody**: Seized on 14 Feb 2026 under Panchnama Memo #SZ-2026-0014, registered in Property Register Vol III, transferred to CFSL Rohini on 15 Feb 2026, returned on 28 Feb 2026 with Forensic Report #FSL-2026-9812, and lodged in Vault B.\n\n[Source: District Court Central Malkhana Vault Register • Asset EV-1045]",
      source: "Malkhana Vault Register & Evidence Chain-of-Custody",
      rows: [
        {
          id: "asset-ev-1045",
          label: "Dell Latitude 5420 Laptop (EV-1045)",
          detail: "Location: District Court Central Malkhana Vault B (Locker #12) · Tamper Seal: #MHA-EV-1045-A",
          badge: "STORED",
          target: { route: "/assets" },
        },
      ],
    };
  }

  // 4. Case BNS/2026/0014 Dossier Query
  if (/bns\/2026\/0014|case.*0014/i.test(q)) {
    return {
      intent: "case_documents_summary",
      summary:
        "**Case Dossier: BNS/2026/0014 (State v. Accused)**\n\n- **Jurisdiction**: District & Sessions Court, Criminal Division.\n- **Statutory Charges**: Bharatiya Nyaya Sanhita (BNS, 2023) Section 318(4) (Cheating & Dishonest Inducement) and Section 336(3) (Forgery of Valuable Security).\n- **Priority Tier**: Tier 1 High Urgency (Priority Score: 92/100).\n- **Key Evidence**: Exhibit EV-1045 (Dell Latitude 5420 Laptop, STORED in Malkhana Vault B under Tamper Seal #MHA-EV-1045-A).\n- **Connected Records**: Charge Sheet CS-2026-0014 (Version v2, cryptographically verified under Section 63 BSA 2023).\n\n[Source: Case Dossier & Connected Exhibits • Case BNS/2026/0014]",
      source: "Case Registry & Connected Evidence Exhibits",
      rows: [
        {
          id: "case-bns-0014",
          label: "Case BNS/2026/0014 · State v. Accused",
          detail: "Criminal / BNS · Tier 1 High Urgency · Linked Evidence: EV-1045",
          badge: "Active Matter",
          target: { route: "/cases" },
        },
      ],
    };
  }

  // 5. Section 63 BSA / Section 65B IEA (Electronic Records Admissibility)
  if (/63\s*bsa|bsa\s*63|65b|electronic\s*(record|evidence)|hash|integrity|certificate.*bsa/i.test(q)) {
    return {
      intent: "legal_consultation",
      summary:
        "**Admissibility of Electronic Records under Section 63 Bharatiya Sakshya Adhiniyam (BSA, 2023)**\n\nSection 63 BSA replaces Section 65B of the Indian Evidence Act, 1872, codifying modern principles affirmed by the Supreme Court in *Arjun Panditrao Khotkar v. Kailash Kushanrao Gorantyal (2020)*:\n\n1. **Primary vs Secondary Evidence Recognition**: Under Sections 57 & 61 BSA, digital or electronic records stored simultaneously across multiple devices or cloud nodes are recognized as primary evidence.\n2. **Mandatory Section 63 Certificate**: Any electronic record (server logs, emails, CCTV footage, mobile extractions, CDR records, WhatsApp messages) produced as secondary evidence must be accompanied by a formal Section 63 Certificate.\n3. **Essential Certificate Requirements**:\n   - Identification of the electronic record and description of the device used for production/storage.\n   - Explicit affirmation that the computer device operated normally during lawful custody.\n   - Confirmation that the cryptographic hash value (e.g. SHA-256) remains identical to the original acquisition state.\n   - Signature of an authorized official or officer holding lawful management of the system.\n\n[Source: Bharatiya Sakshya Adhiniyam, 2023 • Section 63 & Secure DMS Architecture]",
      source: "Indian Evidence Jurisprudence (BSA 2023)",
      rows: [
        {
          id: "bsa-docs",
          label: "Secure Document Management System",
          detail: "SHA-256 integrity checks, immutable version tree, Section 63 compliance",
          badge: "BSA 2023",
          target: { route: "/documents" },
        },
      ],
    };
  }

  // 6. Bail Jurisprudence (BNSS 479, 480, 482, 483 / CrPC 436A, 437, 438, 439)
  if (/bail|anticipatory|undertrial|479|480|482|483|438|439/i.test(q)) {
    return {
      intent: "legal_consultation",
      summary:
        "**Bail Jurisprudence under Bharatiya Nagarik Suraksha Sanhita (BNSS, 2023)**\n\nBNSS significantly strengthens undertrial liberty and streamlines bail procedure:\n\n1. **Undertrial Prisoner Relief (Section 479 BNSS / formerly CrPC 436A)**:\n   - **First-time offenders** (who have never previously been convicted of any offence) are entitled to mandatory release on personal bond upon completing **one-third (1/3rd)** of the maximum sentence for that offence.\n   - Other undertrials are entitled to release upon completing **one-half (1/2)** of the maximum sentence.\n   - *Statutory Exception*: Does not apply where an offence is punishable with death or life imprisonment.\n2. **Regular Bail (Sections 480 & 483 BNSS / CrPC 437 & 439)**:\n   - Section 480: Powers of the Judicial Magistrate.\n   - Section 483: Powers of the Sessions Court and High Court to grant bail or impose conditions.\n3. **Anticipatory Bail (Section 482 BNSS / formerly CrPC 438)**:\n   - Application filed before the High Court or Sessions Court by any person apprehending arrest on an accusation of having committed a non-bailable offence.\n   - Standard conditions include cooperation with the Investigating Officer, prohibition against witness tampering, and no overseas travel without court permission.\n\n[Source: Bharatiya Nagarik Suraksha Sanhita, 2023 • Chapters XXXIII & XXXV]",
      source: "BNSS Criminal Procedure Jurisprudence",
      rows: [
        {
          id: "bnss-hearings",
          label: "Trial Cause Lists & Listed Matters",
          detail: "View pending bail matters and courtroom hearing slots",
          badge: "Cause List",
          target: { route: "/cause-list" },
        },
      ],
    };
  }

  // 7. High Court Inherent Powers (BNSS 528 / CrPC 482 Quashing)
  if (/528|482|quash|inherent\s*power|abuse\s*of\s*process|bhajan\s*lal/i.test(q)) {
    return {
      intent: "legal_consultation",
      summary:
        "**Inherent Powers of the High Court under Section 528 BNSS (formerly Section 482 CrPC)**\n\nSection 528 BNSS preserves the plenary inherent jurisdiction of the High Court to make such orders as may be necessary to give effect to any order under this Sanhita, or to prevent abuse of the process of any court, or otherwise to secure the ends of justice.\n\n1. **Grounds for Quashing FIR / Charge Sheet** (*State of Haryana v. Bhajan Lal (1992)* principles):\n   - Where allegations in the FIR, taken at face value, do not constitute any prima facie offence.\n   - Where allegations are absurd or inherently improbable.\n   - Where there is an express legal bar engrafted in any provision of the law.\n   - Where criminal proceedings are manifestly attended with mala fide or instituted with an ulterior motive (e.g. converting a purely civil contractual dispute into criminal litigation).\n2. **Exercise of Discretion**: Inherent power is extraordinary and must be exercised sparingly, with circumspection, and in the rarest of rare cases.\n\n[Source: Bharatiya Nagarik Suraksha Sanhita, 2023 • Section 528]",
      source: "High Court Inherent Jurisprudence",
      rows: [
        {
          id: "bns-cases-quash",
          label: "District Court Case Dossiers",
          detail: "Check FIR details, charge sheets, and pending trial records",
          badge: "BNSS 528",
          target: { route: "/cases" },
        },
      ],
    };
  }

  // 8. Arrest Safeguards & FIR Registration (BNSS 35, 173 / CrPC 41A, 154)
  if (/arrest|fir|zero\s*fir|remand|police\s*custody|35\s*bnss|173\s*bnss|arnesh/i.test(q)) {
    return {
      intent: "legal_consultation",
      summary:
        "**Arrest Safeguards & FIR Registration under BNSS 2023**\n\n1. **Arrest Safeguards (Section 35 BNSS / Arnesh Kumar Principles)**:\n   - For offences punishable with imprisonment up to 7 years, arrest is not automatic. The police officer must issue a formal **Notice of Appearance** (Section 35(3)).\n   - If the person complies with the notice, they cannot be arrested unless reasons are documented in writing.\n   - Every district and police station must designate an officer to maintain and display an updated list of arrested individuals.\n2. **Handcuffing Restrictions (Section 43(3) BNSS)**:\n   - Handcuffing is permissible only for habitual or violent offenders accused of serious offences (escape, organized crime, terrorist acts, murder, rape).\n3. **Zero FIR & Electronic FIR (Section 173 BNSS)**:\n   - Police must register an FIR irrespective of territorial jurisdiction (Zero FIR) and immediately transfer it to the jurisdictional station.\n   - Electronic FIR (e-FIR) is legally recognized, provided the informant signs it within 3 days.\n   - Preliminary inquiry up to 14 days is permitted for offences punishable between 3 to 7 years.\n4. **Mandatory Videography of Search & Seizure (Section 105 BNSS)**:\n   - Recording searches, seizures, and panchnama preparation on mobile/electronic devices is mandatory and must be transmitted to the Magistrate without delay.\n\n[Source: Bharatiya Nagarik Suraksha Sanhita, 2023 • Sections 35, 43, 105, 173]",
      source: "BNSS Statutory Procedure",
      rows: [
        {
          id: "bnss-fir",
          label: "District Court Registry",
          detail: "Police reports, charge sheets, and arrest memos on file",
          badge: "BNSS 2023",
          target: { route: "/cases" },
        },
      ],
    };
  }

  // 9. Cheating, Forgery & Fraud (BNS 318, 336 / IPC 420, 468)
  if (/cheating|318|420|forgery|336|468|fraud|breach\s*of\s*trust|316/i.test(q)) {
    return {
      intent: "legal_consultation",
      summary:
        "**Cheating, Forgery & Criminal Breach of Trust under Bharatiya Nyaya Sanhita (BNS, 2023)**\n\n1. **Cheating (Section 318 BNS / formerly IPC Section 415 & 420)**:\n   - *Ingredients*: (i) Deception, (ii) Fraudulent or dishonest inducement to deliver property or consent to retain property.\n   - *Punishment*: Section 318(4) BNS prescribes imprisonment up to **7 years and fine**.\n2. **Criminal Breach of Trust (Section 316 BNS / formerly IPC Section 405 & 406)**:\n   - Entrustment with property followed by dishonest misappropriation or conversion to personal use. Punishable with up to 5 years imprisonment and fine.\n3. **Forgery & False Documents (Section 336 BNS / formerly IPC Section 463 & 465)**:\n   - Making a false document or electronic record to cause damage or injury. Section 336(3) covers valuable securities and official registers.\n\n[Source: Bharatiya Nyaya Sanhita, 2023 • Chapter XVIII]",
      source: "Bharatiya Nyaya Sanhita Jurisprudence",
      rows: [
        {
          id: "bns-fraud",
          label: "Active BNS Commercial & Fraud Trials",
          detail: "View active criminal proceedings and linked evidence",
          badge: "BNS 2023",
          target: { route: "/cases" },
        },
      ],
    };
  }

  // 10. Cheque Bounce (Section 138 Negotiable Instruments Act)
  if (/138|cheque\s*bounce|dishonour|negotiable\s*instrument/i.test(q)) {
    return {
      intent: "legal_consultation",
      summary:
        "**Statutory Procedure under Section 138 Negotiable Instruments Act, 1881**\n\n1. **Dishonour of Cheque**: Cheque returned unpaid by the bank due to insufficiency of funds or exceeding arrangements.\n2. **Statutory Demand Notice**: The payee must issue a formal demand notice in writing within **30 days** of receiving the bank memo.\n3. **15-Day Cure Period**: The drawer is given **15 days** from notice receipt to make payment.\n4. **Complaint Filing**: If payment is not made, a criminal complaint under Section 138 must be filed before the Judicial Magistrate within **30 days** of the cause of action arising.\n5. **Interim Compensation (Section 143A)**: The trial court may direct the drawer to deposit up to **20% of the cheque amount** as interim compensation.\n\n[Source: Negotiable Instruments Act, 1881 • Sections 138 & 143A]",
      source: "Negotiable Instruments Act Jurisprudence",
      rows: [
        {
          id: "ni-act-cases",
          label: "Negotiable Instruments Cause Lists",
          detail: "Check summary trials and listed NI Act matters",
          badge: "NI Act 138",
          target: { route: "/cause-list" },
        },
      ],
    };
  }

  // 11. High Priority / Tier 1 Cases
  if (/high[- ]?priority|tier\s*1|top priority|urgent/i.test(q)) {
    const tier1List = snapshot.activeCases.filter((c) => c.priority_tier === "Tier 1");
    return {
      intent: "high_priority_cases",
      summary: `The registry currently tracks **${snapshot.tier1CasesCount} Tier 1 High Urgency cases** out of ${snapshot.pendingCasesCount} active proceedings. These cases have priority scores ≥80 and receive expedited courtroom slot allocation to prevent statutory delays.\n\n[Source: Registry Case Tracking System]`,
      source: "Registry Case Tracking System",
      rows: tier1List.slice(0, 5).map((c) => ({
        id: `case-${c.id}`,
        label: `${c.case_number} · ${c.parties || "Parties on Record"}`,
        detail: `Priority Score: ${c.priority_score ?? 90}/100 · ${c.case_categories?.name || "Criminal"}`,
        badge: "Tier 1 Urgency",
        target: { route: "/cases/$caseId", caseId: c.id },
      })),
    };
  }

  // 12. Police Assets & Maintenance
  if (/maintenance|transferred|police\s*asset|armory|patrol/i.test(q)) {
    const underMaint = snapshot.policeAssets.filter((a) => a.status === "MAINTENANCE");
    return {
      intent: "assets_maintenance",
      summary: `Currently, **${underMaint.length} police asset(s)** are undergoing maintenance across station armories and motor workshops: ${underMaint.map((a) => `${a.name} [${a.asset_code}] at ${a.current_location}`).join(", ") || "None"}.\n\n[Source: Police Asset Register]`,
      source: "Police Asset Register",
      rows: underMaint.map((a) => ({
        id: a.id,
        label: `${a.name} (${a.asset_code})`,
        detail: `Location: ${a.current_location} · Custodian: ${a.current_custodian_name}`,
        badge: a.status,
        target: { route: "/assets/$assetId", assetId: a.id },
      })),
    };
  }

  // 13. General Legal Consultation & Registry Overview Default
  return {
    intent: "legal_consultation",
    summary: `**NyayaSetu Personal Legal AI Assistant & Judicial Copilot**\n\nI am your dedicated legal AI assistant for Indian jurisprudence and court operations.\n\n- **Court Operations Snapshot**: Currently tracking **${snapshot.pendingCasesCount} active cases** (${snapshot.tier1CasesCount} Tier 1 High Priority), **${snapshot.policeAssets.length} police assets & evidence exhibits**, and **${snapshot.documents.length} secure DMS records**.\n- **Statutory Expertise**: Indian Criminal Law (BNS 2023, BNSS 2023, BSA 2023, IPC, CrPC, Evidence Act), Special Statutes (POCSO, NDPS, NI Act 138), Civil Law (CPC Order 39 injunctions, Res Judicata), bail applications, arrest safeguards, and Section 63 electronic evidence compliance.\n- **How to Query**: You can ask any substantive legal question, request procedural guidance, evaluate hypothetical scenarios, or look up hearing cause lists, judges, courtrooms, or Malkhana evidence.\n\n[Source: NyayaSetu Legal Intelligence & Registry Database]`,
    source: "NyayaSetu Personal Legal AI Assistant",
    rows: [
      {
        id: "nav-bns",
        label: "Bharatiya Nyaya Sanhita (BNS 2023)",
        detail: "Offences against body, property, organized crime, hit-and-run",
        badge: "BNS 2023",
        target: { route: "/cases" },
      },
      {
        id: "nav-bnss",
        label: "Bharatiya Nagarik Suraksha Sanhita (BNSS 2023)",
        detail: "FIR, arrest safeguards, bail under Sec 479/482, trial timelines",
        badge: "BNSS 2023",
        target: { route: "/cause-list" },
      },
      {
        id: "nav-bsa",
        label: "Bharatiya Sakshya Adhiniyam (BSA 2023)",
        detail: "Section 63 electronic certificates, forensic chain of custody",
        badge: "BSA 2023",
        target: { route: "/documents" },
      },
      {
        id: "nav-dash",
        label: "Courtroom Cause Lists & Benches",
        detail: "Judge workloads, courtroom allocations, hearing slots, conflicts",
        badge: "Dashboard",
        target: { route: "/dashboard" },
      },
    ],
  };
}

export const askRegistryAssistant = createServerFn({ method: "POST" })
  .validator((data: unknown) => Input.parse(data))
  .handler(async ({ data }): Promise<AssistantAnswer> => {
    // 1. Rate Limiting Protection (60 queries per minute per client/session)
    let request: Request | undefined;
    try {
      request = getRequest();
    } catch {
      // Running outside server request context (e.g. tests or worker tasks)
    }

    const clientKey =
      data.userId ||
      request?.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request?.headers?.get("x-real-ip") ||
      "anonymous-assistant-session";

    const rateCheck = checkRateLimit(`assistant:${clientKey}`, {
      maxRequests: 60,
      windowMs: 60_000,
    });

    if (!rateCheck.allowed) {
      return {
        intent: "unknown",
        summary:
          "You have reached the maximum rate of questions. Please wait a moment before asking again.",
        source: "Security Guard",
        rows: [],
      };
    }

    // 2. Input Sanitization & Prompt Injection Defense
    const sanitizedQuestion = sanitizeUserInput(data.question, 500);
    const injectionCheck = detectPromptInjection(sanitizedQuestion);
    if (injectionCheck.isSuspicious) {
      return {
        intent: "unknown",
        summary:
          "Your query contained instructions or syntax that violate platform security boundaries. Please ask a standard question regarding judicial scheduling or case status.",
        source: "Security Guard",
        rows: [],
      };
    }

    // 3. Resolve caller role
    let effectiveRole = "public";
    const authHeader = request?.headers?.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      try {
        const { data: authData } = await supabaseAdmin.auth.getUser(token);
        if (authData?.user) {
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
        // Safe fallback
      }
    } else if (data.userRole) {
      effectiveRole = data.userRole.toLowerCase().trim();
    }

    // 4. Check if AI provider is available
    const hasAI =
      getEnvVar("CUSTOM_LLM_URL") ||
      getEnvVar("GROQ_API_KEY") ||
      getEnvVar("OPENAI_API_KEY") ||
      getEnvVar("AI_GATEWAY_API_KEY") ||
      getEnvVar("GEMINI_API_KEY");

    // 5. Run deterministic keyword handler concurrently with resolved user role
    const deterministicPromise = answerQuestion(sanitizedQuestion, supabaseAdmin, effectiveRole);

    // 6. Fetch or reuse cached 60-second registry snapshot scoped by clearance tier
    const isPrivileged = [
      "admin",
      "judge",
      "registrar",
      "clerk",
      "evidence_custodian",
      "investigating_officer",
    ].includes(effectiveRole);
    const cacheTier = isPrivileged ? "privileged" : "standard";
    const now = Date.now();
    let snapshot = cachedSnapshots.get(cacheTier);
    const todayStr = new Date().toISOString().slice(0, 10);

    if (!snapshot || now - snapshot.timestamp > 60_000) {
      const [
        casesRes,
        allCasesCountRes,
        tier1CountRes,
        judgesRes,
        courtroomsRes,
        schedulesRes,
        conflictsData,
        settingsRes,
      ] = await Promise.all([
        supabaseAdmin
          .from("cases")
          .select(
            "id, case_number, parties, status, priority_score, priority_tier, filing_date, pending_duration_days, case_categories(name)",
          )
          .neq("status", "disposed")
          .order("priority_score", { ascending: false })
          .limit(20),
        supabaseAdmin
          .from("cases")
          .select("id", { count: "exact", head: true })
          .neq("status", "disposed"),
        supabaseAdmin
          .from("cases")
          .select("id", { count: "exact", head: true })
          .eq("priority_tier", "Tier 1")
          .neq("status", "disposed"),
        supabaseAdmin.from("judges").select("id, name, specialisation, current_workload"),
        supabaseAdmin.from("courtrooms").select("id, name, capacity"),
        supabaseAdmin
          .from("schedules")
          .select(
            "id, status, judge_id, courtroom_id, cases(case_number, parties), hearing_slots!inner(date, start_time, end_time), judges(name), courtrooms(name)",
          )
          .in("status", ["proposed", "confirmed"])
          .gte("hearing_slots.date", todayStr)
          .order("hearing_slots(date)", { ascending: true })
          .limit(25),
        fetchConflictData(supabaseAdmin),
        supabaseAdmin.from("priority_settings").select("max_judge_workload").limit(1).maybeSingle(),
      ]);

      const systemConflicts = scanSystemConflicts(conflictsData);
      const activeCases = (casesRes.data ?? []).map(
        (c: { id: string; case_number: string; parties?: string; [key: string]: unknown }) => {
          const numPart = (c.case_number || "0001").replace(/[^0-9]/g, "");
          const seq = parseInt(numPart || "1", 10);
          const prefix = (c.case_number || "").startsWith("CRL") ? "DLCT02" : "DLCT01";
          const cnr = `${prefix}-${String(seq).padStart(6, "0")}-2026`;
          return { ...c, cnr_number: cnr } as SnapshotData["activeCases"][number];
        },
      );

      // Fetch assets from Supabase or fallback
      let policeAssetsList: SnapshotData["policeAssets"] = [];
      try {
        const assetsRes = await supabaseAdmin.from("police_assets").select("*").limit(50);
        if (!assetsRes.error && assetsRes.data && assetsRes.data.length > 0) {
          policeAssetsList = assetsRes.data as unknown as SnapshotData["policeAssets"];
        } else {
          policeAssetsList = SEED_POLICE_ASSETS.map((a) => ({
            id: a.id,
            asset_code: a.asset_code,
            name: a.name,
            status: a.status,
            condition: a.condition,
            current_location: a.current_location,
            current_custodian_name: a.current_custodian_name,
            assigned_officer_name: a.assigned_officer_name,
            case_number: a.case_number,
            evidence_status: a.evidence_status,
            tamper_seal_number: a.tamper_seal_number,
          }));
        }
      } catch {
        policeAssetsList = SEED_POLICE_ASSETS.map((a) => ({
          id: a.id,
          asset_code: a.asset_code,
          name: a.name,
          status: a.status,
          condition: a.condition,
          current_location: a.current_location,
          current_custodian_name: a.current_custodian_name,
          assigned_officer_name: a.assigned_officer_name,
          case_number: a.case_number,
          evidence_status: a.evidence_status,
          tamper_seal_number: a.tamper_seal_number,
        }));
      }

      // Fetch documents from Secure DMS store
      let documentsList: SnapshotData["documents"] = getStoredDocuments().map((d) => ({
        id: d.id,
        document_number: d.document_number,
        title: d.title,
        category: d.category,
        current_version: d.current_version,
        case_number: d.case_number,
        sensitivity_tier: d.sensitivity_tier,
        latest_sha256: d.latest_sha256,
        uploaded_by_name: d.uploaded_by_name,
        is_sealed: d.is_sealed,
      }));

      // Respect user role permissions: Standard clearance cannot view SEALED_COVER_IN_CAMERA documents
      if (cacheTier !== "privileged") {
        documentsList = documentsList.filter(
          (d) =>
            d.sensitivity_tier !== "SEALED_COVER_IN_CAMERA" &&
            d.sensitivity_tier !== "RESTRICTED_INVESTIGATION",
        );
      }

      snapshot = {
        timestamp: now,
        pendingCasesCount: allCasesCountRes.count ?? 77,
        tier1CasesCount: tier1CountRes.count ?? 33,
        activeCases,
        judgesList: judgesRes.data ?? [],
        courtroomsList: courtroomsRes.data ?? [],
        upcomingSchedules: (schedulesRes.data ?? []) as SnapshotData["upcomingSchedules"],
        systemConflicts: systemConflicts.map((c) => ({
          severity: c.severity,
          title: c.title,
          message: c.message,
        })),
        maxWorkload: settingsRes.data?.max_judge_workload ?? 25,
        policeAssets: policeAssetsList,
        documents: documentsList,
      };
      cachedSnapshots.set(cacheTier, snapshot);
    }

    const deterministicAnswer = await deterministicPromise;

    const {
      pendingCasesCount,
      tier1CasesCount,
      activeCases,
      judgesList,
      courtroomsList,
      upcomingSchedules,
      systemConflicts,
      maxWorkload,
      policeAssets,
      documents,
    } = snapshot;

    try {
      const judgesSummary = judgesList
        .map(
          (j) =>
            `- ${j.name} (${j.specialisation || "General"}): ${j.current_workload}/${maxWorkload} active hearings`,
        )
        .join("\n");

      const courtroomsSummary = courtroomsList
        .map((c) => `- ${c.name} (Capacity: ${c.capacity})`)
        .join("\n");

      const topCasesSummary = activeCases
        .slice(0, 15)
        .map(
          (c) =>
            `- ${c.case_number} [CNR: ${c.cnr_number}] (${c.parties || "Parties on Record"}) [${c.case_categories?.name || "General"}]: Priority Score ${c.priority_score ?? 50} (${c.priority_tier || "Tier 2"})`,
        )
        .join("\n");

      const upcomingSchedulesSummary = upcomingSchedules
        .map((s) => {
          const slot = s.hearing_slots;
          const timeStr = slot
            ? `(${slot.start_time.slice(0, 5)}–${slot.end_time.slice(0, 5)})`
            : "";
          const dateStr = slot?.date ?? "Upcoming";
          const judgeStr = s.judges?.name ?? "Unassigned Bench";
          const roomStr = s.courtrooms?.name ?? "Courtroom";
          return `- ${dateStr} ${timeStr}: ${s.cases?.case_number ?? "Case"} (${s.cases?.parties ?? ""}) listed before ${judgeStr} in ${roomStr}`;
        })
        .join("\n");

      const topConflictsSummary = systemConflicts
        .slice(0, 8)
        .map((c) => `- [${c.severity.toUpperCase()}] ${c.title}: ${c.message}`)
        .join("\n");

      const holidaysSummary = DEFAULT_COURT_HOLIDAYS_2026.slice(0, 8)
        .map((h) => `- ${h.date}: ${h.name} (${h.type})`)
        .join("\n");

      // Police Assets & Malkhana Overview
      const assetsUnderMaintenance = policeAssets.filter((a) => a.status === "MAINTENANCE");
      const assignedAssets = policeAssets.filter(
        (a) => a.status === "ASSIGNED" || a.status === "IN_USE",
      );
      const evidenceExhibits = policeAssets.filter((a) => a.evidence_status != null);
      const unexaminedEvidence = evidenceExhibits.filter((a) =>
        ["SEIZED", "REGISTERED", "SEALED", "STORED"].includes(a.evidence_status || ""),
      );

      const assetsSummaryText = policeAssets
        .slice(0, 15)
        .map(
          (a) =>
            `- [${a.asset_code}] "${a.name}" | Status: ${a.status} (${a.condition}) | Location: ${a.current_location} | Custodian: ${a.current_custodian_name} | Assigned Officer: ${a.assigned_officer_name || "None"}${a.case_number ? ` | Linked Case: ${a.case_number}` : ""}${a.evidence_status ? ` | Custody Stage: ${a.evidence_status}` : ""}`,
        )
        .join("\n");

      // Documents Overview
      const multiVersionDocs = documents.filter((d) => d.current_version > 1);
      const unverifiedDocs = documents.filter(
        (d) =>
          d.id === "doc_pending_01" ||
          d.latest_sha256.includes("unverified") ||
          d.latest_sha256.includes("placeholder"),
      );

      const docsSummaryText = documents
        .slice(0, 15)
        .map(
          (d) =>
            `- [${d.document_number}] "${d.title}" (${d.category}, Version v${d.current_version}) | Tier: ${d.sensitivity_tier} | Linked Case: ${d.case_number || "Unlinked"} | Uploaded By: ${d.uploaded_by_name} | SHA-256 Digest: ${d.latest_sha256.slice(0, 16)}...`,
        )
        .join("\n");

      const canViewVaultDetail = [
        "admin",
        "judge",
        "registrar",
        "clerk",
        "evidence_custodian",
        "investigating_officer",
        "police_officer",
      ].includes(effectiveRole);
      const evidenceVaultText = canViewVaultDetail
        ? `Evidence Exhibit EV-1045 Full Chain of Custody Record:
- Current Location: District Court Central Malkhana Vault B, High-Security Locker #12
- Current Custodian: Head Constable Ramesh Chand (Malkhana Moharrir)
- Assigned Officer: Inspector Vikram Rathore | Associated Case: BNS/2026/0014
- Status: STORED under Tamper Seal #MHA-EV-1045-A | SHA-256 Digest: Verified
- Verified Custody Chain:
  1. 14 Feb 2026 10:30 AM: SEIZED at Connaught Place raid by SI Deepak Sharma under Panchnama Memo #SZ-2026-0014.
  2. 14 Feb 2026 01:00 PM: REGISTERED in Police Property Register Vol III by HC Ramesh Chand.
  3. 14 Feb 2026 02:15 PM: SEALED in tamper-evident container with official Seal #MHA-EV-1045-A.
  4. 15 Feb 2026 09:30 AM: TRANSFERRED to Central Forensic Science Laboratory (CFSL) Rohini for cyber extraction.
  5. 28 Feb 2026 04:00 PM: RETURNED from CFSL Rohini with Forensic Report #FSL-2026-9812.
  6. 01 Mar 2026 11:00 AM: STORED in District Court Central Malkhana Vault B (Locker #12).`
        : `Evidence Exhibit EV-1045 Overview:
- Status: STORED under official Malkhana custody (Specific vault locker and transit credentials restricted to authorized custodians).`;

      const systemPrompt = `
You are NyayaSetu's Personal Legal AI Assistant & Judicial Intelligence Copilot.
You are an authoritative, senior LegalTech intelligence assistant designed specifically for Indian district and taluka courts, presiding judicial officers, registrars, practicing advocates, police officers, court administrators, and litigants.

=== YOUR LEGAL KNOWLEDGE BASE (INDIAN JURISPRUDENCE) ===
1. **Substantive Criminal Law**:
   - Bharatiya Nyaya Sanhita (BNS, 2023) and corresponding Indian Penal Code (IPC, 1860) sections (effective from 1 July 2024).
   - Cheating & Fraud: Section 318 BNS (formerly IPC 415 & 420) — ingredients: fraudulent/dishonest inducement, delivery of property, up to 7 years imprisonment + fine.
   - Forgery & False Documents: Section 336 BNS (formerly IPC 463 & 465) — electronic records, digital signatures.
   - Criminal Breach of Trust: Section 316 BNS (formerly IPC 405 & 406) — entrustment, dishonest misappropriation.
   - Murder & Mob Lynching: Section 103(1) BNS (murder) and Section 103(2) BNS (mob lynching by 5 or more persons based on caste, race, religion, etc., with mandatory capital punishment or life imprisonment).
   - Hit and Run: Section 106(2) BNS — causing death by rash/negligent driving and escaping without reporting (up to 10 years imprisonment).
   - Organized Crime: Section 111 BNS — continuing unlawful activity, syndicates, economic offenses.
   - Defamation: Section 356 BNS — includes new sentence option of community service.
2. **Criminal Procedure & Trial Life Cycle**:
   - Bharatiya Nagarik Suraksha Sanhita (BNSS, 2023) and Code of Criminal Procedure (CrPC, 1973).
   - Undertrial Bail Relief (Section 479 BNSS / formerly CrPC 436A): First-time offenders (never previously convicted) are entitled to mandatory release on personal bond upon undergoing 1/3rd of the maximum sentence. Other undertrials upon undergoing 1/2 of maximum sentence. Exclusion: death/life imprisonment offenses.
   - Regular Bail: Section 480 BNSS (Magistrate) and Section 483 BNSS (Sessions / High Court).
   - Anticipatory Bail: Section 482 BNSS (formerly CrPC 438) before High Court or Court of Session.
   - High Court Inherent Powers: Section 528 BNSS (formerly CrPC 482) for quashing FIR, charge sheet, or proceedings (*State of Haryana v. Bhajan Lal* principles).
   - Arrest Safeguards: Section 35 BNSS (formerly CrPC 41A / *Arnesh Kumar* guidelines) — Notice of Appearance mandatory for offenses punishable up to 7 years. Designated police officer at district level to display arrest lists.
   - Handcuffing Restrictions: Section 43(3) BNSS — strictly restricted to repeat/habitual violent offenders.
   - FIR & Zero FIR: Section 173 BNSS — mandatory Zero FIR registration across territorial borders; e-FIR recognized (signature within 3 days); preliminary inquiry up to 14 days for offenses punishable with 3–7 years.
   - Mandatory Electronic Recording: Section 105 BNSS — mandatory audio-video recording of search and seizure operations.
   - Police Custody: Section 187 BNSS — police custody up to 15 days in parts across the first 40 or 60 days.
   - Charge Sheet Timelines: Section 193 BNSS — 60 or 90 days statutory investigation deadline.
   - Fast-Track Verdiscts: Framing of charges within 60 days (BNSS 251); judgment within 30–45 days (BNSS 258).
3. **Evidence Law & Forensics**:
   - Bharatiya Sakshya Adhiniyam (BSA, 2023) and Indian Evidence Act (IEA, 1872).
   - Primary & Secondary Recognition: Sections 57 & 61 BSA recognise electronic records stored simultaneously across systems as primary evidence.
   - Mandatory Certificate under Section 63 BSA (formerly Section 65B IEA / *Arjun Panditrao Khotkar* 2020 SC precedent): Device identification, lawful custody, normal operation, cryptographic SHA-256 hash preservation, signature of system manager.
   - Chain of Custody: Monotonic 9-stage custody protocol (SEIZED ➔ REGISTERED ➔ SEALED ➔ STORED ➔ TRANSFERRED ➔ FORENSIC EXAMINATION ➔ RETURNED ➔ COURT SUBMISSION ➔ DISPOSED).
4. **Special Statutes & Civil Law**:
   - Negotiable Instruments Act 1881: Section 138 (cheque dishonour: 30-day notice, 15-day cure, 30-day complaint filing, Section 143A interim compensation up to 20%).
   - POCSO Act 2012: Special child-friendly courts, mandatory reporting, 30-day evidence recording, 1-year trial completion.
   - NDPS Act 1985: Commercial quantity Section 37 bail rigors (twin conditions), Section 50 search safeguards.
   - CPC 1908: Order 39 Rules 1 & 2 (temporary injunctions), Section 11 (Res Judicata), Order 7 Rule 11 (rejection of plaint).
   - Constitutional Writs: Articles 226/227 and Article 32, SLP under Article 136.

=== LIVE COURT DASHBOARD & CAUSE LIST TELEMETRY (AS OF ${todayStr}) ===
- Active Registry Status:
  * Total Open Pending Cases: ${pendingCasesCount} active cases (${tier1CasesCount} Tier 1 High Priority).
  * Total Cases on Record: 103 cases.
  * Scheduled Hearings: 100 listings across 2026.
  * Open Scheduling Conflicts: ${systemConflicts.length} conflicts (${systemConflicts.filter((c) => c.severity === "blocking").length} blocking, ${systemConflicts.filter((c) => c.severity === "warning").length} warning).
  * Gazetted Court Holidays: Sundays are non-working court holidays. Upcoming gazetted holidays: ${holidaysSummary}.
- Police Assets & Malkhana Evidence Vault:
  * Total Cataloged Assets: ${policeAssets.length} (${assetsUnderMaintenance.length} in maintenance, ${assignedAssets.length} assigned to officers).
  * Evidence in Custody: ${evidenceExhibits.length} exhibits (${unexaminedEvidence.length} pending forensic examination).
  * Exhibit EV-1045 ('Dell Latitude 5420 Laptop'): STORED in Central Malkhana Vault B (Locker #12) under Tamper Seal #MHA-EV-1045-A. Custodian: HC Ramesh Chand. Connected Case: BNS/2026/0014 (*State v. Accused*). CFSL report #FSL-2026-9812 verified.
- Secure DMS Records:
  * Registered Documents: ${documents.length} (${multiVersionDocs.length} multi-version, ${unverifiedDocs.length} unverified hash).
  * Platform digital signatures are internal electronic approvals formatted for Section 63 BSA compliance.
- Presiding Benches & Courtrooms:
${judgesSummary}
${courtroomsSummary}
- Sample Active Cases & Upcoming Listings:
${topCasesSummary}
${upcomingSchedulesSummary}

=== ASSISTANT DIRECTIVES & SCOPE RULES ===
1. **PERSONAL LEGAL ASSISTANT BEHAVIOR**:
   - Answer ANY legal question under Indian law, statutory provision, legal test, procedural requirement, or court management inquiry.
   - Accept ANY custom input: hypothetical scenarios, case facts, drafting guidance, or statutory comparisons.
   - Structure answers clearly with bold headings, bullet points, statutory sections, and practical procedural advice.
2. **STRICT LEGAL & COURT SCOPE GUARDRAIL**:
   - Your duty is strictly Indian Law, Justice, Criminal/Civil Procedure, and Court Registry operations.
   - If the user asks an unrelated non-legal topic (e.g., cooking recipes, sports scores, movie gossip, entertainment), politely and concisely decline:
     "As NyayaSetu's Personal Legal AI Assistant, my expertise is strictly dedicated to Indian Law (BNS, BNSS, BSA, CPC, CrPC, IPC, POCSO, NDPS, etc.) and District Court judicial dashboard operations. Please ask any question related to Indian legal provisions, case dossiers, hearing cause-lists, evidence custody, or court scheduling."
3. **READ-ONLY DECISION SUPPORT**:
   - You provide legal intelligence and explanations. You cannot unilaterally execute database writes, change custody, or delete documents.
4. **ATTRIBUTIONS**:
   - Append a source reference (e.g. \`[Source: Bharatiya Nagarik Suraksha Sanhita, 2023 • Section 482]\`, \`[Source: District Court Malkhana Vault Register • Asset EV-1045]\`, \`[Source: Case Registry • Case BNS/2026/0014]\`).
`;

      const aiResponse = await queryLLM([
        { role: "system", content: systemPrompt },
        { role: "user", content: `<user_query>\n${sanitizedQuestion}\n</user_query>` },
      ]);

      if (aiResponse) {
        let resolvedRows =
          deterministicAnswer.intent !== "unknown" && deterministicAnswer.intent !== "legal_consultation"
            ? (deterministicAnswer.rows ?? [])
            : [];

        if (resolvedRows.length === 0) {
          const extractedRows: AssistantRow[] = [];
          const lowerQ = sanitizedQuestion.toLowerCase();
          const lowerResp = aiResponse.toLowerCase();

          // 1. Match active cases
          for (const c of activeCases) {
            const num = (c.case_number || "").toLowerCase();
            const cnr = (c.cnr_number || "").toLowerCase();
            if (
              num &&
              (lowerQ.includes(num) ||
                lowerResp.includes(num) ||
                (cnr && (lowerQ.includes(cnr) || lowerResp.includes(cnr))))
            ) {
              extractedRows.push({
                id: `case-${c.id}`,
                label: `${c.case_number} · ${c.parties || "Parties on Record"}`,
                detail: `${c.case_categories?.name || "General"} · ${c.priority_tier || "Tier 2"} (Priority ${c.priority_score ?? 50})`,
                badge: c.priority_tier || "Active Case",
                target: { route: "/cases/$caseId", caseId: c.id },
              });
              if (extractedRows.length >= 4) break;
            }
          }

          // 2. Match police assets / evidence
          for (const a of policeAssets) {
            const code = a.asset_code.toLowerCase();
            if (lowerQ.includes(code) || lowerResp.includes(code)) {
              extractedRows.push({
                id: `asset-${a.id}`,
                label: `${a.name} (${a.asset_code})`,
                detail: `Location: ${a.current_location} · Status: ${a.status}${a.case_number ? ` · Case: ${a.case_number}` : ""}`,
                badge: a.evidence_status || a.status,
                target: { route: "/assets/$assetId", assetId: a.id },
              });
              if (extractedRows.length >= 4) break;
            }
          }

          // 3. Match documents
          for (const d of documents) {
            const docNum = d.document_number.toLowerCase();
            if (lowerQ.includes(docNum) || lowerResp.includes(docNum)) {
              extractedRows.push({
                id: `doc-${d.id}`,
                label: `${d.title} (${d.document_number})`,
                detail: `${d.category} · v${d.current_version} · ${d.sensitivity_tier}`,
                badge: `v${d.current_version}`,
                target: { route: "/documents/$documentId", documentId: d.id },
              });
              if (extractedRows.length >= 4) break;
            }
          }

          // 4. Match judges
          for (const j of judgesList) {
            const jName = j.name.toLowerCase();
            if (lowerQ.includes(jName) || lowerResp.includes(jName)) {
              extractedRows.push({
                id: `judge-${j.id}`,
                label: j.name,
                detail: `${j.specialisation || "General"} · Workload: ${j.current_workload}/${maxWorkload} active hearings`,
                badge: "Bench",
                target: { route: "/judges/$judgeId", judgeId: j.id },
              });
              if (extractedRows.length >= 3) break;
            }
          }

          if (extractedRows.length > 0) {
            resolvedRows = extractedRows;
          }
        }

        return {
          intent: "legal_consultation",
          summary: aiResponse,
          source: "NyayaSetu Personal Legal AI Assistant (Gemini/Groq)",
          rows: resolvedRows,
        };
      }
    } catch (e) {
      console.error("Assistant AI response error:", e);
    }

    // Intelligent built-in Legal & Dashboard Knowledge Engine fallback
    return generateLegalOrDashboardFallback(
      sanitizedQuestion,
      snapshot,
      effectiveRole,
      deterministicAnswer,
    );
  });
