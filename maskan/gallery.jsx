"use client";
import { useState, useEffect, useCallback } from "react";

// Client photo grid + lightbox. It's a client component but still server-rendered on first paint,
// so the <img> tags are in the SSR HTML (crawler-visible) while users get a tap-to-zoom gallery.
export function Gallery({ photos, name }) {
  const [idx, setIdx] = useState(null);
  const close = () => setIdx(null);
  const prev = useCallback(() => setIdx((i) => (i > 0 ? i - 1 : photos.length - 1)), [photos.length]);
  const next = useCallback(() => setIdx((i) => (i < photos.length - 1 ? i + 1 : 0)), [photos.length]);

  useEffect(() => {
    if (idx === null) return;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") close(); else if (e.key === "ArrowLeft") prev(); else if (e.key === "ArrowRight") next(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", onKey); };
  }, [idx, prev, next]);

  if (!photos.length) return null;

  return (
    <>
      <div className="grid grid-cols-4 grid-rows-2 gap-2 h-[280px] md:h-[420px] rounded-3xl overflow-hidden mb-7">
        <button type="button" onClick={() => setIdx(0)} className="col-span-2 row-span-2 relative cursor-zoom-in">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photos[0]} alt={name} className="w-full h-full object-cover" />
        </button>
        {photos.slice(1, 5).map((u, i) => (
          <button type="button" key={i} onClick={() => setIdx(i + 1)} className="relative cursor-zoom-in">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt={`${name} — ${i + 2}`} loading="lazy" className="w-full h-full object-cover" />
            {i === 3 && photos.length > 5 && (
              <span className="absolute inset-0 bg-black/50 grid place-items-center text-white font-bold text-[15px]">+{photos.length - 5}</span>
            )}
          </button>
        ))}
      </div>

      {idx !== null && (
        <div className="fixed inset-0 z-[60] bg-black/92 flex items-center justify-center" onClick={close}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photos[idx]} alt={name} className="max-w-[94vw] max-h-[88vh] object-contain" onClick={(e) => e.stopPropagation()} />
          <button onClick={close} className="absolute top-4 right-4 w-11 h-11 grid place-items-center rounded-full bg-white/15 hover:bg-white/25 text-white text-[20px]">✕</button>
          {photos.length > 1 && (
            <>
              <button onClick={(e) => { e.stopPropagation(); prev(); }} className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 grid place-items-center rounded-full bg-white/15 hover:bg-white/25 text-white text-[22px]">‹</button>
              <button onClick={(e) => { e.stopPropagation(); next(); }} className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 grid place-items-center rounded-full bg-white/15 hover:bg-white/25 text-white text-[22px]">›</button>
              <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/80 text-[13px] tnum">{idx + 1} / {photos.length}</span>
            </>
          )}
        </div>
      )}
    </>
  );
}
