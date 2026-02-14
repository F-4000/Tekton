"use client";

import Link from "next/link";
import { TektonLogo } from "./TektonLogo";

interface FooterLink {
  label: string;
  href: string;
  external?: boolean;
}

const FOOTER_LINKS: Record<string, FooterLink[]> = {
  Product: [
    { label: "Market", href: "/market" },
    { label: "Create Offer", href: "/create" },
    { label: "Documentation", href: "/docs" },
  ],
  Resources: [
    { label: "MIDL SDK Docs", href: "https://js.midl.xyz/", external: true },
    { label: "MIDL Protocol", href: "https://midl.xyz", external: true },
    { label: "GitHub", href: "https://github.com/midl-xyz/midl-js", external: true },
    { label: "Faucet", href: "https://faucet.midl.xyz/", external: true },
  ],
  Explore: [
    { label: "Blockscout Explorer", href: "https://blockscout.staging.midl.xyz/", external: true },
    { label: "Mempool Explorer", href: "https://mempool.staging.midl.xyz/", external: true },
    { label: "Xverse Wallet", href: "https://www.xverse.app/download", external: true },
  ],
};

export function Footer() {
  return (
    <footer className="relative z-10 border-t border-black/[0.06] bg-white mt-12 sm:mt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-10">
          {/* Brand */}
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <TektonLogo size={24} className="text-orange-500" />
              <span className="font-brand text-base font-bold tracking-wide">
                TEKTON
              </span>
            </Link>
            <p className="text-black/50 text-sm leading-relaxed max-w-xs">
              Trustless Bitcoin OTC trading built on MIDL Protocol. 
              Trade peer-to-peer with on-chain escrow protection.
            </p>
            <div className="flex items-center gap-4 mt-6">
              <a
                href="https://x.com/omnirun"
                target="_blank"
                rel="noopener noreferrer"
                className="text-black/30 hover:text-black/60 transition-colors"
                title="X (Twitter)"
                aria-label="Follow us on X (Twitter)"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a
                href="https://github.com/midl-xyz/midl-js"
                target="_blank"
                rel="noopener noreferrer"
                className="text-black/30 hover:text-black/60 transition-colors"
                title="GitHub"
                aria-label="View source on GitHub"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
              </a>
              <a
                href="https://blockscout.staging.midl.xyz/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-black/30 hover:text-black/60 transition-colors"
                title="Block Explorer"
                aria-label="View block explorer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Links */}
          {Object.entries(FOOTER_LINKS).map(([title, links]) => (
            <div key={title}>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-black/40 mb-4">
                {title}
              </h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    {link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-black/50 hover:text-black transition-colors"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-sm text-black/50 hover:text-black transition-colors"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="mt-16 pt-8 border-t border-black/[0.06] flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-black/40">
            © 2026 Tekton. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-xs text-black/40">
            <Link href="/privacy" className="hover:text-black transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-black transition-colors">Terms of Service</Link>
            <span className="text-black/20">•</span>
            <span>Built on <a href="https://midl.xyz" target="_blank" rel="noopener noreferrer" className="hover:text-black transition-colors">MIDL Protocol</a></span>
          </div>
        </div>
      </div>
    </footer>
  );
}
