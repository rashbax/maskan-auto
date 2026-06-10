"use client";

import dynamic from "next/dynamic";

// The app is a fully interactive client experience (mock data for now).
// Render client-only to avoid SSR/window hydration mismatches; real data + routing comes later.
const MaskanApp = dynamic(() => import("@/maskan/App"), {
  ssr: false,
  loading: () => <div className="min-h-screen bg-canvas" />,
});

export default function Home() {
  return <MaskanApp />;
}
