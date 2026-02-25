"use client";

import { useState } from "react";
import { useAccounts } from "@midl/react";
import { useEVMAddress } from "@midl/executor-react";
import { useUserOffers, useOffersBatch } from "@/hooks/useEscrow";
import { TraderProfileCard } from "@/components/TraderProfileCard";
import { WalletBalances } from "@/components/WalletBalances";
import { OfferCard } from "@/components/OfferCard";
import type { Offer } from "@/lib/contract";
import { motion } from "framer-motion";

function CopyableAddress({ address }: Readonly<{ address: string }>) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="group/copy flex items-center gap-2 font-mono text-sm text-[#0a0a0a] break-all text-left hover:text-orange-600 transition-colors"
      title="Copy to clipboard"
    >
      <span>{address}</span>
      <span className="shrink-0 text-black/20 group-hover/copy:text-orange-500 transition-colors">
        {copied ? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-green-500">
            <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path d="M7 3.5A1.5 1.5 0 018.5 2h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0117 6.622V12.5a1.5 1.5 0 01-1.5 1.5h-1v-3.379a3 3 0 00-.879-2.121L10.5 5.379A3 3 0 008.379 4.5H7v-1z" />
            <path d="M4.5 6A1.5 1.5 0 003 7.5v9A1.5 1.5 0 004.5 18h7a1.5 1.5 0 001.5-1.5v-5.879a1.5 1.5 0 00-.44-1.06L9.44 6.439A1.5 1.5 0 008.378 6H4.5z" />
          </svg>
        )}
      </span>
    </button>
  );
}

function OfferByIdCard({ offerId, offer }: Readonly<{ offerId: bigint; offer: Offer | undefined }>) {
  if (!offer) {
    return (
      <div className="card p-6">
        <div className="h-4 bg-black/[0.04] rounded w-24 animate-pulse" />
      </div>
    );
  }

  return (
    <OfferCard offerId={offerId} offer={offer} showActions={false} />
  );
}

export default function ProfilePage() {
  const { isConnected } = useAccounts();
  const evmAddress = useEVMAddress();
  const { data: offerIds, isLoading: offersLoading } = useUserOffers(
    evmAddress as `0x${string}` | undefined
  );

  const ids = (offerIds as bigint[]) ?? [];
  const { offers, isLoading: batchLoading } = useOffersBatch(ids);

  const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

  if (!isConnected || !evmAddress || evmAddress === ZERO_ADDR) {
    return (
      <div className="min-h-[80vh] max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center py-24"
        >
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4 text-[#0a0a0a]">My Profile</h1>
          <p className="text-black/50">Connect your wallet to view your profile</p>
        </motion.div>
      </div>
    );
  }

  const loading = offersLoading || batchLoading;

  return (
    <div className="min-h-[80vh] max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="mb-8"
      >
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2 text-[#0a0a0a]">My Profile</h1>
        <p className="text-black/50 max-w-xl">
          View your trading stats and manage your offers.
        </p>
      </motion.div>

      {/* Address bar - full width */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
        className="mb-6"
      >
        <div className="card px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-2">
          <span className="text-xs font-medium text-black/40 shrink-0">EVM Address</span>
          <CopyableAddress address={evmAddress} />
        </div>
      </motion.div>

      {/* Two-column: Trader Stats + Wallet Balances */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="grid md:grid-cols-2 gap-6 mb-10"
      >
        <TraderProfileCard address={evmAddress} />
        <WalletBalances evmAddress={evmAddress} />
      </motion.div>

      {/* Offers */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
      >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-[#0a0a0a]">
          My Offers ({ids.length})
        </h2>
        <div className="h-px flex-1 ml-6 bg-gradient-to-r from-black/[0.06] to-transparent" />
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <div className="flex items-center gap-3 text-black/40">
            <div className="w-4 h-4 border-2 border-black/10 border-t-orange-500 rounded-full animate-spin" />
            Loading your offers…
          </div>
        </div>
      )}
      {!loading && ids.length === 0 && (
        <div className="text-center py-12 text-black/40">
          You haven&apos;t created or participated in any offers yet.
        </div>
      )}
      {!loading && ids.length > 0 && (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {ids.map((id, idx) => (
            <OfferByIdCard key={id.toString()} offerId={id} offer={offers[idx]} />
          ))}
        </div>
      )}
      </motion.div>
    </div>
  );
}
