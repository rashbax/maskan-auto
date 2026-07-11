"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

// The interactive app is a client experience. Render client-only to avoid SSR/window hydration
// mismatches. No `loading` shell: while the chunk + catalog data load, the server-rendered
// HomeCatalog (passed as `fallback`) stays on screen.
const MaskanApp = dynamic(() => import("@/maskan/App"), { ssr: false });

// The SPA mounts hidden and reports readiness (App calls onReady once its apartment data is in),
// then the server catalog is swapped out in one step — crawlers and the first paint get real
// content, users never see a skeleton flash or a double catalog.
export default function AppClient({ fallback }: { fallback?: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  // Safety valve: if the data fetch hangs, still hand over to the SPA (its own error/skeleton
  // states are better than a static page that never becomes interactive).
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 8000);
    return () => clearTimeout(t);
  }, []);
  return (
    <>
      {!ready && fallback}
      <div hidden={!ready}>
        <MaskanApp onReady={() => setReady(true)} />
      </div>
    </>
  );
}
