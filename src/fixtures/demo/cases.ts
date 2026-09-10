/**
 * DEMO FIXTURES ONLY
 *
 * This file contains mock and seed case records intended strictly for development,
 * testing, and explicit DEMO_MODE demonstrations.
 *
 * ARCHITECTURAL RULE:
 * Under NO circumstances should these records be returned in production queries,
 * unshifted into production data, or used as silent fallbacks when database queries fail.
 */

import type { CaseRow } from "@/lib/cases";

export const SEED_CASE_BNS_0014: CaseRow = {
  id: "case-bns-0014",
  case_number: "BNS/2026/0014",
  cnr_number: "DLCT02-000014-2026",
  category_id: "cat-crim-01",
  filing_date: "2026-02-14",
  status: "scheduled",
  parties: "State of NCT vs. Aman Sharma & Ors.",
  estimated_duration_minutes: 60,
  predicted_duration_minutes: 60,
  adjournment_risk_score: 25,
  pending_duration_days: 22,
  previous_adjournments: 0,
  priority_score: 88,
  priority_tier: "Tier 1",
  legal_priority_flag: true,
  is_ftsc_pocso: false,
  senior_citizen_litigant: false,
  property_dispute_5yr_plus: false,
  statutory_limitation_deadline: "2026-08-14",
  created_at: "2026-02-14T09:00:00Z",
  is_example: true,
  example_order: 1,
  example_label: "BNS Organized Crime & Digital Evidence Case",
  example_note:
    "High priority case featuring Exhibit EV-1045, EV-1046, and Section 63 BSA Digital Signature",
  case_categories: { id: "cat-crim-01", name: "Criminal (BNS)", urgency_weight: 1.5 },
};
