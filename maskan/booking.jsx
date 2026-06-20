"use client";
import { useState, useEffect, useRef } from "react";
import { MASKAN } from "./data";
import { Icon, Logo, Button, Photo, ChannelBtn, Stepper } from "./ui";
import { nightsBetween } from "./calendar";
import { fmtRange } from "./catalog";
import { createBooking } from "./db";

function Field({ label, help, error, children }) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[13px] font-bold text-ink">{label}</span>
        {error && <span className="text-[12px] font-semibold text-red-600">{error}</span>}
      </div>
      {children}
      {help && !error && <div className="text-[12px] text-inksoft mt-1.5">{help}</div>}
    </label>
  );
}

const inputCls = "w-full h-13 px-4 rounded-xl bg-white border border-line text-[15px] outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/15 transition placeholder:text-inksoft/50";

function SummaryStrip({ apt, range, lang, STR }) {
  const nights = nightsBetween(range.from, range.to);
  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl bg-white border border-line">
      <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0"><Photo tone={apt.tone} idx={0} eager showLabel={false} className="w-full h-full" /></div>
      <div className="min-w-0 flex-1">
        <div className="font-serif text-[15px] leading-snug truncate">{apt.title[lang]}</div>
        <div className="text-[12.5px] text-inksoft mt-0.5">{fmtRange(range.from, range.to, lang)} · {STR[lang].night_n(nights)}</div>
      </div>
      <div className="text-right shrink-0"><div className="font-bold text-[17px] tnum">${apt.price * nights}</div><div className="text-[11px] text-green-700 font-semibold">{STR[lang].nofees}</div></div>
    </div>
  );
}

// ---- OTP step ----
function OtpStep({ lang, STR, phone, onDone, onSkip }) {
  const [code, setCode] = useState(["", "", "", ""]);
  const refs = [useRef(), useRef(), useRef(), useRef()];
  useEffect(() => { refs[0].current && refs[0].current.focus(); }, []);
  function set(i, v) {
    if (!/^\d?$/.test(v)) return;
    const next = [...code]; next[i] = v; setCode(next);
    if (v && i < 3) refs[i + 1].current.focus();
    if (next.every((c) => c)) setTimeout(onDone, 350);
  }
  return (
    <div className="fade-up text-center">
      <div className="w-14 h-14 rounded-2xl bg-green-50 text-green-700 grid place-items-center mx-auto mb-4"><Icon name="phone" size={26} /></div>
      <h2 className="font-serif text-[23px]">{STR[lang].otp_title}</h2>
      <p className="text-inksoft text-[14px] mt-1.5">{STR[lang].otp_sub} <b className="text-ink">{phone || "+998 ** *** ** **"}</b></p>
      <div className="flex justify-center gap-3 mt-6">
        {code.map((c, i) => (
          <input key={i} ref={refs[i]} value={c} onChange={(e) => set(i, e.target.value)} inputMode="numeric" maxLength={1}
            className="w-14 h-16 text-center text-[26px] font-bold rounded-2xl bg-white border-2 border-line focus:border-green-600 outline-none tnum" />
        ))}
      </div>
      <button className="text-[13px] font-semibold text-green-700 mt-5 hover:underline">{STR[lang].resend}</button>
      <div className="mt-6"><Button full size="lg" variant="ghost" onClick={onSkip}>{STR[lang].skip} →</Button></div>
      <p className="text-[11.5px] text-inksoft mt-2 px-6">{lang === "ru" ? "Этот шаг можно включить позже, чтобы отсеять ложные брони." : lang === "uz" ? "Bu qadamni keyinroq yoqish mumkin." : "This step can be switched on later to stop fake bookings."}</p>
    </div>
  );
}

// ---- confirmation ----
function Confirmation({ apt, range, form, lang, STR, onHome, bookingId, loggedIn }) {
  const nights = nightsBetween(range.from, range.to);
  const ch = form.messenger === "whatsapp" ? "WhatsApp" : "Telegram";
  const step1 = lang === "ru" ? `Хозяин свяжется с вами в ${ch} перед заездом — пришлёт адрес и передаст ключи.` : lang === "uz" ? `Uy egasi kelishingizdan oldin ${ch} orqali bogʻlanadi — manzilni yuboradi va kalitlarni topshiradi.` : `Your host will contact you on ${ch} before check-in — to send the address and hand over the keys.`;
  const steps = [step1, STR[lang].next_2.replace("Dilnoza", apt.host), STR[lang].next_3];
  return (
    <div className="fade-up">
      <div className="text-center pt-2">
        <div className="w-20 h-20 rounded-full bg-green-700 text-cream grid place-items-center mx-auto pop-in shadow-[0_10px_30px_rgba(20,64,47,.3)]"><Icon name="check" size={42} sw={2.4} /></div>
        <h1 className="font-serif text-[27px] mt-5">{STR[lang].booked}</h1>
        <p className="text-inksoft text-[14px] mt-1.5 tnum">{STR[lang].booking_no} <b className="text-ink">{bookingId}</b></p>
      </div>

      <div className="mt-6"><SummaryStrip apt={apt} range={range} lang={lang} STR={STR} /></div>

      <div className="mt-6">
        <h2 className="font-serif text-[19px] mb-3">{STR[lang].whatsnext}</h2>
        <div className="space-y-3">
          {steps.map((s, i) => (
            <div key={i} className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-green-50 text-green-700 grid place-items-center text-[13px] font-bold shrink-0 tnum">{i + 1}</div>
              <p className="text-[14px] leading-relaxed text-ink/85 pt-0.5">{s}</p>
            </div>
          ))}
          {/* anonymous bookings aren't tied to an account → warn (lost on close) + recommend signing up */}
          {!loggedIn && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-[#F6EEDD] text-[#9A6A1E] grid place-items-center shrink-0"><Icon name="bell" size={15} /></div>
              <p className="text-[14px] leading-relaxed text-[#7a5414] pt-0.5">{STR[lang].save_booking_warn}</p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-7 space-y-3">
        <ChannelBtn channel={form.messenger} lang={lang} STR={STR} variant="solid" full aptId={apt.id} bookingId={bookingId} text={`${STR[lang].booking_no} ${bookingId} · ${apt.title[lang]}`}>
          {form.messenger === "whatsapp" ? STR[lang].get_whatsapp : STR[lang].get_telegram}
        </ChannelBtn>
        <div className="grid grid-cols-2 gap-3">
          <ChannelBtn channel={form.messenger === "whatsapp" ? "telegram" : "whatsapp"} lang={lang} STR={STR} variant="outline" aptId={apt.id} bookingId={bookingId} />
          <Button onClick={onHome}>{STR[lang].done}</Button>
        </div>
      </div>
    </div>
  );
}

export function Booking({ apt, range, lang, STR, device, onBack, onHome, onBooked, loggedIn }) {
  const desktop = device === "desktop";
  const [step, setStep] = useState("form"); // form | otp | confirming | done
  const [form, setForm] = useState({ name: "", phone: "", tg: "", messenger: "telegram", adults: Math.min(2, apt.sleeps || 2), children: 0 });
  const [errs, setErrs] = useState({});
  const [bookingId, setBookingId] = useState("BK-" + (3120 + Math.floor(Math.random() * 80)));
  const submittingRef = useRef(false);

  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = "!";
    // international phone: 9–15 digits, only +, digits, spaces, dashes, parentheses (NOT UZ-only)
    const digits = form.phone.replace(/\D/g, "");
    if (digits.length < 9 || digits.length > 15 || !/^\+?[\d\s\-()]+$/.test(form.phone.trim())) e.phone = "!";
    setErrs(e); return Object.keys(e).length === 0;
  }
  function submit() {
    if (!validate() || submittingRef.current) return; // guard against double-tap
    submittingRef.current = true;
    finishOtp(); // OTP step disabled for now (re-enable later if needed)
  }
  async function finishOtp() {
    setStep("confirming");
    let id;
    try {
      id = await createBooking({
        apartmentId: apt.id,
        guestName: form.name,
        phone: form.phone,
        telegram: form.tg,
        messenger: form.messenger,
        adults: form.adults,
        children: form.children,
        from: range.from,
        to: range.to,
      });
    } catch (e) {
      // The dates were NOT held (overlap / RLS / network) — never show a fake confirmation.
      console.error("createBooking failed:", e);
      submittingRef.current = false; // allow a retry
      setStep("error");
      return;
    }
    setBookingId(id);
    onBooked && onBooked(); // refresh availability so the dates show as busy
    // (owner notification + Beds24 push are triggered server-side inside /api/book)
    setTimeout(() => setStep("done"), 600);
  }

  const content = (
    <>
      {step === "form" && (
        <div className="fade-up">
          <SummaryStrip apt={apt} range={range} lang={lang} STR={STR} />
          <h2 className="font-serif text-[22px] mt-6 mb-1">{STR[lang].reserve_title}</h2>
          <p className="text-[13.5px] text-inksoft mb-5">{lang === "ru" ? "Две детали — и квартира ваша." : lang === "uz" ? "Ikkita maʼlumot — va kvartira sizniki." : "Two details and the place is yours."}</p>
          <div className="space-y-4">
            <div className="rounded-xl border border-line bg-white p-3.5">
              <div className="flex items-center justify-between">
                <div className="text-[13.5px] font-bold">{STR[lang].a_adults}</div>
                <Stepper value={form.adults} min={1} max={Math.max(1, (apt.sleeps || 1) - form.children)} onChange={(v) => setForm({ ...form, adults: v })} />
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-line">
                <div><div className="text-[13.5px] font-bold">{STR[lang].a_children}</div><div className="text-[12px] text-inksoft">{lang === "ru" ? "0–12 лет" : lang === "uz" ? "0–12 yosh" : "Ages 0–12"}</div></div>
                <Stepper value={form.children} min={0} max={Math.max(0, (apt.sleeps || 1) - form.adults)} onChange={(v) => setForm({ ...form, children: v })} />
              </div>
              <div className="text-[12px] text-inksoft mt-2.5">{lang === "ru" ? `Максимум ${apt.sleeps} гостей` : lang === "uz" ? `Koʻpi bilan ${apt.sleeps} mehmon` : `Up to ${apt.sleeps} guests`}</div>
            </div>
            <Field label={STR[lang].your_name} error={errs.name && "⚠"}>
              <input className={inputCls} placeholder={STR[lang].name_ph} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label={STR[lang].phone} help={STR[lang].phone_help} error={errs.phone && (lang === "ru" ? "неверный номер" : lang === "uz" ? "notoʻgʻri raqam" : "invalid number")}>
              <input className={inputCls} inputMode="tel" placeholder="+998 90 123 45 67" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <div>
              <div className="text-[13px] font-bold text-ink mb-1.5">{STR[lang].pref_messenger}</div>
              <div className="grid grid-cols-2 gap-2.5">
                {[["telegram", "tg"], ["whatsapp", "wa"]].map(([k, icon]) => (
                  <button key={k} type="button" onClick={() => setForm({ ...form, messenger: k })}
                    className={`flex items-center justify-center gap-2 h-12 rounded-xl border text-[14.5px] font-semibold transition ${form.messenger === k ? "border-green-600 bg-green-50 text-green-700 ring-2 ring-green-600/15" : "border-line bg-white text-ink hover:border-ink/25"}`}>
                    <Icon name={icon} size={18} />{k === "telegram" ? "Telegram" : "WhatsApp"}
                  </button>
                ))}
              </div>
              <div className="text-[12px] text-inksoft mt-1.5">{STR[lang].pref_help}</div>
            </div>
            <Field label={STR[lang].tg_optional} help={STR[lang].tg_help}>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-inksoft"><Icon name="tg" size={18} /></span>
                <input className={inputCls + " pl-11"} placeholder="@username" value={form.tg} onChange={(e) => { const raw = e.target.value.replace(/^@+/, ""); setForm({ ...form, tg: raw ? "@" + raw : "" }); }} />
              </div>
            </Field>
          </div>
          <div className="flex items-center gap-2 mt-5 text-[12.5px] text-inksoft"><Icon name="shield" size={16} className="text-green-700" />{lang === "ru" ? "Оплата при заселении. Карта не нужна." : lang === "uz" ? "Toʻlov joylashganda. Karta kerak emas." : "Pay at check-in. No card needed."}</div>
        </div>
      )}
      {step === "otp" && <OtpStep lang={lang} STR={STR} phone={form.phone} onDone={finishOtp} onSkip={finishOtp} />}
      {step === "confirming" && (
        <div className="py-20 text-center fade-up">
          <div className="w-12 h-12 mx-auto rounded-full border-[3px] border-green-600/25 border-t-green-700 animate-spin" />
          <p className="text-[14px] text-inksoft mt-4">{lang === "ru" ? "Закрепляем даты…" : lang === "uz" ? "Sanalar saqlanmoqda…" : "Securing your dates…"}</p>
        </div>
      )}
      {step === "error" && (
        <div className="py-16 text-center fade-up">
          <div className="w-16 h-16 mx-auto rounded-full bg-red-50 text-red-600 grid place-items-center text-[32px] font-bold">!</div>
          <h2 className="font-serif text-[22px] mt-4">{lang === "ru" ? "Не удалось забронировать" : lang === "uz" ? "Bron qilib boʻlmadi" : "Booking failed"}</h2>
          <p className="text-[14px] text-inksoft mt-2 px-6">{lang === "ru" ? "Возможно, эти даты только что заняли. Выберите другие даты или попробуйте ещё раз." : lang === "uz" ? "Ehtimol bu sanalar hozirgina band boʻldi. Boshqa sana tanlang yoki qayta urinib koʻring." : "These dates may have just been taken. Pick other dates or try again."}</p>
          <div className="mt-6"><Button full size="lg" onClick={() => setStep("form")}>{lang === "ru" ? "Назад" : lang === "uz" ? "Orqaga" : "Back"}</Button></div>
        </div>
      )}
      {step === "done" && <Confirmation apt={apt} range={range} form={form} lang={lang} STR={STR} onHome={onHome} bookingId={bookingId} loggedIn={loggedIn} />}
    </>
  );

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <header className="sticky top-0 z-30 bg-canvas/92 backdrop-blur border-b border-line px-4">
        <div className={`flex items-center gap-3 h-14 ${desktop ? "max-w-lg mx-auto" : ""}`}>
          {step !== "done" && step !== "confirming" && (
            <button onClick={() => step === "otp" ? setStep("form") : onBack()} className="w-10 h-10 -ml-2 grid place-items-center rounded-full hover:bg-black/5"><Icon name="arrowL" size={20} /></button>
          )}
          <div className="font-serif text-[18px] whitespace-nowrap">{step === "done" ? STR[lang].booking : STR[lang].reserve_title}</div>
          <div className="ml-auto"><Logo size={24} withWord={false} /></div>
        </div>
      </header>

      <div className={`flex-1 px-4 py-5 ${desktop ? "max-w-lg mx-auto w-full" : ""}`}>{content}</div>

      {step === "form" && (
        <div className="sticky bottom-0 bg-white border-t border-line shadow-bar px-4 py-3">
          <div className={`${desktop ? "max-w-lg mx-auto" : ""}`}>
            <Button full size="lg" icon="bolt" onClick={submit}><span className="whitespace-nowrap">{STR[lang].confirm_book} · ${apt.price * nightsBetween(range.from, range.to)}</span></Button>
          </div>
        </div>
      )}
    </div>
  );
}
