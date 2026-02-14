"use client";

/**
 * Global error boundary for Next.js App Router.
 * Catches unhandled errors and shows a recoverable UI.
 * Fixes audit finding: M-3
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  if (process.env.NODE_ENV === "development") {
    console.error("[GlobalError]", error);
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fafafa] p-6">
      <div className="card max-w-md w-full text-center py-12 px-8">
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            className="text-red-500"
          >
            <path
              d="M12 9v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-[#0a0a0a] mb-2">
          Something went wrong
        </h2>
        <p className="text-sm text-black/50 mb-6">
          An unexpected error occurred. Please try again.
        </p>
        <button
          onClick={reset}
          className="px-6 py-2.5 bg-orange-500 text-white text-sm font-medium rounded-xl hover:bg-orange-400 transition-colors shadow-sm shadow-orange-500/20"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
