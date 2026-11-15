"use client";

import dynamic from "next/dynamic";

const ApexChaosClientRoot = dynamic(() => import("./ApexChaosClientRoot"), {
  ssr: false,
  loading: () => (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center bg-[#080b0e] text-[#f1f5f9] select-none"
      aria-label="Loading APEX CHAOS"
    >
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#ff941f]/30 border-t-[#ff941f]" />
      <p className="mt-4 font-mono text-xs tracking-[0.28em] text-[#ff941f]/90 uppercase">
        APEX CHAOS · INITIALIZING SCRAP BASIN
      </p>
    </div>
  ),
});

export default function ApexChaosBootstrap() {
  return <ApexChaosClientRoot />;
}
