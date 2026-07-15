"use client";
// Admin availability manager — master–detail (desktop) + list→page (mobile).
// Editing is draft → Save/Cancel (no per-click DB writes); click or drag across days.
// Covers come from the apartment's existing photos (apt.photoUrls[0]) — read-only.
import { useState, useEffect, useRef, useMemo } from "react";
import { MASKAN } from "./data";
import { Icon, Photo } from "./ui";
import { calMonths, calWD, buildMonth, dOnly } from "./calendar";
import { fmtRange } from "./catalog";
import { getAllBlocks, blockDay, unblockDay } from "./db";

// booking source colours — kept identical to the rest of the admin
const SRC = {
  website: { color: "#1B5E40", bg: "#EAF1EC", key: "src_website" },
  booking: { color: "#2A5B8C", bg: "#E7EEF6", key: "src_booking" },
  manual: { color: "#9A6A1E", bg: "#F6EEDD", key: "src_manual" },
};

// { isoDate: booking } for this apartment's active bookings (value carries popover data)
function bookedMapFor(bookings, aptId) {
  const M = MASKAN;
  const map = {};
  (bookings || []).filter((b) => b.apt === aptId && b.status === "active").forEach((b) => {
    for (let x = new Date(b.from); x < new Date(b.to); x = M.addDays(x, 1)) map[M.iso(x)] = b;
  });
  return map;
}

// first day from today that is neither booked nor blocked (committed state)
function nextFree(lang, STR, bm, blockedSet) {
  const M = MASKAN;
  let d = new Date(M.TODAY);
  for (let i = 0; i < 365; i++) {
    const k = M.iso(d);
    if (!bm[k] && !blockedSet.has(k)) {
      if (i === 0) return STR[lang].cal_today;
      return `${d.getDate()} ${calMonths[lang][d.getMonth()].slice(0, 3)}`;
    }
    d = M.addDays(d, 1);
  }
  return "—";
}

// (booked + blocked days) / days in the viewed month
function occupancyPct(y, m, bm, blockedSet) {
  const M = MASKAN;
  const days = new Date(y, m + 1, 0).getDate();
  let used = 0;
  for (let dd = 1; dd <= days; dd++) {
    const k = M.iso(new Date(y, m, dd));
    if (bm[k] || blockedSet.has(k)) used++;
  }
  return Math.round((used / days) * 100);
}

// ---- apartment row (shared: desktop left pane + mobile list) ----
function Row({ lang, STR, apt, bookings, blockedSet, view, selected, onClick }) {
  const M = MASKAN;
  const bm = useMemo(() => bookedMapFor(bookings, apt.id), [bookings, apt.id]);
  const free = nextFree(lang, STR, bm, blockedSet);
  const occ = occupancyPct(view.y, view.m, bm, blockedSet);
  return (
    <button onClick={onClick}
      className={`relative w-full text-left flex gap-3 p-3 rounded-lg border transition ${selected ? "bg-green-50 border-green-600/30" : "bg-white border-line hover:bg-black/[.02]"}`}>
      {selected && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-green-700" />}
      <div className="w-11 h-11 rounded-lg overflow-hidden shrink-0 relative">
        <Photo tone={apt.tone} idx={0} eager showLabel={false} src={apt.photoUrls?.[0]} className="w-full h-full" />
        <span className="absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full bg-green-500 ring-2 ring-white" />
      </div>
      <div className="min-w-0 flex-1">
        <div className={`text-[13.5px] font-bold leading-snug line-clamp-2 ${selected ? "text-green-800" : "text-ink"}`} style={{ textWrap: "pretty" }}>{apt.title[lang]}</div>
        <div className="text-[12px] text-inksoft mt-0.5">{M.DISTRICTS[apt.district]?.[lang]} · {STR[lang].sleeps(apt.sleeps)}</div>
        <div className="text-[10.5px] font-mono text-inksoft/70 mt-0.5">ID: <span className="select-all">{apt.id}</span></div>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-white border border-line text-[10.5px] font-bold text-green-700"><span className="w-1.5 h-1.5 rounded-full bg-green-600" />{STR[lang].cal_free}: {free}</span>
          <span className="text-[10.5px] font-bold text-inksoft tnum">{occ}% {STR[lang].cal_occ}</span>
        </div>
      </div>
    </button>
  );
}

// ---- apartment header above the calendar ----
function AptHeader({ lang, STR, apt }) {
  const M = MASKAN;
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0"><Photo tone={apt.tone} idx={0} eager showLabel={false} src={apt.photoUrls?.[0]} className="w-full h-full" /></div>
      <div className="min-w-0">
        <div className="font-serif text-[18px] leading-snug" style={{ textWrap: "pretty" }}>{apt.title[lang]}</div>
        <div className="text-[12.5px] text-inksoft mt-0.5">{M.DISTRICTS[apt.district]?.[lang]} · {STR[lang].sleeps(apt.sleeps)} · <span className="font-mono">{apt.id}</span></div>
      </div>
    </div>
  );
}

// ---- hover/tap popover on a booked day ----
function BookedPopover({ lang, STR, b, col, row }) {
  const s = SRC[b.source] || SRC.manual;
  // Keep the fixed-width popover inside the 7-col grid so an edge day doesn't push it off-screen
  // (the bug: a leftmost booked day clipped the card off the left edge on mobile). Anchor left/right
  // for edge columns, center otherwise; the first week opens downward instead of into the header.
  const hpos = col <= 1 ? "left-0" : col >= 5 ? "right-0" : "left-1/2 -translate-x-1/2";
  const vpos = row === 0 ? "top-full mt-1.5" : "bottom-full mb-1.5";
  return (
    <div className={`absolute z-30 ${vpos} ${hpos} w-44 max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-white shadow-pop p-3 pointer-events-none`}>
      <span className="inline-flex items-center gap-1.5 px-2 h-5 rounded-full text-[10.5px] font-bold" style={{ color: s.color, background: s.bg }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />{STR[lang][s.key]}</span>
      <div className="font-bold text-[13px] mt-1.5 truncate">{b.guest || "—"}</div>
      <div className="text-[11.5px] text-inksoft">{fmtRange(new Date(b.from), new Date(b.to), lang)}</div>
      <div className="text-[11.5px] text-inksoft tnum">{STR[lang].night_n(b.nights || 0)} · ${b.total ?? "—"}</div>
    </div>
  );
}

// ---- the month calendar (shared desktop + mobile), with draft editing + drag ----
function Calendar({ lang, STR, apt, bookings, view, setView, draft, setDraft, committed, device, onSave, onCancel }) {
  const M = MASKAN;
  const desktop = device === "desktop";
  const bm = useMemo(() => bookedMapFor(bookings, apt.id), [bookings, apt.id]);
  const cells = buildMonth(view.y, view.m);
  const today = dOnly(M.TODAY);
  const todayIso = M.iso(M.TODAY);
  const dragRef = useRef(null);     // { mode: 'block'|'open', touched: Set }
  const draftRef = useRef(draft);   // latest draft, for the pointerdown anchor read
  useEffect(() => { draftRef.current = draft; }, [draft]);
  const [pop, setPop] = useState(null); // iso of the booked day whose popover is open

  const parseIso = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
  const editable = (k) => { const d = parseIso(k); return d >= today && !bm[k]; };

  function addToDrag(k) {
    const dr = dragRef.current;
    if (!dr || dr.touched.has(k) || !editable(k)) return;
    dr.touched.add(k);
    setDraft((prev) => { const next = new Set(prev); if (dr.mode === "block") next.add(k); else next.delete(k); return next; });
  }
  function onCellDown(k, e) {
    if (!editable(k)) return;
    e.preventDefault();
    dragRef.current = { mode: draftRef.current.has(k) ? "open" : "block", touched: new Set() };
    addToDrag(k);
  }
  // mobile: tap toggles one day. Fires via onClick, which the browser suppresses after a
  // scroll swipe — so the page stays scrollable and a scroll never toggles a day.
  function toggleOne(k) {
    if (!editable(k)) return;
    setDraft((prev) => { const next = new Set(prev); if (next.has(k)) next.delete(k); else next.add(k); return next; });
  }
  function onGridMove(e) {
    if (!dragRef.current) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const cell = el && el.closest("[data-day]");
    if (cell) addToDrag(cell.getAttribute("data-day"));
  }
  useEffect(() => {
    const up = () => { dragRef.current = null; };
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, []);

  const shift = (delta) => setView((v) => { let m = v.m + delta, y = v.y; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } return { y, m }; });
  const goToday = () => setView({ y: M.TODAY.getFullYear(), m: M.TODAY.getMonth() });
  useEffect(() => {
    if (!desktop) return;
    const onKey = (e) => {
      const t = document.activeElement;
      if (t && /^(input|textarea|select)$/i.test(t.tagName)) return;
      if (e.key === "ArrowLeft") shift(-1);
      else if (e.key === "ArrowRight") shift(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [desktop]);

  const toBlock = useMemo(() => [...draft].filter((k) => !committed.has(k)).length, [draft, committed]);
  const toOpen = useMemo(() => [...committed].filter((k) => !draft.has(k)).length, [draft, committed]);
  const dirty = toBlock > 0 || toOpen > 0;

  return (
    <div className="rounded-2xl border border-line bg-white p-4 sm:p-5">
      {/* month header */}
      <div className="flex items-center justify-between mb-4 gap-2">
        <div className="flex items-center gap-1">
          <button onClick={() => shift(-1)} className="w-9 h-9 grid place-items-center rounded-full hover:bg-black/5"><Icon name="chevL" size={18} /></button>
          <button onClick={() => shift(1)} className="w-9 h-9 grid place-items-center rounded-full hover:bg-black/5"><Icon name="chevR" size={18} /></button>
        </div>
        <div className="font-serif text-[18px] tnum">{calMonths[lang][view.m]} {view.y}</div>
        <button onClick={goToday} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-line text-[13px] font-bold hover:border-ink/30"><Icon name="cal" size={15} />{STR[lang].cal_today}</button>
      </div>

      {/* weekday header */}
      <div className="grid grid-cols-7 mb-1">{calWD[lang].map((w, i) => <div key={i} className="text-center text-[11px] font-bold text-inksoft py-1">{w}</div>)}</div>

      {/* day grid — desktop: pointer-drag (touch-action none). mobile: tap-to-toggle, so the
          page stays scrollable (touch-action manipulation = pan/scroll, snappy taps). */}
      <div onPointerMove={desktop ? onGridMove : undefined} className="grid grid-cols-7 gap-1 select-none" style={{ touchAction: desktop ? "none" : "manipulation" }}>
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const k = M.iso(d);
          const past = d < today;
          const booking = bm[k];
          const booked = !!booking;
          const isBlocked = draft.has(k);
          const pending = isBlocked !== committed.has(k);
          const isToday = k === todayIso;
          const free = !past && !booked && !isBlocked;
          // a day with a status fill ALWAYS gets light/cream text (readable). Past booked days get
          // a dark inset overlay (below) instead of faint dark text that vanishes on the colour.
          let cls = "text-ink hover:bg-green-50";
          if (booked) cls = "text-cream cursor-default";
          else if (isBlocked) cls = "bg-inksoft/15 text-inksoft line-through";
          else if (past) cls = "text-inksoft/25";
          return (
            <div key={i} className="relative aspect-square">
              <button
                data-day={!past && !booked ? k : undefined}
                disabled={past}
                onPointerDown={desktop && !booked ? (e) => onCellDown(k, e) : undefined}
                onClick={() => {
                  if (booked) { setPop((p) => (p === k ? null : k)); return; }
                  if (!desktop) toggleOne(k); // mobile: tap toggles (desktop uses pointer-drag)
                }}
                onMouseEnter={() => { if (booked && desktop) setPop(k); }}
                onMouseLeave={() => { if (booked && desktop) setPop((p) => (p === k ? null : p)); }}
                className={`w-full h-full rounded-lg grid place-items-center text-[13.5px] font-semibold tnum transition-colors ${cls}`}
                style={booked ? { background: SRC[booking.source]?.color, ...(past ? { boxShadow: "inset 0 0 0 999px rgba(26,26,23,.18)" } : {}) } : {}}>
                {d.getDate()}
                {free && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-green-600" />}
              </button>
              {pending && <span className="absolute inset-0 rounded-lg border-2 border-dashed border-green-600 pointer-events-none" />}
              {isToday && <span className={`absolute inset-[3px] rounded-md border-2 pointer-events-none ${booked ? "border-cream" : "border-green-700"}`} />}
              {booked && pop === k && <BookedPopover lang={lang} STR={STR} b={booking} col={i % 7} row={Math.floor(i / 7)} />}
            </div>
          );
        })}
      </div>

      {/* legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-4 pt-4 border-t border-line text-[12px] font-semibold">
        {Object.keys(SRC).map((s) => <span key={s} className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: SRC[s].color }} />{STR[lang][SRC[s].key]}</span>)}
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-inksoft/20" />{STR[lang].a_blocked}</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded border-2 border-dashed border-green-600" />{STR[lang].cal_pending}</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded border-2 border-green-700" />{STR[lang].cal_today}</span>
      </div>
      <p className="text-[12.5px] text-inksoft mt-3">{STR[lang].cal_helper}</p>

      {/* floating save bar — fixed to the viewport so you never scroll to reach it */}
      {dirty && (
        <div className={`fixed z-40 ${desktop ? "bottom-6 left-1/2 -translate-x-1/2 max-w-[calc(100vw-2rem)]" : "inset-x-0 bottom-0"}`}>
          <div className={`flex items-center gap-2 bg-white shadow-pop border-green-600/30 ${desktop ? "rounded-2xl border px-3 py-2.5" : "border-t px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]"}`}>
            <span className="w-2 h-2 rounded-full bg-green-600 animate-pulse shrink-0" />
            <div className="min-w-0 flex-1 leading-tight">
              <div className="text-[12.5px] font-bold truncate">{STR[lang].cal_unsaved}</div>
              <div className="text-[11px] text-inksoft truncate"><span className="tnum">{toBlock}</span> {STR[lang].cal_to_block} · <span className="tnum">{toOpen}</span> {STR[lang].cal_to_open}</div>
            </div>
            <button onClick={onCancel} className="shrink-0 h-9 px-3 rounded-full text-[13px] font-semibold text-inksoft hover:bg-black/5">{STR[lang].a_cancel}</button>
            <button onClick={onSave} className="shrink-0 h-9 px-4 rounded-full bg-green-700 text-cream text-[13px] font-bold hover:bg-green-800 inline-flex items-center gap-1.5"><Icon name="check" size={15} />{STR[lang].a_save}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- orchestrator: holds committed blocks (all apts), selection, draft ----
export function CalManager({ lang, STR, apartments, bookings, device }) {
  const M = MASKAN;
  const desktop = device === "desktop";
  const apts = apartments || [];
  const [blockedMap, setBlockedMap] = useState({});
  const [view, setView] = useState({ y: M.TODAY.getFullYear(), m: M.TODAY.getMonth() });
  const [selId, setSelId] = useState(apts[0]?.id || null);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState(new Set());
  const [page, setPage] = useState(false); // mobile: calendar page open

  useEffect(() => { getAllBlocks().then(setBlockedMap); }, []);
  useEffect(() => { if (apts.length && !apts.find((a) => a.id === selId)) setSelId(apts[0].id); }, [apts]);

  const committed = useMemo(() => new Set(blockedMap[selId] || []), [blockedMap, selId]);
  // reset draft whenever the selected apartment changes or committed (re)loads
  useEffect(() => { setDraft(new Set(blockedMap[selId] || [])); }, [selId, blockedMap]);

  const sel = apts.find((a) => a.id === selId) || null;

  async function save() {
    const toBlock = [...draft].filter((k) => !committed.has(k));
    const toOpen = [...committed].filter((k) => !draft.has(k));
    setBlockedMap((prev) => ({ ...prev, [selId]: new Set(draft) })); // optimistic commit
    const fails = new Set();
    let bookedClash = false;
    for (const k of toBlock) { try { await blockDay(selId, k); } catch (e) { fails.add(k); if (e?.code === "23B01") bookedClash = true; } }
    for (const k of toOpen) { try { await unblockDay(selId, k); } catch { fails.add(k); } }
    if (fails.size) {
      setBlockedMap(await getAllBlocks()); // re-sync to the DB truth
      alert(bookedClash
        ? (lang === "ru" ? "Некоторые даты уже забронированы — их нельзя закрыть." : lang === "uz" ? "Baʼzi sanalar band — yopib boʻlmaydi." : "Some dates already have a booking — can't block them.")
        : (lang === "ru" ? "Часть изменений не сохранилась. Повторите." : lang === "uz" ? "Baʼzi oʻzgarishlar saqlanmadi. Qayta urining." : "Some changes didn't save. Try again."));
    }
  }
  const cancel = () => setDraft(new Set(committed));

  function pick(id) {
    setSelId(id); // draft auto-resets via effect (discards any unsaved changes)
    if (!desktop) { setPage(true); window.history.pushState({ admincal: true }, ""); }
  }
  useEffect(() => {
    if (desktop) return;
    const onPop = () => setPage(false);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [desktop]);

  const q = search.trim().toLowerCase();
  const shown = q
    ? apts.filter((a) => a.id.toLowerCase().includes(q) || Object.values(a.title || {}).some((t) => (t || "").toLowerCase().includes(q)))
    : apts;

  const searchBox = (
    <div className="relative">
      <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-inksoft pointer-events-none" />
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={STR[lang].cal_search}
        className="w-full h-11 pl-9 pr-3 rounded-xl bg-white border border-line outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/15 transition text-[14px]" />
    </div>
  );
  const count = <div className="text-[12px] text-inksoft tnum">{shown.length} / {apts.length}</div>;

  // ---------- mobile ----------
  if (!desktop) {
    if (page && sel) {
      return (
        <div>
          <button onClick={() => window.history.back()} className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-inksoft mb-4 hover:text-ink"><Icon name="arrowL" size={16} />{STR[lang].a_calendar}</button>
          <AptHeader lang={lang} STR={STR} apt={sel} />
          <Calendar lang={lang} STR={STR} apt={sel} bookings={bookings} view={view} setView={setView} draft={draft} setDraft={setDraft} committed={committed} device={device} onSave={save} onCancel={cancel} />
        </div>
      );
    }
    return (
      <div>
        <div className="mb-3 space-y-2">{searchBox}{count}</div>
        <div className="space-y-2">
          {shown.map((a) => <Row key={a.id} lang={lang} STR={STR} apt={a} bookings={bookings} blockedSet={new Set(blockedMap[a.id] || [])} view={view} selected={false} onClick={() => pick(a.id)} />)}
        </div>
      </div>
    );
  }

  // ---------- desktop master–detail ----------
  return (
    <div className="grid grid-cols-[320px_1fr] gap-5 items-start">
      {/* left: apartment list (independently scrolling) */}
      <div className="sticky top-0 self-start rounded-2xl border border-line bg-white flex flex-col max-h-[calc(100vh-7.5rem)]">
        <div className="p-4 border-b border-line shrink-0 space-y-2">{searchBox}{count}</div>
        <div className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-1.5">
          {shown.map((a) => <Row key={a.id} lang={lang} STR={STR} apt={a} bookings={bookings} blockedSet={new Set(blockedMap[a.id] || [])} view={view} selected={a.id === selId} onClick={() => pick(a.id)} />)}
        </div>
      </div>
      {/* right: calendar — width-capped so the square cells (and thus the whole
          calendar height) stay compact and the legend/Save bar are visible without scrolling */}
      <div className="sticky top-0 self-start min-w-0 max-w-[460px]">
        {sel ? (
          <>
            <AptHeader lang={lang} STR={STR} apt={sel} />
            <Calendar lang={lang} STR={STR} apt={sel} bookings={bookings} view={view} setView={setView} draft={draft} setDraft={setDraft} committed={committed} device={device} onSave={save} onCancel={cancel} />
          </>
        ) : <div className="text-[14px] text-inksoft py-12 text-center border border-dashed border-line rounded-2xl">—</div>}
      </div>
    </div>
  );
}
