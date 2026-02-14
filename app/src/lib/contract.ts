import { TEKTON_ESCROW_ADDRESS, KNOWN_TOKENS } from "@/config/midl";
import { parseEther, parseUnits, formatEther, formatUnits } from "viem";
import artifact from "@/abi/TektonEscrow.json";

export const escrowContract = {
  address: TEKTON_ESCROW_ADDRESS,
  abi: artifact.abi,
} as const;

/** Minimal ERC20 ABI for approve + balanceOf (used in escrow interactions) */
export const erc20Abi = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// ─── Types ───────────────────────────────────────────────────────

export enum OfferStatus {
  Open = 0,
  Settled = 1,
  Cancelled = 2,
  Expired = 3,
}

export interface Offer {
  maker: `0x${string}`;
  makerToken: `0x${string}`;
  makerAmount: bigint;
  takerToken: `0x${string}`;
  takerAmount: bigint;
  stake: bigint;
  expiry: bigint;
  cancelRequestedAt: bigint;
  allowedTaker: `0x${string}`;
  taker: `0x${string}`;
  status: OfferStatus;
}

export interface TraderProfile {
  tradesCompleted: bigint;
  totalVolume: bigint;
  offersCancelled: bigint;
  offersExpired: bigint;
  firstTradeAt: bigint;
}

// ─── Helpers ─────────────────────────────────────────────────────

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

/** Block explorer URLs - configurable via environment variables */
export const EXPLORER = {
  /** Blockscout EVM explorer */
  evm: process.env.NEXT_PUBLIC_EXPLORER_EVM || "https://blockscout.staging.midl.xyz",
  /** Mempool BTC explorer */
  btc: process.env.NEXT_PUBLIC_EXPLORER_BTC || "https://mempool.staging.midl.xyz",
} as const;

/** Build an EVM transaction link */
export function evmTxUrl(txHash: string): string {
  return `${EXPLORER.evm}/tx/${txHash}`;
}

/** Build an EVM address link */
export function evmAddressUrl(address: string): string {
  return `${EXPLORER.evm}/address/${address}`;
}

/** Build a BTC transaction link */
export function btcTxUrl(txId: string): string {
  return `${EXPLORER.btc}/tx/${txId}`;
}

export function isNativeBTC(token: string): boolean {
  return token === ZERO_ADDRESS;
}

export function formatBTC(wei: bigint): string {
  const formatted = formatEther(wei);
  const btc = parseFloat(formatted);
  if (btc === 0) return "0";
  if (btc < 0.000001) return "< 0.000001";
  if (btc < 0.0001) return btc.toFixed(6);
  return btc.toFixed(btc < 1 ? 6 : 4);
}

/** Format a token amount with the correct decimals for the given token address */
export function formatTokenAmount(wei: bigint, tokenAddr: string): string {
  const token = KNOWN_TOKENS.find(
    (t) => t.address.toLowerCase() === tokenAddr.toLowerCase()
  );
  const decimals = token?.decimals ?? 18;
  if (decimals === 0) return wei.toString();
  const formatted = formatUnits(wei, decimals);
  const num = parseFloat(formatted);
  if (num === 0) return "0";
  if (decimals <= 6) return num.toLocaleString(undefined, { maximumFractionDigits: decimals });
  if (num < 0.0001) return num.toExponential(2);
  return num.toFixed(num < 1 ? 6 : 4);
}

/** Cancel cooldown in seconds (must match TektonEscrow.CANCEL_COOLDOWN) */
export const CANCEL_COOLDOWN = 1800n; // 30 minutes

/** Minimum trade amount: 0.00001 BTC (roughly $1 at ~$100k/BTC) */
const MIN_BTC_AMOUNT = "0.00001";

export function parseBTC(btc: string): bigint {
  const trimmed = btc.trim();
  if (!trimmed) throw new Error("Invalid BTC amount");
  const num = Number(trimmed);
  if (!Number.isFinite(num) || num <= 0) throw new Error("Invalid BTC amount");
  if (num < Number(MIN_BTC_AMOUNT)) {
    throw new Error(`Minimum amount is ${MIN_BTC_AMOUNT} BTC`);
  }
  return parseEther(trimmed);
}

/**
 * Parse a human-readable token amount to its wei/smallest-unit representation,
 * using the correct decimals for the given token address.
 */
export function parseTokenAmount(amount: string, tokenAddr: string): bigint {
  const trimmed = amount.trim();
  if (!trimmed) throw new Error("Invalid amount");
  const num = Number(trimmed);
  if (!Number.isFinite(num) || num <= 0) throw new Error("Invalid amount");
  const token = KNOWN_TOKENS.find(
    (t) => t.address.toLowerCase() === tokenAddr.toLowerCase()
  );
  const decimals = token?.decimals ?? 18;
  if (decimals === 0) {
    // Integer tokens (e.g. TEKTON rune) - no fractional parts
    const intVal = BigInt(Math.floor(num));
    if (intVal <= 0n) throw new Error("Amount must be at least 1");
    return intVal;
  }
  return parseUnits(trimmed, decimals);
}

/**
 * Get the decimals for a known token, defaulting to 18.
 */
export function getTokenDecimals(tokenAddr: string): number {
  const token = KNOWN_TOKENS.find(
    (t) => t.address.toLowerCase() === tokenAddr.toLowerCase()
  );
  return token?.decimals ?? 18;
}

/** Validates a hex address is well-formed (not zero address) */
export function isValidEvmAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr) && addr !== ZERO_ADDRESS;
}

export function getStatusLabel(status: OfferStatus): string {
  switch (status) {
    case OfferStatus.Open:
      return "Open";
    case OfferStatus.Settled:
      return "Settled";
    case OfferStatus.Cancelled:
      return "Cancelled";
    case OfferStatus.Expired:
      return "Expired";
    default:
      return "Unknown";
  }
}

export function getStatusColor(status: OfferStatus): string {
  switch (status) {
    case OfferStatus.Open:
      return "text-green-600";
    case OfferStatus.Settled:
      return "text-blue-600";
    case OfferStatus.Cancelled:
      return "text-red-500";
    case OfferStatus.Expired:
      return "text-black/40";
    default:
      return "text-black/40";
  }
}

/**
 * Apply a confidence multiplier to the raw on-chain score.
 * The on-chain formula rewards ratio (1 perfect trade = 80 pts),
 * but we want the displayed score to ramp up gradually with trade count.
 *
 * displayScore = rawScore × min(totalTrades / CONFIDENCE_THRESHOLD, 1)
 *
 * With CONFIDENCE_THRESHOLD = 10:
 *   1 trade  → 80 × 0.1 =  8
 *   3 trades → 80 × 0.3 = 24
 *   5 trades → 80 × 0.5 = 40
 *  10 trades → 80 × 1.0 = 80
 */
const CONFIDENCE_THRESHOLD = 10;

export function adjustedScore(rawScore: number, tradesCompleted: number): number {
  if (tradesCompleted <= 0) return 0;
  const confidence = Math.min(tradesCompleted / CONFIDENCE_THRESHOLD, 1);
  return Math.round(rawScore * confidence);
}

export function getReliabilityBadge(
  score: number,
  tradesCompleted?: bigint
): {
  label: string;
  color: string;
  nextTier?: string;
  requirement?: string;
} {
  const trades = Number(tradesCompleted ?? 0n);
  // Tiers require BOTH on-chain score AND minimum trade count
  if (trades >= 50 && score >= 95)
    return { label: "OG", color: "text-yellow-600" };
  if (trades >= 15 && score >= 80)
    return { label: "Trusted", color: "text-green-600", nextTier: "OG", requirement: "50 trades & 95+ score" };
  if (trades >= 5 && score >= 60)
    return { label: "Reliable", color: "text-blue-600", nextTier: "Trusted", requirement: "15 trades & 80+ score" };
  if (trades >= 1)
    return { label: "New", color: "text-black/40", nextTier: "Reliable", requirement: "5 trades & 60+ score" };
  return { label: "Unrated", color: "text-black/30", nextTier: "New", requirement: "Complete your first trade" };
}

export function shortenAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/** Resolve a token address to a human-readable label */
export function tokenLabel(addr: string): string {
  if (isNativeBTC(addr)) return "BTC";
  const token = KNOWN_TOKENS.find(
    (t) => t.address.toLowerCase() === addr.toLowerCase()
  );
  return token ? token.name : shortenAddress(addr);
}

export function timeLeft(expiry: bigint): string {
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (expiry <= now) return "Expired";
  const diff = Number(expiry - now);
  const hours = Math.floor(diff / 3600);
  const mins = Math.floor((diff % 3600) / 60);
  if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}
