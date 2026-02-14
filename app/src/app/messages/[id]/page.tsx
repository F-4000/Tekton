"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
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

interface ChatMessage {
  id: string;
  offerId: string;
  sender: string;
  text: string;
  timestamp: number;
  read: boolean;
}

export default function MessageThreadPage() {
  const params = useParams();
  const offerId = params.id as string;

  const { isConnected } = useAccounts();
  const evmAddress = useEVMAddress();
  const { authFetch } = useAuth();

  let parsedId: bigint | null = null;
  try {
    parsedId = BigInt(offerId);
  } catch {
    /* invalid */
  }
  const { data: offerData } = useOffer(parsedId ?? undefined);
  const offer = offerData as Offer | undefined;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevCountRef = useRef(0);

  const fetchMessages = useCallback(async () => {
    if (!evmAddress) {
      setInitialLoad(false);
      return;
    }
    try {
      const res = await authFetch(
        `/api/messages?offerId=${offerId}`
      );
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages ?? []);
      }
    } catch {
      /* ignore */
    } finally {
      setInitialLoad(false);
    }
  }, [offerId, evmAddress, authFetch]);

  // Reset state when switching to a different conversation
  useEffect(() => {
    setMessages([]);
    setInitialLoad(true);
    prevCountRef.current = 0;
  }, [offerId]);

  useEffect(() => {
    fetchMessages();
    const timer = setInterval(fetchMessages, 5000);
    return () => clearInterval(timer);
  }, [fetchMessages]);

  // Only auto-scroll when new messages arrive, not on every poll
  useEffect(() => {
    if (messages.length > prevCountRef.current && messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    }
    prevCountRef.current = messages.length;
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || !evmAddress || sending) return;
    setSending(true);
    setSendError(false);
    try {
      const counterparty =
        offer?.maker?.toLowerCase() !== evmAddress.toLowerCase()
          ? offer?.maker
          : undefined;
      const res = await authFetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        autoAuth: true,
        body: JSON.stringify({
          offerId,
          text: input.trim(),
          counterparty,
        }),
      });
      if (res.ok) {
        setInput("");
        await fetchMessages();
        // Notify the sidebar layout to refresh conversations
        window.dispatchEvent(new Event("tekton-message-sent"));
      } else {
        setSendError(true);
      }
    } catch {
      setSendError(true);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const isMe = (addr: string) =>
    evmAddress?.toLowerCase() === addr.toLowerCase();
  const isMaker = (addr: string) =>
    offer?.maker?.toLowerCase() === addr.toLowerCase();

  const formatTime = (ts: number) => {
    const date = new Date(ts);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return (
      date.toLocaleDateString([], { month: "short", day: "numeric" }) +
      " " +
      date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
  };

  if (!isConnected) {
    return (
      <div className="card flex items-center justify-center flex-1 p-8">
        <p className="text-black/50">Connect your wallet to view messages</p>
      </div>
    );
  }

  const offerSummary =
    offer && offer.maker !== ZERO_ADDRESS
      ? `${formatTokenAmount(offer.makerAmount, offer.makerToken)} ${tokenLabel(offer.makerToken)} → ${formatTokenAmount(offer.takerAmount, offer.takerToken)} ${tokenLabel(offer.takerToken)}`
      : null;

  return (
    <div className="card flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-black/[0.06]">
        {/* Mobile back button */}
        <Link
          href="/messages"
          className="md:hidden text-black/40 hover:text-[#0a0a0a] transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M12.5 15l-5-5 5-5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-sm text-[#0a0a0a]">
              {offerSummary ?? `Offer #${offerId}`}
            </h2>
            <Link
              href={`/offer/${offerId}`}
              className="text-[10px] bg-orange-50 text-orange-500 px-2 py-0.5 rounded-full hover:bg-orange-100 transition-colors shrink-0"
            >
              View offer
            </Link>
          </div>
          {offer && offer.maker !== ZERO_ADDRESS && (
            <p className="text-[11px] text-black/40 mt-0.5 truncate">
              Maker: {shortenAddress(offer.maker)}
            </p>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
        {initialLoad && messages.length === 0 && (
          <div className="flex justify-center py-16">
            <div className="flex items-center gap-3 text-black/40">
              <div className="w-4 h-4 border-2 border-black/10 border-t-orange-500 rounded-full animate-spin" />
              <span className="text-sm">Loading messages…</span>
            </div>
          </div>
        )}

        {!initialLoad && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 bg-black/[0.03] rounded-2xl flex items-center justify-center mb-4">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                className="text-black/15"
              >
                <path
                  d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <p className="text-sm text-black/30">
              Start the conversation. Messages are private between you and the counterparty.
            </p>
          </div>
        )}

        {messages.map((msg, i) => {
          const showDate =
            i === 0 ||
            new Date(messages[i - 1].timestamp).toDateString() !==
              new Date(msg.timestamp).toDateString();
          const self = isMe(msg.sender);

          return (
            <div key={msg.id}>
              {showDate && (
                <div className="flex justify-center my-3">
                  <span className="text-[10px] bg-black/[0.04] text-black/30 px-3 py-1 rounded-full">
                    {new Date(msg.timestamp).toLocaleDateString([], {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              )}
              <div className={`flex ${self ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] ${
                    self ? "items-end" : "items-start"
                  }`}
                >
                  {!self && (
                    <div className="flex items-center gap-1.5 mb-1 pl-1">
                      <span className="text-[10px] font-mono text-black/40">
                        {shortenAddress(msg.sender)}
                      </span>
                      {isMaker(msg.sender) && (
                        <span className="text-[9px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full font-medium">
                          Seller
                        </span>
                      )}
                    </div>
                  )}
                  <div
                    className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      self
                        ? "bg-orange-500 text-white rounded-br-md"
                        : "bg-black/[0.04] text-[#0a0a0a] rounded-bl-md"
                    }`}
                  >
                    {msg.text}
                  </div>
                  <div
                    className={`flex items-center gap-1.5 mt-1 ${
                      self ? "justify-end pr-1" : "pl-1"
                    }`}
                  >
                    <span className="text-[10px] text-black/25">
                      {formatTime(msg.timestamp)}
                    </span>
                    {self && (
                      <span className="text-[10px] text-black/20">
                        {msg.read ? "✓✓" : "✓"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input area */}
      <div className="border-t border-black/[0.06] p-3 bg-white rounded-b-2xl">
        {sendError && (
          <p className="text-xs text-red-500 mb-2 px-1">Failed to send message. Please try again.</p>
        )}
        <div className="flex gap-3">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
          maxLength={1000}
          className="flex-1 input-field text-sm py-2.5"
        />
        <button
          type="button"
          onClick={sendMessage}
          disabled={!input.trim() || sending}
          aria-label="Send message"
          className="px-4 py-2.5 bg-orange-500 text-white text-sm font-medium rounded-xl hover:bg-orange-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm shadow-orange-500/20"
        >
          {sending ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              className="text-white"
            >
              <path
                d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
        </div>
      </div>
    </div>
  );
}
