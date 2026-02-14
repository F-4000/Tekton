"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export default function TermsPage() {
  return (
    <div className="min-h-screen max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-4xl font-bold text-[#0a0a0a] mb-2">Terms of Service</h1>
        <p className="text-black/40 text-sm mb-10">Last updated: February 14, 2026</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="prose prose-neutral max-w-none text-sm text-black/70 leading-relaxed space-y-8"
      >
        <section>
          <h2 className="text-lg font-semibold text-[#0a0a0a] mb-3">1. Acceptance of Terms</h2>
          <p>
            By accessing or using Tekton (&ldquo;the Platform&rdquo;), you agree to be bound by these Terms of Service (&ldquo;Terms&rdquo;). If you do not agree, do not use the Platform.
          </p>
          <p>
            Tekton is a decentralized OTC (over-the-counter) trading platform built on{" "}
            <a href="https://midl.xyz" target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline">
              MIDL Protocol
            </a>
            , enabling peer-to-peer trading of Bitcoin and ERC-20 tokens through smart contract escrow.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#0a0a0a] mb-3">2. Eligibility</h2>
          <p>
            You must be of legal age in your jurisdiction to use this Platform. By using Tekton, you represent that you have the legal capacity to enter into a binding agreement.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#0a0a0a] mb-3">3. Non-Custodial Nature</h2>
          <p>
            Tekton is a non-custodial platform. At no point do we hold, control, or have access to your private keys, seed phrases, or funds. All trades are executed through the{" "}
            <strong>TektonEscrow smart contract</strong> deployed on the MIDL blockchain.
          </p>
          <p>
            You are solely responsible for the security of your wallet, private keys, and any transactions you initiate.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#0a0a0a] mb-3">4. Smart Contract Risks</h2>
          <p>
            Trading on Tekton involves interacting with smart contracts. You acknowledge and accept the following risks:
          </p>
          <ul className="list-disc list-inside space-y-1 text-black/60">
            <li>Smart contracts may contain bugs or vulnerabilities despite auditing efforts</li>
            <li>Blockchain transactions are irreversible once confirmed</li>
            <li>Network congestion may delay transaction processing</li>
            <li>Gas fees are required for all on-chain operations and are non-refundable</li>
            <li>The escrow mechanism has time-based expiration; uncompleted trades may expire</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#0a0a0a] mb-3">5. Trading Rules</h2>

          <h3 className="text-sm font-semibold text-[#0a0a0a] mt-4 mb-2">5.1 Creating Offers</h3>
          <p>
            When you create an offer, you deposit tokens into the TektonEscrow smart contract. Deposited tokens are locked until the trade is completed, cancelled, or expires.
          </p>

          <h3 className="text-sm font-semibold text-[#0a0a0a] mt-4 mb-2">5.2 Taking Offers</h3>
          <p>
            When you take an offer, you deposit the requested counter-asset into escrow. Both parties&apos; funds are held in escrow until the maker confirms completion.
          </p>

          <h3 className="text-sm font-semibold text-[#0a0a0a] mt-4 mb-2">5.3 Completion & Cancellation</h3>
          <p>
            Only the offer maker can confirm trade completion, which triggers the atomic swap of escrowed tokens. Cancellation is subject to the smart contract&apos;s cancellation rules and may affect your reliability score.
          </p>

          <h3 className="text-sm font-semibold text-[#0a0a0a] mt-4 mb-2">5.4 Fees</h3>
          <p>
            A 0.3% platform fee is applied to completed trades. This fee is deducted from the traded amounts and sent to the fee recipient address configured in the smart contract.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#0a0a0a] mb-3">6. Reputation System</h2>
          <p>
            Tekton maintains an on-chain reputation system. Your reliability score (0–100) is calculated based on trade completion ratio, account age, and trading volume. This score is publicly visible and permanently recorded on the blockchain.
          </p>
          <p>
            Cancelled trades negatively impact your score. You cannot reset or delete your on-chain trading history.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#0a0a0a] mb-3">7. Prohibited Conduct</h2>
          <ul className="list-disc list-inside space-y-1 text-black/60">
            <li>Manipulating the reputation system through wash trading or sybil attacks</li>
            <li>Exploiting smart contract vulnerabilities</li>
            <li>Using the platform for money laundering or sanctions evasion</li>
            <li>Sending abusive, threatening, or illegal content through the messaging system</li>
            <li>Interfering with the platform&apos;s operation or other users&apos; ability to trade</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#0a0a0a] mb-3">8. Disclaimer of Warranties</h2>
          <p>
            THE PLATFORM IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
          </p>
          <p>
            We do not warrant that the Platform will be uninterrupted, secure, or error-free.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#0a0a0a] mb-3">9. Limitation of Liability</h2>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, TEKTON AND ITS CONTRIBUTORS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, OR FUNDS ARISING FROM YOUR USE OF THE PLATFORM.
          </p>
          <p>
            You acknowledge that you use the Platform and interact with smart contracts entirely at your own risk.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#0a0a0a] mb-3">10. Regtest Environment</h2>
          <p>
            Tekton currently operates on the MIDL Protocol regtest (staging) network. Tokens on this network have no real monetary value. This environment is intended for testing and demonstration purposes. The platform may be reset, modified, or discontinued without notice.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#0a0a0a] mb-3">11. Modifications</h2>
          <p>
            We reserve the right to modify these Terms at any time. Changes will be reflected on this page with an updated revision date. Continued use of the Platform constitutes acceptance of modified Terms.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#0a0a0a] mb-3">12. Contact</h2>
          <p>
            For questions about these Terms, please open an issue on our{" "}
            <a href="https://github.com/midl-xyz/midl-js" target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline">
              GitHub repository
            </a>.
          </p>
        </section>

        <div className="pt-8 border-t border-black/[0.06]">
          <Link href="/privacy" className="text-orange-600 hover:underline text-sm">
            View Privacy Policy →
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
