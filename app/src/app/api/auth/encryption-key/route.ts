import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuthToken, rateLimit } from "@/lib/api-auth";

/**
 * POST /api/auth/encryption-key — Publish E2E encryption public key.
 * GET  /api/auth/encryption-key?address=0x... — Fetch a user's public key.
 *
 * Public keys are secp256k1 compressed (33 bytes, hex-encoded).
 * Derived client-side from a deterministic wallet signature.
 */

export async function POST(req: NextRequest) {
  // Authenticate
  const authedAddress = await verifyAuthToken(req);
  if (!authedAddress) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit (5 key publishes per minute)
  const rl = rateLimit(`e2e-key:${authedAddress}`, 5, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  try {
    const { publicKey } = await req.json();

    // Validate: must be a 33-byte compressed secp256k1 key (66 hex chars)
    if (
      typeof publicKey !== "string" ||
      !/^(02|03)[0-9a-f]{64}$/i.test(publicKey)
    ) {
      return NextResponse.json(
        { error: "Invalid public key format. Expected 33-byte compressed secp256k1 key (hex)." },
        { status: 400 },
      );
    }

    // Upsert — one key per address
    await prisma.userEncryptionKey.upsert({
      where: { address: authedAddress },
      update: { publicKey: publicKey.toLowerCase() },
      create: {
        address: authedAddress,
        publicKey: publicKey.toLowerCase(),
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 },
    );
  }
}

export async function GET(req: NextRequest) {
  // Authenticate
  const authedAddress = await verifyAuthToken(req);
  if (!authedAddress) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit
  const rl = rateLimit(`e2e-key-get:${authedAddress}`, 60, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  const address = req.nextUrl.searchParams.get("address")?.toLowerCase();
  if (!address || !/^0x[0-9a-f]{40}$/.test(address)) {
    return NextResponse.json(
      { error: "Valid address parameter required" },
      { status: 400 },
    );
  }

  const record = await prisma.userEncryptionKey.findUnique({
    where: { address },
  });

  if (!record) {
    return NextResponse.json({ publicKey: null });
  }

  return NextResponse.json({ publicKey: record.publicKey });
}
