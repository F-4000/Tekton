import { createConfig, regtest } from "@midl/core";
import { xverseConnector } from "@midl/connectors";

export const midlConfig = createConfig({
  networks: [regtest],
  connectors: [xverseConnector()],
  persist: true, // Persist wallet connection across page refreshes
});

/**
 * Contract address - set via NEXT_PUBLIC_ESCROW_ADDRESS env var.
 * After deploying, copy the address from deployments/regtest/TektonEscrow.json
 * into app/.env.local:
 *   NEXT_PUBLIC_ESCROW_ADDRESS=0x...
 */
export const TEKTON_ESCROW_ADDRESS =
  (process.env.NEXT_PUBLIC_ESCROW_ADDRESS as `0x${string}`) ??
  "0x0000000000000000000000000000000000000000";

if (
  process.env.NODE_ENV === "production" &&
  (!process.env.NEXT_PUBLIC_ESCROW_ADDRESS ||
    process.env.NEXT_PUBLIC_ESCROW_ADDRESS === "0x0000000000000000000000000000000000000000")
) {
  throw new Error(
    "NEXT_PUBLIC_ESCROW_ADDRESS must be set in production"
  );
}

if (
  process.env.NODE_ENV === "development" &&
  typeof globalThis.window !== "undefined" &&
  TEKTON_ESCROW_ADDRESS === "0x0000000000000000000000000000000000000000"
) {
  console.warn(
    "⚠️ NEXT_PUBLIC_ESCROW_ADDRESS not set - contract reads will target the zero address. " +
      "Create app/.env.local with NEXT_PUBLIC_ESCROW_ADDRESS=0x<deployed_address>"
  );
}

/**
 * Known ERC20 tokens on MIDL Regtest.
 * Verified via Blockscout: https://blockscout.staging.midl.xyz/tokens
 * Tokens listed here have >1 holder, confirming real on-chain activity.
 */
export const KNOWN_TOKENS: {
  symbol: string;
  name: string;
  address: `0x${string}`;
  decimals: number;
}[] = [
  {
    symbol: "BTC",
    name: "Bitcoin (Native)",
    address: "0x0000000000000000000000000000000000000000",
    decimals: 18,
  },
  {
    // Wrapped Bitcoin - 6 holders on regtest
    symbol: "WBTC",
    name: "Wrapped Bitcoin",
    address: "0x1736866b6CA02F2Ec69a4b7E6A70fd15700d71bE",
    decimals: 18,
  },
  {
    // Mock USDC stablecoin - 3 holders (6 decimals verified on-chain)
    symbol: "USDC",
    name: "Mock USDC",
    address: "0x323177Bac995D133062DC8F5f2D390B3eaC4577C",
    decimals: 6,
  },
  {
    // TEKTON•BITCOIN Rune (185678:1) - on-chain name/symbol garbled due
    // to MIDL Executor encoding bug; hardcoding correct display values.
    symbol: "TEKTON",
    name: "TEKTON",
    address: "0x62865D0bD2576cf10dd261ADB2fC1d6Ca1485f2c",
    decimals: 0,
  },
];
