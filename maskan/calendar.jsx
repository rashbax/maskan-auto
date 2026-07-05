"use client";
import { useState } from "react";
import { MASKAN } from "./data";
import { Icon } from "./ui";

const M = MASKAN;
const MONTHS = {
  ru: ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  uz: ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"],
};
const WD = { ru: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"], en: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"], uz: ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"] };

export function buildMonth(year, month) {
  const first = new Date(year, month, 1);
  const start = (first.getDay() + 6) % 7; // Monday-first
  const days = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < start; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(new Date(year, month, d));
  return cells;
}
function sameDay(a, b) { return a && b && a.getTime() === b.getTime(); }
export function dOnly(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

export function nightsBetween(from, to) { return Math.round((to - from) / 86400000); }

function MonthGrid({ year, month, lang, busy, from, to, hover, onPick, onHover, showAvailability = true }) {
  const cells = buildMonth(year, month);
  const today = dOnly(M.TODAY);
  // Choosing the checkout date? A booking occupies NIGHTS, so the stay may end ON the first busy
  // night after check-in (the guest leaves that morning) but cannot extend past it. Find that cap
  // once: scan forward from check-in to the first busy night (inclusive), bounded by the horizon.
  const picking = !!from && !to;
  let lastCheckout = null;
  if (picking) {
    let x = M.addDays(dOnly(from), 1);
    for (let i = 0; i < 366; i++, x = M.addDays(x, 1)) {
      lastCheckout = x;
      if (busy.has(M.iso(x))) break;
    }
  }
  return (
    <div>
      <div className="text-center font-serif text-[17px] mb-3">{MONTHS[lang][month]} {year}</div>
      <div className="grid grid-cols-7 mb-1.5">
        {WD[lang].map((w, i) => <div key={i} className="text-center text-[11px] font-bold text-inksoft py-1">{w}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const isPast = d < today;
          const isBusy = busy.has(M.iso(d));
          const isFrom = sameDay(d, from), isTo = sameDay(d, to);
          const end = to || (from && hover && hover > from ? hover : null);
          const inRange = from && end && d > from && d < end;
          const isEdge = isFrom || isTo;
          // A busy date is an occupied NIGHT; you may still CHECK OUT on it (you leave that morning).
          // So while choosing the checkout date, the first busy night after check-in stays selectable.
          const isCheckoutTarget = picking && isBusy && !isEdge && d > from && d <= lastCheckout;
          const disabled = isPast || (isBusy && !isCheckoutTarget);
          let cls = "text-ink hover:bg-green-50";
          if (isPast) cls = "text-inksoft/30 cursor-default";
          else if (isCheckoutTarget) cls = "text-ink hover:bg-green-50 ring-1 ring-inset ring-green-600/45";
          else if (isBusy) cls = "text-inksoft/40 cursor-not-allowed line-through decoration-inksoft/40";
          else if (isEdge) cls = "";
          else if (inRange) cls = "text-green-900";
          return (
            <div key={i} className="relative h-11 flex items-center justify-center">
              {(inRange || (isEdge && from && to)) && (
                <div className={`absolute inset-y-1 ${isFrom ? "left-1/2 right-0 rounded-l-full" : isTo ? "right-1/2 left-0 rounded-r-full" : "inset-x-0"} bg-green-50`} />
              )}
              <button disabled={disabled} onClick={() => onPick(d)} onMouseEnter={() => onHover && onHover(d)}
                className={`relative z-10 w-11 h-11 rounded-full grid place-items-center text-[14.5px] font-semibold transition-colors tnum ${isEdge ? "bg-green-700 text-cream shadow-[0_4px_12px_rgba(20,64,47,.28)]" : cls}`}>
                {d.getDate()}
                {showAvailability && !disabled && !isBusy && !isEdge && !inRange && (
                  <span className="absolute bottom-1.5 w-1 h-1 rounded-full bg-green-600/60" />
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AvailabilityCalendar({ lang, STR, busy, value, onChange, months = 1, showAvailability = true }) {
  const [view, setView] = useState(() => ({ y: M.TODAY.getFullYear(), m: M.TODAY.getMonth() }));
  const [hover, setHover] = useState(null);
  const from = value?.from || null;
  const to = value?.to || null;

  function pick(d) {
    if (!from || (from && to)) { onChange({ from: d, to: null }); return; }
    if (d <= from) { onChange({ from: d, to: null }); return; }
    for (let x = new Date(from); x < d; x = M.addDays(x, 1)) {
      if (busy.has(M.iso(x))) { onChange({ from: d, to: null }); return; }
    }
    onChange({ from, to: d });
  }
  function shift(delta) {
    let m = view.m + delta, y = view.y;
    if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; }
    if (delta < 0) { const t = M.TODAY; if (y < t.getFullYear() || (y === t.getFullYear() && m < t.getMonth())) return; }
    setView({ y, m });
  }
  const nextView = (() => { let m = view.m + 1, y = view.y; if (m > 11) { m = 0; y++; } return { y, m }; })();
  const canPrev = !(view.y === M.TODAY.getFullYear() && view.m === M.TODAY.getMonth());

  return (
    <div>
      {/* legend — the free/busy swatches only make sense where the calendar reflects ONE
          apartment's availability (detail / reserve). The catalog filter spans all listings,
          so it passes showAvailability={false} and the picker is a plain range selector. */}
      {(showAvailability || (from && to)) && (
        <div className="flex items-center gap-4 mb-4 text-[12.5px] font-semibold">
          {showAvailability && (
            <>
              <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-600/60" />{STR[lang].available}</span>
              <span className="inline-flex items-center gap-1.5 text-inksoft/70"><span className="w-3 h-0.5 bg-inksoft/40" />{STR[lang].busy}</span>
            </>
          )}
          {from && to && (
            <span className="ml-auto inline-flex items-center gap-1.5 text-green-700">
              <Icon name="cal" size={14} />{STR[lang].night_n(nightsBetween(from, to))}
            </span>
          )}
        </div>
      )}
      <div className="relative">
        <button onClick={() => shift(-1)} disabled={!canPrev} aria-label={lang === "ru" ? "Предыдущий месяц" : lang === "uz" ? "Oldingi oy" : "Previous month"}
          className="absolute -top-1.5 left-0 z-20 w-11 h-11 grid place-items-center rounded-full hover:bg-black/5 disabled:opacity-25"><Icon name="chevL" size={18} /></button>
        <button onClick={() => shift(1)} aria-label={lang === "ru" ? "Следующий месяц" : lang === "uz" ? "Keyingi oy" : "Next month"}
          className="absolute -top-1.5 right-0 z-20 w-11 h-11 grid place-items-center rounded-full hover:bg-black/5"><Icon name="chevR" size={18} /></button>
        <div className={`grid ${months === 2 ? "grid-cols-2 gap-8" : "grid-cols-1"}`} onMouseLeave={() => setHover(null)}>
          <MonthGrid year={view.y} month={view.m} lang={lang} busy={busy} from={from} to={to} hover={hover} onPick={pick} onHover={setHover} showAvailability={showAvailability} />
          {months === 2 && <MonthGrid year={nextView.y} month={nextView.m} lang={lang} busy={busy} from={from} to={to} hover={hover} onPick={pick} onHover={setHover} showAvailability={showAvailability} />}
        </div>
      </div>
    </div>
  );
}

export const calMonths = MONTHS;
export const calWD = WD;
