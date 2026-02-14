"use client";

import { MidlProvider } from "@midl/react";
import { WagmiMidlProvider } from "@midl/executor-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SatoshiKitProvider } from "@midl/satoshi-kit";
import { midlConfig } from "@/config/midl";
import { useState, useEffect, type ReactNode } from "react";

import "@midl/satoshi-kit/styles.css";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  // Unregister stale service workers from previous apps
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((r) => r.unregister());
      });
    }
  }, []);

  return (
    <MidlProvider config={midlConfig}>
      <QueryClientProvider client={queryClient}>
        <WagmiMidlProvider>
          <SatoshiKitProvider>{children}</SatoshiKitProvider>
        </WagmiMidlProvider>
      </QueryClientProvider>
    </MidlProvider>
  );
}
