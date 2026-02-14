"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccounts } from "@midl/react";
import { useEVMAddress } from "@midl/executor-react";
import { useOffer } from "@/hooks/useEscrow";
import { useAuth } from "@/hooks/useAuth";
import {
  shortenAddress,
  formatTokenAmount,
  tokenLabel,
  type Offer,
  ZERO_ADDRESS,
} from "@/lib/contract";
import { motion, AnimatePresence } from "framer-motion";

/* ─── Types ─────────────────────────────────────────────────── */

interface ConversationPreview {
  offerId: string;
  participants: string[];
  lastMessage: {
    sender: string;
    text: string;
    timestamp: number;
  } | null;
  unreadCount: number;
  createdAt: number;
}

/* ─── Conversation list item with on-chain offer details ───── */

function ConversationItem({
  conv,
  active,
  evmAddress,
}: {
  conv: ConversationPreview;
  active: boolean;
  evmAddress: string;
}) {
  let parsedId: bigint | null = null;
  try {
    parsedId = BigInt(conv.offerId);
  } catch {
    /* ignore */
  }
  const { data: offerData } = useOffer(parsedId ?? undefined);
  const offer = offerData as Offer | undefined;

  const other =
    conv.participants.find(
      (p) => p.toLowerCase() !== evmAddress.toLowerCase()
    ) ?? conv.participants[0];

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60_000) return "now";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
    return new Date(ts).toLocaleDateString([], {
      month: "short",
      day: "numeric",
    });
  };

  const offerSummary =
    offer && offer.maker !== ZERO_ADDRESS
      ? `${formatTokenAmount(offer.makerAmount, offer.makerToken)} ${tokenLabel(
          offer.makerToken
        )} → ${formatTokenAmount(offer.takerAmount, offer.takerToken)} ${tokenLabel(
          offer.takerToken
        )}`
      : null;

  return (
    <Link
      href={`/messages/${conv.offerId}`}
      className={`flex items-start gap-3 p-3 rounded-xl transition-all ${
        active
          ? "bg-orange-50 border border-orange-100"
          : "hover:bg-black/[0.02] border border-transparent"
      }`}
    >
      {/* Avatar */}
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center text-white text-[11px] font-bold shrink-0 mt-0.5">
        {shortenAddress(other).slice(0, 2).toUpperCase()}
      </div>

      <div className="flex-1 min-w-0">
        {/* Top row: address + time */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[#0a0a0a] truncate">
            {shortenAddress(other)}
          </span>
          <span className="text-[10px] text-black/30 shrink-0 ml-2">
            {conv.lastMessage ? formatTime(conv.lastMessage.timestamp) : ""}
          </span>
        </div>

        {/* Offer summary */}
        <p className="text-[11px] text-orange-500/80 truncate mt-0.5 font-medium">
          {offerSummary ?? `Offer #${conv.offerId}`}
        </p>

        {/* Last message preview */}
        <div className="flex items-center gap-1.5 mt-0.5">
          <p className="text-[11px] text-black/40 truncate flex-1">
            {conv.lastMessage?.text ?? "No messages yet"}
          </p>
          {conv.unreadCount > 0 && (
            <span className="w-[18px] h-[18px] bg-orange-500 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0">
              {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

/* ─── Layout: sidebar + chat ────────────────────────────────── */

export default function MessagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { isConnected } = useAccounts();
  const evmAddress = useEVMAddress();
  const { authFetch, isAuthenticated } = useAuth();
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const prevUnreadRef = useRef(-1);

  const isThreadView = pathname !== "/messages";
  const activeOfferId = isThreadView ? pathname.split("/").pop() : null;

  /* ── Fetch inbox ──────────────────────────────────────────── */

  const fetchInbox = useCallback(async () => {
    if (!evmAddress || !isAuthenticated) {
      setLoading(false);
      return;
    }
    try {
      const res = await authFetch(
        `/api/messages?inbox=true`
      );
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations ?? []);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [evmAddress, isAuthenticated, authFetch]);

  useEffect(() => {
    fetchInbox();
    const timer = setInterval(fetchInbox, 5000);
    return () => clearInterval(timer);
  }, [fetchInbox]);

  /* ── Request notification permission ─────────────────────── */

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
  }, []);

  /* ── Send browser notification on new unread messages ────── */

  useEffect(() => {
    const totalUnread = conversations.reduce(
      (sum, c) => sum + c.unreadCount,
      0
    );

    if (
      totalUnread > prevUnreadRef.current &&
      prevUnreadRef.current >= 0
    ) {
      // Browser notification
      if (
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        const latest = conversations.find((c) => c.unreadCount > 0);
        const body = latest?.lastMessage?.text ?? "You have a new message";
        new Notification("Tekton – New Message", {
          body,
          icon: "/logo-square.png",
          tag: "tekton-msg",
        });
      }

      // Play notification sound via Web Audio API
      try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = 880;
        gain.gain.value = 0.15;
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.stop(ctx.currentTime + 0.15);
        // Close AudioContext after sound finishes to prevent leak (R8-04)
        osc.onended = () => ctx.close().catch(() => {});
      } catch {
        /* audio context may fail silently */
      }
    }

    prevUnreadRef.current = totalUnread;
  }, [conversations]);

  /* ─── Not connected ───────────────────────────────────────── */

  if (!isConnected) {
    return (
      <div className="min-h-[80vh] max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-24"
        >
          <h1 className="text-3xl font-bold mb-4 text-[#0a0a0a]">Messages</h1>
          <p className="text-black/50">
            Connect your wallet to view messages
          </p>
        </motion.div>
      </div>
    );
  }

  /* ─── Render ──────────────────────────────────────────────── */

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 h-[calc(100vh-56px)] flex flex-col overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Page header - mobile only at /messages, always on desktop */}
        <div
          className={`mb-4 ${isThreadView ? "hidden md:block" : "block"}`}
        >
          <h1 className="text-2xl font-bold tracking-tight text-[#0a0a0a]">
            Messages
          </h1>
          <p className="text-black/40 text-sm mt-0.5">
            Private conversations about your trades
          </p>
        </div>

        {/* Split layout - fixed height so chat scrolls internally */}
        <div className="flex gap-4" style={{ height: "calc(100vh - 140px)" }}>
          {/* ── Left sidebar: conversation list ─────────────── */}
          <div
            className={`${
              isThreadView ? "hidden md:flex" : "flex"
            } flex-col w-full md:w-80 lg:w-96 shrink-0`}
          >
            <div className="card flex flex-col flex-1 overflow-hidden">
              {/* Search / compose */}
              <div className="p-3 border-b border-black/[0.06]">
                <div className="flex items-center gap-2 text-xs text-black/30">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="text-black/20"
                  >
                    <path
                      d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                  </svg>
                  {conversations.length} conversation
                  {conversations.length !== 1 ? "s" : ""}
                </div>
              </div>

              {/* Conversation list */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {loading ? (
                  <div className="flex justify-center py-12">
                    <div className="w-4 h-4 border-2 border-black/10 border-t-orange-500 rounded-full animate-spin" />
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="text-center py-12 px-4">
                    <div className="w-12 h-12 bg-black/[0.03] rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        className="text-black/15"
                      >
                        <path
                          d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        />
                      </svg>
                    </div>
                    <p className="text-xs text-black/40 mb-3">
                      No conversations yet
                    </p>
                    <Link
                      href="/market"
                      className="text-xs text-orange-500 hover:text-orange-600 transition-colors"
                    >
                      Browse offers &rarr;
                    </Link>
                  </div>
                ) : (
                  conversations.map((conv) => (
                    <ConversationItem
                      key={conv.offerId}
                      conv={conv}
                      active={activeOfferId === conv.offerId}
                      evmAddress={evmAddress!}
                    />
                  ))
                )}
              </div>
            </div>
          </div>

          {/* ── Right panel: chat thread (children) ─────────── */}
          <div
            className={`${
              isThreadView ? "flex" : "hidden md:flex"
            } flex-col flex-1 min-w-0`}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={pathname}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col flex-1"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
