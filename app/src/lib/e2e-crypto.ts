/**
 * End-to-end encryption for Tekton messaging.
 *
 * Crypto flow:
 *   1. User signs a deterministic message ("Tekton E2E Key v1") with their wallet
 *   2. The signature is hashed (SHA-256) to derive a secp256k1 private key
 *   3. The corresponding public key is published to the server
 *   4. For each conversation, ECDH(myPriv, theirPub) + HKDF → AES-256-GCM key
 *   5. Messages are encrypted client-side before being sent
 *
 * Uses only @noble/curves + @noble/hashes (already in deps) + Web Crypto API.
 */

import { secp256k1 } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { hkdf } from "@noble/hashes/hkdf.js";

const E2E_SIGN_MESSAGE = "Tekton E2E Key v1";
const HKDF_INFO = new TextEncoder().encode("tekton-e2e-v1");
const AES_KEY_BYTES = 32; // AES-256

// ─── Key Derivation ──────────────────────────────────────────

/**
 * Derive a secp256k1 keypair from a wallet signature.
 * The signature of a deterministic message is hashed to produce a private key scalar.
 */
export function deriveEncryptionKeypair(signatureHex: string): {
  privateKey: Uint8Array;
  publicKey: Uint8Array; // compressed, 33 bytes
  publicKeyHex: string;
} {
  // Hash the signature bytes to get a 32-byte scalar
  const sigBytes = hexToBytes(signatureHex);
  const privateKey = sha256(sigBytes);

  // Ensure it's a valid secp256k1 scalar (non-zero, less than curve order)
  // SHA-256 output is 32 bytes; extremely unlikely to be ≥ n, but clamp just in case
  // secp256k1 curve order n (well-known constant)
  const n = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141n;
  let scalar = bytesToBigInt(privateKey);
  if (scalar === 0n || scalar >= n) {
    scalar = scalar % n;
    if (scalar === 0n) scalar = 1n; // degenerate case — practically impossible
    const clamped = bigIntToBytes(scalar, 32);
    privateKey.set(clamped);
  }

  const publicKey = secp256k1.getPublicKey(privateKey, true); // compressed
  const publicKeyHex = bytesToHex(publicKey);

  return { privateKey, publicKey, publicKeyHex };
}

/** The deterministic message the user must sign to derive their encryption key. */
export const E2E_KEY_MESSAGE = E2E_SIGN_MESSAGE;

// ─── ECDH + HKDF → per-conversation AES key ─────────────────

/**
 * Derive a shared AES-256-GCM key for a conversation between two users.
 *
 * @param myPrivateKey  - My secp256k1 private key (32 bytes)
 * @param theirPubKeyHex - Counterparty's compressed public key (hex)
 * @param conversationId - Unique conversation identifier (for domain separation)
 */
export async function deriveConversationKey(
  myPrivateKey: Uint8Array,
  theirPubKeyHex: string,
  conversationId: string,
): Promise<CryptoKey> {
  const theirPubKey = hexToBytes(theirPubKeyHex);

  // ECDH: shared point
  const sharedPoint = secp256k1.getSharedSecret(myPrivateKey, theirPubKey);
  // sharedPoint is 33 bytes (compressed) — use the x-coordinate (bytes 1..33)
  const sharedX = sharedPoint.subarray(1);

  // HKDF-SHA256: derive AES key with conversation-specific salt
  const salt = new TextEncoder().encode(`tekton:${conversationId}`);
  const rawKey = hkdf(sha256, sharedX, salt, HKDF_INFO, AES_KEY_BYTES);

  // Import as WebCrypto AES-GCM key
  const keyBuffer = new ArrayBuffer(rawKey.byteLength);
  new Uint8Array(keyBuffer).set(rawKey);
  return crypto.subtle.importKey("raw", keyBuffer, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

// ─── AES-256-GCM Encrypt / Decrypt ──────────────────────────

/** Copy a Uint8Array into a fresh ArrayBuffer (TS strict compat with WebCrypto) */
function toBuffer(u: Uint8Array): ArrayBuffer {
  const buf = new ArrayBuffer(u.byteLength);
  new Uint8Array(buf).set(u);
  return buf;
}

/**
 * Encrypt a plaintext message with AES-256-GCM.
 * Returns { ciphertext, iv } as base64 strings.
 */
export async function encryptMessage(
  key: CryptoKey,
  plaintext: string,
): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV
  const encoded = new TextEncoder().encode(plaintext);

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toBuffer(iv) },
    key,
    toBuffer(encoded),
  );

  return {
    ciphertext: uint8ToBase64(new Uint8Array(encrypted)),
    iv: uint8ToBase64(iv),
  };
}

/**
 * Decrypt a ciphertext with AES-256-GCM.
 * Returns the plaintext string, or null if decryption fails.
 */
export async function decryptMessage(
  key: CryptoKey,
  ciphertextB64: string,
  ivB64: string,
): Promise<string | null> {
  try {
    const ciphertext = base64ToUint8(ciphertextB64);
    const iv = base64ToUint8(ivB64);

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: toBuffer(iv) },
      key,
      toBuffer(ciphertext),
    );

    return new TextDecoder().decode(decrypted);
  } catch {
    // Decryption failed — wrong key, corrupted data, or legacy plaintext
    return null;
  }
}

// ─── Encoding helpers ────────────────────────────────────────

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  let result = 0n;
  for (const byte of bytes) {
    result = (result << 8n) | BigInt(byte);
  }
  return result;
}

function bigIntToBytes(n: bigint, length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  for (let i = length - 1; i >= 0; i--) {
    bytes[i] = Number(n & 0xffn);
    n >>= 8n;
  }
  return bytes;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) {
    binary += String.fromCodePoint(b);
  }
  return btoa(binary);
}

function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.codePointAt(i)!;
  }
  return bytes;
}
