import { createAdminClient } from "@/lib/supabase/admin";

// Multi-currency PRICE DISPLAY only (USD stays canonical; booking totals are USD).
// CBU quotes UZS per foreign currency; we store "units of currency C per 1 USD" so the
// UI can do price_usd × per_usd[C]. Refreshed daily, piggy-backed on the beds24-pull cron.

const TARGETS = ["RUB", "KZT", "KGS"] as const; // UZS + USD handled directly below
const FALLBACK: Record<string, number> = { USD: 1, UZS: 12650, RUB: 90, KZT: 480, KGS: 87 };
const CBU_URL = "https://cbu.uz/uz/arkhiv-kursov-valyut/json/";

type CbuRow = { Ccy: string; Rate: string; Nominal: string };

export async function refreshRates(): Promise<{ ok: boolean; per_usd?: Record<string, number>; error?: string }> {
  let rows: CbuRow[];
  try {
    const res = await fetch(CBU_URL, { cache: "no-store" });
    if (!res.ok) return { ok: false, error: `cbu_${res.status}` };
    rows = (await res.json()) as CbuRow[];
  } catch {
    return { ok: false, error: "cbu_fetch_failed" };
  }
  if (!Array.isArray(rows)) return { ok: false, error: "cbu_bad_body" };

  // UZS per 1 unit of a currency (CBU Rate is UZS per Nominal units)
  const uzsPer = (ccy: string): number | null => {
    const r = rows.find((x) => x.Ccy === ccy);
    if (!r) return null;
    const rate = parseFloat(r.Rate), nominal = parseFloat(r.Nominal) || 1;
    return rate > 0 ? rate / nominal : null;
  };

  const uzsPerUsd = uzsPer("USD");
  if (!uzsPerUsd) return { ok: false, error: "no_usd_rate" };

  const per_usd: Record<string, number> = { USD: 1, UZS: Math.round(uzsPerUsd) };
  for (const c of TARGETS) {
    const u = uzsPer(c);
    per_usd[c] = u ? Math.round((uzsPerUsd / u) * 100) / 100 : FALLBACK[c]; // C per 1 USD
  }

  const sb = createAdminClient();
  const { error } = await sb.from("exchange_rates").upsert({ id: 1, per_usd, updated_at: new Date().toISOString() });
  if (error) return { ok: false, error: error.message };
  return { ok: true, per_usd };
}
