"use client";

import { OfferList } from "@/components/OfferList";
import { usePlatformConfig } from "@/hooks/useEscrow";
import { formatBTC } from "@/lib/contract";
import Link from "next/link";
import { motion } from "framer-motion";

export default function MarketPage() {
  const { totalOffers, minStake, platformFeeBps } = usePlatformConfig();

  return (
    <div className="min-h-[80vh] max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="mb-12"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#0a0a0a]">Market</h1>
          <Link href="/create" className="btn-primary">
            + New Offer
          </Link>
        </div>
        <p className="text-black/50 max-w-xl">
          Browse open OTC offers. Accept trades instantly with trustless escrow protection.
        </p>
      </motion.div>

      {/* Stats bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10"
      >
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold font-brand text-[#0a0a0a]">
            {totalOffers?.toString() ?? "—"}
          </div>
          <div className="text-xs text-black/40 uppercase tracking-wider mt-1">
            Total Offers
          </div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold font-brand text-[#0a0a0a]">
            {minStake ? formatBTC(minStake) : "—"}
          </div>
          <div className="text-xs text-black/40 uppercase tracking-wider mt-1">
            Min Stake
          </div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold font-brand text-[#0a0a0a]">
            {platformFeeBps ? `${Number(platformFeeBps) / 100}%` : "—"}
          </div>
          <div className="text-xs text-black/40 uppercase tracking-wider mt-1">
            Platform Fee
          </div>
        </div>
      </motion.div>

      {/* Offers grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
      >
        <OfferList />
      </motion.div>
    </div>
  );
}
