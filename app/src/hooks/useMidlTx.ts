"use client";

import { useState, useCallback } from "react";
import {
  useAddTxIntention,
  useAddCompleteTxIntention,
  useFinalizeBTCTransaction,
  useSignIntention,
} from "@midl/executor-react";
import { weiToSatoshis } from "@midl/executor";
import { useWaitForTransaction } from "@midl/react";
import { usePublicClient } from "wagmi";

/**
 * Shared transaction status type for the MIDL intention-based flow.
 * Used by create/page.tsx and offer detail pages.
 */
export type TxStatus =
  | "idle"
  | "adding-intention"
  | "finalizing"
  | "signing"
  | "broadcasting"
  | "confirming"
  | "success"
  | "error";

/**
 * Reusable hook for the MIDL intention-based transaction flow.
 *
 * Encapsulates the 5-step pattern:
 *   1. Add intention(s) - with deposit.satoshis for value-bearing txs
 *   2. Finalize BTC transaction (auto-adds completeTx intention)
 *   3. Sign each intention
 *   4. Broadcast
 *   5. Wait for confirmation
 *
 * @see PLAN.md §7 - "MIDL Integration Pattern"
 */
export function useMidlTx(options?: {
  onSuccess?: () => void;
  onError?: (err: Error) => void;
}) {
  const [status, setStatus] = useState<TxStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const { addTxIntention, txIntentions } = useAddTxIntention();
  const { addCompleteTxIntentionAsync } = useAddCompleteTxIntention();
  const { finalizeBTCTransaction, data: btcTxData } =
    useFinalizeBTCTransaction();
  const { signIntentionAsync } = useSignIntention();
  const publicClient = usePublicClient();
  const { waitForTransaction } = useWaitForTransaction({
    mutation: {
      onSuccess: () => {
        setStatus("success");
        options?.onSuccess?.();
      },
      onError: (err: Error) => {
        setError(err.message);
        setStatus("error");
        options?.onError?.(err);
      },
    },
  });

  /**
   * Add one or more transaction intentions.
   * Automatically converts EVM `value` (wei) to BTC `deposit.satoshis`
   * so the MIDL bridge funds the EVM account properly.
   */
  const addIntention = useCallback(
    (
      intentionInput: Parameters<typeof addTxIntention>[0],
    ) => {
      const evmTx = intentionInput.intention.evmTransaction;
      const value = evmTx && "value" in evmTx ? (evmTx.value as bigint) : undefined;

      // If the EVM tx carries value, add a deposit to bridge that BTC to EVM
      if (value && value > 0n) {
        intentionInput = {
          ...intentionInput,
          intention: {
            ...intentionInput.intention,
            deposit: {
              satoshis: weiToSatoshis(value),
            },
          },
        };
      }

      addTxIntention(intentionInput);
    },
    [addTxIntention],
  );

  /** Start the flow by setting status to adding-intention */
  const begin = useCallback(() => {
    setError(null);
    setStatus("adding-intention");
  }, []);

  /** Step 2: Finalize the BTC transaction (auto-adds completeTx intention) */
  const handleFinalize = useCallback(async () => {
    setIsProcessing(true);
    setStatus("finalizing");
    try {
      // Add completion intention to get BTC change back
      await addCompleteTxIntentionAsync();
      await finalizeBTCTransaction();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    } finally {
      setIsProcessing(false);
    }
  }, [addCompleteTxIntentionAsync, finalizeBTCTransaction]);

  /** Step 3: Sign all intentions */
  const handleSign = useCallback(async () => {
    if (!btcTxData) return;
    setIsProcessing(true);
    setStatus("signing");
    try {
      for (const intention of txIntentions) {
        await signIntentionAsync({
          intention,
          txId: btcTxData.tx.id,
        });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    } finally {
      setIsProcessing(false);
    }
  }, [btcTxData, txIntentions, signIntentionAsync]);

  /** Step 4: Broadcast to MIDL + Bitcoin */
  const handleBroadcast = useCallback(async () => {
    if (!btcTxData) return;
    if (!publicClient) {
      setError("Network not connected");
      setStatus("error");
      return;
    }
    setIsProcessing(true);
    setStatus("broadcasting");
    try {
      await publicClient.sendBTCTransactions({
        serializedTransactions: txIntentions.map(
          (it) => it.signedEvmTransaction as `0x${string}`,
        ),
        btcTransaction: btcTxData.tx.hex,
      });
      setStatus("confirming");
      waitForTransaction({ txId: btcTxData.tx.id });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    } finally {
      setIsProcessing(false);
    }
  }, [btcTxData, publicClient, txIntentions, waitForTransaction]);

  /** Reset to idle state */
  const handleReset = useCallback(() => {
    setStatus("idle");
    setError(null);
  }, []);

  return {
    // State
    status,
    error,
    isProcessing,
    txIntentions,
    btcTxData,

    // Actions
    begin,
    addIntention,
    handleFinalize,
    handleSign,
    handleBroadcast,
    handleReset,
  };
}
