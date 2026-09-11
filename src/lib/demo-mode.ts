/**
 * Browser storage is never authoritative for legal records, evidence, documents, custody, permissions, or audit history.
 *
 * NyayaSetu Demo & Fixture Mode Configuration
 * When DEMO_MODE or VITE_DEMO_MODE is true, mock fixtures may be presented for demonstration or testing.
 * In production (default: false), data is strictly queried and persisted via authoritative Supabase / R2 layers.
 */

export function isDemoMode(): boolean {
  try {
    // 1. Check client-side Vite import.meta.env
    if (typeof import.meta !== "undefined" && import.meta.env) {
      const metaDemo = import.meta.env["VITE_DEMO_MODE"] ?? import.meta.env["DEMO_MODE"];
      if (metaDemo === true || metaDemo === "true" || metaDemo === "1") {
        return true;
      }
    }

    // 2. Check Node/server-side process.env
    if (typeof process !== "undefined" && process.env) {
      const procDemo = process.env["DEMO_MODE"] ?? process.env["VITE_DEMO_MODE"];
      if (procDemo === "true" || procDemo === "1") {
        return true;
      }
    }
  } catch {
    // Fall back strictly to production mode on any evaluation error
    return false;
  }

  // Strict architectural guarantee: default to false in all environments
  return false;
}
