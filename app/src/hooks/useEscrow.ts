"use client";

import { useReadContract, useReadContracts } from "wagmi";
import { usePublicClient } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import {
  escrowContract,
  type Offer,
  type TraderProfile,
} from "@/lib/contract";

// ─── Read active offers (paginated) ──────────────────────────────

const OFFERS_PAGE_SIZE = 50;

export function useActiveOffers(offset = 0, limit = OFFERS_PAGE_SIZE) {
  return useReadContract({
    ...escrowContract,
    functionName: "getActiveOffersPaginated",
    args: [BigInt(offset), BigInt(limit)],
    query: {
      refetchInterval: 10_000, // poll every 10s
    },
  });
}

// ─── Read single offer ───────────────────────────────────────────

export function useOffer(offerId: bigint | undefined) {
  return useReadContract({
    ...escrowContract,
    functionName: "getOffer",
    args: offerId !== undefined ? [offerId] : undefined,
    query: {
      enabled: offerId !== undefined,
    },
  });
}

// ─── Read user offers ────────────────────────────────────────────

export function useUserOffers(address: `0x${string}` | undefined) {
  return useReadContract({
    ...escrowContract,
    functionName: "getUserOffers",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 10_000,
    },
  });
}

// ─── Read trader profile ─────────────────────────────────────────

export function useTraderProfile(address: `0x${string}` | undefined) {
  const profileResult = useReadContract({
    ...escrowContract,
    functionName: "getProfile",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const scoreResult = useReadContract({
    ...escrowContract,
    functionName: "getReliabilityScore",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  return {
    profile: profileResult.data as TraderProfile | undefined,
    score: scoreResult.data as bigint | undefined,
    isLoading: profileResult.isLoading || scoreResult.isLoading,
    error: profileResult.error || scoreResult.error,
  };
}

// ─── Read platform config ────────────────────────────────────────

export function usePlatformConfig() {
  const results = useReadContracts({
    contracts: [
      { ...escrowContract, functionName: "minStake" },
      { ...escrowContract, functionName: "platformFeeBps" },
      { ...escrowContract, functionName: "nextOfferId" },
    ],
  });

  return {
    minStake: results.data?.[0]?.result as bigint | undefined,
    platformFeeBps: results.data?.[1]?.result as bigint | undefined,
    totalOffers: results.data?.[2]?.result as bigint | undefined,
    isLoading: results.isLoading,
  };
}

// ─── Read multiple offers by ID (batched multicall) ──────────────

export function useOffersBatch(offerIds: bigint[]) {
  const contracts = offerIds.map((id) => ({
    address: escrowContract.address,
    abi: escrowContract.abi as readonly {
      name: string;
      type: string;
      stateMutability: string;
      inputs: readonly { name: string; type: string }[];
      outputs: readonly { name: string; type: string }[];
    }[],
    functionName: "getOffer" as const,
    args: [id] as const,
  }));

  const result = useReadContracts({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contracts: contracts as any,
    query: {
      enabled: offerIds.length > 0,
    },
  });

  return {
    offers: result.data?.map((r) => r.result as Offer | undefined) ?? [],
    isLoading: result.isLoading,
    error: result.error,
  };
}

// ─── Offer transaction receipts (event logs) ─────────────────────

export interface OfferTxReceipt {
  event: string;
  txHash: `0x${string}`;
  blockNumber: bigint;
}

/**
 * Fetch creation/settlement/cancel tx hashes for an offer by querying event logs.
 * Returns an array of { event, txHash, blockNumber } entries.
 */
export function useOfferTxReceipts(offerId: bigint | undefined) {
  const publicClient = usePublicClient();

  return useQuery({
    queryKey: ["offerTxReceipts", offerId?.toString()],
    enabled: offerId !== undefined && !!publicClient,
    staleTime: 60_000,
    queryFn: async (): Promise<OfferTxReceipt[]> => {
      if (!publicClient || offerId === undefined) return [];

      const results: OfferTxReceipt[] = [];

      // Use the full contract ABI to find events with indexed offerId
      const eventEntries = [
        "OfferCreated",
        "OfferSettled",
        "CancelRequested",
        "CancelFinalized",
        "OfferReclaimed",
      ] as const;

      for (const eventName of eventEntries) {
        try {
          const logs = await publicClient.getContractEvents({
            address: escrowContract.address as `0x${string}`,
            abi: escrowContract.abi,
            eventName,
            args: { offerId },
            fromBlock: 0n,
            toBlock: "latest",
          });

          for (const log of logs) {
            results.push({
              event: eventName,
              txHash: log.transactionHash!,
              blockNumber: log.blockNumber,
            });
          }
        } catch {
          // Skip events that fail (e.g. CancelRequested may not have indexed offerId)
        }
      }

      // Sort by block number
      results.sort((a, b) => Number(a.blockNumber - b.blockNumber));
      return results;
    },
  });
}
