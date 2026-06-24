// Multi-currency PRICE DISPLAY. USD is canonical (what's stored & charged); every other
// currency is a convenience conversion via per_usd rates (db.js getRates). Non-USD amounts
// are shown with a "≈" so guests know it's approximate.

export const CURRENCIES = {
  USD: { symbol: "$",    pos: "pre",  name: { uz: "AQSh dollari",        ru: "Доллар США",       en: "US dollar" } },
  UZS: { symbol: "soʻm", pos: "post", name: { uz: "Oʻzbek soʻmi",        ru: "Узбекский сум",    en: "Uzbek som" } },
  RUB: { symbol: "₽",    pos: "post", name: { uz: "Rossiya rubli",       ru: "Российский рубль", en: "Russian ruble" } },
  KZT: { symbol: "₸",    pos: "post", name: { uz: "Qozogʻiston tengesi", ru: "Казахский тенге",  en: "Kazakh tenge" } },
  KGS: { symbol: "som",  pos: "post", name: { uz: "Qirgʻiziston somi",   ru: "Киргизский сом",   en: "Kyrgyz som" } },
};
export const CURRENCY_CODES = ["USD", "UZS", "RUB", "KZT", "KGS"];

// first visit (no saved choice) defaults to USD for everyone; the user can switch (persisted)
export const defaultCurrencyFor = () => "USD";

// round converted amounts so they read cleanly (not 1 583 247)
function roundNice(n, cur) {
  if (cur === "UZS") return Math.round(n / 1000) * 1000;             // nearest 1 000 soʻm
  if (cur === "KZT" || cur === "KGS") return Math.round(n / 10) * 10; // nearest 10
  return Math.round(n);                                              // USD, RUB → integer
}

// usd = amount in USD (canonical). currency = target code. rates = per_usd map (getRates()).
export function fmtPrice(usd, currency = "USD", rates = null) {
  const cur = CURRENCIES[currency] ? currency : "USD";
  const per = cur === "USD" ? 1 : (rates && rates[cur]);
  if (per == null) return fmtPrice(usd, "USD", rates); // no rate yet → never show a wrong number
  const meta = CURRENCIES[cur];
  const value = roundNice((Number(usd) || 0) * per, cur);
  const num = value.toLocaleString("ru-RU").replace(/ /g, " "); // spaces as thousands separators
  const body = meta.pos === "pre" ? `${meta.symbol}${num}` : `${num} ${meta.symbol}`;
  return cur === "USD" ? body : `≈ ${body}`;
}
