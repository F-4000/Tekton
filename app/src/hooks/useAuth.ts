"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useSignMessage } from "@midl/react";
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

  // Initialize token synchronously from localStorage to prevent auto-auth race
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const stored = localStorage.getItem(AUTH_TOKEN_KEY);
    const expires = localStorage.getItem(AUTH_EXPIRES_KEY);
    if (stored && expires && new Date(expires) > new Date()) {
      return stored;
    }
    return null;
  });
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authFailed, setAuthFailed] = useState(false);
  const authAttemptedRef = useRef(false);
  const retryCountRef = useRef(0);
  const pendingAuthRef = useRef<Promise<string | null> | null>(null);
  const MAX_AUTO_RETRIES = 3;

  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

  // Validate stored token against server and clear if address mismatch
  useEffect(() => {
    // Ignore zero address — MIDL/executor returns it as a placeholder before the real address loads
    if (!evmAddress || evmAddress === ZERO_ADDRESS) {
      return;
    }

    const stored = localStorage.getItem(AUTH_TOKEN_KEY);
    const expires = localStorage.getItem(AUTH_EXPIRES_KEY);
    const address = localStorage.getItem(AUTH_ADDRESS_KEY);

    // If address changed or token expired, clear everything
    if (
      !stored ||
      !expires ||
      address !== evmAddress.toLowerCase() ||
      new Date(expires) <= new Date()
    ) {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AUTH_EXPIRES_KEY);
      localStorage.removeItem(AUTH_ADDRESS_KEY);
      setToken(null);
      return;
    }

    // Token looks valid locally — verify it still exists server-side
    fetch("/api/messages?unread=true", {
      headers: { Authorization: `Bearer ${stored}` },
    })
      .then((res) => {
        if (res.status === 401) {
          // Token is stale on server — clear it
          localStorage.removeItem(AUTH_TOKEN_KEY);
          localStorage.removeItem(AUTH_EXPIRES_KEY);
          localStorage.removeItem(AUTH_ADDRESS_KEY);
          setToken(null);
        } else {
          // Confirm the token (may already be set from initializer)
          setToken(stored);
        }
      })
      .catch(() => {
        // Network error — keep local token
      });
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

  // Reset state when wallet disconnects
  useEffect(() => {
    if (!evmAddress) {
      authAttemptedRef.current = false;
      retryCountRef.current = 0;
      setAuthFailed(false);
    }
  }, [evmAddress]);

  const authenticate = useCallback(async () => {
    if (!evmAddress) return null;

    // If auth is already in progress, wait for it instead of failing
    if (pendingAuthRef.current) {
      return pendingAuthRef.current;
    }

    setIsAuthenticating(true);
    setAuthFailed(false);

    const authPromise = (async () => {
      try {
        const message = `Tekton Auth: ${Date.now()}`;

        // Sign the message with the MIDL wallet (ECDSA protocol)
        const result = await signMessageAsync({ message, protocol: "ECDSA" });
        const signature = result.signature;

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
        pendingAuthRef.current = null;
      }
    })();

    pendingAuthRef.current = authPromise;
    return authPromise;
  }, [evmAddress, signMessageAsync]);

  /** Read current token from localStorage (always fresh, no stale closures) */
  const getCurrentToken = useCallback((): string | null => {
    const stored = localStorage.getItem(AUTH_TOKEN_KEY);
    const expires = localStorage.getItem(AUTH_EXPIRES_KEY);
    if (stored && expires && new Date(expires) > new Date()) {
      return stored;
    }
    return null;
  }, []);

  /** Make an authenticated fetch call.
   *  Set `autoAuth: false` to skip the 401→authenticate retry (e.g. for background polls). */
  const authFetch = useCallback(
    async (url: string, options: RequestInit & { autoAuth?: boolean } = {}): Promise<Response> => {
      const { autoAuth = false, ...fetchOptions } = options;
      // Always read token from localStorage to avoid stale closure issues
      const currentToken = getCurrentToken();

      if (!currentToken && !autoAuth) {
        // No token and not allowed to auto-auth — return a synthetic 401
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const headers = {
        ...fetchOptions.headers,
        ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
      };

      const res = await fetch(url, { ...fetchOptions, headers });

      // If 401 and autoAuth is enabled, try authenticating once
      if (res.status === 401 && autoAuth) {
        const newToken = await authenticate();
        if (newToken) {
          return fetch(url, {
            ...fetchOptions,
            headers: {
              ...fetchOptions.headers,
              Authorization: `Bearer ${newToken}`,
            },
          });
        }
      }

      return res;
    },
    [getCurrentToken, authenticate]
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
    authFetch,
  };
}
