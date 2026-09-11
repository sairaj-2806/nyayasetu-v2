/**
 * ============================================================================
 * Cloudflare R2 Private Storage Server Adapter — NyayaSetu Vault
 * ============================================================================
 * Bound to Cloudflare R2 Bucket: `nyayasetu-vault`
 * Cloudflare Worker Binding: `env.VAULT_BUCKET`
 *
 * Security Invariants:
 * 1. The R2 bucket is strictly private and never publicly exposed.
 * 2. Zero client-side R2 credentials. All access passes through authenticated worker.
 * 3. Canonical object key schema:
 *    cases/{caseId}/documents/{documentId}/{safeFilename}
 *    Example: cases/NYS-2026-00001/documents/doc_abc123/FIR-001.pdf
 * ============================================================================
 */

export const VAULT_BUCKET_NAME = "nyayasetu-vault";
export const VAULT_BINDING_NAME = "VAULT_BUCKET";

export interface R2PutMetadata {
  documentId?: string | undefined;
  docUuid?: string | undefined;
  caseId?: string | undefined;
  originalFilename?: string | undefined;
  uploadedBy?: string | undefined;
  uploadedAt?: string | undefined;
  sha256?: string | undefined;
  category?: string | undefined;
  sensitivityTier?: string | undefined;
  [key: string]: string | undefined;
}

export interface R2PutOptions {
  httpMetadata?:
    | {
        contentType?: string | undefined;
        contentDisposition?: string | undefined;
        cacheControl?: string | undefined;
      }
    | undefined;
  customMetadata?: R2PutMetadata | undefined;
  sha256?: ArrayBuffer | string | undefined;
}

export interface R2StoredObject {
  key: string;
  size: number;
  etag?: string | undefined;
  uploaded?: Date | undefined;
  httpMetadata?:
    | {
        contentType?: string | undefined;
        contentDisposition?: string | undefined;
        cacheControl?: string | undefined;
      }
    | undefined;
  customMetadata?: Record<string, string> | undefined;
  arrayBuffer: () => Promise<ArrayBuffer>;
  text: () => Promise<string>;
  body?: ReadableStream | null | undefined;
}

/** In-memory fallback cache for local dev / testing environments without miniflare / wrangler */
const _localDevMemoryStore = new Map<
  string,
  {
    bytes: Uint8Array;
    options: R2PutOptions | undefined;
    uploadedAt: Date;
    etag: string;
  }
>();

/**
 * Accesses the live Cloudflare Worker R2Bucket binding `VAULT_BUCKET`.
 * Returns undefined if running outside a Cloudflare Worker environment.
 */
export function getVaultBucket(): any {
  const g = globalThis as Record<string, any>;
  const cfEnv = g["__env__"] as Record<string, any> | undefined;
  const procEnv = (g["process"] as { env?: Record<string, any> } | undefined)?.env;

  return (
    cfEnv?.[VAULT_BINDING_NAME] ||
    g[VAULT_BINDING_NAME] ||
    procEnv?.[VAULT_BINDING_NAME] ||
    (typeof process !== "undefined"
      ? (process.env as Record<string, any>)?.[VAULT_BINDING_NAME]
      : undefined)
  );
}

/**
 * Checks if the production Cloudflare R2 binding is active.
 */
export function isR2BindingActive(): boolean {
  const bucket = getVaultBucket();
  return Boolean(bucket && typeof bucket.put === "function" && typeof bucket.get === "function");
}

/**
 * Sanitizes arbitrary file names before persisting to R2 object keys or metadata:
 * - Decodes URI encoding to prevent traversal bypasses (%2e%2e, %2f, %5c, %00)
 * - Normalizes Unicode using NFKC
 * - Strips directory traversal (../, ..\, /)
 * - Strips ASCII control chars, null bytes, and bidirectional override characters
 * - Replaces whitespace and non-alphanumeric special characters
 * - Enforces safe length limits
 */
export function sanitizeFilename(rawName: string): string {
  if (!rawName || typeof rawName !== "string") return "document.pdf";

  // 1. Decode URI encodings if present to prevent %2e%2e or %2f bypasses
  let decoded = rawName;
  try {
    decoded = decodeURIComponent(rawName);
  } catch {
    decoded = rawName;
  }

  // 2. Unicode normalization (NFKC) & strip control characters, null bytes, bidirectional overrides
  const normalized = decoded
    .normalize("NFKC")
    .replace(/\0/g, "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1F\x7F-\x9F\u200B-\u200D\uFEFF\u202A-\u202E]/g, "")
    // Strip URL-encoded sequences that survived decode
    .replace(/%2e%2e/gi, "")
    .replace(/%2f/gi, "")
    .replace(/%5c/gi, "")
    .replace(/%00/gi, "")
    // Strip leading path traversal or directory components
    .replace(/^.*[\\/]/, "")
    .trim();

  // 3. Replace any repeated dots or path traversal
  const noTraversal = normalized.replace(/\.{2,}/g, ".");

  // 4. Retain only safe alphanumeric, dots, underscores, and hyphens
  const sanitized = noTraversal.replace(/[^a-zA-Z0-9._-]/g, "_");

  // 5. Enforce safe length limit (max 120 chars)
  const capped = sanitized.slice(0, 120);
  return capped || "document.pdf";
}

/**
 * Sanitizes case identifiers for safe R2 hierarchy pathing:
 * E.g. "CR/2024/00491" -> "CR-2024-00491", "NYS-2026-00001" -> "NYS-2026-00001"
 */
export function sanitizeCaseIdForStorage(rawCaseId?: string | null): string {
  if (!rawCaseId || !rawCaseId.trim()) return "unassigned";
  const cleaned = rawCaseId
    .trim()
    .replace(/[/\\]/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned || "unassigned";
}

/**
 * Generates an R2 object key using the mandatory structure:
 * `cases/{caseId}/documents/{documentId}/{versionId}/{generatedObjectId}`
 *
 * Example:
 * `cases/NYS-2026-00001/documents/doc_abc123/v1/9a8b7c6d-5e4f-3a2b-1c0d.pdf`
 */
export function generateR2ObjectKey({
  caseId,
  documentId,
  versionId,
  safeFilename,
  generatedObjectId,
}: {
  caseId?: string | null;
  documentId: string;
  versionId?: string | number | undefined;
  safeFilename?: string | undefined;
  generatedObjectId?: string | undefined;
}): string {
  const safeCase = sanitizeCaseIdForStorage(caseId);
  const cleanDocId = (documentId || "doc_unknown").replace(/[^a-zA-Z0-9_-]/g, "_");
  const ver = versionId ? `v${versionId}` : "v1";

  // Server-generated object ID takes precedence for guaranteed path safety
  if (generatedObjectId) {
    const cleanObjId = generatedObjectId.replace(/[^a-zA-Z0-9._-]/g, "_");
    return `cases/${safeCase}/documents/${cleanDocId}/${ver}/${cleanObjId}`;
  }

  const cleanFileName = sanitizeFilename(safeFilename || "document.pdf");
  return `cases/${safeCase}/documents/${cleanDocId}/${ver}/${cleanFileName}`;
}

/**
 * Computes cryptographically verified SHA-256 hash using Web Crypto API.
 */
export async function computeSha256(data: ArrayBuffer | Uint8Array | string): Promise<string> {
  let buffer: ArrayBuffer;
  if (typeof data === "string") {
    buffer = new TextEncoder().encode(data).buffer;
  } else if (data instanceof Uint8Array) {
    buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  } else {
    buffer = data;
  }

  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Puts file bytes into Cloudflare R2 bucket `nyayasetu-vault` via `env.VAULT_BUCKET.put()`.
 * If running in local dev without R2 binding, safely buffers in local memory store.
 */
export async function putR2Object(
  key: string,
  data: ArrayBuffer | Uint8Array | string,
  options?: R2PutOptions | undefined,
): Promise<{ key: string; size: number; etag?: string | undefined }> {
  const bucket = getVaultBucket();

  let bytes: Uint8Array;
  if (typeof data === "string") {
    bytes = new TextEncoder().encode(data);
  } else if (data instanceof Uint8Array) {
    bytes = data;
  } else {
    bytes = new Uint8Array(data);
  }

  if (bucket && typeof bucket.put === "function") {
    const r2Opts: any = {};
    if (options?.httpMetadata) {
      r2Opts.httpMetadata = options.httpMetadata;
    }
    if (options?.customMetadata) {
      // R2 customMetadata must be string:string
      const cleanCustom: Record<string, string> = {};
      for (const [k, v] of Object.entries(options.customMetadata)) {
        if (v !== undefined && v !== null) cleanCustom[k] = String(v);
      }
      r2Opts.customMetadata = cleanCustom;
    }
    if (options?.sha256) {
      r2Opts.sha256 = options.sha256;
    }

    const res = await bucket.put(key, bytes, r2Opts);
    return {
      key: res.key || key,
      size: res.size ?? bytes.byteLength,
      etag: res.etag,
    };
  }

  // Local development / fallback store
  console.warn(
    `[R2 Storage: Local Dev Fallback] env.VAULT_BUCKET not bound. Storing key "${key}" (${bytes.byteLength} bytes) in memory buffer.`,
  );
  const etag = `dev-etag-${Date.now()}`;
  _localDevMemoryStore.set(key, {
    bytes,
    options,
    uploadedAt: new Date(),
    etag,
  });

  return {
    key,
    size: bytes.byteLength,
    etag,
  };
}

/**
 * Retrieves an object from Cloudflare R2 bucket `nyayasetu-vault` via `env.VAULT_BUCKET.get()`.
 */
export async function getR2Object(key: string): Promise<R2StoredObject | null> {
  const bucket = getVaultBucket();

  if (bucket && typeof bucket.get === "function") {
    const res = await bucket.get(key);
    if (!res) return null;

    return {
      key: res.key || key,
      size: res.size,
      etag: res.etag,
      uploaded: res.uploaded,
      httpMetadata: res.httpMetadata,
      customMetadata: res.customMetadata,
      arrayBuffer: () => res.arrayBuffer(),
      text: () => res.text(),
      body: res.body,
    };
  }

  // Local dev fallback check
  const local = _localDevMemoryStore.get(key);
  if (local) {
    return {
      key,
      size: local.bytes.byteLength,
      etag: local.etag,
      uploaded: local.uploadedAt,
      httpMetadata: local.options?.httpMetadata,
      customMetadata: local.options?.customMetadata as Record<string, string> | undefined,
      arrayBuffer: async () =>
        local.bytes.buffer.slice(
          local.bytes.byteOffset,
          local.bytes.byteOffset + local.bytes.byteLength,
        ) as ArrayBuffer,
      text: async () => new TextDecoder().decode(local.bytes),
      body: null,
    };
  }

  return null;
}

/**
 * Deletes an object from Cloudflare R2 bucket `nyayasetu-vault` via `env.VAULT_BUCKET.delete()`.
 * Used for cleanup / transactional rollback when metadata persistence fails.
 */
export async function deleteR2Object(key: string): Promise<void> {
  const bucket = getVaultBucket();

  if (bucket && typeof bucket.delete === "function") {
    await bucket.delete(key);
    return;
  }

  _localDevMemoryStore.delete(key);
}

/**
 * Checks metadata of an object in Cloudflare R2 bucket without retrieving its full body.
 */
export async function headR2Object(key: string): Promise<{
  size: number;
  etag?: string | undefined;
  customMetadata?: Record<string, string> | undefined;
} | null> {
  const bucket = getVaultBucket();

  if (bucket && typeof bucket.head === "function") {
    const res = await bucket.head(key);
    if (!res) return null;
    return {
      size: res.size,
      etag: res.etag,
      customMetadata: res.customMetadata,
    };
  }

  const local = _localDevMemoryStore.get(key);
  if (local) {
    return {
      size: local.bytes.byteLength,
      etag: local.etag,
      customMetadata: local.options?.customMetadata as Record<string, string> | undefined,
    };
  }

  return null;
}
