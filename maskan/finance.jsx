"use client";
// Admin finance: per-apartment profit for a chosen period.
//
// Money model (all math in USD; display converts via the daily CBU rates):
//   revenue (net) = bookings prorated to the period, cancelled excluded,
//                   OTA channel commission (commission_usd) subtracted
//   costs         = owner rent + HOA (monthly, prorated by days, from property_files)
//                   + logged expenses (the expenses journal below)
//   profit        = revenue − costs
// Proration: a booking spanning the period boundary contributes only its in-period
// nights at its own nightly rate, so monthly numbers add up across months.
//
// Layout follows the admin shell convention: desktop vs mobile comes from the `device`
// prop (NOT CSS md: breakpoints) so it stays correct inside a phone device frame.
import { useEffect, useMemo, useState } from "react";
import { Icon } from "./ui";
import { calMonths } from "./calendar";
import { getPropertyFiles, getExpenses, addExpense, deleteExpense, getRates, RATE_FALLBACK } from "./db";

const DAY = 86400000;
const AVG_MONTH_DAYS = 30.44; // 365.25 / 12 — monthly rent/HOA prorated to arbitrary periods

const CATEGORIES = ["cleaning", "repair", "supplies", "rent", "utilities", "marketing", "other"];
const CAT_LABEL = {
  cleaning: { ru: "Уборка", uz: "Tozalash", en: "Cleaning" },
  repair: { ru: "Ремонт", uz: "Taʼmir", en: "Repair" },
  supplies: { ru: "Расходники", uz: "Jihozlar", en: "Supplies" },
  rent: { ru: "Аренда", uz: "Ijara", en: "Rent" },
  utilities: { ru: "Коммуналка", uz: "Kommunal", en: "Utilities" },
  marketing: { ru: "Реклама", uz: "Reklama", en: "Marketing" },
  other: { ru: "Прочее", uz: "Boshqa", en: "Other" },
};

// month arithmetic without Date-timezone traps: y/m (0-based) → "YYYY-MM-01"
const monthShift = (y, m, d) => { const t = y * 12 + m + d; return [Math.floor(t / 12), ((t % 12) + 12) % 12]; };
const firstOf = (y, m) => `${y}-${String(m + 1).padStart(2, "0")}-01`;

function periodFor(preset) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const next = firstOf(...monthShift(y, m, 1));
  if (preset === "this") return { from: firstOf(y, m), to: next };
  if (preset === "last") return { from: firstOf(...monthShift(y, m, -1)), to: firstOf(y, m) };
  if (preset === "3m") return { from: firstOf(...monthShift(y, m, -2)), to: next };
  return { from: `${y}-01-01`, to: `${y + 1}-01-01` }; // "year"
}

// nights of [ci, co) that fall inside [from, to)
function overlapNights(from, to, ci, co) {
  const s = ci > from ? ci : from;
  const e = co < to ? co : to;
  return Math.max(0, Math.round((Date.parse(e) - Date.parse(s)) / DAY));
}

// The ONE proration rule: a booking's in-window share of its stay (null when it doesn't touch
// the window). Both the P&L and the trend go through this so the money model can't drift.
function stayShare(b, from, to) {
  const bNights = b.nights || Math.round((Date.parse(b.to) - Date.parse(b.from)) / DAY) || 1;
  const inP = overlapNights(from, to, b.from, b.to);
  return inP ? { inP, frac: inP / bNights } : null;
}

const num = (v) => (v === "" || v == null ? 0 : Number(v) || 0);

// labels shared verbatim between the desktop table and the mobile cards — one triple each,
// so a copy fix can't drift between viewports
const LBL = {
  revenue: { ru: "Доход", uz: "Tushum", en: "Revenue" },
  expenses: { ru: "Расходы", uz: "Xarajat", en: "Expenses" },
  profit: { ru: "Прибыль", uz: "Foyda", en: "Profit" },
  nights: { ru: "Ночей", uz: "Kecha", en: "Nights" },
  occ: { ru: "Загрузка", uz: "Bandlik", en: "Occ." },
  avgNight: { ru: "Ср./ночь", uz: "Oʻrt./kecha", en: "Avg/night" },
  total: { ru: "Итого", uz: "Jami", en: "Total" },
};

// small stat used inside the mobile apartment cards
function AptStat({ label, children }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-bold uppercase tracking-wide text-inksoft/90">{label}</div>
      <div className="text-[13px] tnum mt-0.5">{children}</div>
    </div>
  );
}

export function FinanceSection({ lang, apartments, bookings, device }) {
  const T = (ru, uz, en) => (lang === "ru" ? ru : lang === "uz" ? uz : en);
  const desktop = device === "desktop";
  const [preset, setPreset] = useState("this");
  const [cur, setCur] = useState("USD");
  const [pfiles, setPfiles] = useState([]);
  const [expenses, setExpenses] = useState(null); // null = loading
  const [rates, setRates] = useState(RATE_FALLBACK);
  const [armedDelete, setArmedDelete] = useState(null); // expense id awaiting 2nd tap

  useEffect(() => {
    getPropertyFiles().then(setPfiles);
    getExpenses().then(setExpenses).catch(() => setExpenses([]));
    getRates().then(setRates).catch(() => {});
  }, []);

  const uzs = rates.UZS || RATE_FALLBACK.UZS;
  const toUsd = (amount, currency) => (currency === "USD" ? amount : amount / uzs);
  const fmt = (usd) => {
    const sign = usd < -0.5 ? "−" : "";
    const abs = Math.abs(usd);
    return cur === "USD"
      ? `${sign}$${Math.round(abs).toLocaleString("ru-RU")}`
      : `${sign}${Math.round(abs * uzs).toLocaleString("ru-RU")} UZS`;
  };

  const { from, to } = useMemo(() => periodFor(preset), [preset]);
  const periodDays = Math.round((Date.parse(to) - Date.parse(from)) / DAY);

  const calc = useMemo(() => {
    const perApt = {}; // aptId -> { net, commission, nights, rent, hoa, exp }
    const row = (id) => (perApt[id] ||= { net: 0, commission: 0, nights: 0, rent: 0, hoa: 0, exp: 0 });
    const bySource = { website: 0, manual: 0, booking: 0, airbnb: 0 };

    for (const b of bookings || []) {
      if (b.status === "cancelled") continue;
      const s = stayShare(b, from, to);
      if (!s) continue;
      const gross = (b.total || 0) * s.frac;
      const commission = (b.commission || 0) * s.frac;
      const r = row(b.apt);
      r.commission += commission;
      r.net += gross - commission;
      r.nights += s.inP;
      if (bySource[b.source] != null) bySource[b.source] += gross - commission;
    }

    // monthly owner rent + HOA from the property file, prorated to the period by days
    const monthFrac = periodDays / AVG_MONTH_DAYS;
    for (const f of pfiles || []) {
      if (!f.apartmentId) continue;
      const r = row(f.apartmentId);
      r.rent += toUsd(num(f.rentAmount), f.rentCurrency) * monthFrac;
      r.hoa += (num(f.hoaFeeUzs) / uzs) * monthFrac;
    }

    // logged expenses inside the period ("" apartment → the general row)
    for (const e of expenses || []) {
      if (e.date < from || e.date >= to) continue;
      row(e.apartmentId || "__general").exp += toUsd(e.amount, e.currency);
    }

    const total = { net: 0, nights: 0, cost: 0, profit: 0 };
    for (const r of Object.values(perApt)) {
      const cost = r.rent + r.hoa + r.exp;
      r.cost = cost;
      r.profit = r.net - cost;
      // derived display fields computed ONCE so the table and mobile cards can't drift
      r.occ = r.nights ? Math.min(100, (r.nights / periodDays) * 100) : null;
      r.adr = r.nights ? r.net / r.nights : null;
      total.net += r.net;
      total.nights += r.nights;
      total.cost += cost;
      total.profit += r.profit;
    }
    return { perApt, bySource, total };
  }, [bookings, pfiles, expenses, from, to, periodDays, uzs]);

  // 12-month net-revenue trend (independent of the period selector)
  const trend = useMemo(() => {
    const now = new Date();
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const [y, m] = monthShift(now.getFullYear(), now.getMonth(), -i);
      const mFrom = firstOf(y, m);
      const mTo = firstOf(...monthShift(y, m, 1));
      let net = 0;
      for (const b of bookings || []) {
        if (b.status === "cancelled") continue;
        const s = stayShare(b, mFrom, mTo);
        if (s) net += ((b.total || 0) - (b.commission || 0)) * s.frac;
      }
      months.push({ label: calMonths[lang][m].slice(0, 3), net });
    }
    return months;
  }, [bookings, lang]);
  const trendMax = Math.max(1, ...trend.map((t) => t.net));

  const aptName = (id) =>
    id === "__general"
      ? T("Общие расходы", "Umumiy xarajatlar", "General expenses")
      : (apartments.find((a) => a.id === id)?.title?.[lang] || id);

  const occupancy = calc.total.nights && apartments.length ? (calc.total.nights / (periodDays * apartments.length)) * 100 : 0;
  const adr = calc.total.nights ? calc.total.net / calc.total.nights : 0;
  const margin = calc.total.net > 0.5 ? (calc.total.profit / calc.total.net) * 100 : null; // display-only

  const presets = [
    { k: "this", l: T("Этот месяц", "Shu oy", "This month") },
    { k: "last", l: T("Прошлый месяц", "Oʻtgan oy", "Last month") },
    { k: "3m", l: T("3 месяца", "3 oy", "3 months") },
    { k: "year", l: T("Год", "Yil", "Year") },
  ];

  const card = "rounded-2xl border border-line bg-white p-4";
  const kicker = "text-[11px] font-bold uppercase tracking-wide text-inksoft";
  const th = "text-[11px] font-bold uppercase tracking-wide text-inksoft px-3 py-2.5 whitespace-nowrap";
  const thL = `${th} text-left`;
  const thR = `${th} text-right`;
  const td = "px-3 py-3 text-[13.5px] whitespace-nowrap tnum";
  const tdR = `${td} text-right`;

  // rows: apartments in catalog order, then any id the apartments prop doesn't know (e.g. a
  // hidden listing that still has period bookings — totals include it, so a row must too,
  // keeping Total always equal to the sum of visible rows), then the general-expenses row
  const rowIds = [
    ...apartments.map((a) => a.id).filter((id) => calc.perApt[id]),
    ...Object.keys(calc.perApt).filter((id) => id !== "__general" && !apartments.some((a) => a.id === id)).sort(),
    ...(calc.perApt.__general ? ["__general"] : []),
  ];

  const periodExpenses = (expenses || []).filter((e) => e.date >= from && e.date < to);
  const loss = calc.total.profit < -0.5;
  // apartments whose rent is already auto-counted from the property file — the expense form
  // warns before a manual "rent" entry subtracts the same rent a second time
  const rentAutoIds = useMemo(
    () => new Set((pfiles || []).filter((f) => f.apartmentId && num(f.rentAmount) > 0).map((f) => f.apartmentId)),
    [pfiles],
  );

  return (
    <div className="space-y-5 pb-8">
      {/* period + currency */}
      <div className="flex items-center gap-2 flex-wrap">
        {presets.map((p) => (
          <button key={p.k} onClick={() => setPreset(p.k)}
            className={`h-9 px-3.5 rounded-full text-[13px] font-bold border transition ${preset === p.k ? "bg-green-700 text-cream border-green-700" : "bg-white border-line text-inksoft hover:border-ink/30"}`}>
            {p.l}
          </button>
        ))}
        <span className="text-[12px] text-inksoft ml-1 tnum">{from} → {to}</span>
        <button onClick={() => setCur(cur === "USD" ? "UZS" : "USD")}
          className="ml-auto h-9 px-3.5 rounded-full text-[13px] font-bold border border-line bg-white hover:border-ink/30">
          {cur === "USD" ? "$ USD" : "UZS"}
        </button>
      </div>

      {/* PROFIT hero + secondary metrics (1 + 2×2) */}
      <div className={`grid gap-3 ${desktop ? "lg:grid-cols-3" : ""}`}>
        {/* hero — profit is the answer to "am I making money?" */}
        <div className={`rounded-2xl p-5 flex flex-col justify-between min-h-[132px] ${loss ? "bg-red-600" : "bg-green-700"} text-cream`}>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-bold uppercase tracking-wide text-cream/75">{LBL.profit[lang]}</span>
            {margin != null && (
              <span className="text-[12px] font-bold tnum text-cream/85 bg-cream/15 rounded-full px-2 py-0.5">
                {margin.toFixed(0)}% {T("маржа", "marja", "margin")}
              </span>
            )}
          </div>
          <div className="mt-3">
            <div className="font-serif text-[40px] leading-none tnum">{fmt(calc.total.profit)}</div>
            <div className="text-[12px] text-cream/75 mt-2 tnum">
              {fmt(calc.total.net)} {T("доход", "tushum", "revenue")} − {fmt(calc.total.cost)} {T("расходы", "xarajat", "costs")}
            </div>
          </div>
        </div>
        {/* secondary — 2×2 */}
        <div className={`grid grid-cols-2 gap-3 ${desktop ? "lg:col-span-2" : ""}`}>
          <div className={card}><div className={kicker}>{T("Доход (чистый)", "Tushum (sof)", "Revenue (net)")}</div><div className="font-serif text-[26px] leading-none mt-2 tnum">{fmt(calc.total.net)}</div></div>
          <div className={card}><div className={kicker}>{T("Расходы", "Xarajatlar", "Costs")}</div><div className="font-serif text-[26px] leading-none mt-2 tnum">{fmt(calc.total.cost)}</div></div>
          <div className={card}><div className={kicker}>{T("Загрузка", "Bandlik", "Occupancy")}</div><div className="font-serif text-[26px] leading-none mt-2 tnum">{occupancy.toFixed(0)}%</div></div>
          <div className={card}><div className={kicker}>{T("Средняя цена ночи", "Oʻrtacha kecha narxi", "Avg. nightly price")}</div><div className="font-serif text-[26px] leading-none mt-2 tnum">{fmt(adr)}</div></div>
        </div>
      </div>

      {/* revenue by source */}
      <div className="flex items-center gap-2 flex-wrap text-[13px]">
        <span className="text-inksoft font-semibold">{T("Источники:", "Manbalar:", "Sources:")}</span>
        <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-green-50 text-green-700 font-bold tnum">{T("Сайт", "Sayt", "Website")} · {fmt(calc.bySource.website)}</span>
        <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-cream border border-line font-bold tnum">{T("Вручную", "Qoʻlda", "Manual")} · {fmt(calc.bySource.manual)}</span>
        <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-blue-50 text-blue-700 font-bold tnum">Booking.com · {fmt(calc.bySource.booking)}</span>
        <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full font-bold tnum" style={{ background: "#FBE9E8", color: "#E0565B" }}>Airbnb · {fmt(calc.bySource.airbnb)}</span>
      </div>

      {/* —— per-apartment: dense table on desktop, stacked cards on mobile —— */}
      {rowIds.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white py-12 grid place-items-center text-center px-6">
          <Icon name="clipboard" size={26} className="text-inksoft mb-2.5" />
          <div className="font-serif text-[17px] text-ink">{T("Нет данных за период", "Bu davrda maʼlumot yoʻq", "No data for this period")}</div>
          <div className="text-[13px] text-inksoft mt-1">{T("Выберите другой период выше", "Yuqoridan boshqa davrni tanlang", "Pick another period above")}</div>
        </div>
      ) : desktop ? (
        <div className="rounded-2xl border border-line bg-white overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse">
            <thead className="bg-cream/40 border-b border-line">
              <tr>
                <th className={thL}>{T("Квартира", "Kvartira", "Apartment")}</th>
                <th className={thR}>{LBL.revenue[lang]}</th>
                <th className={thR}>{LBL.nights[lang]}</th>
                <th className={thR}>{LBL.occ[lang]}</th>
                <th className={thR}>{LBL.avgNight[lang]}</th>
                <th className={thR}>{T("Аренда+ТСЖ", "Ijara+TSJ", "Rent+HOA")}</th>
                <th className={thR}>{LBL.expenses[lang]}</th>
                <th className={thR}>{LBL.profit[lang]}</th>
              </tr>
            </thead>
            <tbody>
              {rowIds.map((id) => {
                const r = calc.perApt[id];
                return (
                  <tr key={id} className="odd:bg-cream/20 hover:bg-cream/60 transition-colors">
                    <td className="px-3 py-3 text-[13.5px] font-semibold max-w-[260px] overflow-hidden text-ellipsis">{id !== "__general" && <span className="text-inksoft font-normal tnum">{id} · </span>}{aptName(id)}</td>
                    <td className={tdR}>{fmt(r.net)}{r.commission > 0.5 && <span className="text-[11px] text-inksoft"> ({T("комиссия", "komissiya", "fee")} {fmt(r.commission)})</span>}</td>
                    <td className={tdR}>{r.nights || "—"}</td>
                    <td className={tdR}>{r.occ != null ? `${r.occ.toFixed(0)}%` : "—"}</td>
                    <td className={tdR}>{r.adr != null ? fmt(r.adr) : "—"}</td>
                    <td className={tdR}>{r.rent + r.hoa > 0.5 ? fmt(r.rent + r.hoa) : "—"}</td>
                    <td className={tdR}>{r.exp > 0.5 ? fmt(r.exp) : "—"}</td>
                    <td className={`${tdR} font-bold ${r.profit < -0.5 ? "text-red-600" : "text-green-700"}`}>{fmt(r.profit)}</td>
                  </tr>
                );
              })}
            </tbody>
            {rowIds.length > 1 && (
              <tfoot className="border-t border-line bg-cream/50">
                <tr>
                  <td className={`${td} font-bold`}>{LBL.total[lang]}</td>
                  <td className={`${tdR} font-bold`}>{fmt(calc.total.net)}</td>
                  <td className={`${tdR} font-bold`}>{calc.total.nights}</td>
                  <td className={tdR}>{occupancy.toFixed(0)}%</td>
                  <td className={tdR}>{fmt(adr)}</td>
                  <td className={`${tdR} font-bold`} colSpan={2}>{fmt(calc.total.cost)}</td>
                  <td className={`${tdR} font-bold ${loss ? "text-red-600" : "text-green-700"}`}>{fmt(calc.total.profit)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      ) : (
        <div className="space-y-2.5">
          {rowIds.map((id) => {
            const r = calc.perApt[id];
            const rowLoss = r.profit < -0.5;
            return (
              <div key={id} className="rounded-2xl border border-line bg-white p-4">
                <div className="text-[14px] font-semibold leading-snug">
                  {id !== "__general" && <span className="text-inksoft font-normal tnum">{id} · </span>}{aptName(id)}
                </div>
                <div className="mt-3 grid grid-cols-3 rounded-xl border border-line overflow-hidden text-center">
                  <div className="p-2.5">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-inksoft">{LBL.revenue[lang]}</div>
                    <div className="text-[15px] font-semibold tnum mt-1">{fmt(r.net)}</div>
                  </div>
                  <div className="p-2.5 border-x border-line">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-inksoft">{LBL.expenses[lang]}</div>
                    <div className="text-[15px] font-semibold tnum mt-1">{r.cost > 0.5 ? fmt(r.cost) : "—"}</div>
                  </div>
                  <div className={`p-2.5 ${rowLoss ? "bg-red-600/5" : "bg-green-50"}`}>
                    <div className="text-[10px] font-bold uppercase tracking-wide text-inksoft">{LBL.profit[lang]}</div>
                    <div className={`text-[15px] font-bold tnum mt-1 ${rowLoss ? "text-red-600" : "text-green-700"}`}>{fmt(r.profit)}</div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <AptStat label={LBL.nights[lang]}>{r.nights || "—"}</AptStat>
                  <AptStat label={LBL.occ[lang]}>{r.occ != null ? `${r.occ.toFixed(0)}%` : "—"}</AptStat>
                  <AptStat label={LBL.avgNight[lang]}>{r.adr != null ? fmt(r.adr) : "—"}</AptStat>
                </div>
              </div>
            );
          })}
          {rowIds.length > 1 && (
            <div className={`rounded-2xl border p-4 ${loss ? "border-red-600/30 bg-red-600/5" : "border-green-700/25 bg-green-50"}`}>
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-bold uppercase tracking-wide text-inksoft">{LBL.total[lang]}</span>
                <span className={`font-serif text-[22px] tnum ${loss ? "text-red-600" : "text-green-700"}`}>{fmt(calc.total.profit)}</span>
              </div>
              <div className="text-[12px] text-inksoft mt-1 tnum">{fmt(calc.total.net)} − {fmt(calc.total.cost)}</div>
            </div>
          )}
        </div>
      )}
      <p className="text-[12px] text-inksoft -mt-1">
        {T("Аренда и ТСЖ берутся из паспорта квартиры (в месяц) и пересчитываются на период. Комиссия OTA вычтена из дохода.",
           "Ijara va TSJ kvartira pasportidan (oylik) olinib davrga moslanadi. OTA komissiyasi tushumdan ayirilgan.",
           "Rent and HOA come from the property file (monthly), prorated to the period. OTA commission is subtracted from revenue.")}
      </p>

      {/* 12-month trend */}
      <div className={card}>
        <div className="text-[13px] font-bold mb-4">{T("Доход по месяцам (чистый, 12 мес.)", "Oylik tushum (sof, 12 oy)", "Monthly net revenue (12 mo)")}</div>
        <div className="relative flex items-end gap-1.5 h-36 border-b border-line pt-6">
          {/* faint mid gridline */}
          <div className="pointer-events-none absolute left-0 right-0 top-[calc(50%+9px)] border-t border-dashed border-line/70" />
          {trend.map((t, i) => {
            const isCur = i === trend.length - 1;
            return (
              <div key={i} className="group relative flex-1 flex flex-col items-center justify-end h-full min-w-0">
                <div className={`text-[10px] tnum mb-1 whitespace-nowrap transition-opacity ${isCur ? "opacity-100 font-bold text-green-900" : "opacity-0 group-hover:opacity-100 text-inksoft"}`}>
                  {fmt(t.net).replace(" UZS", "")}
                </div>
                <div className={`w-full rounded-t-md transition-colors ${isCur ? "bg-green-900" : "bg-green-700/80 group-hover:bg-green-900"}`} style={{ height: `${Math.max(2, (t.net / trendMax) * 82)}px` }} />
              </div>
            );
          })}
        </div>
        <div className="flex gap-1.5 mt-1.5">
          {trend.map((t, i) => (
            <div key={i} className={`flex-1 text-center text-[10px] min-w-0 ${i === trend.length - 1 ? "font-bold text-ink" : "text-inksoft"}`}>{t.label}</div>
          ))}
        </div>
      </div>

      {/* expense journal */}
      <div className={card}>
        <div className="text-[13px] font-bold mb-3">{T("Расходы", "Xarajatlar", "Expenses")}</div>
        <ExpenseForm lang={lang} T={T} apartments={apartments} rentAutoIds={rentAutoIds} onSaved={() => getExpenses().then(setExpenses)} />
        <div className="mt-4 space-y-1.5">
          {expenses === null && <div className="text-[13px] text-inksoft">…</div>}
          {expenses !== null && periodExpenses.length === 0 && (
            <div className="rounded-xl border border-dashed border-line py-7 text-center text-[13px] text-inksoft">
              {T("За этот период расходов пока нет", "Bu davrda hali xarajat yoʻq", "No expenses logged in this period yet")}
            </div>
          )}
          {periodExpenses.slice(0, 30).map((e) => (
            <div key={e.id} className="flex items-center gap-3 min-h-11 py-1.5 px-3 rounded-xl border border-line/70 hover:bg-cream/40 transition-colors text-[13px]">
              <span className="text-inksoft tnum shrink-0 w-[86px]">{e.date}</span>
              <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-cream border border-line text-[11px] font-bold shrink-0">{CAT_LABEL[e.category]?.[lang] || e.category}</span>
              <span className="text-inksoft overflow-hidden text-ellipsis whitespace-nowrap min-w-0">
                {e.apartmentId ? `${e.apartmentId} · ${aptName(e.apartmentId)}` : T("Общие", "Umumiy", "General")}{e.note ? ` · ${e.note}` : ""}
              </span>
              <span className="ml-auto font-bold tnum shrink-0">{fmt(toUsd(e.amount, e.currency))}</span>
              {armedDelete === e.id ? (
                <button onClick={async () => { setArmedDelete(null); try { await deleteExpense(e.id); setExpenses((arr) => (arr || []).filter((x) => x.id !== e.id)); } catch { /* keep row */ } }}
                  className="h-8 px-3 rounded-full bg-red-600 text-white text-[12px] font-bold shrink-0">
                  {T("Удалить?", "Oʻchirilsinmi?", "Delete?")}
                </button>
              ) : (
                <button onClick={() => setArmedDelete(e.id)} aria-label="delete"
                  className="w-8 h-8 grid place-items-center rounded-full text-inksoft hover:text-red-600 hover:bg-red-50 shrink-0">
                  <Icon name="trash" size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ExpenseForm({ lang, T, apartments, rentAutoIds, onSaved }) {
  // Tashkent "today", not UTC — between 00:00 and 05:00 local, toISOString() still says
  // yesterday, and a default date just below the month boundary would file the expense
  // into the PREVIOUS month's costs (the period filter works in local months)
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" }).format(new Date());
  const [date, setDate] = useState(today);
  const [aptId, setAptId] = useState("");
  const [category, setCategory] = useState("cleaning");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("UZS");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const fld = "h-11 px-3 rounded-xl bg-white border border-line outline-none focus:border-green-600 text-[13.5px]";
  const lbl = "text-[10px] font-bold uppercase tracking-wide text-inksoft mb-1 block";

  async function submit() {
    const n = Number(amount);
    if (!date || !Number.isFinite(n) || n <= 0) { setErr(true); return; }
    setErr(false);
    setBusy(true);
    try {
      await addExpense({ apartmentId: aptId || null, date, category, amount: n, currency, note: note.trim() });
      setAmount(""); setNote("");
      onSaved();
    } catch {
      setErr(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-line bg-canvas p-3.5">
      <div className="text-[11px] font-bold uppercase tracking-wide text-inksoft mb-2.5">{T("Добавить расход", "Xarajat qoʻshish", "Add expense")}</div>
      <div className="grid gap-2.5 sm:grid-cols-6">
        <label className="sm:col-span-2">
          <span className={lbl}>{T("Дата", "Sana", "Date")}</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${fld} w-full`} />
        </label>
        <label className="sm:col-span-2">
          <span className={lbl}>{T("Квартира", "Kvartira", "Apartment")}</span>
          <select value={aptId} onChange={(e) => setAptId(e.target.value)} className={`${fld} w-full`}>
            <option value="">{T("Общие", "Umumiy", "General")}</option>
            {apartments.map((a) => <option key={a.id} value={a.id}>{a.id} · {a.title?.[lang]}</option>)}
          </select>
        </label>
        <label className="sm:col-span-2">
          <span className={lbl}>{T("Категория", "Toifa", "Category")}</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${fld} w-full`}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{CAT_LABEL[c][lang]}</option>)}
          </select>
        </label>
        <label className="sm:col-span-2">
          <span className={lbl}>{T("Сумма", "Summa", "Amount")}</span>
          <div className="flex gap-2">
            <input type="number" inputMode="decimal" min="0" placeholder="0" value={amount}
              onChange={(e) => setAmount(e.target.value)} className={`${fld} flex-1 min-w-0 w-0 ${err ? "border-red-500" : ""}`} />
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={`${fld} w-[92px] shrink-0`}>
              <option value="UZS">UZS</option>
              <option value="USD">USD</option>
            </select>
          </div>
        </label>
        <label className="sm:col-span-3">
          <span className={lbl}>{T("Заметка", "Izoh", "Note")}</span>
          <input placeholder={T("Необязательно", "Ixtiyoriy", "Optional")} value={note} onChange={(e) => setNote(e.target.value)} className={`${fld} w-full`} />
        </label>
        <div className="sm:col-span-1 flex items-end">
          <button onClick={submit} disabled={busy}
            className="h-11 w-full px-5 rounded-full bg-green-700 text-cream text-[13.5px] font-bold hover:bg-green-900 disabled:opacity-50 transition-colors">
            {T("Добавить", "Qoʻshish", "Add")}
          </button>
        </div>
      </div>
      {category === "rent" && aptId && rentAutoIds?.has(aptId) && (
        <p className="mt-2.5 text-[12px] font-semibold text-amber-800 bg-amber-50 border border-amber-600/25 rounded-lg px-3 py-2">
          {T("Аренда этой квартиры уже считается автоматически из паспорта — эта запись вычтет её из прибыли второй раз.",
             "Bu kvartira ijarasi pasportdan avtomatik hisoblanadi — bu yozuv uni foydadan ikkinchi marta ayiradi.",
             "This apartment's rent is already auto-counted from its property file — this entry will subtract it a second time.")}
        </p>
      )}
    </div>
  );
}
