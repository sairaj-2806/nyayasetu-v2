/**
 * NyayaSetu Cryptographic Engine
 * RFC 6234 compliant SHA-256 implementation with Web Crypto API acceleration.
 * Architected for high-integrity judicial electronic record verification.
 */

// Initial hash values (first 32 bits of fractional parts of square roots of first 8 primes: 2..19)
const H_INIT = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
];

// Round constants (first 32 bits of fractional parts of cube roots of first 64 primes: 2..311)
const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function rotr(n: number, x: number): number {
  return (x >>> n) | (x << (32 - n));
}

function ch(x: number, y: number, z: number): number {
  return (x & y) ^ (~x & z);
}

function maj(x: number, y: number, z: number): number {
  return (x & y) ^ (x & z) ^ (y & z);
}

function sigma0(x: number): number {
  return rotr(2, x) ^ rotr(13, x) ^ rotr(22, x);
}

function sigma1(x: number): number {
  return rotr(6, x) ^ rotr(11, x) ^ rotr(25, x);
}

function gamma0(x: number): number {
  return rotr(7, x) ^ rotr(18, x) ^ (x >>> 3);
}

function gamma1(x: number): number {
  return rotr(17, x) ^ rotr(19, x) ^ (x >>> 10);
}

/**
 * Synchronous, pure TypeScript SHA-256 calculation.
 * Produces exact 64-character lowercase hexadecimal digest.
 */
export function sha256Sync(data: string | Uint8Array): string {
  let bytes: Uint8Array;
  if (typeof data === "string") {
    bytes = new TextEncoder().encode(data);
  } else {
    bytes = data;
  }

  const bitLength = bytes.length * 8;
  // Pad with 1 bit (0x80), zeros, then 64-bit length
  const extra = (bytes.length + 9) % 64;
  const padLength = extra === 0 ? 0 : 64 - extra;
  const totalLength = bytes.length + 1 + padLength + 8;
  const padded = new Uint8Array(totalLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;

  // Append length in bits as 64-bit big-endian integer
  const view = new DataView(padded.buffer);
  // High 32 bits (support up to 53-bit JS safe int)
  const highBits = Math.floor(bitLength / 0x100000000);
  const lowBits = bitLength >>> 0;
  view.setUint32(totalLength - 8, highBits, false);
  view.setUint32(totalLength - 4, lowBits, false);

  const H = [...H_INIT];
  const W = new Int32Array(64);

  for (let i = 0; i < totalLength; i += 64) {
    for (let t = 0; t < 16; t++) {
      W[t] = view.getInt32(i + t * 4, false);
    }
    for (let t = 16; t < 64; t++) {
      W[t] = (gamma1(W[t - 2]!) + W[t - 7]! + gamma0(W[t - 15]!) + W[t - 16]!) | 0;
    }

    let a = H[0]!;
    let b = H[1]!;
    let c = H[2]!;
    let d = H[3]!;
    let e = H[4]!;
    let f = H[5]!;
    let g = H[6]!;
    let h = H[7]!;

    for (let t = 0; t < 64; t++) {
      const T1 = (h + sigma1(e) + ch(e, f, g) + K[t]! + W[t]!) | 0;
      const T2 = (sigma0(a) + maj(a, b, c)) | 0;
      h = g;
      g = f;
      f = e;
      e = (d + T1) | 0;
      d = c;
      c = b;
      b = a;
      a = (T1 + T2) | 0;
    }

    H[0] = (H[0]! + a) | 0;
    H[1] = (H[1]! + b) | 0;
    H[2] = (H[2]! + c) | 0;
    H[3] = (H[3]! + d) | 0;
    H[4] = (H[4]! + e) | 0;
    H[5] = (H[5]! + f) | 0;
    H[6] = (H[6]! + g) | 0;
    H[7] = (H[7]! + h) | 0;
  }

  return H.map((val) => (val >>> 0).toString(16).padStart(8, "0")).join("");
}

/**
 * Asynchronous SHA-256 calculation.
 * Uses Web Crypto API when available for hardware acceleration, falling back to pure TS sha256Sync.
 */
export async function calculateSha256(content: string | ArrayBuffer | Uint8Array): Promise<string> {
  if (typeof globalThis !== "undefined" && globalThis.crypto?.subtle) {
    let buffer: ArrayBuffer;
    if (typeof content === "string") {
      buffer = new TextEncoder().encode(content).buffer;
    } else if (content instanceof Uint8Array) {
      buffer = content.buffer as ArrayBuffer;
    } else {
      buffer = content;
    }

    try {
      const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch {
      // Fallback if subtle digest fails
      return sha256Sync(typeof content === "string" ? content : new Uint8Array(buffer));
    }
  }

  return sha256Sync(typeof content === "string" ? content : new Uint8Array(content));
}
