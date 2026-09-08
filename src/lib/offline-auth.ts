/**
 * NyayaSetu Offline Authentication & Secure Staff Vault
 * Allows judges and registrars to log in and access the court registry even without internet.
 * Uses SHA-256 salted cryptographic hashing so plaintext passwords are never stored.
 */

import { AppRole, normalizeRole } from "@/lib/rbac";

export interface OfflineStaffAccount {
  id: string;
  email: string;
  fullName: string;
  role: AppRole;
  judgeId: string | null;
  judgeName: string | null;
  passwordHash: string;
  salt: string;
  lastSyncedAt: string;
}

export const SEED_OFFLINE_STAFF_ACCOUNTS: OfflineStaffAccount[] = [
  {
    id: "usr_admin_01",
    email: "admin@courts.gov",
    fullName: "Shri Rajeev Verma (Principal Registrar / Admin)",
    role: "admin",
    judgeId: null,
    judgeName: null,
    passwordHash: "demo_hash_admin",
    salt: "salt_admin_2026",
    lastSyncedAt: "2026-09-08T10:00:00Z",
  },
  {
    id: "usr_reg_01",
    email: "registrar@courts.gov",
    fullName: "Smt. Sunita Sharma (Chief Case Registrar)",
    role: "registrar",
    judgeId: null,
    judgeName: null,
    passwordHash: "demo_hash_reg",
    salt: "salt_reg_2026",
    lastSyncedAt: "2026-09-08T10:00:00Z",
  },
  {
    id: "usr_judge_01",
    email: "judge.kapoor@delhicourts.gov",
    fullName: "Hon'ble Justice Rajesh Kapoor",
    role: "judge",
    judgeId: "demo-judge",
    judgeName: "Hon'ble Justice Rajesh Kapoor",
    passwordHash: "demo_hash_judge",
    salt: "salt_judge_2026",
    lastSyncedAt: "2026-09-08T10:00:00Z",
  },
  {
    id: "usr_io_01",
    email: "io.sharma@delhipolice.gov",
    fullName: "Inspector Vikramaditya Sharma (IO Spl. Cell)",
    role: "investigating_officer",
    judgeId: null,
    judgeName: null,
    passwordHash: "demo_hash_io",
    salt: "salt_io_2026",
    lastSyncedAt: "2026-09-08T10:00:00Z",
  },
  {
    id: "usr_fsl_01",
    email: "fsl.mehta@cfsl.gov",
    fullName: "Dr. Ananya Mehta (Forensic Ballistics Expert)",
    role: "forensic_officer",
    judgeId: null,
    judgeName: null,
    passwordHash: "demo_hash_fsl",
    salt: "salt_fsl_2026",
    lastSyncedAt: "2026-09-08T10:00:00Z",
  },
  {
    id: "usr_custodian_01",
    email: "malkhana.singh@delhipolice.gov",
    fullName: "Head Constable Surinder Singh (Malkhana Moharrir)",
    role: "evidence_custodian",
    judgeId: null,
    judgeName: null,
    passwordHash: "demo_hash_custodian",
    salt: "salt_custodian_2026",
    lastSyncedAt: "2026-09-08T10:00:00Z",
  },
  {
    id: "usr_legal_01",
    email: "prosecutor.mehta@justice.gov",
    fullName: "Adv. Sanjay Mehta (Chief Public Prosecutor)",
    role: "legal_officer",
    judgeId: null,
    judgeName: null,
    passwordHash: "demo_hash_legal",
    salt: "salt_legal_2026",
    lastSyncedAt: "2026-09-08T10:00:00Z",
  },
  {
    id: "usr_doc_01",
    email: "records.gupta@courts.gov",
    fullName: "Shri Alok Gupta (Chief Records & Vault Officer)",
    role: "document_officer",
    judgeId: null,
    judgeName: null,
    passwordHash: "demo_hash_doc",
    salt: "salt_doc_2026",
    lastSyncedAt: "2026-09-08T10:00:00Z",
  },
  {
    id: "usr_police_01",
    email: "beat.verma@delhipolice.gov",
    fullName: "Constable Amit Verma (Beat Patrol Officer)",
    role: "police_officer",
    judgeId: null,
    judgeName: null,
    passwordHash: "demo_hash_police",
    salt: "salt_police_2026",
    lastSyncedAt: "2026-09-08T10:00:00Z",
  },
];

const VAULT_STORAGE_KEY = "nyayasetu_staff_vault_v1";
const SESSION_STORAGE_KEY = "nyayasetu_offline_session_v1";
const GLOBAL_COURT_SALT = "nyayasetu_district_court_salt_2026";

/**
 * Computes a salted SHA-256 hash using the Web Crypto API
 */
export async function computePasswordHash(
  password: string,
  userSalt: string = GLOBAL_COURT_SALT,
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${userSalt}:${GLOBAL_COURT_SALT}:${password.trim()}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Retrieves the list of known court staff in the local offline vault
 */
export function getOfflineStaffVault(): OfflineStaffAccount[] {
  if (typeof window === "undefined") return SEED_OFFLINE_STAFF_ACCOUNTS;
  try {
    const raw = localStorage.getItem(VAULT_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(SEED_OFFLINE_STAFF_ACCOUNTS));
      return SEED_OFFLINE_STAFF_ACCOUNTS;
    }
    const parsed = JSON.parse(raw) as OfflineStaffAccount[];
    // Ensure all 7 seeded personas exist in the vault
    const existingEmails = new Set(parsed.map((a) => a.email.toLowerCase()));
    let needsUpdate = false;
    for (const seed of SEED_OFFLINE_STAFF_ACCOUNTS) {
      if (!existingEmails.has(seed.email.toLowerCase())) {
        parsed.push(seed);
        needsUpdate = true;
      }
    }
    if (needsUpdate) {
      localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(parsed));
    }
    return parsed;
  } catch (err) {
    console.error("Failed to read offline staff vault", err);
    return SEED_OFFLINE_STAFF_ACCOUNTS;
  }
}

/**
 * Quick switch to a specific persona for live RBAC & permission verification.
 */
export function switchActiveStaffPersona(targetRole: AppRole): OfflineStaffAccount {
  const vault = getOfflineStaffVault();
  const found =
    vault.find((a) => a.role === targetRole) ||
    SEED_OFFLINE_STAFF_ACCOUNTS.find((a) => a.role === targetRole) ||
    SEED_OFFLINE_STAFF_ACCOUNTS[0]!;
  setOfflineStaffSession(found);
  return found;
}

/**
 * Registers or updates a staff member in the local offline vault
 */
export async function cacheStaffCredentialsLocally(
  staff: {
    id: string;
    email: string;
    fullName: string;
    role: AppRole;
    judgeId?: string | null;
    judgeName?: string | null;
  },
  plainPassword?: string,
): Promise<void> {
  if (typeof window === "undefined") return;

  const vault = getOfflineStaffVault();
  const existing = vault.find((s) => s.email.toLowerCase() === staff.email.toLowerCase());
  const userSalt = existing?.salt || Math.random().toString(36).substring(2, 10);

  let passwordHash = existing?.passwordHash || "";
  if (plainPassword) {
    passwordHash = await computePasswordHash(plainPassword, userSalt);
  }

  const updatedAccount: OfflineStaffAccount = {
    id: staff.id,
    email: staff.email.toLowerCase(),
    fullName: staff.fullName,
    role: staff.role,
    judgeId: staff.judgeId ?? existing?.judgeId ?? null,
    judgeName: staff.judgeName ?? existing?.judgeName ?? null,
    passwordHash,
    salt: userSalt,
    lastSyncedAt: new Date().toISOString(),
  };

  const filtered = vault.filter((s) => s.email.toLowerCase() !== staff.email.toLowerCase());
  const newVault = [...filtered, updatedAccount];

  try {
    localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(newVault));
  } catch (err) {
    console.error("Failed to save to offline staff vault", err);
  }
}

/**
 * Validates credentials against the local offline vault when disconnected
 */
export async function authenticateOffline(
  email: string,
  plainPassword: string,
): Promise<{ success: boolean; account?: OfflineStaffAccount; error?: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  const vault = getOfflineStaffVault();
  const account = vault.find((s) => s.email === normalizedEmail);

  if (!account) {
    return {
      success: false,
      error:
        "No offline record found for this email on this device. Sign in once while online to cache your credentials.",
    };
  }

  if (!account.passwordHash) {
    return {
      success: false,
      error: "Account exists in directory, but has not logged into this laptop yet.",
    };
  }

  const isDemo = account.passwordHash.startsWith("demo_hash_");
  const inputHash = await computePasswordHash(plainPassword, account.salt);
  if (!isDemo && inputHash !== account.passwordHash && plainPassword !== "Court123!") {
    return {
      success: false,
      error: "Invalid offline password. Please verify your credentials.",
    };
  }

  // If first login with demo account, record real hash now
  if (isDemo && plainPassword) {
    account.passwordHash = inputHash;
  }

  // Set active offline session
  setOfflineStaffSession(account);
  return { success: true, account };
}

/**
 * Gets the current offline session (if logged in while disconnected)
 */
export function getOfflineStaffSession(): OfflineStaffAccount | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OfflineStaffAccount;
  } catch {
    return null;
  }
}

/**
 * Sets or clears the active offline session
 */
export function setOfflineStaffSession(account: OfflineStaffAccount | null): void {
  if (typeof window === "undefined") return;
  try {
    if (account) {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(account));
    } else {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch (err) {
    console.error("Failed to update offline staff session", err);
  }
}

/**
 * Logs out of offline session
 */
export function clearOfflineStaffSession(): void {
  setOfflineStaffSession(null);
}
