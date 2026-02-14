"use client";

import Link from "next/link";
import { TektonLogo } from "@/components/TektonLogo";
import { motion } from "framer-motion";

const FEATURES = [
  {
    title: "Trustless Escrow",
    description: "Smart contract locks funds until both parties fulfill their obligations.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
  },
  {
    title: "Native Bitcoin",
    description: "Trade real BTC and Rune tokens on Bitcoin L2. No wrapped assets.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: "Stake Protection",
    description: "Makers lock collateral to guarantee commitment. Bad actors lose stake.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
  {
    title: "Reputation System",
    description: "On-chain profiles track trading history, volume, and reliability.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
      </svg>
    ),
  },
];

const STEPS = [
  { num: "01", title: "Create Offer", desc: "Set your terms: token, amount, price, and expiry." },
  { num: "02", title: "Lock Funds", desc: "Deposit tokens and stake into the escrow contract." },
  { num: "03", title: "Match & Trade", desc: "Taker accepts, trade executes atomically." },
];

// Atomic Swap Visualization - Shows the actual Tekton escrow flow
function IsometricNetwork() {
  // Isometric cube component - cleaner, more polished design
  // This is a purely decorative animated visualization
  const IsoCube = ({ 
    cx, cy, size, depth, 
    topColor, leftColor, rightColor, 
    glowFilter, shadowColor 
  }: { 
    cx: number; cy: number; size: number; depth: number;
    topColor: string; leftColor: string; rightColor: string;
    glowFilter: string; shadowColor: string;
  }) => {
    // Isometric projection angles
    const w = size; // half-width
    const h = size * 0.5; // height ratio for isometric
    const d = depth; // cube depth
    
    return (
      <g>
        {/* Ground shadow */}
        <ellipse 
          cx={cx} 
          cy={cy + d + h + 15} 
          rx={w + 10} 
          ry={15} 
          fill={shadowColor} 
          opacity="0.15" 
          filter="url(#shadow)" 
        />
        
        {/* Left face */}
        <path 
          d={`M ${cx - w} ${cy} L ${cx} ${cy + h} L ${cx} ${cy + h + d} L ${cx - w} ${cy + d} Z`}
          fill={leftColor}
        />
        
        {/* Right face */}
        <path 
          d={`M ${cx + w} ${cy} L ${cx} ${cy + h} L ${cx} ${cy + h + d} L ${cx + w} ${cy + d} Z`}
          fill={rightColor}
        />
        
        {/* Top face with glow */}
        <path 
          d={`M ${cx} ${cy - h} L ${cx + w} ${cy} L ${cx} ${cy + h} L ${cx - w} ${cy} Z`}
          fill={topColor}
          filter={glowFilter}
        />
        
        {/* Top face inner highlight */}
        <path 
          d={`M ${cx} ${cy - h + 8} L ${cx + w - 10} ${cy} L ${cx} ${cy + h - 8} L ${cx - w + 10} ${cy} Z`}
          fill="white"
          opacity="0.15"
        />
        
        {/* Edge highlights */}
        <path 
          d={`M ${cx} ${cy - h} L ${cx + w} ${cy} L ${cx} ${cy + h} L ${cx - w} ${cy} Z`}
          fill="none"
          stroke="white"
          strokeWidth="1"
          opacity="0.3"
        />
        <line x1={cx} y1={cy + h} x2={cx} y2={cy + h + d} stroke="rgba(0,0,0,0.1)" strokeWidth="1" />
      </g>
    );
  };

  return (
    <div className="relative w-full h-full min-h-[420px]" aria-hidden="true">
      <svg
        viewBox="0 0 520 420"
        className="w-full h-full"
        style={{ overflow: 'visible' }}
      >
        <defs>
          {/* Gradients for top faces */}
          <linearGradient id="orangeTopGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fb923c" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
          <linearGradient id="greenTopGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4ade80" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>
          <linearGradient id="purpleTopGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
          
          {/* Glow filters */}
          <filter id="glowOrange" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feFlood floodColor="#f97316" floodOpacity="0.4" />
            <feComposite in2="blur" operator="in" />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glowGreen" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feFlood floodColor="#22c55e" floodOpacity="0.4" />
            <feComposite in2="blur" operator="in" />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glowPurple" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="10" result="blur" />
            <feFlood floodColor="#8b5cf6" floodOpacity="0.4" />
            <feComposite in2="blur" operator="in" />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="10" />
          </filter>
          <filter id="softShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>

        {/* Connection arcs - deposits going IN to escrow */}
        <motion.path
          d="M 100 195 Q 180 115 260 195"
          stroke="#f97316"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          opacity="0.5"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
        />
        <motion.path
          d="M 420 195 Q 340 115 260 195"
          stroke="#22c55e"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          opacity="0.5"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1, delay: 0.8, ease: "easeOut" }}
        />
        
        {/* Connection arcs - releases going OUT from escrow */}
        <motion.path
          d="M 260 235 Q 340 305 420 235"
          stroke="#f97316"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          opacity="0.5"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1, delay: 1.3, ease: "easeOut" }}
        />
        <motion.path
          d="M 260 235 Q 180 305 100 235"
          stroke="#22c55e"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          opacity="0.5"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1, delay: 1.3, ease: "easeOut" }}
        />

        {/* MAKER NODE - Left */}
        <motion.g
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <IsoCube 
            cx={100} cy={195} size={38} depth={45}
            topColor="url(#orangeTopGrad)" 
            leftColor="#ea580c" 
            rightColor="#c2410c"
            glowFilter="url(#glowOrange)"
            shadowColor="#f97316"
          />
          
          {/* BTC symbol on top */}
          <text x="100" y="202" textAnchor="middle" fontSize="22" fill="white" fontWeight="bold" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>₿</text>
          
          {/* Label */}
          <text x="100" y="282" textAnchor="middle" fontSize="12" fill="#404040" fontWeight="600">MAKER</text>
          <text x="100" y="296" textAnchor="middle" fontSize="9" fill="#737373">Deposits BTC</text>
        </motion.g>

        {/* ESCROW NODE - Center (larger) */}
        <motion.g
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          style={{ transformOrigin: '260px 215px' }}
        >
          <IsoCube 
            cx={260} cy={195} size={50} depth={60}
            topColor="url(#purpleTopGrad)" 
            leftColor="#7c3aed" 
            rightColor="#6d28d9"
            glowFilter="url(#glowPurple)"
            shadowColor="#8b5cf6"
          />
          
          {/* Lock icon on top */}
          <g transform="translate(260, 185)">
            {/* Lock body */}
            <rect x="-14" y="-2" width="28" height="20" rx="4" fill="white" opacity="0.95" />
            {/* Lock shackle */}
            <motion.path
              d="M -7 -2 L -7 -10 Q 0 -18 7 -10 L 7 -2"
              stroke="white"
              strokeWidth="4"
              fill="none"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.5, delay: 1 }}
            />
            {/* Keyhole */}
            <circle cx="0" cy="7" r="4" fill="#8b5cf6" />
            <rect x="-1.5" y="7" width="3" height="7" rx="1" fill="#8b5cf6" />
          </g>
          
          {/* Label */}
          <text x="260" y="310" textAnchor="middle" fontSize="12" fill="#404040" fontWeight="600">ESCROW</text>
          <text x="260" y="324" textAnchor="middle" fontSize="9" fill="#737373">Atomic Swap</text>
        </motion.g>

        {/* TAKER NODE - Right */}
        <motion.g
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <IsoCube 
            cx={420} cy={195} size={38} depth={45}
            topColor="url(#greenTopGrad)" 
            leftColor="#16a34a" 
            rightColor="#15803d"
            glowFilter="url(#glowGreen)"
            shadowColor="#22c55e"
          />
          
          {/* Token symbol on top */}
          <text x="420" y="202" textAnchor="middle" fontSize="20" fill="white" fontWeight="bold" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>◈</text>
          
          {/* Label */}
          <text x="420" y="282" textAnchor="middle" fontSize="12" fill="#404040" fontWeight="600">TAKER</text>
          <text x="420" y="296" textAnchor="middle" fontSize="9" fill="#737373">Deposits Tokens</text>
        </motion.g>

        {/* PHASE 1: Both deposit into escrow */}
        {[0, 1].map((i) => (
          <motion.g key={`btc-deposit-${i}`}>
            <motion.circle
              r="7"
              fill="#f97316"
              filter="url(#softShadow)"
              initial={{ opacity: 0, cx: 100, cy: 185 }}
              animate={{
                opacity: [0, 1, 1, 0],
                cx: [100, 180, 260],
                cy: [185, 140, 185],
              }}
              transition={{
                duration: 1.2,
                delay: 2 + i * 0.4,
                repeat: Infinity,
                repeatDelay: 6,
                ease: "easeInOut"
              }}
            />
            <motion.text
              fontSize="9"
              fill="white"
              fontWeight="bold"
              textAnchor="middle"
              initial={{ opacity: 0, x: 100, y: 189 }}
              animate={{
                opacity: [0, 1, 1, 0],
                x: [100, 180, 260],
                y: [189, 144, 189],
              }}
              transition={{
                duration: 1.2,
                delay: 2 + i * 0.4,
                repeat: Infinity,
                repeatDelay: 6,
                ease: "easeInOut"
              }}
            >₿</motion.text>
          </motion.g>
        ))}

        {[0, 1].map((i) => (
          <motion.g key={`token-deposit-${i}`}>
            <motion.circle
              r="7"
              fill="#22c55e"
              filter="url(#softShadow)"
              initial={{ opacity: 0, cx: 420, cy: 185 }}
              animate={{
                opacity: [0, 1, 1, 0],
                cx: [420, 340, 260],
                cy: [185, 140, 185],
              }}
              transition={{
                duration: 1.2,
                delay: 2.5 + i * 0.4,
                repeat: Infinity,
                repeatDelay: 6,
                ease: "easeInOut"
              }}
            />
            <motion.text
              fontSize="9"
              fill="white"
              fontWeight="bold"
              textAnchor="middle"
              initial={{ opacity: 0, x: 420, y: 189 }}
              animate={{
                opacity: [0, 1, 1, 0],
                x: [420, 340, 260],
                y: [189, 144, 189],
              }}
              transition={{
                duration: 1.2,
                delay: 2.5 + i * 0.4,
                repeat: Infinity,
                repeatDelay: 6,
                ease: "easeInOut"
              }}
            >◈</motion.text>
          </motion.g>
        ))}

        {/* PHASE 2: Atomic swap - releases */}
        {[0, 1].map((i) => (
          <motion.g key={`btc-release-${i}`}>
            <motion.circle
              r="7"
              fill="#f97316"
              filter="url(#softShadow)"
              initial={{ opacity: 0, cx: 260, cy: 245 }}
              animate={{
                opacity: [0, 1, 1, 0],
                cx: [260, 340, 420],
                cy: [245, 295, 245],
              }}
              transition={{
                duration: 1.2,
                delay: 5 + i * 0.4,
                repeat: Infinity,
                repeatDelay: 6,
                ease: "easeInOut"
              }}
            />
            <motion.text
              fontSize="9"
              fill="white"
              fontWeight="bold"
              textAnchor="middle"
              initial={{ opacity: 0, x: 260, y: 249 }}
              animate={{
                opacity: [0, 1, 1, 0],
                x: [260, 340, 420],
                y: [249, 299, 249],
              }}
              transition={{
                duration: 1.2,
                delay: 5 + i * 0.4,
                repeat: Infinity,
                repeatDelay: 6,
                ease: "easeInOut"
              }}
            >₿</motion.text>
          </motion.g>
        ))}

        {[0, 1].map((i) => (
          <motion.g key={`token-release-${i}`}>
            <motion.circle
              r="7"
              fill="#22c55e"
              filter="url(#softShadow)"
              initial={{ opacity: 0, cx: 260, cy: 245 }}
              animate={{
                opacity: [0, 1, 1, 0],
                cx: [260, 180, 100],
                cy: [245, 295, 245],
              }}
              transition={{
                duration: 1.2,
                delay: 5 + i * 0.4,
                repeat: Infinity,
                repeatDelay: 6,
                ease: "easeInOut"
              }}
            />
            <motion.text
              fontSize="9"
              fill="white"
              fontWeight="bold"
              textAnchor="middle"
              initial={{ opacity: 0, x: 260, y: 249 }}
              animate={{
                opacity: [0, 1, 1, 0],
                x: [260, 180, 100],
                y: [249, 299, 249],
              }}
              transition={{
                duration: 1.2,
                delay: 5 + i * 0.4,
                repeat: Infinity,
                repeatDelay: 6,
                ease: "easeInOut"
              }}
            >◈</motion.text>
          </motion.g>
        ))}

        {/* Flow labels */}
        <motion.g
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8 }}
        >
          {/* Deposit labels */}
          <g>
            <rect x="140" y="95" width="75" height="24" rx="12" fill="white" stroke="#fed7aa" strokeWidth="1.5" />
            <circle cx="155" cy="107" r="7" fill="#fff7ed" stroke="#f97316" strokeWidth="1" />
            <text x="155" y="111" textAnchor="middle" fontSize="9" fill="#f97316" fontWeight="bold">1</text>
            <text x="188" y="111" textAnchor="middle" fontSize="10" fill="#525252" fontWeight="500">Deposit</text>
          </g>
          <g>
            <rect x="305" y="95" width="75" height="24" rx="12" fill="white" stroke="#bbf7d0" strokeWidth="1.5" />
            <circle cx="320" cy="107" r="7" fill="#f0fdf4" stroke="#22c55e" strokeWidth="1" />
            <text x="320" y="111" textAnchor="middle" fontSize="9" fill="#22c55e" fontWeight="bold">2</text>
            <text x="353" y="111" textAnchor="middle" fontSize="10" fill="#525252" fontWeight="500">Deposit</text>
          </g>
          
          {/* Swap label */}
          <g>
            <rect x="220" y="340" width="80" height="26" rx="13" fill="white" stroke="#c4b5fd" strokeWidth="1.5" />
            <circle cx="236" cy="353" r="7" fill="#f5f3ff" stroke="#8b5cf6" strokeWidth="1" />
            <text x="236" y="357" textAnchor="middle" fontSize="9" fill="#8b5cf6" fontWeight="bold">3</text>
            <text x="272" y="357" textAnchor="middle" fontSize="10" fill="#7c3aed" fontWeight="600">Swap</text>
          </g>
        </motion.g>

        {/* Result labels */}
        <motion.g
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.2 }}
        >
          <text x="100" y="312" textAnchor="middle" fontSize="9" fill="#16a34a" fontWeight="500">Receives ◈</text>
          <text x="420" y="312" textAnchor="middle" fontSize="9" fill="#ea580c" fontWeight="500">Receives ₿</text>
        </motion.g>
      </svg>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="overflow-hidden">
      {/* Hero */}
      <section className="min-h-[60vh] sm:min-h-[80vh] flex items-center py-12 sm:py-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left - Text */}
            <div>
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight leading-[1.1] text-[#0a0a0a]"
              >
                Trustless Bitcoin OTC Trading
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                className="mt-5 sm:mt-6 text-base sm:text-lg text-black/50 max-w-lg leading-relaxed"
              >
                Trade BTC and Rune tokens peer-to-peer with on-chain escrow protection. 
                Zero counterparty risk. Powered by MIDL Protocol.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="mt-8 flex flex-wrap gap-4"
              >
                <Link href="/market" className="btn-primary">
                  <TektonLogo size={18} className="text-white" />
                  Browse Market
                </Link>
                <Link href="/create" className="btn-secondary">
                  Start Trading
                </Link>
              </motion.div>
            </div>

            {/* Right - Animated Escrow Flow */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="hidden lg:block h-[420px] relative"
            >
              <IsometricNetwork />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-[#0a0a0a] mb-4">
              Built for Security
            </h2>
            <p className="text-black/50 max-w-lg mx-auto">
              Every feature designed to eliminate counterparty risk in OTC trading.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="card card-hover p-6"
              >
                <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500 mb-4">
                  {feature.icon}
                </div>
                <h3 className="font-semibold text-[#0a0a0a] mb-2">{feature.title}</h3>
                <p className="text-sm text-black/50 leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-16 sm:py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-[#0a0a0a] mb-4">
              How It Works
            </h2>
            <p className="text-black/50 max-w-lg mx-auto">
              Three simple steps to trustless OTC trading.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {STEPS.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
                className="text-center"
              >
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#fafafa] border border-black/[0.06] mb-4">
                  <span className="text-xl font-bold text-orange-500">{step.num}</span>
                </div>
                <h3 className="font-semibold text-lg text-[#0a0a0a] mb-2">{step.title}</h3>
                <p className="text-sm text-black/50">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-24">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-[#0a0a0a] mb-4">
            Ready to Trade?
          </h2>
          <p className="text-black/50 mb-8 max-w-lg mx-auto">
            Join the trustless OTC marketplace. Connect your wallet and start trading Bitcoin peer-to-peer.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/market" className="btn-primary">
              Explore Market
            </Link>
            <Link href="/docs" className="btn-secondary">
              Read Docs
            </Link>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
