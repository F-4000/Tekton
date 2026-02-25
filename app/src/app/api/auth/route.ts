import { NextRequest, NextResponse } from "next/server";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { prisma } from "@/lib/prisma";
import { csrfCheck, rateLimit } from "@/lib/api-auth";

/**
 * Wallet-based authentication using MIDL message signing (ECDSA).
 *
 * Flow:
 *   1. Client signs a challenge message: "Tekton Auth: <timestamp>"
 *      via MIDL's useSignMessage (Xverse wallet, ECDSA protocol)
 *   2. POST /api/auth with { address, message, signature }
 *   3. Server recovers the public key from the ECDSA signature,
 *      derives the EVM address, and verifies it matches the claimed address
 *   4. Returns a session token (stored in DB, expires in 24h)
 *   5. Client includes token in subsequent API calls via Authorization header
 *
 * Fixes audit findings: C-1, C-2, C-3 (auth + CSRF protection)
 */

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const AUTH_MESSAGE_PREFIX = "Tekton Auth: ";
const MAX_MESSAGE_AGE_MS = 5 * 60 * 1000; // 5 minutes - prevent replay

export async function POST(req: NextRequest) {
  try {
    // CSRF check (R9-09: use shared utility)
    if (!csrfCheck(req)) {
      return NextResponse.json({ error: "CSRF rejected" }, { status: 403 });
    }

    // Rate limit auth attempts by IP (verifyMessage is CPU-expensive)
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = rateLimit(`auth:${ip}`, 10, 60_000); // 10 attempts per minute
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many auth attempts" }, { status: 429 });
    }

    const body = await req.json();
    const { address, message, signature, publicKey } = body;

    // Validate inputs
    if (!address || !message || !signature || !publicKey) {
      return NextResponse.json(
        { error: "address, message, signature, and publicKey required" },
        { status: 400 }
      );
    }

    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
      return NextResponse.json(
        { error: "Invalid address format" },
        { status: 400 }
      );
    }

    // Verify the message format and recency
    if (!message.startsWith(AUTH_MESSAGE_PREFIX)) {
      return NextResponse.json(
        { error: "Invalid message format" },
        { status: 400 }
      );
    }

    const timestamp = Number.parseInt(message.slice(AUTH_MESSAGE_PREFIX.length), 10);
    if (Number.isNaN(timestamp) || Math.abs(Date.now() - timestamp) > MAX_MESSAGE_AGE_MS) {
      return NextResponse.json(
        { error: "Message expired. Please sign a fresh one." },
        { status: 400 }
      );
    }

    // ─── Cryptographic signature + EVM address verification ─────
    //
    // MIDL executor derives EVM addresses from the payment account's public key:
    //   compressed pubkey (33 bytes) → decompress → keccak256(x||y) → last 20 bytes
    //
    // We verify:
    //   1. The client-provided publicKey derives to the claimed EVM address
    //   2. The Bitcoin ECDSA signature recovers to that same public key
    //   3. Message format and timestamp are valid (checked above)
    //   4. CSRF + rate limiting protect against abuse
    if (typeof signature !== "string" || signature.length < 10) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    try {
      verifySignatureAndAddress(message, signature, publicKey, address);
    } catch (e) {
      console.error("[AUTH] verification failed:", e);
      return NextResponse.json(
        { error: "Signature verification failed" },
        { status: 401 }
      );
    }

    // Create session token
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

    // Clean up old sessions for this address (R8-07: scoped to own address only)
    await prisma.authSession.deleteMany({
      where: { address: address.toLowerCase() },
    });

    // Periodically clean expired sessions from all users (best-effort)
    prisma.authSession
      .deleteMany({ where: { expiresAt: { lte: new Date() } } })
      .catch((e) => {
        if (process.env.NODE_ENV === "development") console.warn("Expired session cleanup failed:", e);
      });

    // Create new session
    await prisma.authSession.create({
      data: {
        address: address.toLowerCase(),
        token,
        expiresAt,
      },
    });

    return NextResponse.json({ token, expiresAt: expiresAt.toISOString() });
  } catch {
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/auth - Logout / invalidate session token.
 * Fixes audit finding: R8-06 (no session invalidation)
 */
export async function DELETE(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "No token provided" }, { status: 400 });
  }

  const token = authHeader.slice(7);
  try {
    await prisma.authSession.deleteMany({ where: { token } });
  } catch {
    // Ignore - token may already be gone
  }

  return NextResponse.json({ ok: true });
}

// ─── Bitcoin ECDSA signature verification ─────────────────────

/**
 * Encode message length as a Bitcoin varint.
 */
function varintEncode(n: number): Uint8Array {
  if (n < 0xfd) return new Uint8Array([n]);
  if (n <= 0xffff) {
    const buf = new Uint8Array(3);
    buf[0] = 0xfd;
    buf[1] = n & 0xff;
    buf[2] = (n >> 8) & 0xff;
    return buf;
  }
  const buf = new Uint8Array(5);
  buf[0] = 0xfe;
  buf[1] = n & 0xff;
  buf[2] = (n >> 8) & 0xff;
  buf[3] = (n >> 16) & 0xff;
  buf[4] = (n >> 24) & 0xff;
  return buf;
}

/**
 * Compute the Bitcoin signed message hash:
 *   SHA256(SHA256("\x18Bitcoin Signed Message:\n" + varint(len) + message))
 */
function bitcoinMessageHash(message: string): Uint8Array {
  const prefix = new TextEncoder().encode("\x18Bitcoin Signed Message:\n");
  const msgBytes = new TextEncoder().encode(message);
  const lenVarint = varintEncode(msgBytes.length);

  const payload = new Uint8Array(prefix.length + lenVarint.length + msgBytes.length);
  payload.set(prefix, 0);
  payload.set(lenVarint, prefix.length);
  payload.set(msgBytes, prefix.length + lenVarint.length);

  return sha256(sha256(payload));
}

/**
 * Verify a Bitcoin ECDSA signed message is cryptographically valid.
 *
 * Xverse returns a 65-byte base64 signature: [recoveryFlag, r(32), s(32)]
 * MIDL derives the executor EVM address from the payment account's public key:
 *   compressed pubkey (33 bytes) → decompress to (65 bytes) →
 *   keccak256(uncompressed[1:]) → last 20 bytes = EVM address
 *
 * We verify:
 *   1. The provided publicKey derives to the claimed EVM address
 *   2. The Bitcoin ECDSA signature verifies against that public key
 *
 * IMPORTANT: @noble/curves v2 defaults `prehash: true` (SHA-256 the message).
 * Since bitcoinMessageHash() already double-SHA256s, we MUST pass prehash:false
 * to avoid triple-hashing.
 */
function verifySignatureAndAddress(
  message: string,
  signatureBase64: string,
  publicKeyHex: string,
  claimedAddress: string
): void {
  // ── Step 1: Derive EVM address from the provided compressed public key ──
  const compressedPubkey = Uint8Array.from(Buffer.from(publicKeyHex, "hex"));
  if (compressedPubkey.length !== 33) {
    throw new Error(`Expected 33-byte compressed pubkey, got ${compressedPubkey.length}`);
  }

  // Decompress: prepend 0x04 + x(32) + y(32) → 65 bytes
  const point = secp256k1.Point.fromBytes(compressedPubkey);
  const uncompressed = point.toBytes(false); // 65 bytes: 0x04 || x || y
  // keccak256 of the 64-byte body (skip the 0x04 prefix)
  const addrHash = keccak_256(uncompressed.subarray(1));
  // Last 20 bytes = EVM address
  const derivedAddress =
    "0x" +
    Array.from(addrHash.subarray(-20))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

  if (derivedAddress.toLowerCase() !== claimedAddress.toLowerCase()) {
    throw new Error(
      `Public key derives to ${derivedAddress}, but claimed ${claimedAddress}`
    );
  }

  // ── Step 2: Verify the Bitcoin ECDSA signature against this public key ──
  const sigBytes = Buffer.from(signatureBase64, "base64");
  if (sigBytes.length !== 65) {
    throw new Error(`Expected 65-byte signature, got ${sigBytes.length}`);
  }

  // Bitcoin sig format: [recoveryFlag(1), r(32), s(32)]
  // We only need the compact (r||s) portion for verify()
  const sig64 = sigBytes.subarray(1, 65);
  const msgHash = bitcoinMessageHash(message);

  // Verify signature with the known public key.
  // prehash:false — msgHash is already SHA256(SHA256(...)), do NOT hash again.
  // lowS:false — accept any s-value (Xverse normalizes, but be lenient).
  const valid = secp256k1.verify(sig64, msgHash, compressedPubkey, {
    prehash: false,
    lowS: false,
  });

  if (!valid) {
    throw new Error("Signature verification failed: signature does not match public key");
  }
}
