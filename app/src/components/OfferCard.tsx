"use client";

import Link from "next/link";
import { useTraderProfile, useOfferTxReceipts } from "@/hooks/useEscrow";
import {
  type Offer,
  OfferStatus,
  formatBTC,
  formatTokenAmount,
  shortenAddress,
  timeLeft,
  getStatusColor,
  getStatusLabel,
  getReliabilityBadge,
  adjustedScore,
  CANCEL_COOLDOWN,
  ZERO_ADDRESS,
  tokenLabel,
  evmTxUrl,
} from "@/lib/contract";

interface OfferCardProps {
  offerId: bigint;
  offer: Offer;
  showActions?: boolean;
  userAddress?: string;
}

export function OfferCard({
  offerId,
  offer,
  showActions = true,
  userAddress,
}: OfferCardProps) {
  const isExpired = BigInt(Math.floor(Date.now() / 1000)) >= offer.expiry;
  const isOpen = offer.status === OfferStatus.Open;
  const isMine = userAddress && offer.maker.toLowerCase() === userAddress.toLowerCase();

  const { profile, score } = useTraderProfile(offer.maker as `0x${string}`);
  const rawScore = score ? Number(score) : 0;
  const reliabilityScore = adjustedScore(rawScore, Number(profile?.tradesCompleted ?? 0n));
  const badge = getReliabilityBadge(reliabilityScore, profile?.tradesCompleted);

  const { data: txReceipts } = useOfferTxReceipts(offerId);
  const creationTx = txReceipts?.find((r) => r.event === "OfferCreated");

  const cancelRequested = offer.cancelRequestedAt > 0n;
  const cancelReady =
    cancelRequested &&
    BigInt(Math.floor(Date.now() / 1000)) >=
      offer.cancelRequestedAt + CANCEL_COOLDOWN;

  const isPrivate = offer.allowedTaker !== ZERO_ADDRESS;

  return (
    <Link
      href={`/offer/${offerId.toString()}`}
      aria-label={`Offer #${offerId.toString()}: ${formatTokenAmount(offer.makerAmount, offer.makerToken)} ${tokenLabel(offer.makerToken)} for ${formatTokenAmount(offer.takerAmount, offer.takerToken)} ${tokenLabel(offer.takerToken)}`}
      className={`block card card-hover p-6 cursor-pointer group ${
        isMine ? "ring-2 ring-amber-400/60 shadow-[0_0_12px_rgba(251,191,36,0.15)]" : ""
      }`}
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <span className="text-xs text-black/40 font-mono">
          #{offerId.toString()}
        </span>
        <div className="flex items-center gap-2">
          {isMine && (
            <span className="text-[10px] uppercase tracking-wider bg-amber-500/10 text-amber-600 px-2.5 py-1 rounded-full border border-amber-500/20">
              Your Offer
            </span>
          )}
          {isPrivate && (
            <span className="text-[10px] uppercase tracking-wider bg-purple-500/10 text-purple-600 px-2.5 py-1 rounded-full border border-purple-500/20">
              Private
            </span>
          )}
          {cancelRequested && !cancelReady && (
            <span className="text-[10px] uppercase tracking-wider bg-yellow-500/10 text-yellow-600 px-2.5 py-1 rounded-full border border-yellow-500/20">
              Cancel Pending
            </span>
          )}
          <span className={`text-xs font-medium ${getStatusColor(offer.status)}`}>
            {isExpired && isOpen ? "Expired" : getStatusLabel(offer.status)}
          </span>
        </div>
      </div>

      {/* Trade pair */}
      <div className="space-y-3 mb-5">
        <div className="flex justify-between items-center">
          <span className="text-black/50 text-sm">Selling</span>
          <span className="font-medium text-[#0a0a0a]">
            {formatTokenAmount(offer.makerAmount, offer.makerToken)}{" "}
            <span className="text-orange-500">
              {tokenLabel(offer.makerToken)}
            </span>
          </span>
        </div>
        <div className="flex justify-center">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-black/20">
            <path d="M8 2v12M4 6l4-4 4 4M4 10l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-black/50 text-sm">Wants</span>
          <span className="font-medium text-[#0a0a0a]">
            {formatTokenAmount(offer.takerAmount, offer.takerToken)}{" "}
            <span className="text-orange-500">
              {tokenLabel(offer.takerToken)}
            </span>
          </span>
        </div>
      </div>

      {/* Details */}
      <div className="border-t border-black/[0.06] pt-4 space-y-2">
        <div className="flex justify-between text-xs text-black/40">
          <span>Maker</span>
          <span className="font-mono">{shortenAddress(offer.maker)}</span>
        </div>
        {/* Reputation */}
        <div className="flex justify-between items-center text-xs text-black/40">
          <span>Reputation</span>
          <div className="flex items-center gap-2">
            <span className={`font-medium ${badge.color}`}>{badge.label}</span>
            <span className="text-black/20">·</span>
            <span>{profile ? profile.tradesCompleted.toString() : "0"} trades</span>
            {profile && profile.totalVolume > 0n && (
              <>
                <span className="text-black/20">·</span>
                <span>{formatBTC(profile.totalVolume)} BTC</span>
              </>
            )}
          </div>
        </div>
        <div className="flex justify-between text-xs text-black/40">
          <span>Stake</span>
          <span>{formatBTC(offer.stake)} BTC</span>
        </div>
        <div className="flex justify-between text-xs text-black/40">
          <span>Expires</span>
          <span>{isExpired ? "Expired" : timeLeft(offer.expiry)}</span>
        </div>
        {creationTx && (
          <div className="flex justify-between text-xs text-black/40">
            <span>Tx Receipt</span>
            <a
              href={evmTxUrl(creationTx.txHash)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 font-mono text-orange-500 hover:text-orange-600 transition-colors"
            >
              {creationTx.txHash.slice(0, 8)}…{creationTx.txHash.slice(-4)}
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" className="shrink-0">
                <path d="M3.5 2H10V8.5M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
          </div>
        )}
      </div>

      {/* CTA */}
      {showActions && isOpen && !isExpired && (
        <div className="mt-5 text-center">
          <span className="text-sm text-orange-500 font-medium group-hover:text-orange-600 transition-colors">
            View Details &rarr;
          </span>
        </div>
      )}
    </Link>
  );
}
