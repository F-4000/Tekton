"use client";

import { useParams, useRouter } from "next/navigation";
import { TraderProfileCard } from "@/components/TraderProfileCard";
import { useUserOffers, useOffersBatch } from "@/hooks/useEscrow";
import { OfferCard } from "@/components/OfferCard";
import { isValidEvmAddress, shortenAddress } from "@/lib/contract";
import { motion } from "framer-motion";

export default function TraderPage() {
  const params = useParams();
  const router = useRouter();
  const address = params.address as string;

  const isValid = isValidEvmAddress(address);

  const { data: offerIds, isLoading: offersLoading } = useUserOffers(
    isValid ? (address as `0x${string}`) : undefined,
  );

  const ids = (offerIds as bigint[]) ?? [];
  const { offers, isLoading: batchLoading } = useOffersBatch(ids);

  if (!isValid) {
    return (
      <div className="min-h-[80vh] max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center py-24"
        >
          <h1 className="text-3xl font-bold mb-4 text-red-500">Invalid Address</h1>
          <p className="text-black/50">
            &ldquo;{address}&rdquo; is not a valid EVM address.
          </p>
          <button
            onClick={() => router.push("/market")}
            className="mt-6 text-orange-500 hover:text-orange-600 text-sm transition-colors"
          >
            &larr; Back to Market
          </button>
        </motion.div>
      </div>
    );
  }

  const loading = offersLoading || batchLoading;

  return (
    <div className="min-h-[80vh] max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
      <button
        onClick={() => router.back()}
        className="text-sm text-black/40 hover:text-[#0a0a0a] mb-6 inline-block transition-colors"
      >
        &larr; Back
      </button>

      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2 text-[#0a0a0a]">
        Trader {shortenAddress(address)}
      </h1>
      <p className="text-black/50 max-w-xl mb-8">
        View this trader&apos;s reputation and active offers.
      </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="grid md:grid-cols-3 gap-6 mb-10"
      >
        <div className="md:col-span-1">
          <TraderProfileCard address={address as `0x${string}`} />
        </div>
        <div className="md:col-span-2">
          <div className="card p-6">
            <h3 className="font-medium text-sm text-black/50 mb-2">EVM Address</h3>
            <p className="font-mono text-sm text-[#0a0a0a] break-all">
              {address}
            </p>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
      >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-[#0a0a0a]">
          Offers ({ids.length})
        </h2>
        <div className="h-px flex-1 ml-6 bg-gradient-to-r from-black/[0.06] to-transparent" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="flex items-center gap-3 text-black/40">
            <div className="w-4 h-4 border-2 border-black/10 border-t-orange-500 rounded-full animate-spin" />
            Loading offers…
          </div>
        </div>
      ) : ids.length === 0 ? (
        <div className="text-center py-12 text-black/40">
          This trader has no offers yet.
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {ids.map((id, idx) => {
            const offer = offers[idx];
            if (!offer) return null;
            return <OfferCard key={id.toString()} offerId={id} offer={offer} />;
          })}
        </div>
      )}
      </motion.div>
    </div>
  );
}
