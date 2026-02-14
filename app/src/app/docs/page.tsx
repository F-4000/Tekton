"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ReactNode } from "react";

// Render inline elements (bold, code, URLs)
function renderInline(text: string): ReactNode {
  const parts: ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Find the earliest match of any inline pattern
    const codeMatch = remaining.match(/`([^`]+)`/);
    const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
    const urlMatch = remaining.match(/(https?:\/\/[^\s),]+)/);

    const codeIdx = codeMatch ? remaining.indexOf(codeMatch[0]) : Infinity;
    const boldIdx = boldMatch ? remaining.indexOf(boldMatch[0]) : Infinity;
    const urlIdx = urlMatch ? remaining.indexOf(urlMatch[0]) : Infinity;

    const minIdx = Math.min(codeIdx, boldIdx, urlIdx);
    if (minIdx === Infinity) {
      parts.push(remaining);
      break;
    }

    // Push text before the match
    if (minIdx > 0) parts.push(remaining.slice(0, minIdx));

    if (minIdx === codeIdx && codeMatch) {
      parts.push(
        <code key={key++} className="bg-black/[0.05] px-1.5 py-0.5 rounded text-[#0a0a0a] font-mono text-xs break-all">
          {codeMatch[1]}
        </code>
      );
      remaining = remaining.slice(codeIdx + codeMatch[0].length);
    } else if (minIdx === boldIdx && boldMatch) {
      parts.push(<strong key={key++} className="font-semibold text-[#0a0a0a]">{boldMatch[1]}</strong>);
      remaining = remaining.slice(boldIdx + boldMatch[0].length);
    } else if (minIdx === urlIdx && urlMatch) {
      const url = urlMatch[1];
      // Strip trailing period/comma if present
      const cleanUrl = url.replace(/[.,]+$/, "");
      parts.push(
        <a key={key++} href={cleanUrl} target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline break-all">
          {cleanUrl}
        </a>
      );
      remaining = remaining.slice(urlIdx + cleanUrl.length);
    }
  }

  return parts.length === 1 ? parts[0] : parts;
}

// Main markdown renderer - processes line-by-line
function renderMarkdown(content: string): ReactNode[] {
  const elements: ReactNode[] = [];
  let key = 0;

  // Split by code blocks first
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  const segments: { type: "text" | "code"; content: string; lang?: string }[] = [];

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", content: content.slice(lastIndex, match.index) });
    }
    segments.push({ type: "code", content: match[2].trim(), lang: match[1] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    segments.push({ type: "text", content: content.slice(lastIndex) });
  }

  for (const segment of segments) {
    if (segment.type === "code") {
      elements.push(
        <pre key={key++} className="bg-black/[0.03] border border-black/[0.06] rounded-lg p-4 overflow-x-auto font-mono text-xs my-3">
          <code>{segment.content}</code>
        </pre>
      );
    } else {
      const lines = segment.content.split("\n");
      let i = 0;

      while (i < lines.length) {
        const line = lines[i].trim();

        // Skip blank lines
        if (!line) {
          i++;
          continue;
        }

        // Bold-only heading
        if (line.startsWith("**") && line.endsWith("**") && !line.slice(2, -2).includes("**")) {
          elements.push(
            <h4 key={key++} className="font-semibold text-[#0a0a0a] mt-5 mb-2 text-base">
              {line.slice(2, -2)}
            </h4>
          );
          i++;
          continue;
        }

        // Numbered list - collect consecutive numbered lines
        if (/^\d+\.\s/.test(line)) {
          const items: string[] = [];
          while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
            items.push(lines[i].trim().replace(/^\d+\.\s*/, ""));
            i++;
          }
          elements.push(
            <ol key={key++} className="list-decimal list-inside space-y-1.5 text-black/60 my-2">
              {items.map((item, idx) => (
                <li key={idx}>{renderInline(item)}</li>
              ))}
            </ol>
          );
          continue;
        }

        // Bullet list - collect consecutive bullet lines
        if (line.startsWith("- ")) {
          const items: string[] = [];
          while (i < lines.length && lines[i].trim().startsWith("- ")) {
            items.push(lines[i].trim().replace(/^-\s*/, ""));
            i++;
          }
          elements.push(
            <ul key={key++} className="list-disc list-inside space-y-1.5 text-black/60 my-2">
              {items.map((item, idx) => (
                <li key={idx}>{renderInline(item)}</li>
              ))}
            </ul>
          );
          continue;
        }

        // Regular paragraph - collect consecutive non-special lines
        const paraLines: string[] = [];
        while (
          i < lines.length &&
          lines[i].trim() &&
          !lines[i].trim().startsWith("- ") &&
          !/^\d+\.\s/.test(lines[i].trim()) &&
          !(lines[i].trim().startsWith("**") && lines[i].trim().endsWith("**") && !lines[i].trim().slice(2, -2).includes("**"))
        ) {
          paraLines.push(lines[i].trim());
          i++;
        }
        if (paraLines.length > 0) {
          elements.push(
            <p key={key++} className="text-black/60 my-2">
              {renderInline(paraLines.join(" "))}
            </p>
          );
        }
      }
    }
  }

  return elements;
}

const SECTIONS = [
  {
    id: "overview",
    title: "Overview",
    content: `Tekton is a trustless OTC (Over-The-Counter) trading platform for Bitcoin and ERC-20 tokens built on **MIDL Protocol**. It enables peer-to-peer trades with smart contract escrow protection, eliminating counterparty risk common in traditional OTC markets.

Traditional OTC trades require trust between parties or reliance on centralized escrow services. Tekton removes this friction by using on-chain escrow contracts that atomically settle trades when both parties fulfill their obligations.

Tekton currently runs on the MIDL **regtest (staging)** network. Tokens on this network have no real monetary value and are used for testing and demonstration purposes.`,
  },
  {
    id: "getting-started",
    title: "Getting Started",
    content: `**Prerequisites**
1. Install the **Xverse Wallet**: https://www.xverse.app/download
2. Get test BTC from the **MIDL Faucet**: https://faucet.midl.xyz/
3. Connect your wallet to Tekton

**Network Details**
- **Network**: MIDL Protocol Regtest (Chain ID: 15001)
- **RPC URL**: \`https://rpc.staging.midl.xyz\`
- **Block Explorer (EVM)**: https://blockscout.staging.midl.xyz/
- **Block Explorer (Bitcoin)**: https://mempool.staging.midl.xyz/

**Developer Resources**
- **MIDL SDK Documentation**: https://js.midl.xyz/
- **MIDL JavaScript SDK (GitHub)**: https://github.com/midl-xyz/midl-js`,
  },
  {
    id: "how-it-works",
    title: "How It Works",
    content: `**Creating an Offer**
1. Connect your Xverse wallet to Tekton
2. Navigate to "Create" and fill out offer details
3. Specify the token you're selling and the token you want
4. Set an expiry time and optional private taker address
5. Submit the transaction to lock your funds in escrow

**Accepting an Offer**
1. Browse open offers in the Market
2. Review offer details including maker reputation
3. Click "Accept Trade" and confirm the transaction
4. Both tokens swap atomically through the escrow contract

**Trade Settlement**
When a taker accepts an offer, the smart contract:
- Verifies both parties have sufficient funds
- Transfers maker's tokens to taker
- Transfers taker's tokens to maker
- Returns stake to maker
- Emits on-chain events for tracking`,
  },
  {
    id: "escrow",
    title: "Escrow Mechanism",
    content: `The TektonEscrow smart contract is the core of the platform. It provides:

**Trustless Locking**
When a maker creates an offer, their tokens (plus a stake) are locked in the contract. The contract holds these funds until either:
- A taker accepts and the trade settles
- The maker cancels (after cooldown period)
- The offer expires and maker reclaims

**Stake Protection**
Makers must deposit a stake (minimum 0.001 BTC) when creating offers. This stake:
- Discourages spam and fake offers
- Can be slashed if maker misbehaves
- Is returned upon successful trade completion

**Atomic Settlement**
When a taker accepts, the contract executes an atomic swap:
\`\`\`
maker_tokens → taker
taker_tokens → maker
stake → maker (returned)
\`\`\`
If any step fails, the entire transaction reverts.`,
  },
  {
    id: "reputation",
    title: "Reputation System",
    content: `Tekton tracks on-chain trading history for every user:

**Profile Metrics**
- Total trades completed
- Offers cancelled
- Offers expired
- First trade timestamp

**Reliability Score**
A 0-100 score calculated on-chain from three components, then adjusted by a confidence multiplier:
\`\`\`
totalOffers = tradesCompleted + offersCancelled + offersExpired

On-chain formula:
  Completion (max 80):  (tradesCompleted × 80) / totalOffers
  Account Age (max 10): min(daysSinceFirstTrade / 90, 1) × 10
  Volume (max 10):      min(totalVolume / 10 BTC, 1) × 10
  Raw Score = Completion + Age + Volume

Confidence adjustment:
  Displayed Score = Raw Score × min(tradesCompleted / 10, 1)
\`\`\`

**Reputation Badges**
Badges require both a minimum number of trades and a minimum score:
- **OG**: 50+ trades & 95+ score (veteran trader)
- **Trusted**: 15+ trades & 80+ score (reliable partner)
- **Reliable**: 5+ trades & 60+ score (established track record)
- **New**: At least 1 trade (beginning trader)
- **Unrated**: No trading history

Your score is permanently recorded on the blockchain and cannot be reset.`,
  },
  {
    id: "cancellation",
    title: "Cancellation Rules",
    content: `To prevent front-running and protect takers, cancellation has a cooldown:

**Request Cancel**
1. Maker calls \`requestCancel(offerId)\`
2. 30-minute cooldown timer starts
3. Offer remains visible but takers see "Cancel Pending" warning

**Finalize Cancel**
After 30 minutes, maker can call \`finalizeCancel(offerId)\` to:
- Return locked tokens to maker
- Return stake to maker
- Update maker's reputation (cancellation count increases)

**Why Cooldown?**
Without cooldown, a malicious maker could:
1. See a taker's pending accept transaction
2. Front-run with instant cancel
3. Leave taker's transaction to fail

The 30-minute window ensures takers have time to complete their trades.`,
  },
  {
    id: "private-offers",
    title: "Private Offers",
    content: `For OTC deals negotiated off-platform, makers can create private offers:

**Creating Private Offers**
1. Enable "Private offer" toggle when creating
2. Enter the taker's EVM address
3. Only that address can accept the offer

**Use Cases**
- Pre-negotiated deals between known parties
- Institutional trades with counterparty requirements
- VIP customer arrangements

**Security**
Private offers still use the same escrow contract. The only difference is the \`allowedTaker\` check that restricts who can call \`acceptOffer()\`.`,
  },
  {
    id: "supported-tokens",
    title: "Supported Tokens",
    content: `Tekton supports native BTC and any ERC-20 compatible token on MIDL.

**Native BTC**
- Used as native currency on MIDL Protocol (18 decimal places on MIDL EVM)
- No ERC-20 approval needed. Sent directly as msg.value

**ERC-20 Tokens**
When trading ERC-20 tokens:
1. Approve the escrow contract to spend your tokens
2. Create/accept offer (contract transfers from your balance)

**Known Tokens on MIDL Regtest**

\`\`\`
Token      Decimals   Contract Address
─────      ────────   ────────────────
WBTC       18         0x1736866b6CA02F2Ec69a4b7E6A70fd15700d71bE
USDC       6          0x323177Bac995D133062DC8F5f2D390B3eaC4577C
TEKTON     0          0x62865D0bD2576cf10dd261ADB2fC1d6Ca1485f2c
\`\`\`

**Escrow Contract**

\`\`\`
Address: 0x0FCF1E8F42B98299a44C2A4d1F06298808A5E326
Explorer: https://blockscout.staging.midl.xyz/address/0x0FCF1E8F42B98299a44C2A4d1F06298808A5E326
\`\`\``,
  },
  {
    id: "fees",
    title: "Fees",
    content: `Tekton charges minimal fees to sustain the platform:

**Platform Fee**
- Current: 0.3% of trade value
- Charged to taker on successful settlement
- Collected in the traded token

**Gas Fees**
- Standard MIDL network gas fees apply
- Typically < 0.0001 BTC per transaction

**No Hidden Fees**
- No deposit fees
- No withdrawal fees
- No listing fees
- Stake is fully refunded on successful trades`,
  },
  {
    id: "security",
    title: "Security",
    content: `Tekton prioritizes security at every layer:

**Smart Contract**
- ReentrancyGuard on all state-changing functions
- Comprehensive input validation
- Events emitted for all actions
- No admin backdoors or upgradability

**Wallet Security**
- Non-custodial: you control your keys
- Xverse wallet integration (battle-tested)
- EVM address derived from Bitcoin keys

**Best Practices**
- Always verify offer details before accepting
- Check counterparty reputation score
- Start with small trades to build trust
- Use private offers for large OTC deals`,
  },
  {
    id: "faq",
    title: "FAQ",
    content: `**What if my trade partner doesn't deliver?**
Impossible. The escrow contract holds both sides' tokens. Either the trade settles atomically, or nothing happens.

**Can I cancel after someone starts accepting?**
The 30-minute cooldown prevents instant cancellation. If you request cancel and someone accepts during cooldown, the trade completes normally.

**What happens if my offer expires?**
Call \`reclaimExpired()\` to return your locked tokens and stake. Your reputation will show an expired offer.

**Why do I need to stake BTC?**
Stakes prevent spam and demonstrate commitment. A maker with 0.01 BTC locked has skin in the game.

**Is my private key ever exposed?**
Never. Tekton uses your Xverse wallet for signing. Your keys never leave your device.

**Where do I get test BTC?**
Visit the MIDL Faucet at https://faucet.midl.xyz/ to receive free test BTC on the regtest network.

**What wallet should I use?**
Tekton works with the Xverse wallet. Download it at https://www.xverse.app/download.`,
  },
];

export default function DocsPage() {
  return (
    <div className="min-h-screen max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="lg:grid lg:grid-cols-[240px_1fr] lg:gap-12">
        {/* Sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-20">
            <h3 className="text-xs font-semibold text-black/40 uppercase tracking-wider mb-4">
              Documentation
            </h3>
            <nav className="space-y-1">
              {SECTIONS.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="block px-3 py-2 text-sm text-black/60 hover:text-[#0a0a0a] hover:bg-black/[0.03] rounded-lg transition-colors"
                >
                  {section.title}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        {/* Content */}
        <main>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-4xl font-bold text-[#0a0a0a] mb-2">Documentation</h1>
            <p className="text-black/50 mb-12">
              Everything you need to know about using Tekton for trustless OTC trading.
            </p>
          </motion.div>

          <div className="space-y-16">
            {SECTIONS.map((section, i) => (
              <motion.section
                key={section.id}
                id={section.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
                className="scroll-mt-24"
              >
                <h2 className="text-2xl font-bold text-[#0a0a0a] mb-4 pb-2 border-b border-black/[0.06]">
                  {section.title}
                </h2>
                <div className="prose prose-neutral max-w-none">
                  <div className="text-black/70 leading-relaxed text-sm space-y-4">
                    {renderMarkdown(section.content)}
                  </div>
                </div>
              </motion.section>
            ))}
          </div>

          {/* Bottom CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mt-16 pt-12 border-t border-black/[0.06] text-center"
          >
            <h3 className="text-xl font-semibold text-[#0a0a0a] mb-2">Ready to start trading?</h3>
            <p className="text-black/50 mb-6">Connect your wallet and explore the OTC market.</p>
            <div className="flex justify-center gap-4">
              <Link href="/market" className="btn-primary">
                Browse Market
              </Link>
              <Link href="/create" className="btn-secondary">
                Create Offer
              </Link>
            </div>
          </motion.div>
        </main>
      </div>
    </div>
  );
}
