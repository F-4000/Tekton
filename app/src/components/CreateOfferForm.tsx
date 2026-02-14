"use client";

import { useState, useMemo } from "react";
import { KNOWN_TOKENS } from "@/config/midl";
import { parseTokenAmount, formatTokenAmount, ZERO_ADDRESS, erc20Abi, getTokenDecimals } from "@/lib/contract";
import { usePlatformConfig } from "@/hooks/useEscrow";
import { formatBTC } from "@/lib/contract";
import { formatUnits } from "viem";
import { useBalance } from "@midl/react";
import { useEVMAddress } from "@midl/executor-react";
import { useReadContract } from "wagmi";

interface CreateOfferFormProps {
  onSubmit: (params: {
    makerToken: `0x${string}`;
    makerAmount: bigint;
    takerToken: `0x${string}`;
    takerAmount: bigint;
    expiryHours: number;
    allowedTaker: `0x${string}`;
    totalValue: bigint; // msg.value
  }) => void;
  isLoading?: boolean;
}

export function CreateOfferForm({ onSubmit, isLoading }: CreateOfferFormProps) {
  const { minStake, platformFeeBps } = usePlatformConfig();
  const { balance: btcBalance } = useBalance(); // BTC balance in satoshis
  const evmAddress = useEVMAddress();

  const [makerToken, setMakerToken] = useState<string>(ZERO_ADDRESS);
  const [makerCustomAddr, setMakerCustomAddr] = useState("");
  const [takerToken, setTakerToken] = useState<string>("");
  const [takerCustomAddr, setTakerCustomAddr] = useState("");
  const [makerAmount, setMakerAmount] = useState("");
  const [takerAmount, setTakerAmount] = useState("");
  const [expiryHours, setExpiryHours] = useState("24");
  const [allowedTaker, setAllowedTaker] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);

  const CUSTOM_VALUE = "__custom__";

  const resolvedMakerToken =
    makerToken === CUSTOM_VALUE ? makerCustomAddr : makerToken;
  const resolvedTakerToken =
    takerToken === CUSTOM_VALUE ? takerCustomAddr : takerToken;

  const isValidAddress = (addr: string) =>
    /^0x[0-9a-fA-F]{40}$/.test(addr) && addr !== ZERO_ADDRESS;

  // Helper: get token symbol for display
  const getTokenSymbol = (addr: string) => {
    const token = KNOWN_TOKENS.find(
      (t) => t.address.toLowerCase() === addr.toLowerCase()
    );
    return token?.symbol ?? "Token";
  };

  // Check ERC20 balance when selling a non-BTC token
  const isSellingERC20 = resolvedMakerToken !== ZERO_ADDRESS && isValidAddress(resolvedMakerToken);
  const { data: erc20Balance } = useReadContract({
    address: isSellingERC20 ? (resolvedMakerToken as `0x${string}`) : undefined,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: evmAddress ? [evmAddress] : undefined,
    query: {
      enabled: isSellingERC20 && !!evmAddress,
    },
  });

  // Compute parsed amounts and total value for validation
  const { parsedMakerAmount, parsedTakerAmount, totalValue, balanceError } = useMemo(() => {
    let parsedMaker = 0n;
    let parsedTaker = 0n;
    let total = minStake ?? 0n;
    let balErr: string | null = null;

    try {
      if (makerAmount && resolvedMakerToken) {
        parsedMaker = parseTokenAmount(makerAmount, resolvedMakerToken);
      }
    } catch {
      // invalid amount - will be caught by form validation
    }

    try {
      if (takerAmount && resolvedTakerToken) {
        parsedTaker = parseTokenAmount(takerAmount, resolvedTakerToken);
      }
    } catch {
      // invalid amount
    }

    // If selling BTC, maker deposits BTC + stake
    if (resolvedMakerToken === ZERO_ADDRESS && parsedMaker > 0n) {
      total += parsedMaker;
    }

    // Balance check: always need BTC for stake (1 sat = 10^10 wei)
    if (btcBalance && total > 0n) {
      const balanceWei = BigInt(btcBalance) * 10_000_000_000n;
      if (total > balanceWei) {
        balErr = `Insufficient BTC balance. Need ~${formatBTC(total)} BTC but have ~${formatBTC(balanceWei)} BTC`;
      }
    }

    // ERC20 balance check when selling a token
    if (
      !balErr &&
      isSellingERC20 &&
      erc20Balance !== undefined &&
      parsedMaker > 0n
    ) {
      const bal = erc20Balance as bigint;
      if (parsedMaker > bal) {
        const sym = getTokenSymbol(resolvedMakerToken);
        balErr = `Insufficient ${sym} balance. Need ${formatTokenAmount(parsedMaker, resolvedMakerToken)} but have ${formatTokenAmount(bal, resolvedMakerToken)} ${sym}`;
      }
    }

    return {
      parsedMakerAmount: parsedMaker,
      parsedTakerAmount: parsedTaker,
      totalValue: total,
      balanceError: balErr,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [makerAmount, takerAmount, resolvedMakerToken, resolvedTakerToken, minStake, btcBalance, erc20Balance, isSellingERC20]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!makerAmount || !takerAmount || !resolvedTakerToken) return;
    if (makerToken === CUSTOM_VALUE && !isValidAddress(makerCustomAddr)) return;
    if (takerToken === CUSTOM_VALUE && !isValidAddress(takerCustomAddr)) return;
    if (resolvedMakerToken.toLowerCase() === resolvedTakerToken.toLowerCase()) return;
    if (isPrivate && allowedTaker && !isValidAddress(allowedTaker)) return;
    if (balanceError) return;

    const parsedExpiry = parseInt(expiryHours);
    if (!Number.isFinite(parsedExpiry) || parsedExpiry < 1) return;

    onSubmit({
      makerToken: resolvedMakerToken as `0x${string}`,
      makerAmount: parsedMakerAmount,
      takerToken: resolvedTakerToken as `0x${string}`,
      takerAmount: parsedTakerAmount,
      expiryHours: parsedExpiry,
      allowedTaker: (isPrivate && allowedTaker
        ? allowedTaker
        : ZERO_ADDRESS) as `0x${string}`,
      totalValue,
    });
  };

  const feePercent = platformFeeBps ? Number(platformFeeBps) / 100 : 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="card p-6 sm:p-8 space-y-5">
        <h3 className="text-lg font-semibold text-[#0a0a0a]">Create OTC Offer</h3>

        {/* Selling */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-black/50">You&apos;re selling</label>
            {/* Inline balance */}
            {resolvedMakerToken === ZERO_ADDRESS && btcBalance !== undefined && (
              <button
                type="button"
                onClick={() => {
                  const maxWei = BigInt(btcBalance) * 10_000_000_000n - (minStake ?? 0n);
                  if (maxWei > 0n) setMakerAmount(formatBTC(maxWei));
                }}
                className={`text-xs transition-colors ${
                  balanceError ? "text-red-500" : "text-black/40 hover:text-orange-500"
                }`}
              >
                Balance: {formatBTC(BigInt(btcBalance) * 10_000_000_000n)} BTC
                <span className="ml-1 text-[10px] font-medium text-orange-500">MAX</span>
              </button>
            )}
            {isSellingERC20 && erc20Balance !== undefined && (
              <button
                type="button"
                onClick={() => {
                  const decimals = getTokenDecimals(resolvedMakerToken);
                  setMakerAmount(formatUnits(erc20Balance as bigint, decimals));
                }}
                className={`text-xs transition-colors ${
                  balanceError ? "text-red-500" : "text-black/40 hover:text-orange-500"
                }`}
              >
                Balance: {formatTokenAmount(erc20Balance as bigint, resolvedMakerToken)} {getTokenSymbol(resolvedMakerToken)}
                <span className="ml-1 text-[10px] font-medium text-orange-500">MAX</span>
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              step="any"
              min="0"
              placeholder="Amount"
              value={makerAmount}
              onChange={(e) => setMakerAmount(e.target.value)}
              className={`flex-1 input-field ${balanceError ? "!border-red-300 focus:!border-red-400" : ""}`}
              required
            />
            <select
              value={makerToken}
              onChange={(e) => setMakerToken(e.target.value)}
              className="input-field min-w-[120px]"
            >
              {KNOWN_TOKENS.map((t) => (
                <option key={t.address} value={t.address}>
                  {t.symbol}
                </option>
              ))}
              <option value={CUSTOM_VALUE}>Custom ERC20…</option>
            </select>
          </div>
          {makerToken === CUSTOM_VALUE && (
            <input
              type="text"
              placeholder="ERC20 contract address (0x...)"
              value={makerCustomAddr}
              onChange={(e) => setMakerCustomAddr(e.target.value)}
              className={`mt-2 w-full input-field text-sm font-mono ${
                makerCustomAddr && !isValidAddress(makerCustomAddr)
                  ? "!border-red-500/50 focus:!border-red-500/70 focus:!ring-red-500/20"
                  : ""
              }`}
            />
          )}
          {/* Inline balance error - fixed height so form doesn't shift */}
          <div className="min-h-[20px] mt-1.5">
            {balanceError ? (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm-.75 3.75a.75.75 0 011.5 0v3.5a.75.75 0 01-1.5 0v-3.5zM8 11a1 1 0 110 2 1 1 0 010-2z"/></svg>
                {balanceError}
              </p>
            ) : isSellingERC20 && btcBalance !== undefined ? (
              <p className="text-[11px] text-black/30">
                + {minStake ? formatBTC(minStake) : "0.0001"} BTC stake required · Your BTC: {formatBTC(BigInt(btcBalance) * 10_000_000_000n)}
              </p>
            ) : null}
          </div>
        </div>

        {/* Wanting */}
        <div>
          <label className="block text-sm text-black/50 mb-2">
            You want in return
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              step="any"
              min="0"
              placeholder="Amount"
              value={takerAmount}
              onChange={(e) => setTakerAmount(e.target.value)}
              className="flex-1 input-field"
              required
            />
            <select
              value={takerToken}
              onChange={(e) => setTakerToken(e.target.value)}
              className="input-field min-w-[120px]"
            >
              <option value="" disabled>
                Select token
              </option>
              {KNOWN_TOKENS.filter(
                (t) => t.address !== resolvedMakerToken
              ).map((t) => (
                <option key={t.address} value={t.address}>
                  {t.symbol}
                </option>
              ))}
              <option value={CUSTOM_VALUE}>Custom ERC20…</option>
            </select>
          </div>
          {takerToken === CUSTOM_VALUE && (
            <input
              type="text"
              placeholder="ERC20 contract address (0x...)"
              value={takerCustomAddr}
              onChange={(e) => setTakerCustomAddr(e.target.value)}
              className={`mt-2 w-full input-field text-sm font-mono ${
                takerCustomAddr && !isValidAddress(takerCustomAddr)
                  ? "!border-red-500/50 focus:!border-red-500/70 focus:!ring-red-500/20"
                  : ""
              }`}
            />
          )}
        </div>

        {/* Expiry */}
        <div>
          <label className="block text-sm text-black/50 mb-2">
            Expires in (hours)
          </label>
          <input
            type="number"
            min="1"
            max="720"
            value={expiryHours}
            onChange={(e) => setExpiryHours(e.target.value)}
            className="w-full input-field"
          />
        </div>

        {/* Private offer */}
        <div>
          <label className="flex items-center gap-2.5 text-sm text-black/50 cursor-pointer">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="rounded bg-white border-black/10 text-orange-500 focus:ring-orange-500/20"
            />
            Private offer (specific taker only)
          </label>
          {isPrivate && (
            <input
              type="text"
              placeholder="Taker's EVM address (0x...)"
              value={allowedTaker}
              onChange={(e) => setAllowedTaker(e.target.value)}
              className="mt-2 w-full input-field text-sm font-mono"
            />
          )}
        </div>

        {/* Info bar */}
        <div className="bg-black/[0.02] border border-black/[0.06] rounded-xl p-4 space-y-2 text-xs">
          <div className="flex justify-between text-black/40">
            <span>Required stake (refundable)</span>
            <span className="text-[#0a0a0a]">{minStake ? formatBTC(minStake) : "…"} BTC</span>
          </div>
          <div className="flex justify-between text-black/40">
            <span>Platform fee (on settlement)</span>
            <span className="text-[#0a0a0a]">{feePercent}%</span>
          </div>
          <div className="flex justify-between text-black/40">
            <span>Cancel cooldown</span>
            <span className="text-[#0a0a0a]">30 minutes</span>
          </div>
          {resolvedMakerToken === ZERO_ADDRESS && makerAmount && (
            <div className="flex justify-between text-black/40 border-t border-black/[0.06] pt-2 mt-2">
              <span>Total BTC needed</span>
              <span className="text-[#0a0a0a] font-medium">{formatBTC(totalValue)} BTC</span>
            </div>
          )}
          <p className="text-[10px] text-black/30 pt-1">
            Stake is fully refunded on settlement, cancellation, or expiry reclaim.
          </p>
        </div>

        <button
          type="submit"
          disabled={
            isLoading ||
            !makerAmount ||
            !takerAmount ||
            !resolvedTakerToken ||
            !!balanceError ||
            (makerToken === CUSTOM_VALUE && !isValidAddress(makerCustomAddr)) ||
            (takerToken === CUSTOM_VALUE && !isValidAddress(takerCustomAddr)) ||
            (resolvedMakerToken.toLowerCase() === resolvedTakerToken.toLowerCase()) ||
            (isPrivate && allowedTaker !== "" && !isValidAddress(allowedTaker))
          }
          className="w-full btn-primary py-3.5 disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none"
        >
          {isLoading
            ? "Creating…"
            : makerAmount && takerAmount && resolvedTakerToken
              ? `Sell ${makerAmount} ${getTokenSymbol(resolvedMakerToken)} for ${takerAmount} ${getTokenSymbol(resolvedTakerToken)}`
              : "Create Offer"
          }
        </button>
      </div>
    </form>
  );
}
