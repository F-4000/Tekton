"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useSignMessage } from "wagmi";
import { useEVMAddress } from "@midl/executor-react";

const AUTH_TOKEN_KEY = "tekton_auth_token";
const AUTH_EXPIRES_KEY = "tekton_auth_expires";
const AUTH_ADDRESS_KEY = "tekton_auth_address";

/**
 * Hook for wallet-based authentication.
 *
 * Manages the auth flow:
 *   1. Signs a message with the connected wallet
 *   2. Sends to /api/auth for verification
 *   3. Stores the session token in localStorage
 *   4. Provides the token for API calls
 *
 * Auto-authenticates when a wallet is connected and no valid token exists.
 */
export function useAuth() {
  const evmAddress = useEVMAddress();
  const { signMessageAsync } = useSignMessage();
  const [token, setToken] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authFailed, setAuthFailed] = useState(false);
  const authAttemptedRef = useRef(false);
  const retryCountRef = useRef(0);
  const MAX_AUTO_RETRIES = 3;

  // Load existing token from localStorage on mount
  useEffect(() => {
    if (!evmAddress) {
      setToken(null);
      return;
    }

    const stored = localStorage.getItem(AUTH_TOKEN_KEY);
    const expires = localStorage.getItem(AUTH_EXPIRES_KEY);
    const address = localStorage.getItem(AUTH_ADDRESS_KEY);

    if (
      stored &&
      expires &&
      address === evmAddress.toLowerCase() &&
      new Date(expires) > new Date()
    ) {
      setToken(stored);
    } else {
      // Clear stale tokens
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AUTH_EXPIRES_KEY);
      localStorage.removeItem(AUTH_ADDRESS_KEY);
      setToken(null);
    }
  }, [evmAddress]);

  // Sync logout across tabs via storage event (R9-12)
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === AUTH_TOKEN_KEY && !e.newValue) {
        setToken(null);
        authAttemptedRef.current = false;
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  // Auto-authenticate when wallet connected and no token
  useEffect(() => {
    if (evmAddress && !token && !isAuthenticating && !authAttemptedRef.current) {
      authAttemptedRef.current = true;
      // Delay to let wagmi connector fully initialize after MIDL wallet connect
      const timer = setTimeout(async () => {
        const result = await authenticate();
        if (!result && retryCountRef.current < MAX_AUTO_RETRIES) {
          // Allow retry on next effect trigger
          retryCountRef.current++;
          authAttemptedRef.current = false;
        }
      }, 800);
      return () => clearTimeout(timer);
    }
    // Reset attempt flag when address changes
    if (!evmAddress) {
      authAttemptedRef.current = false;
      retryCountRef.current = 0;
      setAuthFailed(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evmAddress, token, isAuthenticating]);

  const authenticate = useCallback(async () => {
    if (!evmAddress || isAuthenticating) return null;

    setIsAuthenticating(true);
    setAuthFailed(false);
    try {
      const message = `Tekton Auth: ${Date.now()}`;

      // Sign the message with the wallet
      const signature = await signMessageAsync({ message });

      // Send to auth endpoint
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: evmAddress,
          message,
          signature,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Authentication failed");
      }

      const data = await res.json();

      // Store token
      localStorage.setItem(AUTH_TOKEN_KEY, data.token);
      localStorage.setItem(AUTH_EXPIRES_KEY, data.expiresAt);
      localStorage.setItem(AUTH_ADDRESS_KEY, evmAddress.toLowerCase());
      setToken(data.token);

      return data.token as string;
    } catch {
      // Auth failed - clear state and allow manual retry
      setToken(null);
      setAuthFailed(true);
      return null;
    } finally {
      setIsAuthenticating(false);
    }
  }, [evmAddress, isAuthenticating, signMessageAsync]);

  /** Get auth headers for API calls */
  const getAuthHeaders = useCallback((): HeadersInit => {
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  }, [token]);

  /** Make an authenticated fetch call */
  const authFetch = useCallback(
    async (url: string, options: RequestInit = {}): Promise<Response> => {
      const headers = {
        ...options.headers,
        ...getAuthHeaders(),
      };

      const res = await fetch(url, { ...options, headers });

      // If 401, try re-authenticating once
      if (res.status === 401 && token) {
        const newToken = await authenticate();
        if (newToken) {
          return fetch(url, {
            ...options,
            headers: {
              ...options.headers,
              Authorization: `Bearer ${newToken}`,
            },
          });
        }
      }

      return res;
    },
    [getAuthHeaders, authenticate, token]
  );

  /** Logout - invalidate session on server and clear local state (R8-06) */
  const logout = useCallback(async () => {
    if (token) {
      try {
        await fetch("/api/auth", {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // Best-effort server invalidation
      }
    }
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_EXPIRES_KEY);
    localStorage.removeItem(AUTH_ADDRESS_KEY);
    setToken(null);
    authAttemptedRef.current = false;
  }, [token]);

  return {
    token,
    isAuthenticated: !!token,
    isAuthenticating,
    authFailed,
    authenticate,
    logout,
    getAuthHeaders,
    authFetch,
  };
}
