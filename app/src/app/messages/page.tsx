"use client";

import Link from "next/link";

export default function MessagesPage() {
  return (
    <div className="card flex flex-col items-center justify-center flex-1 text-center p-8">
      <div className="w-16 h-16 bg-black/[0.03] rounded-2xl flex items-center justify-center mb-5">
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          className="text-black/15"
        >
          <path
            d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <h3 className="font-semibold text-[#0a0a0a] mb-1">
        Select a conversation
      </h3>
      <p className="text-sm text-black/40 max-w-xs">
        Choose a conversation from the left, or message a seller from the&nbsp;
        <Link
          href="/market"
          className="text-orange-500 hover:text-orange-600 transition-colors"
        >
          market
        </Link>
        .
      </p>
    </div>
  );
}
