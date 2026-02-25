"use client";

import { useState, useMemo } from "react";
import { useActiveOffers } from "@/hooks/useEscrow";
import { OfferCard } from "./OfferCard";
import { useEVMAddress } from "@midl/executor-react";
import { KNOWN_TOKENS } from "@/config/midl";
import type { Offer } from "@/lib/contract";

const PAGE_SIZE = 50;

export function OfferList() {
  const [page, setPage] = useState(0);
  const [tokenFilter, setTokenFilter] = useState<string>("all");
  const { data, isLoading, error } = useActiveOffers(page * PAGE_SIZE, PAGE_SIZE);
  const evmAddress = useEVMAddress();

  const result = data as [bigint[], Offer[], bigint] | undefined;
  const ids = useMemo(() => result?.[0] ?? [], [result]);
  const offers = useMemo(() => result?.[1] ?? [], [result]);
  const totalActive = result?.[2] ? Number(result[2]) : 0;

  const totalPages = Math.max(1, Math.ceil(totalActive / PAGE_SIZE));

  // Filter offers by token
  const filtered = useMemo(() => {
    if (tokenFilter === "all") {
      return { ids, offers };
    }
    const filterLower = tokenFilter.toLowerCase();
    const filteredIds: bigint[] = [];
    const filteredOffers: Offer[] = [];
    for (let i = 0; i < offers.length; i++) {
      if (
        offers[i].makerToken.toLowerCase() === filterLower ||
        offers[i].takerToken.toLowerCase() === filterLower
      ) {
        filteredIds.push(ids[i]);
        filteredOffers.push(offers[i]);
      }
    }
    return { ids: filteredIds, offers: filteredOffers };
  }, [ids, offers, tokenFilter]);

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

  return (
    <div>
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <span className="text-xs text-black/40 uppercase tracking-wider mr-1">Token</span>
        <button
          onClick={() => setTokenFilter("all")}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
            tokenFilter === "all"
              ? "bg-orange-500 text-white border-orange-500"
              : "border-black/10 text-black/50 hover:border-orange-300 hover:text-orange-500"
          }`}
        >
          All
        </button>
        {KNOWN_TOKENS.map((t) => (
          <button
            key={t.address}
            onClick={() => setTokenFilter(t.address)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              tokenFilter === t.address
                ? "bg-orange-500 text-white border-orange-500"
                : "border-black/10 text-black/50 hover:border-orange-300 hover:text-orange-500"
            }`}
          >
            {t.symbol}
          </button>
        ))}
      </div>

      {filtered.offers.length === 0 ? (
        <div className="text-center py-24">
          <p className="text-black/50 text-lg mb-1">
            {offers.length === 0 ? "No open offers yet" : "No offers match this filter"}
          </p>
          <p className="text-black/30 text-sm">
            {offers.length === 0
              ? "Be the first to create an OTC offer"
              : "Try a different token filter"}
          </p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filtered.offers.map((offer, idx) => (
            <OfferCard
              key={filtered.ids[idx].toString()}
              offerId={filtered.ids[idx]}
              offer={offer}
              userAddress={evmAddress ?? undefined}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-8">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="text-sm px-3 py-1.5 rounded-lg border border-black/10 text-black/50 hover:border-orange-300 hover:text-orange-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            ← Prev
          </button>
          <span className="text-xs text-black/40">
            Page {page + 1} of {totalPages} · {totalActive} active offers
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="text-sm px-3 py-1.5 rounded-lg border border-black/10 text-black/50 hover:border-orange-300 hover:text-orange-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
