"use client";
import { useState, useEffect, useLayoutEffect, useCallback, useRef } from "react";

// useLayoutEffect on the client, useEffect on the server (avoids the SSR warning).
const useIso = typeof document !== "undefined" ? useLayoutEffect : useEffect;

// Client photo grid + lightbox. It's a client component but still server-rendered on first paint,
// so the grid <img> tags are in the SSR HTML (crawler-visible). The lightbox itself opens on the
// client only. On phones it's a native-feeling, swipeable scroll-snap gallery; on desktop (no
// touch) it adds prev/next arrows + a thumbnail strip. mobile vs desktop = the page's md: breakpoint.
export function Gallery({ photos, name }) {
  const [openAt, setOpenAt] = useState(null); // index the lightbox was opened at; null = closed
  const [active, setActive] = useState(0); // current photo — DERIVED from the track's scroll position
  const trackRef = useRef(null);
  const thumbsRef = useRef(null);
  const activeRef = useRef(0); // mirror of `active` for scroll/keyboard handlers without stale closures

  const n = photos.length;
  const isOpen = openAt !== null;

  // Opening pushes a history entry so the phone's Back button closes the lightbox
  // (instead of leaving the apartment page). Both Back and the ✕ go through history.back().
  const open = (i) => {
    setActive(i); activeRef.current = i; setOpenAt(i);
    window.history.pushState({ maskanLightbox: true }, "");
  };
  const requestClose = () => window.history.back();

  // Active index is read straight off scrollLeft — no separate source of truth, no rAF.
  const onScroll = () => {
    const el = trackRef.current;
    if (!el || !el.clientWidth) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== activeRef.current) { activeRef.current = i; setActive(i); }
  };

  // Desktop arrows / thumbnails / keyboard all funnel through here. Wrap-around at the ends.
  const goTo = useCallback((i) => {
    const el = trackRef.current;
    if (!el) return;
    const idx = ((i % n) + n) % n;
    el.scrollTo({ left: idx * el.clientWidth, behavior: "smooth" });
  }, [n]);

  // Open at photo N: jump the track there instantly (no animation) before paint.
  useIso(() => {
    if (!isOpen) return;
    const el = trackRef.current;
    if (el) el.scrollLeft = openAt * el.clientWidth;
  }, [isOpen, openAt]);

  // Back button (popstate) closes the lightbox — the entry pushed in open() is already
  // popped by the browser here, so we just clear state (no extra history.back()).
  useEffect(() => {
    if (!isOpen) return;
    const onPop = () => setOpenAt(null);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [isOpen]);

  // Body scroll lock + keyboard while open.
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") requestClose();
      else if (e.key === "ArrowLeft") goTo(activeRef.current - 1);
      else if (e.key === "ArrowRight") goTo(activeRef.current + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", onKey); };
  }, [isOpen, goTo]);

  // Keep the active thumbnail scrolled into view (desktop strip).
  useEffect(() => {
    if (!isOpen) return;
    thumbsRef.current?.children[active]?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [active, isOpen]);

  // Re-align the track on resize/orientation change so the active photo stays centered.
  useEffect(() => {
    if (!isOpen) return;
    const onResize = () => { const el = trackRef.current; if (el) el.scrollLeft = activeRef.current * el.clientWidth; };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => { window.removeEventListener("resize", onResize); window.removeEventListener("orientationchange", onResize); };
  }, [isOpen]);

  if (!n) return null;

  // Windowed dots (mobile): ~7 around the active one so long galleries don't overflow.
  const WIN = 7;
  const start = n <= WIN ? 0 : Math.min(Math.max(active - 3, 0), n - WIN);
  const dots = Array.from({ length: Math.min(WIN, n) }, (_, k) => start + k);

  return (
    <>
      <div className="grid grid-cols-4 grid-rows-2 gap-2 h-[280px] md:h-[420px] rounded-3xl overflow-hidden mb-7">
        <button type="button" onClick={() => open(0)} className="col-span-2 row-span-2 relative cursor-zoom-in">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photos[0]} alt={name} className="w-full h-full object-cover" />
        </button>
        {photos.slice(1, 5).map((u, i) => (
          <button type="button" key={i} onClick={() => open(i + 1)} className="relative cursor-zoom-in">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt={`${name} — ${i + 2}`} loading="lazy" className="w-full h-full object-cover" />
            {i === 3 && photos.length > 5 && (
              <span className="absolute inset-0 bg-black/50 grid place-items-center text-white font-bold text-[15px]">+{photos.length - 5}</span>
            )}
          </button>
        ))}
      </div>

      {isOpen && (
        <div className="gallery-lightbox fixed inset-0 z-[60] bg-black/95">
          {/* swipe track FILLS the overlay (absolute inset-0 → definite height = viewport), so slide
              sizing never depends on a flex height that some engines (Yandex) resolve to auto. */}
          <div
            ref={trackRef}
            onScroll={onScroll}
            className="no-scrollbar absolute inset-0 flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory overscroll-contain touch-pan-x"
          >
            {photos.map((u, k) => (
              <div key={k} className="shrink-0 w-screen h-full snap-center snap-always flex items-center justify-center p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={u}
                  alt={`${name} — ${k + 1}`}
                  loading={Math.abs(k - active) <= 1 ? "eager" : "lazy"}
                  draggable={false}
                  className="max-h-[88vh] max-w-[94vw] object-contain select-none"
                />
              </div>
            ))}
          </div>

          {/* top bar floats over the track (pointer-events-none so swipes pass through; buttons opt in) */}
          <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between px-3 pt-3 pointer-events-none">
            <button onClick={requestClose} aria-label="close" className="pointer-events-auto w-11 h-11 grid place-items-center rounded-full bg-black/40 hover:bg-black/60 text-white text-[20px]">✕</button>
            <span className="px-3 py-1 rounded-full bg-black/40 text-white/90 text-[13px] tnum">{active + 1} / {n}</span>
          </div>

          {/* desktop-only arrows (no swipe with a mouse) */}
          {n > 1 && (
            <>
              <button onClick={() => goTo(active - 1)} aria-label="previous photo" className="hidden md:grid absolute z-10 left-3 top-1/2 -translate-y-1/2 w-11 h-11 place-items-center rounded-full bg-black/40 hover:bg-black/60 text-white text-[22px]">‹</button>
              <button onClick={() => goTo(active + 1)} aria-label="next photo" className="hidden md:grid absolute z-10 right-3 top-1/2 -translate-y-1/2 w-11 h-11 place-items-center rounded-full bg-black/40 hover:bg-black/60 text-white text-[22px]">›</button>
            </>
          )}

          {/* mobile-only windowed progress dots */}
          {n > 1 && (
            <div className="md:hidden absolute z-10 bottom-4 inset-x-0 flex items-center justify-center gap-1.5 pointer-events-none" aria-hidden>
              {dots.map((d) => (
                <span key={d} className={`h-1.5 rounded-full transition-all ${d === active ? "w-4 bg-white" : "w-1.5 bg-white/50"}`} />
              ))}
            </div>
          )}

          {/* desktop-only thumbnail strip */}
          {n > 1 && (
            <div ref={thumbsRef} className="no-scrollbar hidden md:flex absolute z-10 bottom-0 inset-x-0 gap-2 overflow-x-auto px-4 py-3 bg-linear-to-t from-black/70 to-transparent">
              {photos.map((u, k) => (
                <button key={k} type="button" onClick={() => goTo(k)} aria-label={`photo ${k + 1}`}
                  className={`shrink-0 w-16 h-12 rounded-lg overflow-hidden ring-2 transition ${k === active ? "ring-white" : "ring-transparent opacity-60 hover:opacity-100"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt="" loading="lazy" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
