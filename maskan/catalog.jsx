"use client";
import { useState } from "react";
import { MASKAN } from "./data";
import { Icon, Logo, Button, Chip, Badge, Stars, Photo, Sk, Stepper, Sheet, ChannelBtn, CurrencyMenu } from "./ui";
import { AvailabilityCalendar, nightsBetween, calMonths } from "./calendar";
import { NavLinks } from "./account";
import { fmtPrice } from "./money";
import { WEBSITE_DISCOUNT_PCT, directTotal } from "../lib/pricing";

export function fmtRange(from, to, lang) {
  if (!from) return null;
  const mon = calMonths[lang].map((m) => m.slice(0, 3));
  const f = `${from.getDate()} ${mon[from.getMonth()]}`;
  if (!to) return f;
  return `${from.getDate()}–${to.getDate()} ${mon[to.getMonth()]}`;
}

// --- one catalog card ---
export function AptCard({ apt, lang, STR, filters, onOpen, device, saved, onToggleSave, currency, rates }) {
  const M = MASKAN;
  const d = M.DISTRICTS[apt.district];
  const nights = filters?.range?.from && filters?.range?.to ? nightsBetween(filters.range.from, filters.range.to) : 0;
  const fav = !!saved;
  const [copied, setCopied] = useState(false);
  const copyId = (e) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(apt.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  return (
    <div role="button" tabIndex={0} onClick={() => onOpen(apt)} onKeyDown={(e) => e.key === "Enter" && onOpen(apt)} className="group text-left w-full fade-up cursor-pointer">
      <div className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-card">
        <Photo tone={apt.tone} idx={apt.id.charCodeAt(1)} src={apt.photoUrls?.[0]} label="apartment photo" className="w-full h-full group-hover:scale-[1.03] transition-transform duration-500" />
        <div className="absolute top-3 left-3 flex flex-wrap gap-2">
          <Badge tone="green" icon="ticket">{STR[lang].disc_badge(WEBSITE_DISCOUNT_PCT)}</Badge>
          {apt.superhost && <Badge tone="cream" icon="shield">{STR[lang].superhost}</Badge>}
          {d.centre && <Badge tone="ink">{STR[lang].centre}</Badge>}
        </div>
        <button onClick={(e) => { e.stopPropagation(); onToggleSave && onToggleSave(apt.id); }}
          aria-label={fav ? STR[lang].saved_title : STR[lang].a_save} aria-pressed={fav}
          className="absolute top-3 right-3 w-10 h-10 grid place-items-center rounded-full bg-white/90 backdrop-blur hover:scale-110 transition-transform">
          <Icon name="heart" size={18} fill={fav ? "#1B5E40" : "none"} className={fav ? "text-green-600" : "text-ink"} sw={1.8} /></button>
        <div className="absolute bottom-3 left-3">
          <span className="inline-flex items-baseline gap-1 px-3.5 py-2 rounded-full bg-white/95 backdrop-blur font-bold text-ink shadow-sm">
            <span className="text-[15px] tnum">{fmtPrice(apt.price, currency, rates)}</span><span className="text-[12px] font-semibold text-inksoft">/{STR[lang].night1}</span>
          </span>
        </div>
      </div>
      <div className="pt-3 px-0.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold tracking-[0.12em] uppercase text-green-700">{d[lang]}</span>
          <Stars rating={apt.rating} lang={lang} STR={STR} />
        </div>
        <h3 className="font-serif text-[18px] leading-snug mt-1 text-ink" style={{ textWrap: "balance" }}>{apt.title[lang]}</h3>
        <div className="flex items-center gap-2 mt-1.5 text-[13px] text-inksoft font-medium">
          <Icon name="pin" size={14} /><span>{apt.near?.[lang] || d[lang]}</span>
          <span className="text-line">·</span><span>{STR[lang].sleeps(apt.sleeps)}</span>
        </div>
        {nights > 0 && (
          <div className="mt-2.5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-green-700 bg-green-50 px-2.5 py-1 rounded-lg">
            <Icon name="check" size={14} sw={2.2} />{fmtPrice(directTotal(apt.price * nights), currency, rates)} · {STR[lang].night_n(nights)}
          </div>
        )}
        {/* apartment id — so a guest can tell the host exactly which apartment they mean */}
        <div className="flex items-center justify-between gap-2 mt-2.5 pt-2 border-t border-line/60">
          <span className="text-[11px] font-mono text-inksoft/75 truncate"><span className="text-inksoft/50">ID:</span> <span className="select-all">{apt.id}</span></span>
          <span role="button" tabIndex={0} onClick={copyId} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") copyId(e); }}
            title={lang === "ru" ? "Скопировать ID" : lang === "uz" ? "ID nusxa olish" : "Copy ID"}
            className="shrink-0 w-6 h-6 grid place-items-center rounded text-inksoft hover:text-ink hover:bg-black/6 cursor-pointer">
            {copied
              ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1B5E40" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>}
          </span>
        </div>
      </div>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div>
      <Sk className="aspect-[4/3] w-full" rounded="rounded-2xl" />
      <div className="pt-3 space-y-2">
        <Sk className="h-3 w-24" rounded="rounded-full" />
        <Sk className="h-5 w-4/5" rounded="rounded-md" />
        <Sk className="h-3 w-3/5" rounded="rounded-full" />
      </div>
    </div>
  );
}

// --- filter sheet content (dates, guests, district) ---
function FilterControls({ lang, STR, filters, setFilters, device }) {
  return (
    <div className="space-y-7">
      <div>
        <div className="text-[12px] font-bold tracking-wide uppercase text-inksoft mb-3">{STR[lang].stay}</div>
        {/* catalog filter spans all listings → plain range picker (no per-apartment free/busy) */}
        <AvailabilityCalendar lang={lang} STR={STR} busy={new Set()} value={filters.range} onChange={(r) => setFilters({ ...filters, range: r })} months={device === "desktop" ? 2 : 1} showAvailability={false} />
      </div>
      <div className="flex items-center justify-between border-t border-line pt-5">
        <div>
          <div className="font-serif text-[17px]">{STR[lang].guests}</div>
          <div className="text-[13px] text-inksoft">{STR[lang].guest_n(filters.guests)}</div>
        </div>
        <Stepper value={filters.guests} min={1} max={10} onChange={(g) => setFilters({ ...filters, guests: g })} />
      </div>
    </div>
  );
}

function DistrictRow({ lang, STR, filters, setFilters }) {
  const M = MASKAN;
  const ds = Object.keys(M.DISTRICTS);
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 py-1">
      <Chip active={!filters.district} onClick={() => setFilters({ ...filters, district: null })}>{STR[lang].all_districts}</Chip>
      {ds.map((k) => (
        <Chip key={k} active={filters.district === k} onClick={() => setFilters({ ...filters, district: filters.district === k ? null : k })} icon={M.DISTRICTS[k].centre ? "pin" : undefined}>
          {M.DISTRICTS[k][lang]}</Chip>
      ))}
    </div>
  );
}

export function Catalog({ lang, STR, apartments, filters, setFilters, onOpen, device, openLang, saved, toggleSave, tab, setTab, currency, setCurrency, rates }) {
  const M = MASKAN;
  const [errored, setErrored] = useState(false);
  const [showFilter, setShowFilter] = useState(false);

  // local filtering is synchronous — only the real Supabase fetch (apartments == null) shows
  // skeletons. Filter changes re-render instantly; the cards' own fade-up covers the swap.
  const isLoading = apartments == null;
  const list = (apartments || []).filter((a) => {
    if (filters.district && a.district !== filters.district) return false;
    if (filters.guests && a.sleeps < filters.guests) return false;
    if (filters.range?.from) {
      // one day picked (no checkout yet) → check just that single night; a full range checks every night
      const end = filters.range.to || M.addDays(filters.range.from, 1);
      for (let x = new Date(filters.range.from); x < end; x = M.addDays(x, 1)) if (a.busy.has(M.iso(x))) return false;
    }
    return true;
  });

  const rangeLabel = fmtRange(filters.range?.from, filters.range?.to, lang);
  const desktop = device === "desktop";

  return (
    <div className="min-h-screen bg-canvas">
      {/* header */}
      <header className={`sticky top-0 z-30 bg-canvas/90 backdrop-blur border-b border-line ${desktop ? "px-8" : "px-4"}`}>
        <div className={`flex items-center justify-between ${desktop ? "h-[68px] max-w-6xl mx-auto" : "h-14"}`}>
          <Logo size={desktop ? 32 : 28} />
          {desktop && <NavLinks tab={tab} setTab={setTab} lang={lang} STR={STR} />}
          <div className="flex items-center gap-1.5">
            <CurrencyMenu currency={currency} setCurrency={setCurrency} lang={lang} />
            <button onClick={openLang} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-line text-[13px] font-bold hover:border-ink/30 transition">
              <Icon name="globe" size={16} />{STR[lang].code}</button>
          </div>
        </div>
      </header>

      <div className={`${desktop ? "max-w-6xl mx-auto px-8" : "px-4"}`}>
        {/* hero + search */}
        <div className={`${desktop ? "pt-10 pb-6" : "pt-6 pb-3"}`}>
          <h1 className={`font-serif ${desktop ? "text-[40px]" : "text-[28px]"} leading-[1.06] tracking-tight`} style={{ textWrap: "balance" }}>
            {lang === "ru" ? "Квартиры посуточно в Ташкенте" : lang === "uz" ? "Toshkentda kunlik kvartiralar" : "Daily apartments in Tashkent"}
          </h1>
          <p className={`text-inksoft mt-2 ${desktop ? "text-[16px]" : "text-[14px]"} max-w-lg`}>
            {lang === "ru" ? "Реальные фото, честная цена, мгновенное бронирование. Без звонков и переписки." : lang === "uz" ? "Haqiqiy rasmlar, halol narx, lahzada band qilish. Qoʻngʻiroqlarsiz." : "Real photos, honest prices, instant booking. No calls, no chasing."}
          </p>
        </div>

        {/* search bar */}
        <button onClick={() => setShowFilter(true)} className={`w-full flex items-center gap-3 ${desktop ? "h-16 px-6 rounded-2xl" : "h-14 px-4 rounded-2xl"} bg-white border border-line shadow-card hover:shadow-pop transition-shadow text-left`}>
          <Icon name="search" size={20} className="text-green-700 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-bold truncate">{STR[lang].search_city}{rangeLabel ? ` · ${rangeLabel}` : ""}</div>
            <div className="text-[12.5px] text-inksoft truncate">{rangeLabel ? STR[lang].guest_n(filters.guests) : STR[lang].anydates + " · " + STR[lang].guest_n(filters.guests)}</div>
          </div>
          <span className="shrink-0 w-10 h-10 grid place-items-center rounded-xl bg-green-700 text-cream"><Icon name="sliders" size={18} /></span>
        </button>

        {/* districts */}
        <div className="mt-4"><DistrictRow lang={lang} STR={STR} filters={filters} setFilters={setFilters} /></div>

        {/* results */}
        <div className="mt-5 pb-3">
          {!isLoading && !errored && (
            <div className="flex items-center justify-between mb-4">
              <span className="text-[13.5px] font-semibold text-inksoft">{list.length} {lang === "ru" ? "вариантов" : lang === "uz" ? "variant" : "places"}{rangeLabel ? " · " + rangeLabel : ""}</span>
            </div>
          )}

          {errored ? (
            <StateBlock icon="bolt" title={STR[lang].error_title} sub={STR[lang].error_sub} action={STR[lang].retry} onAction={() => setErrored(false)} />
          ) : isLoading ? (
            <div className={`grid gap-x-6 gap-y-8 ${desktop ? "grid-cols-3" : "grid-cols-1"}`}>
              {Array.from({ length: desktop ? 6 : 3 }).map((_, i) => <CardSkeleton key={i} />)}
            </div>
          ) : list.length === 0 ? (
            <StateBlock icon="search" title={STR[lang].no_results} sub={STR[lang].no_results_sub} action={STR[lang].reset} onAction={() => setFilters({ range: { from: null, to: null }, guests: 2, district: null })} />
          ) : (
            <div className={`grid gap-x-6 gap-y-8 ${desktop ? "grid-cols-3" : "grid-cols-1"}`}>
              {list.map((a) => <AptCard key={a.id} apt={a} lang={lang} STR={STR} filters={filters} onOpen={onOpen} device={device} saved={saved && saved.has(a.id)} onToggleSave={toggleSave} currency={currency} rates={rates} />)}
            </div>
          )}
        </div>

        {/* help / footer */}
        <footer className={`mt-2 ${desktop ? "pb-12" : "pb-24"}`}>
          <div className="rounded-3xl bg-cream border border-line p-6 sm:p-7">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
              <div>
                <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-green-700 mb-1.5">{STR[lang].help_contact}</div>
                <h3 className="font-serif text-[20px] leading-snug max-w-xs">{STR[lang].questions_title}</h3>
                <p className="text-[13px] text-inksoft mt-1 max-w-sm">{STR[lang].questions_sub}</p>
              </div>
              <div className="flex flex-col gap-2.5 sm:w-60 shrink-0">
                <ChannelBtn channel="whatsapp" lang={lang} STR={STR} variant="solid" full />
                <ChannelBtn channel="telegram" lang={lang} STR={STR} variant="outline" full />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between mt-6 px-1">
            <Logo size={24} />
            <span className="text-[12px] text-inksoft">© 2026 Maskan</span>
          </div>
        </footer>
      </div>

      <Sheet open={showFilter} onClose={() => setShowFilter(false)} title={STR[lang].filters} desktop={desktop}
        footer={
          <div className="flex items-center gap-3">
            {(filters.range?.from || filters.district || filters.guests !== 2) && (
              <Button variant="outline" size="lg" className="shrink-0" onClick={() => setFilters({ range: { from: null, to: null }, guests: 2, district: null })}>{STR[lang].clear}</Button>
            )}
            <Button full size="lg" onClick={() => setShowFilter(false)}>
              {lang === "ru" ? `Показать ${list.length} вариантов` : lang === "uz" ? `${list.length} ta variantni koʻrsatish` : `Show ${list.length} places`}
            </Button>
          </div>
        }>
        <FilterControls lang={lang} STR={STR} filters={filters} setFilters={setFilters} device={device} />
      </Sheet>
    </div>
  );
}

export function StateBlock({ icon, title, sub, action, onAction }) {
  return (
    <div className="py-16 flex flex-col items-center text-center fade-up">
      <div className="w-16 h-16 rounded-2xl bg-green-50 grid place-items-center text-green-700 mb-4"><Icon name={icon} size={28} /></div>
      <div className="font-serif text-[22px]">{title}</div>
      <p className="text-inksoft text-[14px] mt-1.5 max-w-xs">{sub}</p>
      {action && <div className="mt-5"><Button variant="outline" onClick={onAction}>{action}</Button></div>}
    </div>
  );
}
