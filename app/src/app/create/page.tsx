"use client";

import { CreateOfferForm } from "@/components/CreateOfferForm";
import { StepItem } from "@/components/StepItem";
import { useAccounts } from "@midl/react";
import { useRouter } from "next/navigation";
import { encodeFunctionData } from "viem";
import { escrowContract, erc20Abi, ZERO_ADDRESS } from "@/lib/contract";
import { useMidlTx } from "@/hooks/useMidlTx";
import { motion } from "framer-motion";

export default function CreateOfferPage() {
  const { isConnected } = useAccounts();
  const router = useRouter();

  const tx = useMidlTx({
    onSuccess: () => setTimeout(() => router.push("/market"), 2000),
  });

  const handleSubmit = (params: {
    makerToken: `0x${string}`;
    makerAmount: bigint;
    takerToken: `0x${string}`;
    takerAmount: bigint;
    expiryHours: number;
    allowedTaker: `0x${string}`;
    totalValue: bigint;
  }) => {
    const expiry = BigInt(Math.floor(Date.now() / 1000) + params.expiryHours * 3600);

    tx.begin();

    // If selling an ERC20, add approval intention first
    if (params.makerToken !== ZERO_ADDRESS) {
      tx.addIntention({
        reset: true,
        intention: {
          evmTransaction: {
            to: params.makerToken,
            data: encodeFunctionData({
              abi: erc20Abi,
              functionName: "approve",
              args: [escrowContract.address, params.makerAmount],
            }),
          },
        },
      });
    }

    tx.addIntention({
      reset: params.makerToken === ZERO_ADDRESS,
      intention: {
        evmTransaction: {
          to: escrowContract.address,
          data: encodeFunctionData({
            abi: escrowContract.abi,
            functionName: "createOffer",
            args: [
              params.makerToken,
              params.makerAmount,
              params.takerToken,
              params.takerAmount,
              expiry,
              params.allowedTaker,
            ],
          }),
          value: params.totalValue,
        },
      },
    });
  };

  if (!isConnected) {
    return (
      <div className="min-h-[80vh] max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center py-24"
        >
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4 text-[#0a0a0a]">Create OTC Offer</h1>
          <p className="text-black/50">Connect your wallet to create an offer</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="mb-12"
      >
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2 text-[#0a0a0a]">Create OTC Offer</h1>
        <p className="text-black/50 max-w-xl">
          Set your terms and create a trustless escrow-backed trade.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-lg"
      >

      {tx.status === "idle" && (
        <CreateOfferForm
          onSubmit={handleSubmit}
          isLoading={false}
        />
      )}

      {tx.status !== "idle" && tx.status !== "success" && (
        <div className="card p-6 sm:p-8 space-y-5">
          <h3 className="font-medium text-lg text-[#0a0a0a]">Transaction Progress</h3>

          {/* Step indicators */}
          <div className="space-y-3">
            <StepItem
              label="1. Add Transaction Intention"
              active={tx.status === "adding-intention"}
              done={["finalizing", "signing", "broadcasting", "confirming"].includes(tx.status)}
            />
            <StepItem
              label="2. Finalize BTC Transaction"
              active={tx.status === "finalizing"}
              done={["signing", "broadcasting", "confirming"].includes(tx.status)}
              actionLabel="Finalize"
              onAction={tx.status === "adding-intention" && tx.txIntentions.length > 0 ? tx.handleFinalize : undefined}
              disabled={tx.isProcessing}
            />
            <StepItem
              label="3. Sign Intentions"
              active={tx.status === "signing"}
              done={["broadcasting", "confirming"].includes(tx.status)}
              actionLabel="Sign"
              onAction={tx.status === "finalizing" && tx.btcTxData ? tx.handleSign : undefined}
              disabled={tx.isProcessing}
            />
            <StepItem
              label="4. Broadcast"
              active={tx.status === "broadcasting"}
              done={["confirming"].includes(tx.status)}
              actionLabel="Broadcast"
              onAction={
                tx.status === "signing" &&
                tx.txIntentions.every((it) => it.signedEvmTransaction)
                  ? tx.handleBroadcast
                  : undefined
              }
              disabled={tx.isProcessing}
            />
            <StepItem
              label="5. Confirming..."
              active={tx.status === "confirming"}
              done={false}
            />
          </div>

          {tx.error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">
              {tx.error}
              <button
                onClick={tx.handleReset}
                className="ml-2 text-red-500 underline hover:text-red-600"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      )}

      {tx.status === "success" && (
        <div className="card border-emerald-500/20 p-8 text-center">
          <div className="text-4xl mb-3 text-emerald-500">&#10003;</div>
          <h3 className="font-medium text-lg text-emerald-600">
            Offer Created Successfully!
          </h3>
          <p className="text-sm text-black/50 mt-2">
            Redirecting to market...
          </p>
        </div>
      )}
      </motion.div>
    </div>
  );
}
