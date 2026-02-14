import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Verify an auth session token from the Authorization header.
 * Returns the authenticated address (lowercase) or null if invalid.
 *
 * Expected header format: Authorization: Bearer <token>
 */
export async function verifyAuthToken(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  if (!token) return null;

  try {
    const session = await prisma.authSession.findUnique({
      where: { token },
    });

    if (!session) return null;
    if (session.expiresAt < new Date()) {
      // Expired - clean up
      await prisma.authSession.delete({ where: { token } });
      return null;
    }

    return session.address;
  } catch {
    return null;
  }
}

/**
 * Simple in-memory rate limiter.
 * Tracks request counts per key (IP or address) with a sliding window.
 *
 * Fixes audit finding: H-2 (no rate limiting)
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_CLEANUP_INTERVAL = 5 * 60_000; // 5 min
let lastRateLimitCleanup = Date.now();

function cleanupRateLimitMap() {
  const now = Date.now();
  if (now - lastRateLimitCleanup < RATE_LIMIT_CLEANUP_INTERVAL) return;
  lastRateLimitCleanup = now;
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(key);
  }
}

export function rateLimit(
  key: string,
  maxRequests: number = 30,
  windowMs: number = 60_000
): { allowed: boolean; remaining: number } {
  cleanupRateLimitMap();
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  entry.count++;
  const remaining = Math.max(0, maxRequests - entry.count);
  return { allowed: entry.count <= maxRequests, remaining };
}

/**
 * Sanitize message text by stripping control characters and trimming.
 * Fixes audit finding: H-7 (no server-side sanitization)
 */
export function sanitizeText(text: string): string {
  return text
    // Remove C0/C1 control characters except newline (\n) and tab (\t)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, "")
    // Remove Unicode directional overrides (RTL/LTR exploits)
    .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, "")
    // Remove zero-width characters (homoglyph exploits)
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, "")
    .trim()
    .slice(0, 1000);
}

/**
 * Validate an offerId string - must be a non-negative integer.
 * Fixes audit finding: M-2 (unvalidated offerId)
 */
export function isValidOfferId(offerId: string): boolean {
  return /^\d+$/.test(offerId) && parseInt(offerId, 10) >= 0;
}

/**
 * CSRF check: verify Origin hostname matches Host.
 * Fixes audit findings: C-3, R8-01
 */
export function csrfCheck(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  // If no origin header (same-origin request), allow
  if (!origin) return true;
  if (!host) return false;
  try {
    const originHost = new URL(origin).host; // includes port
    return originHost === host;
  } catch {
    return false;
  }
}
