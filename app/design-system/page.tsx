// @ts-nocheck — this showcase intentionally consumes the untyped JS UI components
"use client";

import { useState } from "react";
import { MASKAN } from "@/maskan/data";
import {
  Icon, Logo, Button, Chip, Badge, Stars, Stepper, Photo, Sk,
  ChannelBtn, GoogleG, uzs,
} from "@/maskan/ui";

const lang = "uz";
const STR = MASKAN.STR;

function Swatch({ name, value, dark }: { name: string; value: string; dark?: boolean }) {
  return (
    <div className="rounded-xl overflow-hidden border border-line bg-white">
      <div className="h-16" style={{ background: value }} />
      <div className="px-3 py-2">
        <div className="text-[12.5px] font-bold">{name}</div>
        <div className="text-[11px] text-inksoft tnum uppercase">{value}</div>
      </div>
    </div>
  );
}

function Block({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="py-8 border-t border-line first:border-t-0">
      <h2 className="font-serif text-[24px]">{title}</h2>
      {sub && <p className="text-[13.5px] text-inksoft mt-1 mb-5 max-w-xl">{sub}</p>}
      <div className={sub ? "" : "mt-5"}>{children}</div>
    </section>
  );
}

const ICONS = [
  "search", "cal", "users", "pin", "star", "heart", "shield", "phone", "tg", "wa",
  "globe", "bolt", "grid", "home", "list", "logout", "user", "mail", "lock", "bell",
  "reply", "eyeoff", "ticket", "refresh", "trash", "clock", "sliders", "check", "plus", "minus",
  "wifi", "ac", "kitchen", "washer", "parking", "tv", "elevator", "heating", "workspace", "balcony", "selfcheckin", "water",
];

export default function DesignSystem() {
  const [guests, setGuests] = useState(2);
  const inputCls = "w-full h-12 px-4 rounded-xl bg-white border border-line text-[15px] outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/15 transition placeholder:text-inksoft/50";

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-30 bg-canvas/90 backdrop-blur border-b border-line px-5 sm:px-8">
        <div className="flex items-center justify-between h-[64px] max-w-5xl mx-auto">
          <Logo size={28} />
          <span className="text-[12px] font-bold text-inksoft px-2.5 py-1 rounded-full bg-white border border-line">Design System</span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-5 sm:px-8 pb-24">
        <div className="pt-10 pb-2">
          <h1 className="font-serif text-[40px] leading-tight" style={{ textWrap: "balance" }}>Maskan Design System</h1>
          <p className="text-inksoft mt-2 max-w-xl">Yagona dizayn tili — ranglar, shriftlar, soyalar va qayta ishlatiladigan komponentlar. Hammasi Tailwind tokenlari (globals.css) va <code className="font-mono text-[13px]">maskan/ui.jsx</code> orqali.</p>
        </div>

        {/* COLORS */}
        <Block title="Ranglar" sub="Iliq qog'oz fon (canvas/cream), to'q siyoh matn (ink), va ishonch yashili (green).">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            <Swatch name="canvas" value="#FBF7F0" />
            <Swatch name="cream" value="#F5EADA" />
            <Swatch name="creamdeep" value="#F9ECDC" />
            <Swatch name="line" value="#E8DECE" />
            <Swatch name="ink" value="#1A1A17" dark />
            <Swatch name="inksoft" value="#6B675C" dark />
            <Swatch name="green-50" value="#EAF1EC" />
            <Swatch name="green-100" value="#D6E4DA" />
            <Swatch name="green-600" value="#1B5E40" dark />
            <Swatch name="green-700" value="#164F36" dark />
            <Swatch name="green-900" value="#14402F" dark />
          </div>
        </Block>

        {/* TYPOGRAPHY */}
        <Block title="Shriftlar" sub="Spectral (serif) — sarlavhalar; Manrope (sans) — matn va UI.">
          <div className="space-y-3">
            <div className="font-serif text-[40px] leading-tight">Markazdagi yorug studiya</div>
            <div className="font-serif text-[28px]">Toshkentda kunlik kvartiralar</div>
            <div className="font-serif text-[20px]">Qulayliklar va qoidalar</div>
            <p className="text-[15px] text-ink/85 max-w-xl leading-relaxed">Manrope — body matni. Haqiqiy rasmlar, halol narx, lahzada band qilish. Qoʻngʻiroqlarsiz va ortiqcha yozishuvlarsiz.</p>
            <p className="text-[13px] text-inksoft">Kichik yordamchi matn (inksoft) · <span className="tnum">UZS 531 300</span> · tabular raqamlar</p>
          </div>
        </Block>

        {/* SHADOWS */}
        <Block title="Soyalar" sub="card — kartochkalar; pop — modal/menyu; bar — pastki panel.">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[["shadow-card", "card"], ["shadow-pop", "pop"], ["shadow-bar", "bar"]].map(([cls, name]) => (
              <div key={name} className={`h-24 rounded-2xl bg-white grid place-items-center font-semibold text-[13px] ${cls}`}>{name}</div>
            ))}
          </div>
        </Block>

        {/* BUTTONS */}
        <Block title="Tugmalar" sub="Variantlar va o'lchamlar.">
          <div className="flex flex-wrap gap-3 items-center">
            <Button variant="primary" icon="bolt">Band qilish</Button>
            <Button variant="dark">Dark</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="soft" icon="heart">Soft</Button>
          </div>
          <div className="flex flex-wrap gap-3 items-center mt-4">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
            <Button disabled className="opacity-40 pointer-events-none">Disabled</Button>
          </div>
        </Block>

        {/* CHIPS + BADGES */}
        <Block title="Chip va Badge">
          <div className="flex flex-wrap gap-2 items-center">
            <Chip active icon="pin">Markaz</Chip>
            <Chip icon="wifi">Wi-Fi</Chip>
            <Chip>Chilonzor</Chip>
          </div>
          <div className="flex flex-wrap gap-2 items-center mt-4">
            <Badge tone="cream" icon="shield">Superhost</Badge>
            <Badge tone="green">$42</Badge>
            <Badge tone="soft">soft</Badge>
            <Badge tone="ink">Markaz</Badge>
          </div>
        </Block>

        {/* FORM CONTROLS */}
        <Block title="Forma elementlari">
          <div className="grid sm:grid-cols-2 gap-5 max-w-2xl">
            <label className="block">
              <span className="text-[13px] font-bold">Ismingiz</span>
              <input className={inputCls + " mt-1.5"} placeholder="Masalan, Anna" />
            </label>
            <label className="block">
              <span className="text-[13px] font-bold">Telefon</span>
              <input className={inputCls + " mt-1.5"} placeholder="+998 90 123 45 67" />
            </label>
            <div>
              <span className="text-[13px] font-bold">Mehmonlar</span>
              <div className="mt-2"><Stepper value={guests} min={1} max={10} onChange={setGuests} /></div>
            </div>
            <div>
              <span className="text-[13px] font-bold">Baho</span>
              <div className="mt-2"><Stars rating={4.92} reviews={128} lang={lang} STR={STR} /></div>
            </div>
          </div>
        </Block>

        {/* CONTACT + LOGIN */}
        <Block title="Aloqa va kirish tugmalari">
          <div className="flex flex-wrap gap-3 items-center">
            <ChannelBtn channel="whatsapp" lang={lang} STR={STR} variant="solid" />
            <ChannelBtn channel="telegram" lang={lang} STR={STR} variant="outline" />
          </div>
          <div className="flex flex-wrap gap-3 items-center mt-4">
            <button className="inline-flex items-center gap-2.5 px-5 rounded-full bg-green-700 text-cream font-semibold text-[15px]" style={{ height: 52 }}>
              <Icon name="tg" size={20} />{STR[lang].login_telegram}</button>
            <button className="inline-flex items-center gap-2.5 px-5 rounded-full bg-white border border-line text-ink font-semibold text-[15px]" style={{ height: 52 }}>
              <GoogleG size={19} />{STR[lang].login_google}</button>
          </div>
        </Block>

        {/* PHOTO + SKELETON */}
        <Block title="Rasm (blur-up) va Skeleton" sub="Rasmlar avval xira, keyin tiniqlashadi; yuklanayotganda skeleton.">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(["sage", "clay", "sky", "rose"] as const).map((t) => (
              <div key={t} className="aspect-[4/3] rounded-2xl overflow-hidden shadow-card"><Photo tone={t} idx={1} label={t} className="w-full h-full" eager /></div>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <Sk className="aspect-[4/3]" rounded="rounded-2xl" />
            <Sk className="h-6" rounded="rounded-full" />
            <Sk className="h-6 w-3/4" rounded="rounded-full" />
            <Sk className="h-6 w-1/2" rounded="rounded-full" />
          </div>
        </Block>

        {/* ICONS */}
        <Block title="Ikonkalar" sub="Bitta stroke-uslubidagi to'plam (currentColor).">
          <div className="grid grid-cols-6 sm:grid-cols-10 gap-3">
            {ICONS.map((n) => (
              <div key={n} className="aspect-square rounded-xl border border-line bg-white grid place-items-center text-ink" title={n}>
                <Icon name={n} size={22} />
              </div>
            ))}
          </div>
        </Block>

        <div className="pt-10 text-center text-[12px] text-inksoft">© 2026 Maskan · Design System · {uzs(1)} ≈ 1 USD</div>
      </div>
    </div>
  );
}
