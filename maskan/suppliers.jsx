"use client";
// Admin-only "Suppliers" (Taʼminotchilar) — kept DEAD SIMPLE: exactly three fields
// (name / product-service / contact). No categories, ratings or images.
import { useState, useEffect } from "react";
import { Icon, Button, Sheet } from "./ui";
import { getSuppliers, saveSupplier, deleteSupplier } from "./db";

const fld = "mt-1.5 w-full h-12 px-4 rounded-xl bg-white border border-line outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/15 transition text-[15px]";

// Add + Edit share this form (the three fields + Save).
function SupplierForm({ lang, STR, init, onDone }) {
  const [name, setName] = useState(init?.name || "");
  const [product, setProduct] = useState(init?.product || "");
  const [contact, setContact] = useState(init?.contact || "");
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    try { await saveSupplier({ id: init?.id, name, product, contact }); onDone(); }
    catch (e) { console.error("saveSupplier failed:", e); setBusy(false); }
  }
  return (
    <div className="space-y-4 pb-2">
      <label className="block"><span className="text-[13px] font-bold">{STR[lang].sup_name}</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={STR[lang].sup_name_ph} className={fld} autoFocus /></label>
      <label className="block"><span className="text-[13px] font-bold">{STR[lang].sup_product}</span>
        <input value={product} onChange={(e) => setProduct(e.target.value)} placeholder={STR[lang].sup_product_ph} className={fld} /></label>
      <label className="block"><span className="text-[13px] font-bold">{STR[lang].sup_contact}</span>
        <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder={STR[lang].sup_contact_ph} className={fld + " tnum"} /></label>
      <Button full size="lg" icon="check" onClick={submit} disabled={busy} className={busy ? "opacity-60 pointer-events-none" : ""}>{busy ? "…" : STR[lang].a_save}</Button>
    </div>
  );
}

export function SuppliersSection({ lang, STR }) {
  const [items, setItems] = useState(null);
  const [editing, setEditing] = useState(null); // {} = new, supplier obj = edit, null = closed
  const reload = () => getSuppliers().then(setItems);
  useEffect(() => { reload(); }, []);

  async function del(s) {
    const msg = lang === "ru" ? "Удалить поставщика?" : lang === "uz" ? "Taʼminotchini oʻchirilsinmi?" : "Delete this supplier?";
    if (!window.confirm(msg)) return;
    setItems((xs) => (xs || []).filter((x) => x.id !== s.id)); // optimistic
    try { await deleteSupplier(s.id); } catch (e) { console.error("deleteSupplier failed:", e); reload(); }
  }

  const list = items || [];
  return (
    <div className="max-w-2xl">
      <div className="flex justify-end mb-4"><Button icon="plusbox" onClick={() => setEditing({})}>{STR[lang].sup_add}</Button></div>

      {items == null ? null
        : list.length === 0 ? (
          <button onClick={() => setEditing({})} className="w-full border border-dashed border-line rounded-2xl py-12 px-5 text-center hover:border-green-600 hover:bg-green-50/40 transition">
            <Icon name="truck" size={26} className="mx-auto text-inksoft" />
            <div className="font-serif text-[16px] mt-2">{STR[lang].sup_empty}</div>
            <div className="text-[13px] text-inksoft mt-0.5">{STR[lang].sup_empty_sub}</div>
          </button>
        ) : (
          <div className="space-y-2">
            {list.map((s) => (
              <div key={s.id} className="group flex items-center gap-3 p-4 rounded-2xl border border-line bg-white">
                <div className="min-w-0 flex-1 grid sm:grid-cols-3 gap-0.5 sm:gap-4 sm:items-center">
                  <div className="font-bold text-[14px] truncate">{s.name || "—"}</div>
                  <div className="text-[13px] text-inksoft truncate">{s.product || "—"}</div>
                  <div className="text-[13px] text-ink truncate tnum">{s.contact || "—"}</div>
                </div>
                <div className="flex items-center gap-1 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setEditing(s)} title={STR[lang].sup_edit_title} className="w-9 h-9 grid place-items-center rounded-full text-inksoft hover:text-ink hover:bg-black/[.05]"><Icon name="pencil" size={16} /></button>
                  <button onClick={() => del(s)} title={lang === "ru" ? "Удалить" : lang === "uz" ? "Oʻchirish" : "Delete"} className="w-9 h-9 grid place-items-center rounded-full text-inksoft hover:text-red-600 hover:bg-red-50"><Icon name="trash" size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        )}

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing && editing.id ? STR[lang].sup_edit_title : STR[lang].sup_add} desktop>
        {editing && <SupplierForm lang={lang} STR={STR} init={editing.id ? editing : null} onDone={() => { setEditing(null); reload(); }} />}
      </Sheet>
    </div>
  );
}
