"use client";

import dynamic from "next/dynamic";

// The interactive app is a client experience. Render client-only to avoid SSR/window hydration
// mismatches. `initialAptId` deep-links straight to an apartment (used by /apartment/[id]).
const MaskanApp = dynamic(() => import("@/maskan/App"), {
  ssr: false,
  loading: () => <div className="min-h-screen bg-canvas" />,
});

export default function AppClient({ initialAptId }: { initialAptId?: string }) {
  return <MaskanApp initialAptId={initialAptId} />;
}
