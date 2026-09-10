/**
 * NYAYASETU DEMO & TEST FIXTURES REGISTRY
 *
 * ARCHITECTURAL MANDATE:
 * Browser storage and in-memory mock datasets are NEVER authoritative for legal
 * records, evidence, documents, custody, permissions, or audit history.
 *
 * All exports in this module are strictly for:
 * 1. Explicit DEMO_MODE runs (e.g. hackathon demonstration, local offline UX preview).
 * 2. Automated unit and integration testing.
 *
 * In production builds, these fixtures MUST NOT be merged, unshifted, or returned
 * as silent fallbacks for empty or failed database queries.
 */

export * from "./demo/cases";
export * from "./demo/assets";
export * from "./demo/documents";
export * from "./demo/audit";
export * from "./demo/officers";
export * from "./demo/locations";
export * from "./demo/staff";
