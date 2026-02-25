"use client";

import { ConnectButton } from "@midl/satoshi-kit";
import { useAccounts, useDisconnect } from "@midl/react";
import { useEVMAddress } from "@midl/executor-react";
import { shortenAddress } from "@/lib/contract";
import { useAuth } from "@/hooks/useAuth";

export function ConnectWallet() {
  const { isConnected } = useAccounts();
  const { disconnect } = useDisconnect();
  const evmAddress = useEVMAddress();
  const { isAuthenticated, isAuthenticating, authenticate } = useAuth();

  if (!isConnected) {
    return (
      <div className="flex items-center [&_button]:!bg-gradient-to-br [&_button]:!from-orange-500 [&_button]:!to-orange-600 [&_button]:!text-white [&_button]:!font-medium [&_button]:!rounded-lg [&_button]:!px-4 [&_button]:!py-2 [&_button]:!text-sm [&_button]:!border-0 [&_button]:!shadow-none [&_button]:hover:!brightness-105 [&_button]:!transition-all [&_button]:!whitespace-nowrap [&_button]:!min-w-[140px] [&_button]:!overflow-hidden">
        <ConnectButton />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {evmAddress && (
        <span className="text-sm text-black/40 font-mono bg-black/[0.03] px-2 py-1 rounded">
          {shortenAddress(evmAddress)}
        </span>
      )}
      {/* Show Sign In button when wallet is connected but not authenticated */}
      {evmAddress && !isAuthenticated && !isAuthenticating && (
        <button
          onClick={() => authenticate()}
          aria-label="Sign in with wallet signature"
          className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
        >
          Sign In
        </button>
      )}
      {isAuthenticating && (
        <span className="text-xs text-black/40">Signing…</span>
      )}
      <button
        onClick={() => disconnect()}
        aria-label="Disconnect wallet"
        className="btn-secondary px-4 py-2 text-sm"
      >
        Disconnect
      </button>
    </div>
  );
}
