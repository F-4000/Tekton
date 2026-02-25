"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useOffer, useOfferTxReceipts, usePlatformConfig } from "@/hooks/useEscrow";
import { useAccounts } from "@midl/react";
import { useEVMAddress } from "@midl/executor-react";
import { encodeFunctionData } from "viem";
import { useState } from "react";
import {
  escrowContract,
  erc20Abi,
  type Offer,
  OfferStatus,
  formatBTC,
  formatTokenAmount,
  isNativeBTC,
  shortenAddress,
  timeLeft,
  getStatusColor,
  getStatusLabel,
  ZERO_ADDRESS,
  tokenLabel,
  evmTxUrl,
  evmAddressUrl,
} from "@/lib/contract";
import { TraderProfileCard } from "@/components/TraderProfileCard";
import { StepItem } from "@/components/StepItem";
import { useMidlTx } from "@/hooks/useMidlTx";
import { motion } from "framer-motion";

export default function OfferDetailPage() {
  const params = useParams();
  const router = useRouter();

  // Parse offer ID - validate after hooks (Rules of Hooks)
  let parsedId: bigint | null = null;
  try {
    parsedId = BigInt(params.id as string);
  } catch {
    // handled below after hooks
  }

  const { data: offerData, refetch } = useOffer(parsedId ?? undefined);
  const offer = offerData as Offer | undefined;
  const { cancelCooldown: contractCooldown } = usePlatformConfig();
  const CANCEL_COOLDOWN = contractCooldown ?? 1800n; // fallback to 30min

  const { isConnected } = useAccounts();
  const evmAddress = useEVMAddress();

  // Fetch on-chain transaction receipts for this offer
  const { data: txReceipts } = useOfferTxReceipts(parsedId ?? undefined);

  // MIDL tx flow via shared hook
  const [actionType, setActionType] = useState<string>("");
  const tx = useMidlTx({
    onSuccess: () => refetch(),
  });

  // Early returns AFTER all hooks
  if (parsedId === null) {
    return (
      <div className="min-h-[80vh] max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center py-24"
        >
          <h1 className="text-3xl font-bold mb-4 text-red-500">Invalid Offer ID</h1>
          <p className="text-black/50">The offer ID &ldquo;{params.id}&rdquo; is not valid.</p>
          <button onClick={() => router.push("/market")} className="mt-6 text-orange-500 hover:text-orange-600 text-sm transition-colors">&larr; Back to Market</button>
        </motion.div>
      </div>
    );
  }

  const offerId = parsedId;

  if (!offer) {
    return (
      <div className="flex justify-center py-24">
        <div className="flex items-center gap-3 text-black/40">
          <div className="w-4 h-4 border-2 border-black/10 border-t-orange-500 rounded-full animate-spin" />
          Loading offer…
        </div>
      </div>
    );
  }

  // Guard against non-existent offers (mapping returns zero-initialized struct)
  if (offer.maker === ZERO_ADDRESS) {
    return (
      <div className="min-h-[80vh] max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center py-24"
        >
          <h1 className="text-3xl font-bold mb-4 text-red-500">Offer Not Found</h1>
          <p className="text-black/50">Offer #{offerId.toString()} does not exist.</p>
          <button onClick={() => router.push("/market")} className="mt-6 text-orange-500 hover:text-orange-600 text-sm transition-colors">&larr; Back to Market</button>
        </motion.div>
      </div>
    );
  }

  const isMaker = evmAddress?.toLowerCase() === offer.maker.toLowerCase();
  const isExpired = BigInt(Math.floor(Date.now() / 1000)) >= offer.expiry;
  const isOpen = offer.status === OfferStatus.Open;
  const cancelRequested = offer.cancelRequestedAt > 0n;
  const cancelReady =
    cancelRequested &&
    BigInt(Math.floor(Date.now() / 1000)) >=
      offer.cancelRequestedAt + CANCEL_COOLDOWN;
  const isPrivate = offer.allowedTaker !== ZERO_ADDRESS;
  const canAccept =
    isConnected &&
    isOpen &&
    !isExpired &&
    !isMaker &&
    (!isPrivate ||
      evmAddress?.toLowerCase() === offer.allowedTaker.toLowerCase());

  // ─── Action handlers ──────────────────────────────────────────

  const startAction = (
    action: string,
    functionName: string,
    args: unknown[],
    value?: bigint,
    approvalToken?: `0x${string}`,
    approvalAmount?: bigint,
  ) => {
    setActionType(action);
    tx.begin();

    // If ERC20 approval is needed, add it as the first intention
    if (approvalToken && approvalAmount) {
      tx.addIntention({
        reset: true,
        intention: {
          evmTransaction: {
            to: approvalToken,
            data: encodeFunctionData({
              abi: erc20Abi,
              functionName: "approve",
              args: [escrowContract.address, approvalAmount],
            }),
          },
        },
      });
    }

    tx.addIntention({
      reset: !(approvalToken && approvalAmount),
      intention: {
        evmTransaction: {
          to: escrowContract.address,
          data: encodeFunctionData({
            abi: escrowContract.abi,
            functionName,
            args,
          }),
          ...(value ? { value } : {}),
        },
      },
    });
  };

  const handleAccept = () => {
    if (!offer) return;
    const value = isNativeBTC(offer.takerToken) ? offer.takerAmount : 0n;
    const needsApproval = !isNativeBTC(offer.takerToken);
    startAction(
      "Accept Trade",
      "acceptOffer",
      [offerId],
      value,
      needsApproval ? offer.takerToken : undefined,
      needsApproval ? offer.takerAmount : undefined,
    );
  };

  const handleRequestCancel = () => {
    startAction("Request Cancel", "requestCancel", [offerId]);
  };

  const handleFinalizeCancel = () => {
    startAction("Finalize Cancel", "finalizeCancel", [offerId]);
  };

  const handleReclaim = () => {
    startAction("Reclaim Expired", "reclaimExpired", [offerId]);
  };

  const handleResetAction = () => {
    tx.handleReset();
    setActionType("");
  };

  return (
    <div className="min-h-[80vh] max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
      <button
        onClick={() => router.push("/market")}
        className="text-sm text-black/40 hover:text-[#0a0a0a] mb-6 inline-block transition-colors"
      >
        &larr; Back to Market
      </button>

      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-8 text-[#0a0a0a]">
        Offer #{offerId.toString()}
      </h1>

      <div className="grid md:grid-cols-3 gap-6 mb-6 max-w-2xl">
        {/* Offer details card */}
        <div className="md:col-span-2 card p-6 sm:p-8 space-y-5">
          {/* Status */}
          <div className="flex justify-between items-center">
            <span className={`text-sm font-semibold ${getStatusColor(offer.status)}`}>
              {isExpired && isOpen ? "Expired" : getStatusLabel(offer.status)}
            </span>
            <div className="flex gap-2">
              {isPrivate && (
                <span className="text-[10px] uppercase tracking-wider bg-purple-50 text-purple-600 px-2.5 py-1 rounded-full border border-purple-200">
                  Private
                </span>
              )}
              {cancelRequested && !cancelReady && (
                <span className="text-[10px] uppercase tracking-wider bg-yellow-50 text-yellow-600 px-2.5 py-1 rounded-full border border-yellow-200">
                  Cancel Pending
                </span>
              )}
            </div>
          </div>

          {/* Trade pair */}
          <div className="border-t border-black/[0.06] pt-5 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-black/50">Selling</span>
              <span className="text-lg font-semibold text-[#0a0a0a]">
                {formatTokenAmount(offer.makerAmount, offer.makerToken)}{" "}
                <span className="text-orange-500">
                  {tokenLabel(offer.makerToken)}
                </span>
              </span>
            </div>
            <div className="flex justify-center">
              <svg width="20" height="20" viewBox="0 0 16 16" fill="none" className="text-black/20">
                <path d="M8 2v12M4 6l4-4 4 4M4 10l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-black/50">Wants</span>
              <span className="text-lg font-semibold text-[#0a0a0a]">
                {formatTokenAmount(offer.takerAmount, offer.takerToken)}{" "}
                <span className="text-orange-500">
                  {tokenLabel(offer.takerToken)}
                </span>
              </span>
            </div>
          </div>

          {/* Details grid */}
          <div className="border-t border-black/[0.06] pt-5 grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-black/40 text-xs">Maker</span>
              <div className="font-mono mt-0.5 text-[#0a0a0a] flex items-center gap-1.5">
                <Link href={`/trader/${offer.maker}`} className="hover:text-orange-500 transition-colors">
                  {shortenAddress(offer.maker)}
                </Link>
                <a
                  href={evmAddressUrl(offer.maker)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-black/20 hover:text-orange-400 transition-colors"
                  title="View on Blockscout"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M3.5 2H10V8.5M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </a>
              </div>
            </div>
            {offer.taker !== ZERO_ADDRESS && (
              <div>
                <span className="text-black/40 text-xs">Taker</span>
                <div className="font-mono mt-0.5 text-[#0a0a0a]">{shortenAddress(offer.taker)}</div>
              </div>
            )}
            <div>
              <span className="text-black/40 text-xs">Stake</span>
              <div className="mt-0.5 text-[#0a0a0a]">{formatBTC(offer.stake)} BTC</div>
            </div>
            <div>
              <span className="text-black/40 text-xs">Expires</span>
              <div className="mt-0.5 text-[#0a0a0a]">{isExpired ? "Expired" : timeLeft(offer.expiry)}</div>
            </div>
            {isPrivate && (
              <div className="col-span-2">
                <span className="text-black/40 text-xs">Allowed Taker</span>
                <div className="font-mono text-sm text-purple-600 mt-0.5">
                  {shortenAddress(offer.allowedTaker)}
                </div>
              </div>
            )}
          </div>

          {/* Transaction History */}
          {txReceipts && txReceipts.length > 0 && (
            <div className="border-t border-black/[0.06] pt-5">
              <h4 className="text-xs uppercase tracking-wider text-black/40 mb-3">Transaction Receipts</h4>
              <div className="space-y-2">
                {txReceipts.map((receipt) => {
                  const eventLabels: Record<string, { label: string; icon: string; color: string }> = {
                    OfferCreated: { label: "Created", icon: "✦", color: "text-green-600" },
                    OfferSettled: { label: "Settled", icon: "✓", color: "text-blue-600" },
                    CancelRequested: { label: "Cancel Requested", icon: "⏳", color: "text-yellow-600" },
                    CancelFinalized: { label: "Cancelled", icon: "✕", color: "text-red-500" },
                    OfferReclaimed: { label: "Reclaimed", icon: "↩", color: "text-orange-500" },
                  };
                  const meta = eventLabels[receipt.event] ?? { label: receipt.event, icon: "•", color: "text-black/50" };
                  return (
                    <a
                      key={receipt.txHash}
                      href={evmTxUrl(receipt.txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 rounded-lg bg-black/[0.02] hover:bg-black/[0.04] border border-black/[0.04] transition-colors group"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={`text-sm ${meta.color}`}>{meta.icon}</span>
                        <span className={`text-sm font-medium ${meta.color}`}>{meta.label}</span>
                        <span className="text-xs text-black/30">Block #{receipt.blockNumber.toString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-black/40 group-hover:text-orange-500 transition-colors">
                          {receipt.txHash.slice(0, 10)}…{receipt.txHash.slice(-6)}
                        </span>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-black/20 group-hover:text-orange-400 transition-colors shrink-0">
                          <path d="M3.5 2H10V8.5M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action buttons - only visible when idle */}
          {isConnected && tx.status === "idle" && (
            <div className="border-t border-black/[0.06] pt-5 flex gap-3">
              {canAccept && (
                <button
                  onClick={handleAccept}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-3 rounded-lg transition-all duration-300 shadow-lg shadow-emerald-600/20"
                >
                  Accept Trade
                </button>
              )}
              {isMaker && isOpen && !isExpired && !cancelRequested && (
                <button
                  onClick={handleRequestCancel}
                  className="flex-1 btn-secondary py-3"
                >
                  Request Cancel
                </button>
              )}
              {isMaker && isOpen && cancelReady && (
                <button
                  onClick={handleFinalizeCancel}
                  className="flex-1 bg-red-600/80 hover:bg-red-500/80 text-white font-medium py-3 rounded-lg transition-all duration-300"
                >
                  Finalize Cancel
                </button>
              )}
              {isMaker && isOpen && isExpired && (
                <button
                  onClick={handleReclaim}
                  className="flex-1 bg-yellow-600/80 hover:bg-yellow-500/80 text-white font-medium py-3 rounded-lg transition-all duration-300"
                >
                  Reclaim Funds
                </button>
              )}
            </div>
          )}

          {/* Transaction progress */}
          {tx.status !== "idle" && tx.status !== "success" && (
            <div className="border-t border-black/[0.06] pt-5 space-y-4">
              <h4 className="font-medium text-sm text-black/50">
                {actionType}: Transaction Progress
              </h4>
              <div className="space-y-2.5">
                <StepItem
                  label="1. Add Transaction Intention"
                  active={tx.status === "adding-intention"}
                  done={["finalizing", "signing", "broadcasting", "confirming"].includes(tx.status)}
                />
                <StepItem
                  label="2. Finalize BTC Transaction"
                  active={tx.status === "finalizing"}
                  done={["signing", "broadcasting", "confirming"].includes(tx.status)}
                  actionLabel="Finalize"
                  onAction={
                    tx.status === "adding-intention" && tx.txIntentions.length > 0
                      ? tx.handleFinalize
                      : undefined
                  }
                  disabled={tx.isProcessing}
                />
                <StepItem
                  label="3. Sign Intentions"
                  active={tx.status === "signing"}
                  done={["broadcasting", "confirming"].includes(tx.status)}
                  actionLabel="Sign"
                  onAction={
                    tx.status === "finalizing" && tx.btcTxData
                      ? tx.handleSign
                      : undefined
                  }
                  disabled={tx.isProcessing}
                />
                <StepItem
                  label="4. Broadcast"
                  active={tx.status === "broadcasting"}
                  done={["confirming"].includes(tx.status)}
                  actionLabel="Broadcast"
                  onAction={
                    tx.status === "signing" &&
                    tx.txIntentions.every((it) => it.signedEvmTransaction)
                      ? tx.handleBroadcast
                      : undefined
                  }
                  disabled={tx.isProcessing}
                />
                <StepItem
                  label="5. Confirming on-chain…"
                  active={tx.status === "confirming"}
                  done={false}
                />
              </div>
              {tx.error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">
                  {tx.error}
                  <button
                    onClick={handleResetAction}
                    className="ml-2 text-red-500 underline hover:text-red-600"
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Success */}
          {tx.status === "success" && (
            <div className="border-t border-black/[0.06] pt-5">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center">
                <div className="text-3xl mb-2 text-emerald-500">&#10003;</div>
                <p className="text-emerald-600 font-medium">
                  {actionType} completed successfully!
                </p>
                <button
                  onClick={handleResetAction}
                  className="mt-3 text-sm text-black/50 hover:text-[#0a0a0a] transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Maker profile sidebar */}
        <div className="md:col-span-1 space-y-4">
          <div>
            <h3 className="text-xs uppercase tracking-wider text-black/40 mb-3">Maker Profile</h3>
            <TraderProfileCard address={offer.maker as `0x${string}`} />
          </div>
        </div>
      </div>

      {/* Message Seller - below the main grid */}
      {isConnected && !isMaker && (
        <div className="max-w-2xl mt-6">
          <Link
            href={`/messages/${offerId.toString()}`}
            className="card p-4 flex items-center gap-3 hover:bg-black/[0.02] transition-colors group"
          >
            <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-orange-500">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="flex-1">
              <span className="text-sm font-medium text-[#0a0a0a] group-hover:text-orange-500 transition-colors">
                Message Seller
              </span>
              <p className="text-xs text-black/40">Send a private message about this trade</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 16 16" className="text-black/20 group-hover:text-orange-400 transition-colors">
              <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
        </div>
      )}

      {/* View Messages - for maker */}
      {isConnected && isMaker && (
        <div className="max-w-2xl mt-6">
          <Link
            href={`/messages/${offerId.toString()}`}
            className="card p-4 flex items-center gap-3 hover:bg-black/[0.02] transition-colors group"
          >
            <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-orange-500">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="flex-1">
              <span className="text-sm font-medium text-[#0a0a0a] group-hover:text-orange-500 transition-colors">
                View Messages
              </span>
              <p className="text-xs text-black/40">Check messages from potential buyers</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 16 16" className="text-black/20 group-hover:text-orange-400 transition-colors">
              <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
        </div>
      )}
      </motion.div>
    </div>
  );
}
