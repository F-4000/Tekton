"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-4xl font-bold text-[#0a0a0a] mb-2">Privacy Policy</h1>
        <p className="text-black/40 text-sm mb-10">Last updated: February 14, 2026</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="prose prose-neutral max-w-none text-sm text-black/70 leading-relaxed space-y-8"
      >
        <section>
          <h2 className="text-lg font-semibold text-[#0a0a0a] mb-3">1. Introduction</h2>
          <p>
            Tekton (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) is a decentralized OTC trading platform built on{" "}
            <a href="https://midl.xyz" target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline">
              MIDL Protocol
            </a>
            . This Privacy Policy explains how we collect, use, and protect information when you use the Tekton platform.
          </p>
          <p>
            Tekton is a non-custodial application. We do not hold, control, or have access to your private keys, seed phrases, or funds at any time.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#0a0a0a] mb-3">2. Information We Collect</h2>
          
          <h3 className="text-sm font-semibold text-[#0a0a0a] mt-4 mb-2">2.1 Blockchain Data</h3>
          <p>
            When you interact with Tekton, your transactions are recorded on the MIDL blockchain. This includes your public EVM address, transaction hashes, trade amounts, and smart contract interactions. This data is inherently public and immutable.
          </p>

          <h3 className="text-sm font-semibold text-[#0a0a0a] mt-4 mb-2">2.2 Authentication Data</h3>
          <p>
            We use wallet-based authentication (personal_sign). When you sign in, we store a session token linked to your EVM address. Session tokens expire after 24 hours and are stored in your browser&apos;s localStorage.
          </p>

          <h3 className="text-sm font-semibold text-[#0a0a0a] mt-4 mb-2">2.3 Messages</h3>
          <p>
            If you use the messaging feature to communicate with trading counterparties, message content and metadata (sender address, timestamp, associated offer ID) are stored in our database. Messages are associated with your public EVM address.
          </p>

          <h3 className="text-sm font-semibold text-[#0a0a0a] mt-4 mb-2">2.4 Information We Do NOT Collect</h3>
          <ul className="list-disc list-inside space-y-1 text-black/60">
            <li>Private keys or seed phrases</li>
            <li>Real names, email addresses, or phone numbers</li>
            <li>IP addresses for tracking purposes</li>
            <li>Browser fingerprints</li>
            <li>Cookies for advertising or analytics</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#0a0a0a] mb-3">3. How We Use Information</h2>
          <ul className="list-disc list-inside space-y-1 text-black/60">
            <li>To authenticate your wallet and maintain your session</li>
            <li>To display your trading profile and reputation (derived from on-chain data)</li>
            <li>To facilitate peer-to-peer messaging between trading parties</li>
            <li>To display offer and trade data from the blockchain</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#0a0a0a] mb-3">4. Data Storage & Security</h2>
          <p>
            Off-chain data (messages, sessions) is stored in a SQLite database. Session tokens are validated on each request. We implement CSRF protection, rate limiting, input sanitization, and Content Security Policy headers.
          </p>
          <p>
            On-chain data (trades, profiles, balances) is stored on the MIDL blockchain and is publicly accessible through block explorers such as{" "}
            <a href="https://blockscout.staging.midl.xyz" target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline">
              Blockscout
            </a>.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#0a0a0a] mb-3">5. Third-Party Services</h2>
          <p>Tekton integrates with the following third-party services:</p>
          <ul className="list-disc list-inside space-y-1 text-black/60">
            <li>
              <strong>MIDL Protocol</strong>: blockchain infrastructure (
              <a href="https://midl.xyz" target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline">midl.xyz</a>)
            </li>
            <li>
              <strong>Xverse Wallet</strong>: wallet connection and transaction signing (
              <a href="https://www.xverse.app" target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline">xverse.app</a>)
            </li>
          </ul>
          <p>
            These services have their own privacy policies. We encourage you to review them.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#0a0a0a] mb-3">6. Your Rights</h2>
          <p>Since Tekton is pseudonymous and non-custodial:</p>
          <ul className="list-disc list-inside space-y-1 text-black/60">
            <li>You can disconnect your wallet at any time to end your session</li>
            <li>On-chain data cannot be deleted due to blockchain immutability</li>
            <li>Message history can be requested for deletion by contacting us</li>
            <li>You maintain full control over your funds and private keys at all times</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#0a0a0a] mb-3">7. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. Changes will be reflected on this page with an updated revision date.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#0a0a0a] mb-3">8. Contact</h2>
          <p>
            For questions about this Privacy Policy, please open an issue on our{" "}
            <a href="https://github.com/midl-xyz/midl-js" target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline">
              GitHub repository
            </a>.
          </p>
        </section>

        <div className="pt-8 border-t border-black/[0.06]">
          <Link href="/terms" className="text-orange-600 hover:underline text-sm">
            View Terms of Service →
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
