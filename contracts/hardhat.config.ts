import "hardhat-deploy";
import "@midl/hardhat-deploy";
import "@nomicfoundation/hardhat-verify";
import { midlRegtest } from "@midl/executor";
import { type HardhatUserConfig, vars } from "hardhat/config";

if (!vars.has("MNEMONIC")) {
  throw new Error("Set MNEMONIC via: npx hardhat vars set MNEMONIC");
}
const mnemonic = vars.get("MNEMONIC");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const config: HardhatUserConfig & { etherscan: any; midl: any } = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  defaultNetwork: "regtest",
  midl: {
    networks: {
      regtest: {
        mnemonic,
        network: "regtest",
        confirmationsRequired: 1,
        btcConfirmationsRequired: 1,
        hardhatNetwork: "regtest",
      },
    },
  },
  networks: {
    regtest: {
      url: "https://rpc.staging.midl.xyz",
      chainId: midlRegtest.id,
    },
  },
  etherscan: {
    apiKey: {
      regtest: "empty",
    },
    customChains: [
      {
        network: "regtest",
        chainId: midlRegtest.id,
        urls: {
          apiURL: "https://blockscout.staging.midl.xyz/api",
          browserURL: "https://blockscout.staging.midl.xyz",
        },
      },
    ],
  },
};

export default config;
