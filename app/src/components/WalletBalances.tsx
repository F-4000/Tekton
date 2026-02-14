"use client";

import { KNOWN_TOKENS } from "@/config/midl";
import { erc20Abi, ZERO_ADDRESS, formatTokenAmount, formatBTC } from "@/lib/contract";
import { useBalance } from "@midl/react";
import { useReadContracts } from "wagmi";

interface WalletBalancesProps {
  evmAddress: `0x${string}`;
}

/** Token icons - simple colored circles with symbol initials */
const TOKEN_COLORS: Record<string, string> = {
  BTC: "bg-orange-500",
  WBTC: "bg-amber-600",
  USDC: "bg-blue-500",
  TEKTON: "bg-gradient-to-br from-orange-500 to-orange-600",
};

export function WalletBalances({ evmAddress }: WalletBalancesProps) {
  const { balance: btcBalance } = useBalance(); // BTC in satoshis

  // Batch-read all ERC20 balances in a single multicall
  const erc20Tokens = KNOWN_TOKENS.filter((t) => t.address !== ZERO_ADDRESS);

  const { data: erc20Results, isLoading } = useReadContracts({
    contracts: erc20Tokens.map((token) => ({
      address: token.address,
      abi: erc20Abi,
      functionName: "balanceOf" as const,
      args: [evmAddress] as const,
    })),
    query: {
      enabled: !!evmAddress,
      refetchInterval: 15_000,
    },
  });

  // Build balance entries
  const balances: {
    symbol: string;
    name: string;
    address: string;
    formatted: string;
    raw: bigint;
    decimals: number;
  }[] = [];

  // Native BTC
  const btcToken = KNOWN_TOKENS.find((t) => t.address === ZERO_ADDRESS);
  if (btcToken) {
    const raw = btcBalance !== undefined ? BigInt(btcBalance) * 10n ** 10n : 0n; // sats → 18-dec wei
    balances.push({
      symbol: btcToken.symbol,
      name: btcToken.name,
      address: btcToken.address,
      formatted: btcBalance !== undefined ? formatBTC(raw) : "—",
      raw,
      decimals: btcToken.decimals,
    });
  }

  // ERC20 tokens
  erc20Tokens.forEach((token, i) => {
    const result = erc20Results?.[i];
    const raw = result?.status === "success" ? (result.result as bigint) : 0n;
    balances.push({
      symbol: token.symbol,
      name: token.name,
      address: token.address,
      formatted:
        result?.status === "success"
          ? formatTokenAmount(raw, token.address)
          : "—",
      raw,
      decimals: token.decimals,
    });
  });

  const VISIBLE_COUNT = 4;
  const needsScroll = balances.length > VISIBLE_COUNT;

  return (
    <div className="card p-6">
      <h3 className="font-medium text-sm text-black/50 mb-4">Wallet Balances</h3>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-black/[0.04] animate-pulse" />
                <div className="h-4 bg-black/[0.04] rounded w-16 animate-pulse" />
              </div>
              <div className="h-4 bg-black/[0.04] rounded w-20 animate-pulse" />
            </div>
          ))}
        </div>
      ) : (
        <div
          className={needsScroll ? "max-h-[232px] overflow-y-auto pr-1 scrollbar-thin" : ""}
        >
          <div className="space-y-3">
            {balances.map((b) => (
            <div
              key={b.address}
              className="flex items-center justify-between py-1.5"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                    TOKEN_COLORS[b.symbol] ?? "bg-black/20"
                  }`}
                >
                  {b.symbol.slice(0, 2)}
                </div>
                <div>
                  <p className="text-sm font-medium text-[#0a0a0a]">
                    {b.symbol}
                  </p>
                  <p className="text-xs text-black/40">{b.name}</p>
                </div>
              </div>
              <p
                className={`text-sm font-mono tabular-nums ${
                  b.raw > 0n ? "text-[#0a0a0a]" : "text-black/30"
                }`}
              >
                {b.formatted}
              </p>
            </div>
          ))}
          </div>
        </div>
      )}
    </div>
  );
}
