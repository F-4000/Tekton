"use client";

import { useActiveOffers } from "@/hooks/useEscrow";
import { OfferCard } from "./OfferCard";
import { useEVMAddress } from "@midl/executor-react";
import type { Offer } from "@/lib/contract";

export function OfferList() {
  const { data, isLoading, error } = useActiveOffers();
  const evmAddress = useEVMAddress();

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <div className="flex items-center gap-3 text-black/40">
          <div className="w-4 h-4 border-2 border-black/10 border-t-orange-500 rounded-full animate-spin" />
          Loading offers…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-24">
        <p className="text-red-500/80 text-sm">Failed to load offers: {error.message}</p>
      </div>
    );
  }

  const result = data as [bigint[], Offer[], bigint] | undefined;
  const ids = result?.[0] ?? [];
  const offers = result?.[1] ?? [];
  // totalActive available at result?.[2] for future pagination UI

  if (offers.length === 0) {
    return (
      <div className="text-center py-24">
        <p className="text-black/50 text-lg mb-1">No open offers yet</p>
        <p className="text-black/30 text-sm">
          Be the first to create an OTC offer
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      {offers.map((offer, idx) => (
        <OfferCard key={ids[idx].toString()} offerId={ids[idx]} offer={offer} userAddress={evmAddress ?? undefined} />
      ))}
    </div>
  );
}
