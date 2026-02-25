"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useSignMessage } from "@midl/react";
import { SignMessageProtocol } from "@midl/core";
import { useEVMAddress } from "@midl/executor-react";
import {
  E2E_KEY_MESSAGE,
  deriveEncryptionKeypair,
  deriveConversationKey,
  encryptMessage,
  decryptMessage,
} from "@/lib/e2e-crypto";

const E2E_PUBKEY_STORAGE = "tekton_e2e_pubkey";
const E2E_PRIVKEY_STORAGE = "tekton_e2e_privkey"; // Session only — never persisted to server

/**
 * Hook for E2E encryption key management.
 *
 * Flow:
 *   1. User signs deterministic message → derive secp256k1 keypair
 *   2. Public key is POSTed to /api/auth/encryption-key
 *   3. Private key lives in sessionStorage (cleared on tab close)
 *   4. Provides encrypt/decrypt functions for message threads
 */
export function useE2E() {
  const evmAddress = useEVMAddress();
  const { signMessageAsync } = useSignMessage();
  const [publicKeyHex, setPublicKeyHex] = useState<string | null>(null);
  const [isSetup, setIsSetup] = useState(false);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const privateKeyRef = useRef<Uint8Array | null>(null);
  const setupAttemptedRef = useRef(false);
  // Cache of CryptoKey objects per conversationId+counterpartyPubKey
  const keyCache = useRef<Map<string, CryptoKey>>(new Map());

  // Restore keys from sessionStorage on mount
  useEffect(() => {
    if (!evmAddress) {
      privateKeyRef.current = null;
      setPublicKeyHex(null);
      setIsSetup(false);
      setupAttemptedRef.current = false;
      keyCache.current.clear();
      return;
    }

    const storedPub = sessionStorage.getItem(E2E_PUBKEY_STORAGE);
    const storedPriv = sessionStorage.getItem(E2E_PRIVKEY_STORAGE);
    if (storedPub && storedPriv) {
      setPublicKeyHex(storedPub);
      // Restore private key from hex
      const clean = storedPriv.startsWith("0x") ? storedPriv.slice(2) : storedPriv;
      const bytes = new Uint8Array(clean.length / 2);
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = Number.parseInt(clean.substring(i * 2, i * 2 + 2), 16);
      }
      privateKeyRef.current = bytes;
      setIsSetup(true);
    }
  }, [evmAddress]);

  /**
   * Set up E2E encryption by signing a deterministic message.
   * Call this once after auth succeeds.
   */
  const setupEncryption = useCallback(async (): Promise<boolean> => {
    if (!evmAddress || isSetup || isSettingUp) return isSetup;
    if (setupAttemptedRef.current) return false;
    setupAttemptedRef.current = true;
    setIsSettingUp(true);

    try {
      // Sign deterministic message
      const result = await signMessageAsync({
        message: E2E_KEY_MESSAGE,
        protocol: SignMessageProtocol.Ecdsa,
      });
      const sig = result.signature;

      // Derive keypair
      const keypair = deriveEncryptionKeypair(sig);
      privateKeyRef.current = keypair.privateKey;
      const pubHex = keypair.publicKeyHex;
      setPublicKeyHex(pubHex);

      // Persist in sessionStorage (private key stays in tab only)
      sessionStorage.setItem(E2E_PUBKEY_STORAGE, pubHex);
      const privHex = Array.from(keypair.privateKey)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      sessionStorage.setItem(E2E_PRIVKEY_STORAGE, privHex);

      // Publish public key to server
      const token = localStorage.getItem("tekton_auth_token");
      if (token) {
        await fetch("/api/auth/encryption-key", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ publicKey: pubHex }),
        });
      }

      setIsSetup(true);
      return true;
    } catch {
      // User rejected signing or it failed — encryption won't work
      setupAttemptedRef.current = false;
      return false;
    } finally {
      setIsSettingUp(false);
    }
  }, [evmAddress, isSetup, isSettingUp, signMessageAsync]);

  /**
   * Get (or derive and cache) the AES key for a conversation.
   */
  const getConversationKey = useCallback(
    async (
      counterpartyPubKeyHex: string,
      conversationId: string,
    ): Promise<CryptoKey | null> => {
      if (!privateKeyRef.current || !counterpartyPubKeyHex) return null;

      const cacheKey = `${conversationId}:${counterpartyPubKeyHex}`;
      const cached = keyCache.current.get(cacheKey);
      if (cached) return cached;

      const key = await deriveConversationKey(
        privateKeyRef.current,
        counterpartyPubKeyHex,
        conversationId,
      );
      keyCache.current.set(cacheKey, key);
      return key;
    },
    [],
  );

  /**
   * Encrypt a plaintext message for a conversation.
   */
  const encrypt = useCallback(
    async (
      plaintext: string,
      counterpartyPubKeyHex: string,
      conversationId: string,
    ): Promise<{ ciphertext: string; iv: string } | null> => {
      const key = await getConversationKey(counterpartyPubKeyHex, conversationId);
      if (!key) return null;
      return encryptMessage(key, plaintext);
    },
    [getConversationKey],
  );

  /**
   * Decrypt a ciphertext message from a conversation.
   * Returns null if decryption fails (wrong key, legacy plaintext, etc.)
   */
  const decrypt = useCallback(
    async (
      ciphertextB64: string,
      ivB64: string,
      counterpartyPubKeyHex: string,
      conversationId: string,
    ): Promise<string | null> => {
      const key = await getConversationKey(counterpartyPubKeyHex, conversationId);
      if (!key) return null;
      return decryptMessage(key, ciphertextB64, ivB64);
    },
    [getConversationKey],
  );

  return {
    isSetup,
    isSettingUp,
    publicKeyHex,
    setupEncryption,
    encrypt,
    decrypt,
  };
}
