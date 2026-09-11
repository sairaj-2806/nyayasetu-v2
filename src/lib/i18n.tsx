/**
 * High-Performance Bidirectional Hindi & English Translation Engine for NyayaSetu
 *
 * Features:
 * 1. True Bidirectional Translation (EN ⇄ HI): Never gets stuck in Hindi; translates back to English cleanly.
 * 2. Official Indian Court Legal Terminology (मानक उच्च न्यायालय एवं जिला न्यायालय विधिक शब्दावली).
 * 3. React DOM Reconciliation Guard (prevents removeChild/insertBefore crashes).
 * 4. Contextual React hook `useLanguage()` + `t()` with dynamic UI tree walking.
 * 5. Automatic reverse-translation engine for dynamically inserted DOM nodes.
 */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from "react";

export type Language = "en" | "hi";

const STORAGE_KEY = "nyayasetu.language";

// ─── REACT RECONCILIATION CRASH GUARD ──────────────────────────────────────────
// When text in the DOM is altered, React 19 / 18 can throw:
// "NotFoundError: Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node."
// This patch safely guards Node.prototype methods against unparented removals.
if (typeof window !== "undefined" && typeof Node !== "undefined" && Node.prototype) {
  const nodeProto = Node.prototype as unknown as Record<string, Function>;

  const origRemoveChild = nodeProto["removeChild"];
  if (typeof origRemoveChild === "function") {
    nodeProto["removeChild"] = function (this: Node, child: Node): Node {
      if (child.parentNode !== this) {
        return child;
      }
      return origRemoveChild.call(this, child);
    };
  }

  const origInsertBefore = nodeProto["insertBefore"];
  if (typeof origInsertBefore === "function") {
    nodeProto["insertBefore"] = function (
      this: Node,
      newNode: Node,
      referenceNode: Node | null,
    ): Node {
      if (referenceNode && referenceNode.parentNode !== this) {
        return newNode;
      }
      return origInsertBefore.call(this, newNode, referenceNode);
    };
  }
}

// ─── COMPREHENSIVE LEGAL & UI TRANSLATION DICTIONARY ───────────────────────────
export const translations = {
  // Navigation
  "nav.overview": { en: "Overview", hi: "अवलोकन" },
  "nav.command-center": { en: "Investigation Command Center", hi: "अन्वेषण नियंत्रण केंद्र" },
  "nav.scheduling": { en: "Scheduling", hi: "वाद अनुसूचन" },
  "nav.case-ops": { en: "Case & Hearing Operations", hi: "वाद एवं सुनवाई प्रक्रिया संचालन" },
  "nav.administration": { en: "Administration", hi: "न्यायालयीन प्रशासन" },
  "nav.dashboard": { en: "Command Center", hi: "नियंत्रण केंद्र" },
  "nav.cases": { en: "Cases", hi: "वाद एवं प्रकरण" },
  "nav.judges": { en: "Judges", hi: "न्यायाधीश" },
  "nav.courtrooms": { en: "Courtrooms", hi: "न्यायालय कक्ष" },
  "nav.calendar": { en: "Calendar", hi: "न्यायालयीन कैलेंडर" },
  "nav.cause-list": { en: "Cause List", hi: "दैनिक वाद सूची" },
  "nav.smart-scheduling": { en: "Smart Scheduling", hi: "स्मार्ट वाद अनुसूची निर्धारण" },
  "nav.conflicts": { en: "Conflict Detection", hi: "समय एवं कक्ष टकराव पहचान" },
  "nav.what-if": { en: "What-If Simulation", hi: "परिदृश्य विश्लेषण एवं अनुकरण" },
  "nav.backlog": { en: "Backlog Simulator", hi: "लंबित वाद निपटान सिमुलेटर" },
  "nav.reports": { en: "Reports", hi: "विधिक प्रतिवेदन" },
  "nav.activity-log": { en: "Audit & Security", hi: "अपरिवर्तनीय ऑडिट व सुरक्षा" },
  "nav.governance": { en: "Governance & Compliance", hi: "प्रशासनिक नियंत्रण एवं विधिक अनुपालन" },
  "nav.admin": { en: "Admin Panel", hi: "मुख्य प्रशासक पैनल" },
  "nav.priority-settings": { en: "Priority Settings", hi: "वाद प्राथमिकता मानदंड सेटिंग्स" },
  "nav.assets": { en: "Police Assets", hi: "पुलिस संसाधन व संपत्ति" },
  "nav.police-assets": { en: "Evidence & Asset Management", hi: "साक्ष्य व परिसंपत्ति प्रबंधन" },
  "nav.documents": { en: "Secure Document Vault", hi: "सुरक्षित डिजिटल दस्तावेज़ वॉल्ट" },
  "nav.evidence": { en: "Evidence & Custody", hi: "साक्ष्य एवं अभिरक्षा प्रबंधन" },
  "nav.search": { en: "Unified Search", hi: "एकीकृत विधिक खोज" },
  "nav.bench": { en: "My Bench", hi: "मेरी न्यायपीठ" },
  "nav.case-status": { en: "Case Status", hi: "वाद स्थिति एवं सीएनआर खोज" },
  "nav.ai-assistant": { en: "NyayaSetu Assistant", hi: "न्यायसेतु अन्वेषण सहायक" },

  // Dashboard
  "dash.pending-cases": { en: "Pending cases", hi: "लंबित वाद / विचाराधीन प्रकरण" },
  "dash.tier1-cases": { en: "Tier 1 cases", hi: "टीयर 1 प्राथमिकता वाद" },
  "dash.scheduled": { en: "Scheduled hearings", hi: "निर्धारित सुनवाइयाँ" },
  "dash.conflicts": { en: "Conflicts detected", hi: "पहचाने गए समय/कक्ष टकराव" },
  "dash.judge-util": { en: "Judge utilisation", hi: "न्यायाधीश कार्य उपयोग दर" },
  "dash.courtroom-util": { en: "Courtroom utilisation", hi: "न्यायालय कक्ष उपयोग दर" },
  "dash.awaiting": { en: "Awaiting scheduling", hi: "अनुसूची निर्धारण प्रतीक्षारत" },
  "dash.disposed": { en: "Disposed cases", hi: "निस्तारित वाद" },
  "dash.judge-workload": { en: "Judge workload distribution", hi: "न्यायाधीश कार्यभार वितरण" },
  "dash.courtroom-util-title": { en: "Courtroom utilisation", hi: "न्यायालय कक्ष उपयोग" },
  "dash.registry-briefing": { en: "Registry briefing", hi: "रजिस्ट्री दैनिक सारांश" },
  "dash.court-readiness": { en: "Court readiness", hi: "न्यायालयीन तत्परता" },
  "dash.conflict-review": { en: "Conflict review", hi: "टकराव निवारण समीक्षा" },
  "dash.unlisted": { en: "Unlisted open cases", hi: "असूचीबद्ध खुले वाद" },
  "dash.tier1-attention": { en: "Tier 1 attention", hi: "टीयर 1 विशेष ध्यान" },
  "dash.bench-capacity": { en: "Bench capacity", hi: "न्यायपीठ क्षमता" },
  "dash.courtroom-slots": { en: "Courtroom slots", hi: "न्यायालय कक्ष समय-स्लॉट" },
  "dash.impact": { en: "NyayaSetu Impact", hi: "न्यायसेतु प्रभाव एवं दक्षता" },
  "dash.impact.conflicts": { en: "Conflicts Detected & Prevented", hi: "पहचाने और टाले गए टकराव" },
  "dash.impact.tier1": { en: "Tier 1 Cases Prioritised", hi: "शीर्ष प्राथमिकता प्रदत्त वाद" },
  "dash.impact.recs": { en: "Smart Recommendations Issued", hi: "जारी स्मार्ट अनुशंसाएं" },
  "dash.impact.hearings": { en: "Active Scheduled Hearings", hi: "सक्रिय निर्धारित सुनवाइयाँ" },

  // Cases Table & Filters
  "cases.case-number": { en: "Case Number", hi: "वाद संख्या" },
  "cases.category": { en: "Category", hi: "विधिक श्रेणी" },
  "cases.status": { en: "Status", hi: "वर्तमान स्थिति" },
  "cases.filing-date": { en: "Filing Date", hi: "वाद संस्थित तिथि" },
  "cases.priority": { en: "Priority", hi: "प्राथमिकता क्रम" },
  "cases.parties": { en: "Parties", hi: "पक्षकार (वादी / प्रतिवादी)" },
  "cases.adjournments": { en: "Adjournments", hi: "स्थगन संख्या" },
  "cases.pending-days": { en: "Pending Days", hi: "लंबित दिन" },

  // Cause List
  "cause-list.title": { en: "Cause List", hi: "दैनिक वाद सूची" },
  "cause-list.date": { en: "Date", hi: "दिनांक" },
  "cause-list.judge": { en: "Judge", hi: "न्यायाधीश" },
  "cause-list.courtroom": { en: "Courtroom", hi: "न्यायालय कक्ष" },
  "cause-list.slot": { en: "Slot", hi: "समय स्लॉट" },
  "cause-list.generate": { en: "Generate Optimised Board", hi: "अनुकूलित वाद सूची तैयार करें" },
  "cause-list.morning": { en: "Urgent Mentions & Admissions", hi: "अति आवश्यक उल्लेख एवं प्रवेश" },
  "cause-list.contested": {
    en: "Contested Arguments & Evidence",
    hi: "अंतिम बहस एवं साक्ष्य परीक्षण",
  },
  "cause-list.afternoon": {
    en: "Orders & Miscellaneous Disposals",
    hi: "आदेश, निर्णय एवं प्रकीर्ण निस्तारण",
  },

  // General & Actions
  "general.refresh": { en: "Refresh", hi: "ताज़ा करें" },
  "general.loading": { en: "Loading…", hi: "डेटा लोड हो रहा है…" },
  "general.error": { en: "Error", hi: "त्रुटि" },
  "general.search": { en: "Search cases…", hi: "वाद या प्रकरण खोजें…" },
  "general.sign-out": { en: "Sign out", hi: "साइन आउट" },
  "general.accept": { en: "Accept", hi: "स्वीकार करें" },
  "general.modify": { en: "Modify", hi: "संशोधित करें" },
  "general.reject": { en: "Reject", hi: "अस्वीकार करें" },
  "general.cancel": { en: "Cancel", hi: "रद्द करें" },
  "general.save": { en: "Save", hi: "सहेजें" },
} as const;

export type TranslationKey = keyof typeof translations;

// ─── MASTER BIDIRECTIONAL PHRASE & VOCABULARY DICTIONARY ────────────────────────
// Tuple structure: [English Regex, Hindi Translation, English Source]
// Ordered from longest compound phrases to shorter single words.
const DICTIONARY_PAIRS: [RegExp, string, string][] = [
  // Full Headers & System Features
  [/Smart Scheduling/gi, "स्मार्ट वाद अनुसूची निर्धारण", "Smart Scheduling"],
  [/Conflict Detection/gi, "समय एवं कक्ष टकराव पहचान", "Conflict Detection"],
  [/What-If Simulation/gi, "परिदृश्य विश्लेषण एवं अनुकरण", "What-If Simulation"],
  [/Backlog Simulator/gi, "लंबित वाद निपटान सिमुलेटर", "Backlog Simulator"],
  [/Governance & Compliance/gi, "प्रशासनिक नियंत्रण एवं विधिक अनुपालन", "Governance & Compliance"],
  [/Priority Settings/gi, "वाद प्राथमिकता मानदंड सेटिंग्स", "Priority Settings"],
  [/Architecture Preview/gi, "प्रणाली संरचना पूर्वावलोकन", "Architecture Preview"],
  [/Activity Log/gi, "अपरिवर्तनीय गतिविधि विवरण", "Activity Log"],
  [/Cause List/gi, "दैनिक वाद सूची", "Cause List"],
  [/Decision Receipt/gi, "विधिक निर्णय अभिलेख एवं रसीद", "Decision Receipt"],
  [
    /Explainable Decision Receipt/gi,
    "पारदर्शी विधिक निर्णय अभिलेख",
    "Explainable Decision Receipt",
  ],
  [/NyayaSetu Registry/gi, "न्यायसेतु न्यायालय अभिलेखागार", "NyayaSetu Registry"],
  [
    /AI powered court scheduling control/gi,
    "एआई संचालित न्यायालय अनुसूची निर्धारण नियंत्रण",
    "AI powered court scheduling control",
  ],
  [/AI powered court scheduling/gi, "एआई संचालित न्यायालय अनुसूचन", "AI powered court scheduling"],
  [/Run Scheduling Engine/gi, "अनुसूची निर्धारण इंजन चलाएं", "Run Scheduling Engine"],
  [/Load SIH Demo/gi, "डेमो परिदृश्य लोड करें", "Load SIH Demo"],
  [/Load Demo Scenario/gi, "डेमो परिदृश्य लोड करें", "Load Demo Scenario"],
  [/Load Demo/gi, "डेमो डेटा लोड करें", "Load Demo"],
  [/Apply Changes/gi, "परिवर्तन लागू करें", "Apply Changes"],
  [/Generate Optimised Board/gi, "अनुकूलित वाद सूची तैयार करें", "Generate Optimised Board"],
  [/Export PDF/gi, "पीडीएफ (PDF) निर्यात करें", "Export PDF"],
  [
    /Alternative scheduling options/gi,
    "वैकल्पिक अनुसूची निर्धारण विकल्प",
    "Alternative scheduling options",
  ],
  [
    /Alternative Scheduling Options/gi,
    "वैकल्पिक अनुसूची निर्धारण विकल्प",
    "Alternative Scheduling Options",
  ],
  [
    /Why this combination was recommended/gi,
    "इस संयोजन की अनुशंसा का विधिक आधार",
    "Why this combination was recommended",
  ],
  [
    /Scheduling recommendation · top ranked/gi,
    "अनुसूची अनुशंसा · शीर्ष वरीयता प्राप्त",
    "Scheduling recommendation · top ranked",
  ],
  [
    /Hard Constraints \(all must pass\)/gi,
    "बाध्यकारी विधिक नियम (सभी का अनुपालन अनिवार्य)",
    "Hard Constraints (all must pass)",
  ],
  [/Hard Constraints/gi, "बाध्यकारी विधिक नियम", "Hard Constraints"],
  [
    /Soft Preferences \(ranking only\)/gi,
    "प्राथमिकता वरीयताएं (केवल रैंकिंग हेतु)",
    "Soft Preferences (ranking only)",
  ],
  [/Soft Preferences/gi, "प्राथमिकता वरीयताएं", "Soft Preferences"],
  [/Deterministic rules engine/gi, "निश्चित विधिक नियम इंजन", "Deterministic rules engine"],
  [/No AI randomness/gi, "कोई आकस्मिक त्रुटि नहीं", "No AI randomness"],
  [
    /Same inputs always produce same output/gi,
    "समान इनपुट पर सदैव वही सुसंगत परिणाम",
    "Same inputs always produce same output",
  ],
  [/Court readiness/gi, "न्यायालयीन तत्परता", "Court readiness"],
  [/Registry briefing/gi, "रजिस्ट्री दैनिक सारांश", "Registry briefing"],
  [/Judge workload distribution/gi, "न्यायाधीश कार्यभार वितरण", "Judge workload distribution"],
  [/Courtroom utilisation/gi, "न्यायालय कक्ष उपयोग", "Courtroom utilisation"],
  [/Active hearings per judge/gi, "प्रति न्यायाधीश सक्रिय सुनवाइयाँ", "Active hearings per judge"],
  [/Pending cases/gi, "लंबित वाद / विचाराधीन प्रकरण", "Pending cases"],
  [/Tier 1 cases/gi, "टीयर 1 प्राथमिकता वाद", "Tier 1 cases"],
  [/Tier 2 cases/gi, "टीयर 2 वाद", "Tier 2 cases"],
  [/Tier 3 cases/gi, "टीयर 3 वाद", "Tier 3 cases"],
  [/Scheduled hearings/gi, "निर्धारित सुनवाइयाँ", "Scheduled hearings"],
  [/Conflicts detected/gi, "पहचाने गए समय/कक्ष टकराव", "Conflicts detected"],
  [/Judge utilisation/gi, "न्यायाधीश कार्य उपयोग दर", "Judge utilisation"],
  [/Awaiting scheduling/gi, "अनुसूची निर्धारण प्रतीक्षारत", "Awaiting scheduling"],
  [/Disposed cases/gi, "निस्तारित वाद", "Disposed cases"],
  [/Fit score \/ 100/gi, "अनुकूलता गुणांक / 100", "Fit score / 100"],
  [/fit score/gi, "अनुकूलता गुणांक", "fit score"],
  [/minutes estimated/gi, "मिनट (अनुमानित)", "minutes estimated"],
  [/estimated duration/gi, "अनुमानित सुनवाई अवधि", "estimated duration"],
  [/previous adjournments/gi, "पूर्व स्थगन संख्या", "previous adjournments"],
  [/Select a pending case/gi, "एक लंबित वाद चुनें", "Select a pending case"],
  [/Choose a case…/gi, "वाद या प्रकरण चुनें…", "Choose a case…"],
  [/Choose a pending case…/gi, "लंबित वाद चुनें…", "Choose a pending case…"],
  [/No pending cases/gi, "कोई लंबित वाद उपलब्ध नहीं", "No pending cases"],
  [/Checking case priority/gi, "वाद प्राथमिकता की जांच की जा रही है", "Checking case priority"],
  [
    /Checking judge & courtroom availability/gi,
    "न्यायाधीश एवं न्यायालय कक्ष उपलब्धता की जांच",
    "Checking judge & courtroom availability",
  ],
  [/Checking booking conflicts/gi, "समय एवं कक्ष टकराव की जांच", "Checking booking conflicts"],
  [/Checking duration fit/gi, "सुनवाई अवधि अनुकूलता की जांच", "Checking duration fit"],
  [/Analysis complete/gi, "विश्लेषण सफलतापूर्वक पूर्ण", "Analysis complete"],
  [
    /Accept & Confirm Listing/gi,
    "स्वीकार करें एवं वाद सूची में दर्ज करें",
    "Accept & Confirm Listing",
  ],
  [/Modify \/ Pick Alternative/gi, "संशोधित करें / अन्य विकल्प चुनें", "Modify / Pick Alternative"],
  [/Reject Recommendation/gi, "अनुशंसा अस्वीकृत करें", "Reject Recommendation"],
  [/Explain recommendation/gi, "अनुशंसा का विधिक आधार समझें", "Explain recommendation"],
  [/Explain with AI/gi, "एआई (AI) विधिक व्याख्या", "Explain with AI"],
  [/Explain with AI Copilot/gi, "एआई कोपायलट द्वारा समझें", "Explain with AI Copilot"],
  [/AI Decision Support/gi, "एआई निर्णय सहायता प्रणाली", "AI Decision Support"],
  [/AI Explanation/gi, "एआई विधिक कारण व्याख्या", "AI Explanation"],
  [/Refresh analysis/gi, "विश्लेषण ताज़ा करें", "Refresh analysis"],

  // Indian Legal & Court Terms
  [/Senior Citizen Litigant/gi, "वरिष्ठ नागरिक पक्षकार", "Senior Citizen Litigant"],
  [/Senior citizen/gi, "वरिष्ठ नागरिक", "Senior citizen"],
  [/Fast Track Special Court/gi, "फास्ट ट्रैक विशेष न्यायालय", "Fast Track Special Court"],
  [/POCSO Act Case/gi, "पॉक्सो (POCSO) अधिनियम प्रकरण", "POCSO Act Case"],
  [/POCSO Act/gi, "पॉक्सो अधिनियम", "POCSO Act"],
  [/POCSO/gi, "पॉक्सो (POCSO)", "POCSO"],
  [/Bail Application/gi, "जमानत आवेदन पत्र", "Bail Application"],
  [/Criminal Law/gi, "आपराधिक / दांडिक विधि", "Criminal Law"],
  [/Civil Law/gi, "दीवानी विधि", "Civil Law"],
  [/Family Law/gi, "पारिवारिक विधि", "Family Law"],
  [/Commercial Disputes/gi, "वाणिज्यिक वाद", "Commercial Disputes"],
  [/Commercial Law/gi, "वाणिज्यिक विधि", "Commercial Law"],
  [/Constitutional Law/gi, "संवैधानिक विधि", "Constitutional Law"],
  [/Labour & Industrial/gi, "श्रम एवं औद्योगिक विधि", "Labour & Industrial"],
  [/Property Dispute 5yr\+/gi, "5+ वर्ष पुराना संपत्ति विवाद", "Property Dispute 5yr+"],
  [/Property Dispute/gi, "संपत्ति विवाद", "Property Dispute"],
  [
    /Statutory Limitation Approaching/gi,
    "वैधानिक परिसीमा तिथि निकट",
    "Statutory Limitation Approaching",
  ],
  [
    /Urgent Mentions & Admissions/gi,
    "अति आवश्यक उल्लेख एवं प्रवेश",
    "Urgent Mentions & Admissions",
  ],
  [
    /Contested Arguments & Evidence/gi,
    "अंतिम बहस एवं साक्ष्य परीक्षण",
    "Contested Arguments & Evidence",
  ],
  [
    /Orders & Miscellaneous Disposals/gi,
    "आदेश, निर्णय एवं प्रकीर्ण निस्तारण",
    "Orders & Miscellaneous Disposals",
  ],
  [
    /Judge available at this slot/gi,
    "इस समय-स्लॉट पर न्यायाधीश उपलब्ध हैं",
    "Judge available at this slot",
  ],
  [/Courtroom available/gi, "न्यायालय कक्ष उपलब्ध है", "Courtroom available"],
  [/No double-booking/gi, "कोई दोहरा आवंटन नहीं", "No double-booking"],
  [
    /Hearing duration fits slot/gi,
    "सुनवाई अवधि समय-स्लॉट के अनुकूल है",
    "Hearing duration fits slot",
  ],
  [
    /Judge workload within threshold/gi,
    "न्यायाधीश कार्यभार निर्धारित सीमा में है",
    "Judge workload within threshold",
  ],
  [/Not a court holiday/gi, "न्यायालयीन अवकाश नहीं है", "Not a court holiday"],
  [
    /Judge emergency leave \/ absence/gi,
    "न्यायाधीश का आकस्मिक अवकाश / अनुपस्थिति",
    "Judge emergency leave / absence",
  ],
  [
    /Courtroom emergency infrastructure closure/gi,
    "न्यायालय कक्ष का आकस्मिक रख-रखाव बंद",
    "Courtroom emergency infrastructure closure",
  ],
  [
    /Applying simulated condition/gi,
    "सिम्युलेटेड स्थिति लागू की जा रही है",
    "Applying simulated condition",
  ],
  [
    /Tracing affected hearings/gi,
    "प्रभावित सुनवाइयों की पहचान की जा रही है",
    "Tracing affected hearings",
  ],
  [
    /Re-checking judge & courtroom availability/gi,
    "न्यायाधीश एवं कक्ष की पुनः उपलब्धता जांच",
    "Re-checking judge & courtroom availability",
  ],
  [
    /Re-checking conflicts and duration fit/gi,
    "टकराव एवं अवधि की पुनः जांच",
    "Re-checking conflicts and duration fit",
  ],

  // Police Assets & Evidence Terminology
  [/Evidence Exhibits/gi, "साक्ष्य प्रदर्श", "Evidence Exhibits"],
  [/Evidence Exhibit/gi, "साक्ष्य प्रदर्श", "Evidence Exhibit"],
  [/Police Assets/gi, "पुलिस संसाधन व संपत्ति", "Police Assets"],
  [/Police Asset/gi, "पुलिस संसाधन", "Police Asset"],
  [/Chain of Custody/gi, "अभिरक्षा श्रृंखला (Chain of Custody)", "Chain of Custody"],
  [/Evidence Custodian/gi, "मालखाना अभिरक्षक / मोहर्रिर", "Evidence Custodian"],
  [/Investigating Officer/gi, "विवेचना अधिकारी (I.O.)", "Investigating Officer"],
  [/Central Malkhana/gi, "केंद्रीय मालखाना", "Central Malkhana"],
  [/Malkhana/gi, "मालखाना", "Malkhana"],
  [/Digital Documents/gi, "डिजिटल दस्तावेज़ व अभिलेख", "Digital Documents"],
  [/Digital Document/gi, "डिजिटल दस्तावेज़", "Digital Document"],
  [/Document Vault/gi, "दस्तावेज़ अभिरक्षा केंद्र", "Document Vault"],
  [/Forensic Report/gi, "फोरेंसिक रिपोर्ट", "Forensic Report"],
  [/Ballistic Report/gi, "बैलिस्टिक रिपोर्ट", "Ballistic Report"],
  [/Search Registry/gi, "रजिस्ट्री खोजें", "Search Registry"],
  [/Unified Global Registry Search/gi, "एकीकृत रजिस्ट्री खोज", "Unified Global Registry Search"],
  [/Global Search/gi, "एकीकृत खोज", "Global Search"],

  // Core Legal Roles
  [/\bJudicial Officers\b/gi, "न्यायिक अधिकारी", "Judicial Officers"],
  [/\bJudicial Officer\b/gi, "न्यायिक अधिकारी", "Judicial Officer"],
  [/\bPrincipal Registrar\b/gi, "प्रधान रजिस्ट्रार", "Principal Registrar"],
  [/\bCourt Administrator\b/gi, "न्यायालय प्रशासक", "Court Administrator"],
  [/\bCourt Staff\b/gi, "न्यायालयीन कर्मचारी", "Court Staff"],
  [/\bRegistrar\b/gi, "रजिस्ट्रार", "Registrar"],
  [/\bCourtrooms\b/gi, "न्यायालय कक्ष", "Courtrooms"],
  [/\bCourtroom\b/gi, "न्यायालय कक्ष", "Courtroom"],
  [/\bJudges\b/gi, "न्यायाधीश", "Judges"],
  [/\bJudge\b/gi, "न्यायाधीश", "Judge"],
  [/\bBenches\b/gi, "न्यायपीठें", "Benches"],
  [/\bBench\b/gi, "न्यायपीठ", "Bench"],
  [/\bParties\b/gi, "पक्षकार", "Parties"],
  [/\bParty\b/gi, "पक्षकार", "Party"],
  [/\bPetitioner\b/gi, "याचिकाकर्ता", "Petitioner"],
  [/\bRespondent\b/gi, "प्रतिवादी", "Respondent"],
  [/\bAdvocate\b/gi, "अधिवक्ता", "Advocate"],
  [/\bLitigant\b/gi, "वादकारी", "Litigant"],

  // Case Attributes & States
  [/\bCase Number\b/gi, "वाद संख्या", "Case Number"],
  [/\bFiling Date\b/gi, "वाद संस्थित तिथि", "Filing Date"],
  [/\bHearing Date\b/gi, "सुनवाई तिथि", "Hearing Date"],
  [/\bNext Date\b/gi, "अगली नियत तिथि", "Next Date"],
  [/\bCases\b/gi, "वाद एवं प्रकरण", "Cases"],
  [/\bCase\b/gi, "वाद / प्रकरण", "Case"],
  [/\bStatus\b/gi, "स्थिति", "Status"],
  [/\bPriority\b/gi, "प्राथमिकता", "Priority"],
  [/\bCategory\b/gi, "श्रेणी", "Category"],
  [/\bSlot\b/gi, "समय-स्लॉट", "Slot"],
  [/\bSlots\b/gi, "समय-स्लॉट", "Slots"],
  [/\bCalendar\b/gi, "कैलेंडर", "Calendar"],
  [/\bReports\b/gi, "प्रतिवेदन", "Reports"],
  [/\bReport\b/gi, "प्रतिवेदन", "Report"],
  [/\bDisposed\b/gi, "निस्तारित", "Disposed"],
  [/\bPending\b/gi, "लंबित", "Pending"],
  [/\bScheduled\b/gi, "निर्धारित", "Scheduled"],
  [/\bAdjourned\b/gi, "स्थगित", "Adjourned"],
  [/\bAdjournments\b/gi, "स्थगन", "Adjournments"],
  [/\bAdjournment\b/gi, "स्थगन", "Adjournment"],
  [/\bConfirmed\b/gi, "पुष्ट", "Confirmed"],
  [/\bProposed\b/gi, "प्रस्तावित", "Proposed"],
  [/\bHigh Urgency\b/gi, "अति उच्च प्राथमिकता", "High Urgency"],
  [/\bMedium Urgency\b/gi, "मध्यम प्राथमिकता", "Medium Urgency"],
  [/\bNormal Urgency\b/gi, "सामान्य प्राथमिकता", "Normal Urgency"],
  [/\bAvailable\b/gi, "उपलब्ध", "Available"],
  [/\bAssigned\b/gi, "आवंटित", "Assigned"],
  [/\bMaintenance\b/gi, "अनुरक्षण में", "Maintenance"],

  // UI Actions & General Controls
  [/\bOverview\b/gi, "अवलोकन", "Overview"],
  [/\bAdministration\b/gi, "प्रशासन", "Administration"],
  [/\bScheduling\b/gi, "अनुसूचन", "Scheduling"],
  [/\bDashboard\b/gi, "डैशबोर्ड", "Dashboard"],
  [/\bRefresh\b/gi, "ताज़ा करें", "Refresh"],
  [/\bSign out\b/gi, "साइन आउट", "Sign out"],
  [/\bSearch cases…\b/gi, "वाद या प्रकरण खोजें…", "Search cases…"],
  [/\bSearch\b/gi, "खोजें", "Search"],
  [/\bCancel\b/gi, "रद्द करें", "Cancel"],
  [/\bSubmit\b/gi, "जमा करें", "Submit"],
  [/\bSave\b/gi, "सहेजें", "Save"],
  [/\bClose\b/gi, "बंद करें", "Close"],
  [/\bAccept\b/gi, "स्वीकार करें", "Accept"],
  [/\bModify\b/gi, "संशोधित करें", "Modify"],
  [/\bReject\b/gi, "अस्वीकार करें", "Reject"],
  [/\bAction\b/gi, "कार्रवाई", "Action"],
  [/\bActions\b/gi, "कार्रवाइयां", "Actions"],
  [/\bOptions\b/gi, "विकल्प", "Options"],
  [/\bOption\b/gi, "विकल्प", "Option"],
  [/\bLoading…\b/gi, "डेटा लोड हो रहा है…", "Loading…"],
  [/\bLoading\b/gi, "लोड हो रहा है", "Loading"],
  [/\bError\b/gi, "त्रुटि", "Error"],
  [/\bSuccess\b/gi, "सफल", "Success"],
];

// Pre-build forward and reverse maps
const EN_TO_HI_MAP: [RegExp, string][] = DICTIONARY_PAIRS.map(([regex, hi]) => [regex, hi]);

// Build reverse dictionary sorted by descending Hindi length so long phrases match before individual words
const HI_TO_EN_MAP: [RegExp, string][] = [...DICTIONARY_PAIRS]
  .sort((a, b) => b[1].length - a[1].length)
  .map(([, hi, en]) => {
    // Escape special regex characters in Hindi phrase
    const escaped = hi.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return [new RegExp(escaped, "g"), en];
  });

// WeakMaps to track original text across DOM elements
const originalTextMap = new WeakMap<Node, string>();
const originalPlaceholderMap = new WeakMap<Element, string>();

function shouldSkipElement(el: HTMLElement | null): boolean {
  if (!el) return true;
  const tag = el.tagName.toLowerCase();
  if (
    tag === "script" ||
    tag === "style" ||
    tag === "code" ||
    tag === "pre" ||
    tag === "svg" ||
    tag === "input" ||
    tag === "textarea"
  ) {
    return true;
  }
  if (el.closest(".notranslate") || el.getAttribute("translate") === "no") {
    return true;
  }
  return false;
}

function translateSingleTextNode(node: Text, toHindi: boolean) {
  const parent = node.parentElement;
  if (shouldSkipElement(parent)) return;

  const currentVal = node.nodeValue ?? "";
  if (!currentVal || !currentVal.trim()) return;

  // Skip pure numbers, punctuation or symbols
  if (/^[\d\s.,:;/#%*+()\-–—_@!?"'’|]+$/.test(currentVal)) return;

  if (toHindi) {
    // Save original English ONLY if node does NOT already contain Devanagari Hindi
    if (!originalTextMap.has(node) && !/[\u0900-\u097F]/.test(currentVal)) {
      originalTextMap.set(node, currentVal);
    }
    const source = originalTextMap.get(node) ?? currentVal;

    let translated = source;
    for (let i = 0; i < EN_TO_HI_MAP.length; i++) {
      const [regex, hiText] = EN_TO_HI_MAP[i]!;
      translated = translated.replace(regex, hiText);
    }

    if (translated !== currentVal) {
      node.nodeValue = translated;
    }
  } else {
    // Restore English
    // 1. First priority: restore from cached original English string
    const orig = originalTextMap.get(node);
    if (orig && !/[\u0900-\u097F]/.test(orig)) {
      if (node.nodeValue !== orig) {
        node.nodeValue = orig;
      }
      return;
    }

    // 2. If node was recreated by React while in Hindi or has no entry, run reverse translation!
    if (/[\u0900-\u097F]/.test(currentVal)) {
      let english = currentVal;
      for (let i = 0; i < HI_TO_EN_MAP.length; i++) {
        const [hiRegex, enText] = HI_TO_EN_MAP[i]!;
        english = english.replace(hiRegex, enText);
      }
      if (english !== currentVal) {
        node.nodeValue = english;
      }
    }
  }
}

function walkAndTranslate(root: Node, toHindi: boolean) {
  if (root.nodeType === Node.TEXT_NODE) {
    translateSingleTextNode(root as Text, toHindi);
    return;
  }

  if (root.nodeType === Node.ELEMENT_NODE) {
    const el = root as HTMLElement;
    if (shouldSkipElement(el)) return;

    // Handle input placeholders
    if (el.hasAttribute("placeholder")) {
      const ph = el.getAttribute("placeholder") || "";
      if (toHindi) {
        if (!originalPlaceholderMap.has(el) && !/[\u0900-\u097F]/.test(ph)) {
          originalPlaceholderMap.set(el, ph);
        }
        let tPh = originalPlaceholderMap.get(el) ?? ph;
        for (let i = 0; i < EN_TO_HI_MAP.length; i++) {
          const [regex, hiText] = EN_TO_HI_MAP[i]!;
          tPh = tPh.replace(regex, hiText);
        }
        if (tPh !== ph) el.setAttribute("placeholder", tPh);
      } else {
        const orig = originalPlaceholderMap.get(el);
        if (orig) {
          el.setAttribute("placeholder", orig);
        } else if (/[\u0900-\u097F]/.test(ph)) {
          let enPh = ph;
          for (let i = 0; i < HI_TO_EN_MAP.length; i++) {
            const [hiRegex, enText] = HI_TO_EN_MAP[i]!;
            enPh = enPh.replace(hiRegex, enText);
          }
          el.setAttribute("placeholder", enPh);
        }
      }
    }

    // Use efficient TreeWalker to find all text nodes under root
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const p = node.parentElement;
        if (shouldSkipElement(p)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    let current = walker.nextNode();
    while (current) {
      translateSingleTextNode(current as Text, toHindi);
      current = walker.nextNode();
    }
  }
}

// ─── CONTEXT & PROVIDER ────────────────────────────────────────────────────────
type LanguageContextValue = {
  lang: Language;
  setLang: (l: Language) => void;
  t: (keyOrPhrase: string) => string;
};

const LanguageContext = createContext<LanguageContextValue>({
  lang: "en",
  setLang: () => {},
  t: (keyOrPhrase) => keyOrPhrase,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    if (typeof window === "undefined") return "en";
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      return stored === "hi" ? "hi" : "en";
    } catch {
      return "en";
    }
  });

  const observerRef = useRef<MutationObserver | null>(null);
  const debounceTimerRef = useRef<number | null>(null);
  const isTranslatingRef = useRef(false);

  const setLang = useCallback((l: Language) => {
    setLangState(l);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_KEY, l);
        document.documentElement.lang = l;
      } catch (err) {
        console.warn("Failed to persist language preference", err);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const isHi = lang === "hi";
    document.documentElement.lang = lang;

    // Disconnect previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    // Run safe full-page translation or reversion
    isTranslatingRef.current = true;
    try {
      walkAndTranslate(document.body, isHi);
    } finally {
      isTranslatingRef.current = false;
    }

    // Only attach MutationObserver when in Hindi to catch dynamically mounted content
    if (isHi) {
      observerRef.current = new MutationObserver((mutations) => {
        if (isTranslatingRef.current) return;

        let hasAddedNodes = false;
        for (let i = 0; i < mutations.length; i++) {
          if (mutations[i]!.addedNodes.length > 0) {
            hasAddedNodes = true;
            break;
          }
        }

        if (hasAddedNodes) {
          if (debounceTimerRef.current) {
            window.clearTimeout(debounceTimerRef.current);
          }
          debounceTimerRef.current = window.setTimeout(() => {
            if (isTranslatingRef.current) return;
            isTranslatingRef.current = true;
            try {
              walkAndTranslate(document.body, true);
            } finally {
              isTranslatingRef.current = false;
            }
          }, 60);
        }
      });

      observerRef.current.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, [lang]);

  /**
   * Universal bidirectional translation helper:
   * 1. Checks if `keyOrPhrase` is a key in `translations` (e.g. "nav.dashboard")
   * 2. When in English, restores English or reverse-translates any Hindi string
   * 3. When in Hindi, forward-translates to formal legal Hindi
   */
  const t = useCallback(
    (keyOrPhrase: string): string => {
      if (!keyOrPhrase) return "";

      if (lang === "en") {
        const known = (translations as Record<string, { en: string; hi: string }>)[keyOrPhrase];
        if (known) return known.en;

        // If string contains Hindi characters, reverse translate to English
        if (/[\u0900-\u097F]/.test(keyOrPhrase)) {
          let english = keyOrPhrase;
          for (let i = 0; i < HI_TO_EN_MAP.length; i++) {
            const [hiRegex, enText] = HI_TO_EN_MAP[i]!;
            english = english.replace(hiRegex, enText);
          }
          return english;
        }
        return keyOrPhrase;
      }

      // lang === "hi"
      const known = (translations as Record<string, { en: string; hi: string }>)[keyOrPhrase];
      if (known) return known.hi;

      let translated = keyOrPhrase;
      for (let i = 0; i < EN_TO_HI_MAP.length; i++) {
        const [regex, hiText] = EN_TO_HI_MAP[i]!;
        translated = translated.replace(regex, hiText);
      }
      return translated;
    },
    [lang],
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
