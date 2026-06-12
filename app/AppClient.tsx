"use client";

import dynamic from "next/dynamic";

// The interactive app is a client experience. Render client-only to avoid SSR/window hydration
// mismatches.
const MaskanApp = dynamic(() => import("@/maskan/App"), {
  ssr: false,
  loading: () => <div className="min-h-screen bg-canvas" />,
});

export default function AppClient() {
  return <MaskanApp />;
}
