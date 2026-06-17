"use client";
// Admin-only "Property file" (Kvartira pasporti) — per-apartment internal ops DB,
// kept SEPARATE from the public listing so guest-facing and financial data never mix.
// A file is 1:1 with an apartment (via apartment_id) but can also exist standalone.
// Linked files DERIVE title/district/cover live from the apartment — nothing copied.
import { useState, useEffect } from "react";
import { MASKAN } from "./data";
import { Icon, Button, Badge, Photo, Stepper, Sk } from "./ui";
import { getPropertyFiles, savePropertyFile } from "./db";

const fld = "mt-1.5 w-full h-12 px-4 rounded-xl bg-white border border-line outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/15 transition text-[15px]";
const fldMono = fld + " font-mono tracking-tight";
const lbl = "text-[13px] font-bold";

// thousands separators + tabular numerals (stores raw digits, formats for display)
const fmtMoney = (v) => (v === "" || v == null ? "" : Number(v).toLocaleString("ru-RU").replace(/,/g, " ").replace(/ /g, " "));

function blankFile() {
  return {
    id: null, apartmentId: null, name: "", district: "mirobod",
    ownerName: "", ownerPhone: "", leaseStart: "", leaseEnd: "", depositUzs: "",
    rentAmount: "", rentCurrency: "UZS", rentDay: 1, rentLastPaid: "",
    electricMeterNo: "", electricLastReading: "", gasAccount: "", waterAccount: "",
    internetProvider: "", internetAccount: "", hoaFeeUzs: "",
    floor: "", intercomCode: "", keyboxCode: "", keySets: 1, notes: "",
  };
}

// ---- small building blocks ----
function GroupCard({ icon, title, sub, children }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4 sm:p-5 mb-5">
      <div className="flex items-center gap-2.5 mb-4">
        <span className="w-8 h-8 rounded-lg bg-green-50 text-green-700 grid place-items-center shrink-0"><Icon name={icon} size={17} /></span>
        <div className="leading-tight">
          <div className="font-serif text-[17px]">{title}</div>
          {sub && <div className="text-[12px] text-inksoft">{sub}</div>}
        </div>
      </div>
      {children}
    </div>
  );
}

function Txt({ label, value, set, mono, ...rest }) {
  return (
    <label className="block">
      <span className={lbl}>{label}</span>
      <input value={value} onChange={(e) => set(e.target.value)} className={mono ? fldMono : fld} {...rest} />
    </label>
  );
}

function DateF({ label, value, set }) {
  return (
    <label className="block">
      <span className={lbl}>{label}</span>
      <input type="date" value={value} onChange={(e) => set(e.target.value)} className={fld + " tnum"} />
    </label>
  );
}

// money input with thousands separators; optional UZS/USD segmented toggle inside
function Money({ label, value, set, currency, setCurrency }) {
  return (
    <label className="block">
      <span className={lbl}>{label}</span>
      <div className="mt-1.5 flex items-center rounded-xl border border-line bg-white h-12 overflow-hidden focus-within:border-green-600 focus-within:ring-2 focus-within:ring-green-600/15 transition">
        <input value={fmtMoney(value)} inputMode="numeric" onChange={(e) => set(e.target.value.replace(/[^\d]/g, ""))}
          className="flex-1 w-full min-w-0 px-4 text-[15px] tnum outline-none bg-transparent" />
        {setCurrency && (
          <div className="flex items-center gap-0.5 pr-1.5 shrink-0">
            {["UZS", "USD"].map((c) => (
              <button key={c} type="button" onClick={() => setCurrency(c)}
                className={`h-8 px-2.5 rounded-lg text-[12px] font-bold transition ${currency === c ? "bg-green-700 text-cream" : "text-inksoft hover:bg-black/[.04]"}`}>{c}</button>
            ))}
          </div>
        )}
      </div>
    </label>
  );
}

// ---- list card (reuses the apartment cover READ-ONLY; placeholder if standalone) ----
function FileCard({ lang, STR, file, apt, onClick }) {
  const M = MASKAN;
  const title = apt ? apt.title[lang] : (file.name || "—");
  const district = apt ? (M.DISTRICTS[apt.district]?.[lang] || "") : (M.DISTRICTS[file.district]?.[lang] || file.district || "");
  const cover = apt?.photoUrls?.[0];
  const filled = !!(file.ownerName || file.rentAmount || file.electricMeterNo || file.notes);
  return (
    <button onClick={onClick} className="text-left rounded-2xl border border-line bg-white overflow-hidden hover:shadow-card transition group">
      <div className="aspect-[16/10] relative">
        <Photo tone={apt?.tone || "sage"} idx={0} eager showLabel={false} src={cover} className="w-full h-full group-hover:scale-105 transition-transform duration-500" />
        <div className="absolute top-2.5 left-2.5 flex gap-1.5">
          <Badge tone="green" icon="clipboard">{STR[lang].pf_badge}</Badge>
          {!filled && <Badge tone="cream">{STR[lang].pf_draft}</Badge>}
        </div>
      </div>
      <div className="p-3.5">
        <div className="font-serif text-[15px] leading-snug truncate">{title}</div>
        <div className="text-[12.5px] text-inksoft mt-1 truncate">{district || "—"}{!apt && <span className="text-inksoft/60"> · {STR[lang].pf_standalone}</span>}</div>
        <div className="flex flex-wrap gap-1.5 mt-2.5 min-h-[24px]">
          {file.rentAmount !== "" && <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-green-50 text-green-700 text-[11.5px] font-bold">{STR[lang].pf_rent_due(file.rentDay)}</span>}
          {file.electricMeterNo && <span className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full bg-black/[.04] text-inksoft text-[11.5px] font-bold font-mono"><Icon name="bolt" size={12} />{file.electricMeterNo}</span>}
        </div>
      </div>
    </button>
  );
}

// ---- detail / edit (max-w-3xl) ----
function FileEdit({ lang, STR, init, apartments, onBack, onSaved }) {
  const M = MASKAN;
  const T = (uz, ru, en) => (lang === "ru" ? ru : lang === "en" ? en : uz);
  const [f, setF] = useState(init);
  const [saving, setSaving] = useState(false);
  const up = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const apt = f.apartmentId ? (apartments || []).find((a) => a.id === f.apartmentId) : null;
  const title = apt ? apt.title[lang] : f.name;
  const district = apt ? (M.DISTRICTS[apt.district]?.[lang] || "") : (M.DISTRICTS[f.district]?.[lang] || f.district);

  async function save() {
    setSaving(true);
    try {
      const id = await savePropertyFile(f);
      if (!f.id) setF((p) => ({ ...p, id })); // round-trip: keep the new id
      if (onSaved) await onSaved();
      onBack();
    } catch (e) { console.error("savePropertyFile failed:", e); setSaving(false); }
  }

  return (
    <div className="max-w-3xl">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-inksoft mb-4 hover:text-ink"><Icon name="arrowL" size={16} />{STR[lang].a_pfile}</button>

      {/* header — linked: read-only; standalone: editable name + district */}
      {apt ? (
        <div className="rounded-2xl border border-line bg-white overflow-hidden mb-6 flex">
          <div className="w-28 sm:w-44 shrink-0 self-stretch"><Photo tone={apt.tone} idx={0} eager showLabel={false} src={apt.photoUrls?.[0]} className="w-full h-full min-h-[104px]" /></div>
          <div className="p-4 min-w-0 flex-1">
            <div className="font-serif text-[18px] leading-snug">{title}</div>
            <div className="text-[13px] text-inksoft mt-0.5">{district}</div>
            <div className="text-[11px] font-mono text-inksoft/80 mt-2"><span className="text-inksoft/55">ID:</span> <span className="select-all">{apt.id}</span></div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-line bg-white p-4 sm:p-5 mb-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-20 h-16 rounded-xl overflow-hidden shrink-0"><Photo tone="sage" idx={0} eager showLabel={false} className="w-full h-full" /></div>
            <div className="text-[12px] text-inksoft leading-snug pt-0.5">{STR[lang].pf_new_hint}</div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block"><span className={lbl}>{STR[lang].pf_apt_name}</span>
              <input value={f.name} onChange={(e) => up("name", e.target.value)} placeholder={T("Masalan, Markazdagi studiya", "Напр. Студия в центре", "e.g. Studio in the centre")} className={fld} /></label>
            <label className="block"><span className={lbl}>{STR[lang].district}</span>
              <select value={f.district} onChange={(e) => up("district", e.target.value)} className={fld}>
                {Object.keys(M.DISTRICTS).map((k) => <option key={k} value={k}>{M.DISTRICTS[k][lang]}</option>)}</select></label>
          </div>
        </div>
      )}

      {/* 1) owner & lease */}
      <GroupCard icon="user" title={STR[lang].pf_g_owner}>
        <div className="grid sm:grid-cols-2 gap-4">
          <Txt label={STR[lang].pf_owner} value={f.ownerName} set={(v) => up("ownerName", v)} />
          <Txt label={STR[lang].pf_owner_phone} value={f.ownerPhone} set={(v) => up("ownerPhone", v)} placeholder="+998 ..." inputMode="tel" />
          <DateF label={STR[lang].pf_lease_start} value={f.leaseStart} set={(v) => up("leaseStart", v)} />
          <DateF label={STR[lang].pf_lease_end} value={f.leaseEnd} set={(v) => up("leaseEnd", v)} />
          <Money label={STR[lang].pf_deposit} value={f.depositUzs} set={(v) => up("depositUzs", v)} />
        </div>
      </GroupCard>

      {/* 2) monthly rent — paid to owner */}
      <GroupCard icon="ticket" title={STR[lang].pf_g_rent} sub={STR[lang].pf_g_rent_sub}>
        <div className="grid sm:grid-cols-3 gap-4">
          <Money label={STR[lang].pf_amount} value={f.rentAmount} set={(v) => up("rentAmount", v)} currency={f.rentCurrency} setCurrency={(c) => up("rentCurrency", c)} />
          <label className="block"><span className={lbl}>{STR[lang].pf_pay_day}</span>
            <input value={f.rentDay} inputMode="numeric" onChange={(e) => up("rentDay", e.target.value.replace(/[^\d]/g, ""))}
              onBlur={(e) => up("rentDay", Math.max(1, Math.min(31, parseInt(e.target.value, 10) || 1)))} className={fld + " tnum"} /></label>
          <DateF label={STR[lang].pf_last_paid} value={f.rentLastPaid} set={(v) => up("rentLastPaid", v)} />
        </div>
      </GroupCard>

      {/* 3) utilities & meters — codes/meters monospace */}
      <GroupCard icon="bolt" title={STR[lang].pf_g_util}>
        <div className="grid sm:grid-cols-2 gap-4">
          <Txt label={STR[lang].pf_electric} value={f.electricMeterNo} set={(v) => up("electricMeterNo", v)} mono />
          <Txt label={STR[lang].pf_electric_reading} value={f.electricLastReading} set={(v) => up("electricLastReading", v)} mono />
          <Txt label={STR[lang].pf_gas} value={f.gasAccount} set={(v) => up("gasAccount", v)} mono />
          <Txt label={STR[lang].pf_water} value={f.waterAccount} set={(v) => up("waterAccount", v)} mono />
          <Txt label={STR[lang].pf_internet} value={f.internetProvider} set={(v) => up("internetProvider", v)} />
          <Txt label={STR[lang].pf_internet_acc} value={f.internetAccount} set={(v) => up("internetAccount", v)} mono />
          <Money label={STR[lang].pf_hoa} value={f.hoaFeeUzs} set={(v) => up("hoaFeeUzs", v)} />
        </div>
      </GroupCard>

      {/* 4) access & keys */}
      <GroupCard icon="lock" title={STR[lang].pf_g_access}>
        <div className="grid sm:grid-cols-2 gap-4">
          <Txt label={STR[lang].pf_floor} value={f.floor} set={(v) => up("floor", v)} placeholder="4/9" />
          <Txt label={STR[lang].pf_intercom} value={f.intercomCode} set={(v) => up("intercomCode", v)} mono />
          <Txt label={STR[lang].pf_keybox} value={f.keyboxCode} set={(v) => up("keyboxCode", v)} mono />
          <label className="block"><span className={lbl}>{STR[lang].pf_key_sets}</span>
            <div className="mt-1.5 flex items-center justify-between rounded-xl border border-line bg-white h-12 px-3">
              <span className="text-[12px] text-inksoft">{STR[lang].pf_sets}</span>
              <Stepper value={Number(f.keySets) || 0} min={0} max={20} onChange={(v) => up("keySets", v)} />
            </div></label>
        </div>
      </GroupCard>

      {/* 5) notes */}
      <GroupCard icon="list" title={STR[lang].pf_g_notes}>
        <textarea rows={4} value={f.notes} onChange={(e) => up("notes", e.target.value)} placeholder={STR[lang].pf_notes_ph}
          className="w-full px-4 py-3 rounded-xl bg-white border border-line outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/15 transition text-[15px] resize-y leading-relaxed" />
      </GroupCard>

      <div className="flex gap-3 items-center">
        <Button onClick={save} disabled={saving} className={saving ? "opacity-60 pointer-events-none" : ""}>{STR[lang].a_save}</Button>
        <Button variant="ghost" onClick={onBack}>{STR[lang].back}</Button>
      </div>
    </div>
  );
}

// ---- section wrapper (list ↔ detail) ----
export function PropertyFilesSection({ lang, STR, apartments }) {
  const [files, setFiles] = useState(null);
  const [open, setOpen] = useState(null); // file being edited, or null
  const reload = () => getPropertyFiles().then(setFiles);
  useEffect(() => { reload(); }, []);

  if (open) {
    return <FileEdit lang={lang} STR={STR} init={open} apartments={apartments} onBack={() => setOpen(null)} onSaved={reload} />;
  }

  const list = files || [];
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="inline-flex items-center gap-2 text-[12.5px] text-inksoft"><Icon name="lock" size={14} className="text-green-700 shrink-0" />{STR[lang].pf_internal}</div>
        <Button icon="plusbox" onClick={() => setOpen(blankFile())} className="shrink-0">{STR[lang].pf_add}</Button>
      </div>

      {files == null ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl border border-line bg-white overflow-hidden">
              <Sk className="aspect-[16/10]" rounded="" />
              <div className="p-3.5 space-y-2"><Sk className="h-4 w-2/3" /><Sk className="h-3 w-1/3" /></div>
            </div>
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="text-[14px] text-inksoft py-12 text-center border border-dashed border-line rounded-2xl">—</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((file) => {
            const apt = file.apartmentId ? (apartments || []).find((a) => a.id === file.apartmentId) : null;
            return <FileCard key={file.id} lang={lang} STR={STR} file={file} apt={apt} onClick={() => setOpen(file)} />;
          })}
        </div>
      )}
    </div>
  );
}
