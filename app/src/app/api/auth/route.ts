import { NextRequest, NextResponse } from "next/server";
import { verifyMessage } from "viem";
import { prisma } from "@/lib/prisma";
import { csrfCheck, rateLimit } from "@/lib/api-auth";

/**
 * Wallet-based authentication using personal_sign.
 *
 * Flow:
 *   1. Client signs a challenge message: "Tekton Auth: <timestamp>"
 *   2. POST /api/auth with { address, message, signature }
 *   3. Server verifies the signature matches the address
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

    // Verify the signature
    const isValid = await verifyMessage({
      address: address as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid signature" },
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
