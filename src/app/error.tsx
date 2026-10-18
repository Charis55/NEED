"use client";

import { useEffect } from "react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App Router Error Caught:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[var(--color-brutal-bg,#f4f0ea)] flex flex-col items-center justify-center p-6 text-black select-none">
      <div className="border-4 border-black bg-white p-8 shadow-[8px_8px_0_0_#000] flex flex-col items-center gap-4 max-w-sm w-full text-center">
        <div className="w-12 h-12 bg-yellow-400 border-4 border-black flex items-center justify-center text-2xl font-black">
          !
        </div>
        <h2 className="font-black text-2xl uppercase tracking-tighter">Something Went Wrong</h2>
        <p className="font-bold text-xs uppercase tracking-wider text-black/70">
          {error?.message || "An unexpected error occurred while loading this view."}
        </p>
        <button
          onClick={() => reset()}
          className="mt-4 px-6 py-3 bg-yellow-400 border-4 border-black shadow-[4px_4px_0_0_#000] active:translate-x-1 active:translate-y-1 font-black uppercase text-sm"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
