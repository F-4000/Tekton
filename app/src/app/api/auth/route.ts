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
    const { address, message, signature } = body;

    // Validate inputs
    if (!address || !message || !signature) {
      return NextResponse.json(
        { error: "address, message, and signature required" },
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

    const timestamp = parseInt(message.slice(AUTH_MESSAGE_PREFIX.length), 10);
    if (isNaN(timestamp) || Math.abs(Date.now() - timestamp) > MAX_MESSAGE_AGE_MS) {
      return NextResponse.json(
        { error: "Message expired. Please sign a fresh one." },
        { status: 400 }
      );
    }

    // ─── Cryptographic signature verification ───────────────────
    // Xverse ECDSA signatures use Bitcoin's signed message format:
    //   hash = SHA256(SHA256("\x18Bitcoin Signed Message:\n" + varint(len) + message))
    // The signature is 65 bytes base64: [recoveryFlag(1), r(32), s(32)]
    // We recover the public key and derive the EVM address (keccak256(pubkey)[12:])
    // to verify it matches the claimed address.
    if (typeof signature !== "string" || signature.length < 10) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    try {
      const recoveredAddress = recoverEVMAddressFromBitcoinSig(message, signature);
      if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
        return NextResponse.json(
          { error: "Signature does not match address" },
          { status: 401 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: "Invalid signature format" },
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
 * Recover the EVM address from a Bitcoin ECDSA signed message.
 *
 * Xverse returns a 65-byte base64 signature: [recoveryFlag, r(32), s(32)]
 * recoveryFlag encodes the recovery ID:
 *   - 27-30: uncompressed key (recovery = flag - 27)
 *   - 31-34: compressed key (recovery = flag - 31)
 *
 * We recover the secp256k1 public key, then derive the EVM address
 * as the last 20 bytes of keccak256(uncompressed_pubkey_without_prefix).
 */
function recoverEVMAddressFromBitcoinSig(message: string, signatureBase64: string): string {
  const sigBytes = Buffer.from(signatureBase64, "base64");
  if (sigBytes.length !== 65) {
    throw new Error(`Expected 65-byte signature, got ${sigBytes.length}`);
  }

  const flag = sigBytes[0];
  let recoveryId: number;

  if (flag >= 27 && flag <= 30) {
    recoveryId = flag - 27;
  } else if (flag >= 31 && flag <= 34) {
    recoveryId = flag - 31;
  } else {
    throw new Error(`Invalid recovery flag: ${flag}`);
  }

  const r = sigBytes.subarray(1, 33);
  const s = sigBytes.subarray(33, 65);

  const msgHash = bitcoinMessageHash(message);

  // Build 65-byte recoverable signature: [recoveryId, r(32), s(32)]
  const sig65 = new Uint8Array(65);
  sig65[0] = recoveryId;
  sig65.set(r, 1);
  sig65.set(s, 33);

  // Recover compressed public key (33 bytes) using @noble/curves v2 API
  const compressedPubkey = secp256k1.recoverPublicKey(sig65, msgHash);

  // Decompress to get uncompressed key (65 bytes: 04 + x + y)
  const point = secp256k1.Point.fromBytes(compressedPubkey);
  const uncompressedPubkey = point.toBytes(false); // 65 bytes

  // EVM address = keccak256(pubkey_x_y)[12:]  (skip the 0x04 prefix byte)
  const pubkeyBody = uncompressedPubkey.subarray(1); // 64 bytes: x(32) + y(32)
  const addressHash = keccak_256(pubkeyBody);
  const addressBytes = addressHash.subarray(12); // last 20 bytes

  return "0x" + Buffer.from(addressBytes).toString("hex");
}
