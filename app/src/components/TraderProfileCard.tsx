"use client";

import { useState } from "react";
import { useTraderProfile } from "@/hooks/useEscrow";
import {
  getReliabilityBadge,
  adjustedScore,
  shortenAddress,
} from "@/lib/contract";

interface TraderProfileCardProps {
  address: `0x${string}`;
}

/**
 * Compute a human-readable score breakdown matching the on-chain formula.
 * completionPts = (tradesCompleted * 80) / totalOffers  (max 80)
 * agePts = min(daysSinceFirst / 90, 1) * 10             (max 10)
 * volumePts = min(totalVolume / 10e18, 1) * 10           (max 10)
 */
function computeScoreBreakdown(profile: {
  tradesCompleted: bigint;
  offersCancelled: bigint;
  offersExpired: bigint;
  totalVolume: bigint;
  firstTradeAt: bigint;
}) {
  const total =
    Number(profile.tradesCompleted) +
    Number(profile.offersCancelled) +
    Number(profile.offersExpired);

  if (total === 0) return { completion: 0, age: 0, volume: 0 };

  const completion = Math.floor(
    (Number(profile.tradesCompleted) * 80) / total
  );

  let age = 0;
  if (profile.firstTradeAt > 0n) {
    const daysSince = Math.floor(
      (Date.now() / 1000 - Number(profile.firstTradeAt)) / 86400
    );
    age = daysSince >= 90 ? 10 : Math.floor((daysSince * 10) / 90);
  }

  const volumeCap = 10n * 10n ** 18n; // 10 BTC
  const volume =
    profile.totalVolume >= volumeCap
      ? 10
      : Number((profile.totalVolume * 10n) / volumeCap);

  return { completion, age, volume };
}

export function TraderProfileCard({ address }: TraderProfileCardProps) {
  const { profile, score, isLoading } = useTraderProfile(address);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="card p-6">
        <div className="h-4 bg-black/[0.04] rounded w-32 mb-4 animate-pulse" />
        <div className="h-3 bg-black/[0.04] rounded w-24 animate-pulse" />
      </div>
    );
  }

  if (!profile) return null;

  const rawScore = score ? Number(score) : 0;
  const trades = Number(profile.tradesCompleted);
  const reliabilityScore = adjustedScore(rawScore, trades);
  const badge = getReliabilityBadge(reliabilityScore, profile.tradesCompleted);
  const rawBreakdown = computeScoreBreakdown(profile);
  // Scale breakdown to match confidence-adjusted score
  const confidence = trades > 0 ? Math.min(trades / 10, 1) : 0;
  const breakdown = {
    completion: Math.round(rawBreakdown.completion * confidence),
    age: Math.round(rawBreakdown.age * confidence),
    volume: Math.round(rawBreakdown.volume * confidence),
  };

  return (
    <div className="card p-6">
      <div className="flex justify-between items-center mb-5">
        <button
          onClick={handleCopy}
          className="group/addr font-mono text-sm text-black/40 hover:text-orange-600 transition-colors flex items-center gap-1.5"
          title="Copy address"
        >
          {shortenAddress(address)}
          <span className="text-black/15 group-hover/addr:text-orange-400 transition-colors">
            {copied ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 text-green-500">
                <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                <path d="M5.5 3.5A1.5 1.5 0 0 1 7 2h2.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 1 .439 1.061V9.5A1.5 1.5 0 0 1 12 11h-.5V8.621a3 3 0 0 0-.879-2.121L8 3.879A3 3 0 0 0 5.879 3H5.5Z" />
                <path d="M4 5a1.5 1.5 0 0 0-1.5 1.5v6A1.5 1.5 0 0 0 4 14h5a1.5 1.5 0 0 0 1.5-1.5V8.621a1.5 1.5 0 0 0-.44-1.06L7.44 4.94A1.5 1.5 0 0 0 6.378 4.5H4Z" />
              </svg>
            )}
          </span>
        </button>
        <span className={`text-sm font-bold ${badge.color}`}>
          {badge.label}
        </span>
      </div>

      {/* Score bar with breakdown */}
      <div className="mb-5">
        <div className="flex justify-between text-xs text-black/40 mb-2">
          <span>Reliability</span>
          <span className="text-[#0a0a0a]">{reliabilityScore}/100</span>
        </div>
        {/* Stacked bar showing score components */}
        <div className="h-1.5 bg-black/[0.04] rounded-full overflow-hidden flex">
          {breakdown.completion > 0 && (
            <div
              className="h-full bg-orange-500"
              style={{ width: `${breakdown.completion}%` }}
              title={`Completion: ${breakdown.completion}/80`}
            />
          )}
          {breakdown.age > 0 && (
            <div
              className="h-full bg-orange-300"
              style={{ width: `${breakdown.age}%` }}
              title={`Account age: ${breakdown.age}/10`}
            />
          )}
          {breakdown.volume > 0 && (
            <div
              className="h-full bg-orange-200"
              style={{ width: `${breakdown.volume}%` }}
              title={`Volume: ${breakdown.volume}/10`}
            />
          )}
        </div>
        <div className="flex gap-3 mt-1.5 text-[10px] text-black/30">
          <span>Completion {breakdown.completion}/80</span>
          <span>Age {breakdown.age}/10</span>
          <span>Volume {breakdown.volume}/10</span>
        </div>
      </div>

      {/* Stats - 3 columns, volume removed (on-chain tracking is inaccurate for non-BTC tokens) */}
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <div className="text-black/40 text-xs mb-0.5">Trades</div>
          <div className="font-medium text-[#0a0a0a]">
            {profile.tradesCompleted.toString()}
          </div>
        </div>
        <div>
          <div className="text-black/40 text-xs mb-0.5">Cancelled</div>
          <div className="font-medium text-red-500">
            {profile.offersCancelled.toString()}
          </div>
        </div>
        <div>
          <div className="text-black/40 text-xs mb-0.5">Expired</div>
          <div className="font-medium text-yellow-600">
            {profile.offersExpired.toString()}
          </div>
        </div>
      </div>

      {profile.firstTradeAt > 0n && (
        <div className="mt-4 pt-4 border-t border-black/[0.04] text-xs text-black/30">
          Trading since{" "}
          {new Date(Number(profile.firstTradeAt) * 1000).toLocaleDateString()}
        </div>
      )}

      {badge.nextTier && (
        <div className="mt-3 text-[10px] text-black/25">
          Next: <span className="font-medium">{badge.nextTier}</span> · {badge.requirement}
        </div>
      )}
    </div>
  );
}
