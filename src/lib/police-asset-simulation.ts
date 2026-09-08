/**
 * ============================================================================
 * NyayaSetu Digital Twin: Police Asset & Evidence Impact Simulation Engine
 * ============================================================================
 *
 * SIMULATION ONLY:
 * Pure in-memory digital twin modeling.
 * Evaluates operational disruptions without modifying production database records.
 *
 * Scenarios modeled:
 * 1. "What if vehicle VH-1045 becomes unavailable?"
 * 2. "What if Evidence Locker L-12 becomes unavailable?"
 * 3. "What if Officer X goes on leave?"
 * 4. "What if an evidence transfer is delayed?"
 *
 * Traceable outputs:
 * - Affected assets
 * - Affected officers
 * - Affected cases (with trial hearing adjournment risk)
 * - Affected evidence items
 * - Affected documents (panchnama, FIR, charge sheets, BSA §63 certificates)
 * - Recommended alternatives (actionable, ranked mitigations)
 */

import { getStoredDocuments, type SecureDocument } from "@/lib/documents";
import { getStoredLocalAssets, type PoliceAsset } from "@/lib/assets";
import { getPendingEvidenceTransfers, type PendingEvidenceTransfer } from "@/lib/evidence-custody";
import type { CaseRow } from "@/lib/cases";

export type PoliceAssetSimulationScenarioType =
  | "vehicle-unavailable"
  | "locker-unavailable"
  | "officer-on-leave"
  | "transfer-delayed"
  | "custom";

export interface PoliceAssetSimulationInput {
  scenarioType: PoliceAssetSimulationScenarioType;
  title: string;
  description: string;
  targetAssetId?: string;
  targetAssetCode?: string;
  targetOfficerName?: string;
  targetLockerLocation?: string;
  targetTransferId?: string;
  delayHours?: number;
  simulatedDate?: string;
}

export interface AffectedAssetItem {
  id: string;
  assetCode: string;
  name: string;
  categoryName: string;
  status: string;
  evidenceStatus: string | null;
  location: string;
  custodian: string;
  impactReason: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
}

export interface AffectedOfficerItem {
  id: string;
  name: string;
  role: string;
  station: string;
  assignedAssetsCount: number;
  activeCasesCount: number;
  dutyImpact: string;
  recommendedSubstitute: string;
}

export interface AffectedCaseItem {
  caseId: string;
  caseNumber: string;
  caseTitle: string;
  stage: string;
  category: string;
  scheduledHearingDate: string | null;
  hearingCourtroom: string | null;
  judgeName: string | null;
  adjournmentRisk: "HIGH_RISK_OF_ADJOURNMENT" | "MODERATE_DELAY" | "LOW_IMPACT";
  riskRationale: string;
}

export interface AffectedEvidenceItem {
  id: string;
  assetCode: string;
  name: string;
  tamperSealNumber: string | null;
  currentStatus: string;
  storageLocation: string;
  chainOfCustodyRisk: string;
  admissibilityConcern: string;
}

export interface AffectedDocumentItem {
  id: string;
  documentNumber: string;
  title: string;
  category: string;
  caseNumber: string | null;
  sha256: string;
  documentImpact: string;
}

export interface RecommendedAlternative {
  id: string;
  category: "ASSET_SUBSTITUTION" | "VAULT_REALLOCATION" | "OFFICER_REASSIGNMENT" | "HEARING_MITIGATION" | "CHAIN_SAFEGUARD";
  title: string;
  description: string;
  actionSteps: string[];
  feasibilityScore: number; // 0 - 100%
  priority: "CRITICAL" | "HIGH" | "RECOMMENDED";
  resourceAssigned: string;
  complianceNotes: string;
}

export interface SimulationRiskMetrics {
  totalAssetsAffected: number;
  totalOfficersAffected: number;
  totalCasesAffected: number;
  totalEvidenceAffected: number;
  totalDocumentsAffected: number;
  highRiskAdjournmentCount: number;
  overallDisruptionIndex: "SEVERE" | "ELEVATED" | "MANAGEABLE";
}

export interface PoliceAssetSimulationResult {
  isSimulationOnly: true;
  scenario: PoliceAssetSimulationInput;
  summary: string;
  simulatedAt: string;
  affectedAssets: AffectedAssetItem[];
  affectedOfficers: AffectedOfficerItem[];
  affectedCases: AffectedCaseItem[];
  affectedEvidence: AffectedEvidenceItem[];
  affectedDocuments: AffectedDocumentItem[];
  recommendedAlternatives: RecommendedAlternative[];
  metrics: SimulationRiskMetrics;
}

// ============================================================================
// PRESET SCENARIO DEFINITIONS
// ============================================================================

export const PRESET_SIMULATION_SCENARIOS: {
  id: PoliceAssetSimulationScenarioType;
  label: string;
  tagline: string;
  description: string;
  defaultTarget: string;
}[] = [
  {
    id: "vehicle-unavailable",
    label: "Vehicle Unavailable",
    tagline: 'e.g. "What if vehicle VH-1045 becomes unavailable?"',
    description: "Simulate mechanical failure or unexpected repair of an emergency mobile forensic or prisoner escort van.",
    defaultTarget: "VH-1045 (Mahindra Bolero Mobile Crime Van)",
  },
  {
    id: "locker-unavailable",
    label: "Evidence Locker Unavailable",
    tagline: 'e.g. "What if Evidence Locker L-12 becomes unavailable?"',
    description: "Model electronic lock failure, biometric scanner glitch, or fumigation quarantine of a malkhana safe locker.",
    defaultTarget: "Locker L-12 (Central Malkhana High-Security Vault)",
  },
  {
    id: "officer-on-leave",
    label: "Officer On Leave",
    tagline: 'e.g. "What if Officer X goes on leave?"',
    description: "Analyze the ripple effect if an Investigating Officer or Malkhana Custodian goes on sudden emergency leave.",
    defaultTarget: "Insp. Rajesh Sharma (Senior Investigating Officer)",
  },
  {
    id: "transfer-delayed",
    label: "Evidence Transfer Delayed",
    tagline: 'e.g. "What if an evidence transfer is delayed?"',
    description: "Examine chain-of-custody exposure and trial hearing jeopardy when inter-station transit is held up by 48-72 hours.",
    defaultTarget: "TRF-NDPS-89 (Malkhana to Forensic Science Laboratory)",
  },
];

// ============================================================================
// PURE IN-MEMORY SIMULATION ENGINE
// ============================================================================

/**
 * Runs the Police Asset & Evidence Impact What-If simulation entirely in-memory.
 * Strictly guarantees ZERO modification to production database records.
 */
export function runPoliceAssetSimulation(params: {
  input: PoliceAssetSimulationInput;
  liveAssets?: PoliceAsset[] | undefined;
  liveDocuments?: SecureDocument[] | undefined;
  liveCases?: CaseRow[] | undefined;
  liveTransfers?: PendingEvidenceTransfer[] | undefined;
}): PoliceAssetSimulationResult {
  const { input } = params;
  const now = new Date().toISOString();

  // Read in-memory snapshot of data
  const assets: PoliceAsset[] = params.liveAssets || getStoredLocalAssets();
  const docs: SecureDocument[] = params.liveDocuments || getStoredDocuments();
  const cases: CaseRow[] = params.liveCases || [];
  const transfers: PendingEvidenceTransfer[] = params.liveTransfers || getPendingEvidenceTransfers();

  const affectedAssets: AffectedAssetItem[] = [];
  const affectedOfficers: AffectedOfficerItem[] = [];
  const affectedCases: AffectedCaseItem[] = [];
  const affectedEvidence: AffectedEvidenceItem[] = [];
  const affectedDocuments: AffectedDocumentItem[] = [];
  const recommendedAlternatives: RecommendedAlternative[] = [];

  let summary = "";

  switch (input.scenarioType) {
    case "vehicle-unavailable": {
      const vehicleCode = input.targetAssetCode || "VH-1045";
      const vehicleName = input.title || `Patrol / Mobile Crime Unit Vehicle ${vehicleCode}`;
      summary = `Simulation: Transport asset ${vehicleCode} is marked unavailable. Mobile forensic deployment halted, inter-station evidence transit to FSL delayed, and 2 trial courtroom physical exhibit productions are at risk of adjournment.`;

      // 1. Affected Assets
      affectedAssets.push({
        id: "sim-ast-veh-01",
        assetCode: vehicleCode,
        name: vehicleName,
        categoryName: "Vehicles & Automobile Assets",
        status: "UNAVAILABLE (SIMULATED)",
        evidenceStatus: null,
        location: "District Police Lines Workshop (Simulated Breakdown)",
        custodian: "Sub-Inspector Kuldeep Malik (Workshop Incharge)",
        impactReason: "Engine clutch assembly failure; unscheduled 48-hour mechanical overhaul required.",
        severity: "CRITICAL",
      });

      // Also mark co-deployed tactical gear inside vehicle
      affectedAssets.push({
        id: "sim-ast-cam-02",
        assetCode: "POL-2026-TAC-0550",
        name: "Axon Body 3 HD Tactical Body Camera Kit",
        categoryName: "Communications & Tactical Gear",
        status: "IMPOUNDED_WITH_VEHICLE",
        evidenceStatus: null,
        location: `Inside Vehicle ${vehicleCode}`,
        custodian: "Constable Amit Yadav",
        impactReason: "Equipment locked inside secured vehicular locker during maintenance transit.",
        severity: "HIGH",
      });

      // 2. Affected Officers
      affectedOfficers.push(
        {
          id: "sim-off-01",
          name: "Inspector Rajesh Sharma",
          role: "Investigating Officer (IO)",
          station: "Kotwali Police Station",
          assignedAssetsCount: 3,
          activeCasesCount: 4,
          dutyImpact: "Cannot transport ballistic physical exhibit to District Courtroom 4 for scheduled 11:30 AM trial.",
          recommendedSubstitute: "Sub-Inspector Deepak Sharma (Designated Link Officer)",
        },
        {
          id: "sim-off-02",
          name: "Constable Mahendra Yadav",
          role: "Police Escort Driver",
          station: "District Police Lines",
          assignedAssetsCount: 1,
          activeCasesCount: 0,
          dutyImpact: "Grounded at motor pool; scheduled transit schedule invalid.",
          recommendedSubstitute: "Reserve Driver ASI Vinod Kumar (Vehicle VH-1048)",
        },
      );

      // 3. Affected Cases
      affectedCases.push(
        {
          caseId: "sim-case-01",
          caseNumber: "BNS/2026/0014",
          caseTitle: "State (NCT of Delhi) vs. Rakesh Kumar & Ors.",
          stage: "Prosecution Evidence (P.E.)",
          category: "Criminal (Bharatiya Nyaya Sanhita)",
          scheduledHearingDate: input.simulatedDate || "Tomorrow (11:30 AM)",
          hearingCourtroom: "Courtroom 4 (Additional Sessions Judge)",
          judgeName: "Hon'ble Judge Ananya Deshmukh",
          adjournmentRisk: "HIGH_RISK_OF_ADJOURNMENT",
          riskRationale: "Primary weapon exhibit cannot reach courtroom before hearing commencement. Defence counsel likely to press for dismissal or adjournment.",
        },
        {
          caseId: "sim-case-02",
          caseNumber: "NDPS/2026/0089",
          caseTitle: "Narcotics Control Bureau vs. Tarun Mehra",
          stage: "Cross Examination of Chemical Examiner",
          category: "Special Acts (NDPS)",
          scheduledHearingDate: "In 2 Days (02:00 PM)",
          hearingCourtroom: "Courtroom 2 (Special NDPS Court)",
          judgeName: "Hon'ble Judge Vikramaditya Sen",
          adjournmentRisk: "MODERATE_DELAY",
          riskRationale: "Delayed delivery of chemical lab certificate; witness testimony may need to be rescheduled to afternoon roll.",
        },
      );

      // 4. Affected Evidence
      affectedEvidence.push({
        id: "sim-evid-01",
        assetCode: "POL-2026-WPN-0042",
        name: "9mm Semi-Automatic Service Pistol (Exhibit A-1)",
        tamperSealNumber: "COURT-EV-8841-B",
        currentStatus: "STRANDED_IN_TRANSIT",
        storageLocation: `Vehicle ${vehicleCode} Secure Transit Box`,
        chainOfCustodyRisk: "Chain of custody continuity interrupted due to unscheduled transport breakdown.",
        admissibilityConcern: "Defence may challenge Section 63 BSA transit integrity if delay exceeds scheduled delivery manifest.",
      });

      // 5. Affected Documents
      affectedDocuments.push(
        {
          id: "sim-doc-01",
          documentNumber: "DOC-2026-0001",
          title: "FIR No. 74/2026 Kotwali & Seizure Memo",
          category: "Seizure Memo",
          caseNumber: "BNS/2026/0014",
          sha256: "8e23b094f2910ba45a6c78e129304cbe65109b841a0293ec9481bcae0192384a",
          documentImpact: "Original paper panchnama memo physically tied to transit escort envelope.",
        },
        {
          id: "sim-doc-02",
          documentNumber: "DOC-2026-0010",
          title: "FSL Ballistic Examination Report",
          category: "Forensic Report",
          caseNumber: "BNS/2026/0014",
          sha256: "4c902834bc01928340192bc840192834bca01923840129bc840192381290384b",
          documentImpact: "Physical copy pending delivery; digital certified copy exists in NyayaSetu Secure DMS.",
        },
      );

      // 6. Recommended Alternatives
      recommendedAlternatives.push(
        {
          id: "rec-alt-01",
          category: "ASSET_SUBSTITUTION",
          title: "Dispatch Reserve Pool Vehicle VH-1048 (Mahindra Scorpio)",
          description: "Immediately re-route reserve escort vehicle VH-1048 stationed at Central Police Lines to take over transit duties.",
          actionSteps: [
            "Log into Police Asset Fleet and assign Reserve Unit VH-1048 to ASI Vinod Kumar.",
            "Inspect and document intact tamper seal #COURT-EV-8841-B before transferring to new vehicle.",
            "Execute signed digital custody handover receipt in NyayaSetu Mobile Malkhana App.",
          ],
          feasibilityScore: 95,
          priority: "CRITICAL",
          resourceAssigned: "Vehicle VH-1048 (Driver: ASI Vinod Kumar)",
          complianceNotes: "Complies with Standing Order 24/2025 on emergency inter-district police transport.",
        },
        {
          id: "rec-alt-02",
          category: "HEARING_MITIGATION",
          title: "Submit Cryptographically Certified Electronic Copy to Courtroom 4",
          description: "To prevent adjournment under Section 63 BSA, electronically submit the SHA-256 verified digital exhibit document directly to the presiding judge's bench portal.",
          actionSteps: [
            "Registrar uploads signed Section 63 BSA certificate for DOC-2026-0010.",
            "Transmit digital exhibit to Courtroom 4 Bench Screen before 11:30 AM roll call.",
            "Petition presiding judge to commence examination based on digital electronic record while physical exhibit arrives.",
          ],
          feasibilityScore: 90,
          priority: "HIGH",
          resourceAssigned: "NyayaSetu Bench Portal (Judge Deshmukh)",
          complianceNotes: "Admissible under Section 63, Bharatiya Sakshya Adhiniyam, 2023.",
        },
      );
      break;
    }

    case "locker-unavailable": {
      const lockerLocation = input.targetLockerLocation || "Locker L-12 (Central Malkhana High-Security Vault)";
      summary = `Simulation: ${lockerLocation} is unavailable due to an electronic biometric lock mechanism failure. 4 physical exhibits (weapons & cash) cannot be accessed, stalling 3 criminal proceedings.`;

      // 1. Affected Assets
      affectedAssets.push(
        {
          id: "sim-ast-lock-01",
          assetCode: "POL-MALK-L12",
          name: lockerLocation,
          categoryName: "Malkhana Secure Vaults & Lockers",
          status: "LOCKED_OUT (SIMULATED)",
          evidenceStatus: "STORED",
          location: "Central Malkhana Wing A, District Courts Complex",
          custodian: "Head Constable Ramesh Chand (Malkhana Moharrir)",
          impactReason: "Electronic solenoid sensor failure; biometric authorization terminal offline.",
          severity: "CRITICAL",
        },
        {
          id: "sim-ast-wpn-02",
          assetCode: "POL-2026-WPN-0042",
          name: "9mm Semi-Automatic Service Pistol (Exhibit A-1)",
          categoryName: "Firearms, Weapons & Ballistics",
          status: "INACCESSIBLE_INSIDE_LOCKER",
          evidenceStatus: "STORED",
          location: lockerLocation,
          custodian: "Head Constable Ramesh Chand",
          impactReason: "Trapped inside locked compartment; cannot be produced for witness identification.",
          severity: "CRITICAL",
        },
        {
          id: "sim-ast-val-03",
          assetCode: "POL-2026-VAL-0104",
          name: "Seized Currency Notes (₹14,50,000 in Hawala Proceeds)",
          categoryName: "Seized Currency & Valuable Property",
          status: "INACCESSIBLE_INSIDE_LOCKER",
          evidenceStatus: "STORED",
          location: lockerLocation,
          custodian: "Head Constable Ramesh Chand",
          impactReason: "Required for physical inspection by currency verification magistrate.",
          severity: "HIGH",
        },
      );

      // 2. Affected Officers
      affectedOfficers.push(
        {
          id: "sim-off-lock-01",
          name: "Head Constable Ramesh Chand",
          role: "Malkhana Moharrir (Vault Custodian)",
          station: "Central District Malkhana",
          assignedAssetsCount: 14,
          activeCasesCount: 12,
          dutyImpact: "Cannot open vault door to retrieve case property for morning court schedule.",
          recommendedSubstitute: "Inspector Harish Chander (Station House Custody Supervisor)",
        },
        {
          id: "sim-off-lock-02",
          name: "Sub-Inspector Deepak Sharma",
          role: "Court Liaison Officer",
          station: "Kotwali Police Station",
          assignedAssetsCount: 2,
          activeCasesCount: 5,
          dutyImpact: "Unable to produce physical exhibits before Trial Judge in Courtroom 3.",
          recommendedSubstitute: "Inspector Rajesh Sharma",
        },
      );

      // 3. Affected Cases
      affectedCases.push(
        {
          caseId: "sim-case-lock-01",
          caseNumber: "CRL-0002/2026",
          caseTitle: "State vs. Gurpreet Singh @ Sunny",
          stage: "Framing of Charges / Exhibit Confirmation",
          category: "Criminal (Arms Act)",
          scheduledHearingDate: input.simulatedDate || "Today (11:00 AM)",
          hearingCourtroom: "Courtroom 3 (Chief Judicial Magistrate)",
          judgeName: "Hon'ble Judge Rajiv Nanda",
          adjournmentRisk: "HIGH_RISK_OF_ADJOURNMENT",
          riskRationale: "Charge framing requires judicial inspection of weapon serial IOF-9MM-2021-994. Inability to produce exhibit forces hearing adjournment.",
        },
        {
          caseId: "sim-case-lock-02",
          caseNumber: "PMLA/2026/0019",
          caseTitle: "Enforcement Directorate vs. S. K. Gupta",
          stage: "Valuation of Seized Currency Proceeds",
          category: "Economic Offences",
          scheduledHearingDate: "Tomorrow (02:30 PM)",
          hearingCourtroom: "Courtroom 1 (Special Sessions Judge)",
          judgeName: "Hon'ble Judge Meenakshi Sundaram",
          adjournmentRisk: "MODERATE_DELAY",
          riskRationale: "Magistrate verification of cash bundles will be postponed if locker remains sealed past 24 hours.",
        },
      );

      // 4. Affected Evidence
      affectedEvidence.push(
        {
          id: "sim-evid-lock-01",
          assetCode: "POL-2026-WPN-0042",
          name: "9mm Semi-Automatic Service Pistol #IOF-9MM-2021-994",
          tamperSealNumber: "COURT-EV-8841-B",
          currentStatus: "STORED",
          storageLocation: lockerLocation,
          chainOfCustodyRisk: "Vault inaccessible; custody cannot be verified physically without manual override.",
          admissibilityConcern: "None as seal remains intact, but availability at trial is impeded.",
        },
        {
          id: "sim-evid-lock-02",
          assetCode: "POL-2026-VAL-0104",
          name: "Seized Currency Notes ₹14.5 Lakhs (Packets 1-14)",
          tamperSealNumber: "ED-SEAL-2026-902",
          currentStatus: "STORED",
          storageLocation: lockerLocation,
          chainOfCustodyRisk: "Tamper seal intact inside safe vault.",
          admissibilityConcern: "Delayed physical production before registrar.",
        },
      );

      // 5. Affected Documents
      affectedDocuments.push({
        id: "sim-doc-lock-01",
        documentNumber: "DOC-2026-0004",
        title: "Confessional Statement & Arms Seizure Memo",
        category: "Witness Statement",
        caseNumber: "CRL-0002/2026",
        sha256: "7820ba94c1209384bc01928340129bc840192834bca01923840129bc84019238",
        documentImpact: "Reference annexure list points to exhibit currently locked in Locker L-12.",
      });

      // 6. Recommended Alternatives
      recommendedAlternatives.push(
        {
          id: "rec-alt-lock-01",
          category: "VAULT_REALLOCATION",
          title: "Execute Dual-Key Manual Override & Re-locate to Locker L-14 (Wing B)",
          description: "Initiate emergency dual-custodian manual mechanical key protocol in the presence of SDM/Judicial Magistrate and CCTV recording.",
          actionSteps: [
            "Summon Dual-Key holders (Malkhana Moharrir + Station ACP).",
            "Engage mechanical override under continuous high-definition video recording.",
            "Transfer exhibits to redundant tamper-proof locker L-14 in Malkhana Wing B.",
            "Generate digital signature approval and update asset locations in NyayaSetu.",
          ],
          feasibilityScore: 92,
          priority: "CRITICAL",
          resourceAssigned: "Locker L-14 (Dual Key: Insp. Chander & HC Chand)",
          complianceNotes: "In accordance with Delhi High Court Malkhana Rules Rule 14(b) on emergency vault access.",
        },
        {
          id: "rec-alt-lock-02",
          category: "HEARING_MITIGATION",
          title: "Formal Registrar Memo & Hearing Passover to 02:00 PM",
          description: "Issue an automated verified memo to Chief Judicial Magistrate Rajiv Nanda requesting hearing passover to afternoon session.",
          actionSteps: [
            "Auto-generate Digital Twin Locker Downtime Certificate.",
            "Submit to CJM Courtroom 3 Reader before 10:30 AM roll call.",
            "Pass over trial matter to 02:00 PM session to allow manual locker extraction.",
          ],
          feasibilityScore: 88,
          priority: "HIGH",
          resourceAssigned: "CJM Courtroom 3 Reader Desk",
          complianceNotes: "Prevents formal case adjournment and avoids statutory delay penalty.",
        },
      );
      break;
    }

    case "officer-on-leave": {
      const officerName = input.targetOfficerName || "Insp. Rajesh Sharma";
      summary = `Simulation: ${officerName} goes on unexpected emergency leave. 4 active criminal investigations, 3 scheduled court testimonies, and 2 checked-out service firearms require immediate custodial transfer.`;

      // 1. Affected Assets
      affectedAssets.push(
        {
          id: "sim-ast-off-01",
          assetCode: "AST-001",
          name: "Glock 17 9mm Gen 5 Service Pistol (Issued)",
          categoryName: "Firearms, Weapons & Ballistics",
          status: "HELD_BY_LEAVING_OFFICER",
          evidenceStatus: null,
          location: "Personal Duty Armory Holster",
          custodian: officerName,
          impactReason: "Service weapon must be returned to armory before officer proceeds on leave.",
          severity: "HIGH",
        },
        {
          id: "sim-ast-off-02",
          assetCode: "POL-2026-TAC-0550",
          name: "Axon Body 3 Police Body Camera",
          categoryName: "Communications & Tactical Gear",
          status: "ASSIGNED",
          evidenceStatus: null,
          location: "Kotwali Police Station Duty Room",
          custodian: officerName,
          impactReason: "Body cam docking station upload required for recent patrol footage.",
          severity: "MEDIUM",
        },
      );

      // 2. Affected Officers
      affectedOfficers.push(
        {
          id: "sim-off-leave-01",
          name: officerName,
          role: "Investigating Officer (IO)",
          station: "Kotwali Police Station",
          assignedAssetsCount: 4,
          activeCasesCount: 5,
          dutyImpact: "Unavailable to tender sworn deposition as prosecution witness in Sessions Court.",
          recommendedSubstitute: "Sub-Inspector Deepak Sharma (Designated Link Officer)",
        },
        {
          id: "sim-off-leave-02",
          name: "Sub-Inspector Deepak Sharma",
          role: "Link Investigating Officer",
          station: "Kotwali Police Station",
          assignedAssetsCount: 2,
          activeCasesCount: 3,
          dutyImpact: "Will absorb 3 active case dockets and prepare for trial appearance.",
          recommendedSubstitute: "Primary Designated Substitute",
        },
      );

      // 3. Affected Cases
      affectedCases.push(
        {
          caseId: "sim-case-off-01",
          caseNumber: "BNS/2026/0014",
          caseTitle: "State (NCT of Delhi) vs. Rakesh Kumar & Ors.",
          stage: "Prosecution Witness Deposition (IO Evidence)",
          category: "Homicide / Heinous Crime",
          scheduledHearingDate: input.simulatedDate || "In 3 Days (11:00 AM)",
          hearingCourtroom: "Courtroom 4 (Sessions Judge)",
          judgeName: "Hon'ble Judge Ananya Deshmukh",
          adjournmentRisk: "HIGH_RISK_OF_ADJOURNMENT",
          riskRationale: "IO testimony cannot be completed in absence of original recording officer without formal Link Officer notification.",
        },
        {
          caseId: "sim-case-off-02",
          caseNumber: "NDPS/2026/0089",
          caseTitle: "Narcotics Control Bureau vs. Tarun Mehra",
          stage: "Supplementary Charge Sheet Filing Deadline",
          category: "Special Acts",
          scheduledHearingDate: "In 5 Days (04:00 PM)",
          hearingCourtroom: "Courtroom 2 (Special NDPS Court)",
          judgeName: "Hon'ble Judge Vikramaditya Sen",
          adjournmentRisk: "MODERATE_DELAY",
          riskRationale: "Supplementary charge sheet requires digital signature endorsement under Section 63 BSA before statutory 90-day filing cutoff.",
        },
      );

      // 4. Affected Evidence
      affectedEvidence.push({
        id: "sim-evid-off-01",
        assetCode: "POL-2026-BIO-0932",
        name: "Sterile DNA Swab Specimen Collection Kit #4",
        tamperSealNumber: "FORENSIC-CRYO-9011",
        currentStatus: "STORED",
        storageLocation: "Cold Storage Biological Vault B-2",
        chainOfCustodyRisk: "Chain of custody requires signature handover from leaving IO to Link IO.",
        admissibilityConcern: "Ensure dual signature endorsement under BSA Section 63.",
      });

      // 5. Affected Documents
      affectedDocuments.push(
        {
          id: "sim-doc-off-01",
          documentNumber: "DOC-2026-0002",
          title: "Supplementary Charge Sheet Draft (v2)",
          category: "Charge Sheet",
          caseNumber: "BNS/2026/0014",
          sha256: "1948ba0248c02b918a03c81290384b01e29084cba0123984cae981203847a02b",
          documentImpact: "Pending final digital signature endorsement by leaving IO.",
        },
        {
          id: "sim-doc-off-02",
          documentNumber: "DOC-2026-0007",
          title: "Bail Rejection Opposition Brief",
          category: "Legal Notice",
          caseNumber: "NDPS/2026/0089",
          sha256: "3fa85f647c92b8d910a2bc8e72ef0192a48b301c23f1a0e98345719082bc3411",
          documentImpact: "Opposition affidavit requires verification by designated link officer.",
        },
      );

      // 6. Recommended Alternatives
      recommendedAlternatives.push(
        {
          id: "rec-alt-off-01",
          category: "OFFICER_REASSIGNMENT",
          title: "Designate Sub-Inspector Deepak Sharma as Official Link IO",
          description: "Execute immediate administrative transfer of case dockets to Link IO with digital delegation of signing authority.",
          actionSteps: [
            "Issue Link Officer Order under CrPC Section 36 / BNSS Section 33.",
            "Transfer physical custody of Glock 17 AST-001 back to Kotwali Armory Safe.",
            "Grant Sub-Inspector Deepak Sharma electronic delegation clearance for Case BNS/2026/0014 in NyayaSetu.",
          ],
          feasibilityScore: 94,
          priority: "CRITICAL",
          resourceAssigned: "SI Deepak Sharma (Kotwali Police Station)",
          complianceNotes: "Preserves statutory compliance with BNSS 2023 investigation guidelines.",
        },
        {
          id: "rec-alt-off-02",
          category: "HEARING_MITIGATION",
          title: "File Authorized Representation & Passover Application in Courtroom 4",
          description: "Submit Link Officer notification to Judge Deshmukh and apply for 5-day postponement of IO witness deposition while examining other public witnesses.",
          actionSteps: [
            "Generate NyayaSetu Link IO Appearance Memo.",
            "Serve notice on defense counsel 24 hours prior to scheduled hearing.",
            "Examine prosecution witness PW-2 (Eye Witness) in the interim slot to prevent courtroom idle time.",
          ],
          feasibilityScore: 89,
          priority: "HIGH",
          resourceAssigned: "Courtroom 4 Bench Register",
          complianceNotes: "Avoids wasted courtroom hours and maintains 90%+ courtroom utilisation KPI.",
        },
      );
      break;
    }

    case "transfer-delayed": {
      const delayHours = input.delayHours || 48;
      const transferRef = input.targetTransferId || "TRF-NDPS-89";
      summary = `Simulation: Inter-station evidence transit ${transferRef} is delayed by ${delayHours} hours due to highway blockage / FSL laboratory admission queue. Risk of evidence degradation and hearing postponement in NDPS Special Court.`;

      // 1. Affected Assets
      affectedAssets.push({
        id: "sim-ast-trf-01",
        assetCode: "POL-2026-NC-0078",
        name: "Seized Psychotropic Contraband Consignment (4.8 kg)",
        categoryName: "Narcotics & Contraband",
        status: "TRANSFERRED (IN_TRANSIT)",
        evidenceStatus: "TRANSFERRED",
        location: `Transit Corridor NH-44 (Delayed by ${delayHours}h)`,
        custodian: "Sub-Inspector Sandeep Nain (Escort Commander)",
        impactReason: `High-priority exhibit stalled in transit; scheduled delivery missed by ${delayHours} hours.`,
        severity: "CRITICAL",
      });

      // 2. Affected Officers
      affectedOfficers.push(
        {
          id: "sim-off-trf-01",
          name: "Sub-Inspector Sandeep Nain",
          role: "Transit Escort Officer",
          station: "Crime Branch Narcotic Squad",
          assignedAssetsCount: 2,
          activeCasesCount: 2,
          dutyImpact: `Delayed on highway; unable to return to station for scheduled patrol.`,
          recommendedSubstitute: "Station Duty Officer Inspector V. K. Rao",
        },
        {
          id: "sim-off-trf-02",
          name: "Dr. Sunita Rao",
          role: "Senior Forensic Analyst",
          station: "Forensic Science Laboratory (FSL) Rohini",
          assignedAssetsCount: 1,
          activeCasesCount: 4,
          dutyImpact: "Cannot begin chemical purity assay without physical parcel inspection.",
          recommendedSubstitute: "Lab Assistant Examiner Mr. P. Sharma",
        },
      );

      // 3. Affected Cases
      affectedCases.push({
        caseId: "sim-case-trf-01",
        caseNumber: "NDPS/2026/0089",
        caseTitle: "Narcotics Control Bureau vs. Tarun Mehra",
        stage: "Bail Hearing / Quantitative Purity Determination",
        category: "Special Acts (NDPS)",
        scheduledHearingDate: input.simulatedDate || "In 2 Days (02:00 PM)",
        hearingCourtroom: "Courtroom 2 (Special NDPS Court)",
        judgeName: "Hon'ble Judge Vikramaditya Sen",
        adjournmentRisk: "HIGH_RISK_OF_ADJOURNMENT",
        riskRationale: "Under NDPS Section 37, bail adjudication hinges on whether contraband is of commercial quantity. Missing chemical purity certificate forces adjournment.",
      });

      // 4. Affected Evidence
      affectedEvidence.push({
        id: "sim-evid-trf-01",
        assetCode: "POL-2026-NC-0078",
        name: "Seized Psychotropic Contraband Consignment (4.8 kg)",
        tamperSealNumber: "MHA-NARCO-SEAL-9982",
        currentStatus: "TRANSFERRED",
        storageLocation: "Mobile Secured Transit Safe (Lock Box #2)",
        chainOfCustodyRisk: `Delayed acknowledgment: Transit window extended by ${delayHours} hours without destination receipt sign-off.`,
        admissibilityConcern: "Possibility of defense arguing compromised custody if temperature control is breached.",
      });

      // 5. Affected Documents
      affectedDocuments.push({
        id: "sim-doc-trf-01",
        documentNumber: "DOC-2026-0010",
        title: "Interim Panchnama & Transit Custody Manifest #TRF-NDPS-89",
        category: "Chain of Custody Document",
        caseNumber: "NDPS/2026/0089",
        sha256: "9b3c4f92d8e04b1c738e4a921d7b38c201a4e591283c704f128e903bc148293a",
        documentImpact: `Receipt acknowledgment pending; transit duration exceeded normal SLA by ${delayHours}h.`,
      });

      // 6. Recommended Alternatives
      recommendedAlternatives.push(
        {
          id: "rec-alt-trf-01",
          category: "CHAIN_SAFEGUARD",
          title: "Interim Checkpoint Custody Verification at District Malkhana Sonipat",
          description: "Instruct escort team to check into closest designated government malkhana (Sonipat) to perform interim seal verification and re-secure under refrigerated storage.",
          actionSteps: [
            "Issue Electronic Transit Deviation Clearance via NyayaSetu.",
            "Sonipat Malkhana Custodian inspects tamper seal #MHA-NARCO-SEAL-9982.",
            "Record intermediate chain-of-custody verification hash on ledger.",
          ],
          feasibilityScore: 96,
          priority: "CRITICAL",
          resourceAssigned: "District Malkhana Sonipat (Safe Deposit Room)",
          complianceNotes: "Preserves Section 63 BSA electronic admissibility and prevents environmental spoilage.",
        },
        {
          id: "rec-alt-trf-02",
          category: "HEARING_MITIGATION",
          title: "Submit Field Testing Kit (Drug Detection) Report for Interim Hearing",
          description: "Submit preliminary field testing kit memo (already notarized in Secure DMS) to Judge Vikramaditya Sen to maintain bail hearing schedule without delay.",
          actionSteps: [
            "Export digitally signed Field Drug Detection Certificate (DOC-2026-0008).",
            "Present to Special NDPS Court with formal notice of delayed FSL purity report.",
            "Request court to consider preliminary narcotic classification for interim custody purposes.",
          ],
          feasibilityScore: 87,
          priority: "HIGH",
          resourceAssigned: "Special NDPS Courtroom 2",
          complianceNotes: "Complies with Supreme Court guidelines in Mohan Lal vs. State of Punjab.",
        },
      );
      break;
    }

    case "custom":
    default: {
      const assetCode = input.targetAssetCode || "AST-001";
      summary = `Custom Simulation: Modeling operational unavailability for asset ${assetCode}. Identifying interconnected cases, officers, evidence exhibits, and generating alternatives.`;

      // Find matching asset from live list
      const matched = assets.find((a) => a.asset_code === assetCode || a.id === input.targetAssetId);
      const matchedName = matched?.name || `Police Asset ${assetCode}`;
      const matchedLoc = matched?.current_location || "District Police Armory";
      const matchedCust = matched?.current_custodian_name || "Malkhana Moharrir";

      affectedAssets.push({
        id: matched?.id || "sim-cust-01",
        assetCode: matched?.asset_code || assetCode,
        name: matchedName,
        categoryName: matched?.category_name || "General Police Asset",
        status: "UNAVAILABLE (SIMULATED)",
        evidenceStatus: matched?.evidence_status || null,
        location: matchedLoc,
        custodian: matchedCust,
        impactReason: "Targeted operational unavailability modeled in digital twin sandbox.",
        severity: "HIGH",
      });

      affectedOfficers.push({
        id: "sim-off-cust-01",
        name: matchedCust,
        role: "Primary Assigned Custodian",
        station: matched?.department_station || "Central Police Station",
        assignedAssetsCount: 3,
        activeCasesCount: 2,
        dutyImpact: "Primary resource unavailable for active duty schedule.",
        recommendedSubstitute: "Station Duty Officer",
      });

      affectedCases.push({
        caseId: matched?.case_id || "sim-case-cust-01",
        caseNumber: matched?.case_number || matched?.fir_number || "BNS/2026/0014",
        caseTitle: matched?.case_title || "State vs. Primary Accused",
        stage: "Active Trial Proceeding",
        category: "Criminal Investigation",
        scheduledHearingDate: input.simulatedDate || "Upcoming Listed Hearing",
        hearingCourtroom: "District Courtroom 3",
        judgeName: "Presiding Judicial Magistrate",
        adjournmentRisk: "MODERATE_DELAY",
        riskRationale: "Operational asset unavailability may delay evidence production or officer appearance.",
      });

      if (matched?.evidence_status) {
        affectedEvidence.push({
          id: matched.id,
          assetCode: matched.asset_code,
          name: matched.name,
          tamperSealNumber: matched.tamper_seal_number || "SEAL-VERIFIED",
          currentStatus: matched.evidence_status,
          storageLocation: matchedLoc,
          chainOfCustodyRisk: "Resource unavailable for scheduled court presentation.",
          admissibilityConcern: "Verify continuous custody continuity log.",
        });
      }

      // Check for related documents
      const relatedDocs = docs.filter(
        (d) => d.case_number === matched?.case_number || d.title.includes(assetCode),
      );
      if (relatedDocs.length > 0) {
        for (const rd of relatedDocs.slice(0, 2)) {
          affectedDocuments.push({
            id: rd.id,
            documentNumber: rd.document_number,
            title: rd.title,
            category: rd.category,
            caseNumber: rd.case_number || null,
            sha256: rd.latest_sha256,
            documentImpact: "Case document referenced to unavailable equipment.",
          });
        }
      } else {
        affectedDocuments.push({
          id: "sim-doc-cust-01",
          documentNumber: "DOC-2026-0001",
          title: "Primary Case Exhibit Registry Document",
          category: "Evidence Record",
          caseNumber: "BNS/2026/0014",
          sha256: "8e23b094f2910ba45a6c78e129304cbe65109b841a0293ec9481bcae0192384a",
          documentImpact: "Electronic manifest linked to simulated equipment.",
        });
      }

      recommendedAlternatives.push({
        id: "rec-alt-cust-01",
        category: "ASSET_SUBSTITUTION",
        title: `Reallocate Standby Reserve Asset for ${assetCode}`,
        description: `Deploy designated reserve standby resource from station armory inventory to replace ${assetCode}.`,
        actionSteps: [
          `Identify available standby unit in category ${matched?.category_name || "Assets"}.`,
          "Record digital custody handover in NyayaSetu mobile portal.",
          "Notify court liaison officer of substituted serial reference.",
        ],
        feasibilityScore: 91,
        priority: "HIGH",
        resourceAssigned: "Station Reserve Inventory",
        complianceNotes: "Maintains operational continuity and complies with trial schedules.",
      });
      break;
    }
  }

  // Calculate high-risk adjournment count
  const highRiskCount = affectedCases.filter(
    (c) => c.adjournmentRisk === "HIGH_RISK_OF_ADJOURNMENT",
  ).length;

  const disruptionIndex =
    highRiskCount >= 2 || affectedAssets.length >= 3
      ? "SEVERE"
      : affectedCases.length >= 1
        ? "ELEVATED"
        : "MANAGEABLE";

  return {
    isSimulationOnly: true,
    scenario: input,
    summary,
    simulatedAt: now,
    affectedAssets,
    affectedOfficers,
    affectedCases,
    affectedEvidence,
    affectedDocuments,
    recommendedAlternatives,
    metrics: {
      totalAssetsAffected: affectedAssets.length,
      totalOfficersAffected: affectedOfficers.length,
      totalCasesAffected: affectedCases.length,
      totalEvidenceAffected: affectedEvidence.length,
      totalDocumentsAffected: affectedDocuments.length,
      highRiskAdjournmentCount: highRiskCount,
      overallDisruptionIndex: disruptionIndex,
    },
  };
}
