"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccounts } from "@midl/react";
import { useEVMAddress } from "@midl/executor-react";
import { ConnectWallet } from "./ConnectWallet";
import { TektonLogo } from "./TektonLogo";
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { AnimatePresence, motion } from "framer-motion";

export function Navbar() {
  const pathname = usePathname();
  const { isConnected } = useAccounts();
  const evmAddress = useEVMAddress();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { authFetch, isAuthenticated } = useAuth();
  const prevUnreadRef = useRef(0);

  // Close menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  // Poll unread message count
  const fetchUnread = useCallback(async () => {
    if (!evmAddress || !isAuthenticated) { setUnreadCount(0); return; }
    try {
      const res = await authFetch(`/api/messages?unread=true`);
      if (res.ok) {
        const data = await res.json();
        const count = data.unread ?? 0;
        // Only update state if value changed (M-4: prevent unnecessary re-renders)
        if (count !== prevUnreadRef.current) {
          prevUnreadRef.current = count;
          setUnreadCount(count);
        }
      }
    } catch { /* ignore */ }
  }, [evmAddress, isAuthenticated, authFetch]);

  useEffect(() => {
    fetchUnread();
    const timer = setInterval(fetchUnread, 8000);
    return () => clearInterval(timer);
  }, [fetchUnread]);

  const MAIN_NAV = [
    { href: "/", label: "Home" },
    { href: "/market", label: "Market" },
    { href: "/create", label: "Create" },
    { href: "/docs", label: "Docs" },
  ] as { href: string; label: string; badge?: number }[];

  const USER_NAV = isConnected
    ? [
        { href: "/messages", label: "Messages", badge: unreadCount },
        { href: "/profile", label: "Profile" },
      ]
    : [];

  const ALL_NAV = [...MAIN_NAV, ...USER_NAV] as { href: string; label: string; badge?: number }[];

  return (
    <>
      <nav className="z-50 sticky top-0 bg-[#fafafa]/80 backdrop-blur-xl border-b border-black/[0.06]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
            {/* Left: Logo + main nav */}
            <div className="flex items-center gap-10">
              <Link href="/" className="flex items-center gap-2.5 group">
                <TektonLogo size={28} className="text-orange-500" />
                <span className="font-brand text-base font-bold tracking-wide text-[#0a0a0a]">
                  TEKTON
                </span>
              </Link>
              <div className="hidden md:flex items-center gap-1">
                {MAIN_NAV.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`relative px-4 py-2 text-sm rounded-lg transition-colors ${
                        isActive
                          ? "text-[#0a0a0a] bg-black/[0.04]"
                          : "text-[#0a0a0a]/60 hover:text-[#0a0a0a] hover:bg-black/[0.03]"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Right: User nav + wallet */}
            <div className="flex items-center gap-1">
              {/* Messages & Profile - separated from main nav */}
              {USER_NAV.length > 0 && (
                <div className="hidden md:flex items-center gap-1 mr-3">
                  {USER_NAV.map((item) => {
                    const isActive = pathname === item.href || (item.href === "/messages" && pathname.startsWith("/messages"));
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`relative px-3 py-2 text-sm rounded-lg transition-colors ${
                          isActive
                            ? "text-[#0a0a0a] bg-black/[0.04]"
                            : "text-[#0a0a0a]/60 hover:text-[#0a0a0a] hover:bg-black/[0.03]"
                        }`}
                      >
                        {item.label}
                        {item.badge !== undefined && item.badge > 0 && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center text-[9px] font-bold text-white">
                            {item.badge > 9 ? "9+" : item.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                  <div className="w-px h-5 bg-black/[0.08] mx-2" />
                </div>
              )}

              <div className="hidden md:block">
                <ConnectWallet />
              </div>

              {/* Mobile hamburger */}
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="md:hidden relative w-10 h-10 flex items-center justify-center rounded-lg hover:bg-black/[0.04] transition-colors"
                aria-label="Toggle menu"
              >
                <div className="w-5 flex flex-col gap-[5px]">
                  <span
                    className={`block h-[2px] bg-[#0a0a0a] rounded-full transition-all duration-300 origin-center ${
                      mobileOpen ? "rotate-45 translate-y-[7px]" : ""
                    }`}
                  />
                  <span
                    className={`block h-[2px] bg-[#0a0a0a] rounded-full transition-all duration-300 ${
                      mobileOpen ? "opacity-0 scale-0" : ""
                    }`}
                  />
                  <span
                    className={`block h-[2px] bg-[#0a0a0a] rounded-full transition-all duration-300 origin-center ${
                      mobileOpen ? "-rotate-45 -translate-y-[7px]" : ""
                    }`}
                  />
                </div>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile menu overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 md:hidden"
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />

            {/* Menu panel */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="absolute top-14 left-0 right-0 bg-[#fafafa] border-b border-black/[0.06] shadow-lg shadow-black/5"
            >
              <div className="px-4 py-4 space-y-1">
                {ALL_NAV.map((item) => {
                  const isActive = pathname === item.href || (item.href === "/messages" && pathname.startsWith("/messages"));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center justify-between px-4 py-3 text-sm rounded-lg transition-colors ${
                        isActive
                          ? "text-[#0a0a0a] bg-black/[0.04] font-medium"
                          : "text-[#0a0a0a]/60 hover:text-[#0a0a0a] hover:bg-black/[0.03]"
                      }`}
                    >
                      {item.label}
                      {item.badge !== undefined && item.badge > 0 && (
                        <span className="w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white">
                          {item.badge > 9 ? "9+" : item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
              <div className="border-t border-black/[0.06] px-4 py-4">
                <ConnectWallet />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
