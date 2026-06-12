"use client";
import { useState } from "react";
import { MASKAN } from "./data";
import { Icon, Button, Sheet, GoogleG } from "./ui";
import { TelegramLoginButton } from "./telegram-button";
import { calMonths } from "./calendar";
import { submitReview } from "./db";

// display N filled stars out of 5
export function StarRow({ value, size = 15 }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Icon key={s} name="star" size={size} sw={0} fill={s <= value ? "#1B5E40" : "#D6CDBC"} className={s <= value ? "text-green-600" : "text-line"} />
      ))}
    </span>
  );
}

// interactive 1..5 picker
export function StarPicker({ value, onChange }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-2" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((s) => (
        <button key={s} type="button" onMouseEnter={() => setHover(s)} onClick={() => onChange(s)}
          className="p-1 transition-transform hover:scale-110 active:scale-95">
          <Icon name="star" size={34} sw={0} fill={s <= (hover || value) ? "#1B5E40" : "#E3DAC9"} className={s <= (hover || value) ? "text-green-600" : "text-line"} />
        </button>
      ))}
    </div>
  );
}

function relDate(d, lang) {
  const months = calMonths[lang].map((m) => m.slice(0, 3));
  const dt = new Date(d);
  return `${dt.getDate()} ${months[dt.getMonth()]} ${dt.getFullYear()}`;
}

function ReviewCard({ r, lang, STR }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-green-700 text-cream grid place-items-center font-serif text-[15px] shrink-0">{r.name[0]}</div>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-[14px] leading-tight">{r.name} <span className="text-inksoft font-medium">· {r.country}</span></div>
          <div className="text-[12px] text-inksoft whitespace-nowrap">{relDate(r.date, lang)}</div>
        </div>
        <div className="shrink-0"><StarRow value={r.rating} size={13} /></div>
      </div>
      {r.cons && (
        <div className="flex items-start gap-1.5 mt-3 text-[13px] text-[#9a4a3c]">
          <Icon name="minus" size={14} sw={2.4} className="mt-0.5 shrink-0" />
          <span><b>{STR[lang].minuses}:</b> {r.cons}</span>
        </div>
      )}
      <p className="text-[14px] leading-relaxed text-ink/85 mt-2">{r.text}</p>
    </div>
  );
}

export function ReviewForm({ lang, STR, onSubmit, auth, onLogin, apartmentId }) {
  const [rating, setRating] = useState(0);
  const [cons, setCons] = useState("");
  const [comment, setComment] = useState("");
  const [err, setErr] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const ta = "w-full px-4 py-3 rounded-xl bg-white border border-line text-[15px] outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/15 transition placeholder:text-inksoft/50 resize-none";

  async function submit() {
    if (!rating) { setErr(true); return; }
    setBusy(true); setMsg("");
    const text = comment.trim() || (lang === "ru" ? "Спасибо, всё понравилось!" : lang === "uz" ? "Rahmat, hammasi yoqdi!" : "Thanks, enjoyed the stay!");
    const res = await submitReview({ apartmentId, rating, cons: cons.trim(), text, name: auth?.name, country: STR[lang].code });
    setBusy(false);
    if (res.ok) {
      onSubmit({ name: auth?.name || (lang === "ru" ? "Вы" : lang === "uz" ? "Siz" : "You"), country: STR[lang].code, rating, cons: cons.trim(), text, date: MASKAN.iso(MASKAN.TODAY) });
      setDone(true);
    } else {
      setMsg(res.error === "not_eligible" ? "not_eligible" : "fail");
    }
  }

  if (done) return (
    <div className="py-10 text-center fade-up">
      <div className="w-16 h-16 rounded-full bg-green-700 text-cream grid place-items-center mx-auto pop-in"><Icon name="check" size={34} sw={2.4} /></div>
      <h3 className="font-serif text-[22px] mt-4">{STR[lang].review_thanks}</h3>
      <p className="text-inksoft text-[14px] mt-1.5 max-w-xs mx-auto">{STR[lang].review_thanks_sub}</p>
    </div>
  );

  if (!auth) return (
    <div className="py-8 text-center fade-up">
      <div className="w-14 h-14 rounded-2xl bg-green-50 grid place-items-center text-green-700 mx-auto mb-3"><Icon name="lock" size={26} /></div>
      <p className="text-[14px] text-inksoft mb-5 max-w-xs mx-auto">{lang === "ru" ? "Войдите, чтобы оставить отзыв." : lang === "uz" ? "Sharh qoldirish uchun tizimga kiring." : "Sign in to leave a review."}</p>
      <div className="space-y-2.5 max-w-xs mx-auto">
        <TelegramLoginButton lang={lang} height={48} />
        <button onClick={() => onLogin("google")} className="inline-flex items-center justify-center gap-2.5 w-full rounded-full bg-white border border-line text-ink font-semibold text-[14.5px] hover:border-ink/30 transition" style={{ height: 48 }}><GoogleG size={18} />{STR[lang].login_google}</button>
      </div>
    </div>
  );

  return (
    <div className="pb-2">
      {/* stars (required) */}
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-bold">{STR[lang].your_rating}</span>
        {err && !rating && <span className="text-[12px] font-semibold text-red-600">{STR[lang].rate_required}</span>}
      </div>
      <div className="mt-2 mb-5"><StarPicker value={rating} onChange={(v) => { setRating(v); setErr(false); }} /></div>

      {/* line 1 — disadvantages */}
      <label className="block mb-4">
        <span className="text-[14px] font-bold">{STR[lang].cons_label}</span>
        <span className="text-[12px] text-inksoft font-medium ml-1.5">— {lang === "ru" ? "необязательно" : lang === "uz" ? "ixtiyoriy" : "optional"}</span>
        <textarea rows={2} value={cons} onChange={(e) => setCons(e.target.value)} placeholder={STR[lang].cons_ph} className={ta + " mt-1.5"} />
      </label>

      {/* line 2 — general comment */}
      <label className="block">
        <span className="text-[14px] font-bold">{STR[lang].comment_label}</span>
        <textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={STR[lang].comment_ph} className={ta + " mt-1.5"} />
      </label>

      {msg && <div className="text-[13px] text-[#9a4a3c] bg-red-50 rounded-lg p-3 mt-4">{msg === "not_eligible" ? (lang === "ru" ? "Отзыв можно оставить только после проживания." : lang === "uz" ? "Sharhni faqat turib ketgandan keyin qoldirasiz." : "You can review only after your stay.") : (lang === "ru" ? "Не удалось отправить." : lang === "uz" ? "Yuborib boʻlmadi." : "Could not submit.")}</div>}
      <div className="sticky bottom-0 -mx-5 px-5 pt-3 pb-1 bg-canvas mt-5">
        <Button full size="lg" icon="check" onClick={submit} disabled={busy} className={busy ? "opacity-60 pointer-events-none" : ""}>{busy ? "…" : STR[lang].submit_review}</Button>
      </div>
    </div>
  );
}

export function ReviewsSection({ apt, lang, STR, device, auth, onLogin }) {
  const [list, setList] = useState(apt.reviewsList);
  const [open, setOpen] = useState(false);
  const avg = list.length ? (list.reduce((s, r) => s + r.rating, 0) / list.length) : apt.rating;
  const shown = list.slice(0, 4);

  return (
    <section className="py-6 border-t border-line">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="font-serif text-[20px] flex items-center gap-2">
            <Icon name="star" size={19} fill="#1B5E40" sw={0} className="text-green-600" />
            <span className="tnum">{avg.toFixed(2)}</span>· {STR[lang].reviews_title}
          </h2>
          <div className="text-[13px] text-inksoft mt-0.5">{STR[lang].based_on(list.length)}</div>
        </div>
        <Button variant="outline" size="sm" icon="heart" onClick={() => setOpen(true)}>{STR[lang].leave_review}</Button>
      </div>

      <div className={`grid gap-3 ${device === "desktop" ? "grid-cols-2" : "grid-cols-1"}`}>
        {shown.map((r, i) => <ReviewCard key={i} r={r} lang={lang} STR={STR} />)}
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title={STR[lang].leave_review} desktop={device === "desktop"}>
        <ReviewForm lang={lang} STR={STR} onSubmit={(rev) => setList([rev, ...list])} auth={auth} onLogin={onLogin} apartmentId={apt.id} />
      </Sheet>
    </section>
  );
}
