import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifyAuthToken,
  rateLimit,
  sanitizeText,
  isValidOfferId,
  csrfCheck,
} from "@/lib/api-auth";

/**
 * Private messaging system for Tekton OTC trades.
 * Messages are scoped per offer and only visible to trade participants.
 *
 * Security features:
 *  - Wallet-signature authentication (C-1, C-2)
 *  - CSRF origin verification (C-3)
 *  - Rate limiting (H-2)
 *  - Server-side text sanitization (H-7)
 *  - Prisma/SQLite persistent storage (H-1)
 *  - Cryptographic message IDs via cuid (M-1)
 *  - offerId validation (M-2)
 */

// ─── GET: Fetch messages or inbox ────────────────────────────
export async function GET(req: NextRequest) {
  // Authenticate
  const authedAddress = await verifyAuthToken(req);
  if (!authedAddress) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit (300 reads/min per address — inbox + thread + unread all poll)
  const rl = rateLimit(`get:${authedAddress}`, 300);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  const offerId = req.nextUrl.searchParams.get("offerId");
  const inboxOnly = req.nextUrl.searchParams.get("inbox") === "true";
  const unreadOnly = req.nextUrl.searchParams.get("unread") === "true";

  // Unread count across all conversations
  if (unreadOnly) {
    const count = await prisma.message.count({
      where: {
        conversation: {
          participants: { some: { address: authedAddress } },
        },
        sender: { not: authedAddress },
        readAt: null,
      },
    });
    return NextResponse.json({ unread: count });
  }

  // Inbox: list all conversations for this user
  if (inboxOnly) {
    const convos = await prisma.conversation.findMany({
      where: {
        participants: { some: { address: authedAddress } },
      },
      include: {
        participants: true,
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Batch unread counts in a single query (R9-05: fix N+1)
    const convoIds = convos.map((c) => c.id);
    const unreadCounts = await prisma.message.groupBy({
      by: ["conversationId"],
      where: {
        conversationId: { in: convoIds },
        sender: { not: authedAddress },
        readAt: null,
      },
      _count: true,
    });
    const unreadMap = new Map(
      unreadCounts.map((u) => [u.conversationId, u._count])
    );

    const userConvos = convos.map((conv) => {
      const lastMessage = conv.messages[0] ?? null;

      return {
        offerId: conv.offerId,
        participants: conv.participants.map((p) => p.address),
        lastMessage: lastMessage
          ? {
              id: lastMessage.id,
              offerId: conv.offerId,
              sender: lastMessage.sender,
              text: lastMessage.text,
              iv: lastMessage.iv ?? null,
              timestamp: lastMessage.createdAt.getTime(),
              read: lastMessage.readAt !== null,
            }
          : null,
        unreadCount: unreadMap.get(conv.id) ?? 0,
        createdAt: conv.createdAt.getTime(),
      };
    });

    // Sort by last message time, most recent first
    userConvos.sort((a, b) => {
      const aTime = a.lastMessage?.timestamp ?? a.createdAt;
      const bTime = b.lastMessage?.timestamp ?? b.createdAt;
      return bTime - aTime;
    });

    return NextResponse.json({ conversations: userConvos });
  }

  // Single conversation messages
  if (!offerId) {
    return NextResponse.json({ error: "offerId required" }, { status: 400 });
  }

  if (!isValidOfferId(offerId)) {
    return NextResponse.json({ error: "Invalid offerId" }, { status: 400 });
  }

  const conv = await prisma.conversation.findUnique({
    where: { offerId },
    include: {
      participants: true,
      messages: {
        orderBy: { createdAt: "asc" },
        take: 200,
      },
    },
  });

  if (!conv || !conv.participants.some((p) => p.address === authedAddress)) {
    return NextResponse.json({ messages: [] });
  }

  // Mark messages as read for this user (only when explicitly requested)
  const markRead = req.nextUrl.searchParams.get("markRead") === "true";
  if (markRead) {
    await prisma.message.updateMany({
      where: {
        conversationId: conv.id,
        sender: { not: authedAddress },
        readAt: null,
      },
      data: { readAt: new Date() },
    });
  }

  const messages = conv.messages.map((m) => ({
    id: m.id,
    offerId: conv.offerId,
    sender: m.sender,
    text: m.text,
    iv: m.iv ?? null, // null = legacy plaintext message
    timestamp: m.createdAt.getTime(),
    read: m.readAt !== null || m.sender === authedAddress,
  }));

  // Fetch encryption public keys for all participants
  const participantAddresses = conv.participants.map((p) => p.address);
  const encKeys = await prisma.userEncryptionKey.findMany({
    where: { address: { in: participantAddresses } },
  });
  const encryptionKeys: Record<string, string> = {};
  for (const k of encKeys) {
    encryptionKeys[k.address] = k.publicKey;
  }

  return NextResponse.json({ messages, encryptionKeys });
}

// ─── Validate POST body ──────────────────────────────────────
function validatePostBody(body: Record<string, unknown>): {
  valid: false; error: string; status: number;
} | {
  valid: true; offerId: string; sanitizedText: string; counterparty?: string; iv?: string; isEncrypted: boolean;
} {
  const { offerId, text, counterparty, iv } = body;

  if (!offerId || !(text as string | undefined)?.trim()) {
    return { valid: false, error: "offerId and text required", status: 400 };
  }

  if (!isValidOfferId(offerId as string)) {
    return { valid: false, error: "Invalid offerId", status: 400 };
  }

  if (counterparty && !/^0x[0-9a-fA-F]{40}$/.test(counterparty as string)) {
    return { valid: false, error: "Invalid counterparty address", status: 400 };
  }

  const isEncrypted = typeof iv === "string" && iv.length > 0;
  const sanitizedText = isEncrypted ? (text as string).trim() : sanitizeText(text as string);
  if (!sanitizedText) {
    return { valid: false, error: "Message text is empty after sanitization", status: 400 };
  }

  return {
    valid: true,
    offerId: offerId as string,
    sanitizedText,
    counterparty: counterparty as string | undefined,
    iv: isEncrypted ? iv : undefined,
    isEncrypted,
  };
}

// ─── POST: Send a message ────────────────────────────────────
export async function POST(req: NextRequest) {
  // CSRF check
  if (!csrfCheck(req)) {
    return NextResponse.json({ error: "CSRF rejected" }, { status: 403 });
  }

  // Authenticate
  const authedAddress = await verifyAuthToken(req);
  if (!authedAddress) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit (20 writes/min per address)
  const rl = rateLimit(`post:${authedAddress}`, 20);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  try {
    const body = await req.json();
    const validation = validatePostBody(body);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: validation.status });
    }

    const { offerId, sanitizedText, counterparty, iv, isEncrypted } = validation;

    // Get or create conversation
    let conv = await prisma.conversation.findUnique({
      where: { offerId },
      include: { participants: true },
    });

    if (conv) {
      // Existing conversation - only participants may send messages (R8-02)
      if (!conv.participants.some((p) => p.address === authedAddress)) {
        return NextResponse.json(
          { error: "Not a participant in this conversation" },
          { status: 403 }
        );
      }
    } else {
      // New conversation requires a counterparty (R9-01: prevent squatting)
      if (!counterparty) {
        return NextResponse.json(
          { error: "counterparty required for new conversations" },
          { status: 400 }
        );
      }

      const counterpartyLower = counterparty.toLowerCase();
      if (counterpartyLower === authedAddress) {
        return NextResponse.json(
          { error: "Cannot message yourself" },
          { status: 400 }
        );
      }

      const participantAddresses = [authedAddress, counterpartyLower];

      conv = await prisma.conversation.create({
        data: {
          offerId,
          participants: {
            create: participantAddresses.map((addr) => ({ address: addr })),
          },
        },
        include: { participants: true },
      });
    }

    // Create message
    const message = await prisma.message.create({
      data: {
        conversationId: conv.id,
        sender: authedAddress,
        text: sanitizedText,
        ...(isEncrypted ? { iv } : {}),
      },
    });

    return NextResponse.json({
      message: {
        id: message.id,
        offerId,
        sender: message.sender,
        text: message.text,
        iv: message.iv ?? null,
        timestamp: message.createdAt.getTime(),
        read: false,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
