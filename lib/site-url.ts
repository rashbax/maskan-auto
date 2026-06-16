// Single source of truth for the public site origin (no trailing slash).
// Override per-environment with the SITE_URL env var (Vercel → Environment Variables);
// the literal below is the canonical production domain and the fallback used at build time
// or wherever the env var isn't inlined (e.g. a client bundle, where non-NEXT_PUBLIC vars
// resolve to undefined). Keep this in sync with the domain configured in Vercel.
export const SITE_URL = (process.env.SITE_URL || "https://maskan-24.uz").replace(/\/$/, "");
