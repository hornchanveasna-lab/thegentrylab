import { useEffect, useRef, useState } from "react";
import Lenis from "lenis";

/* ── Animated counter (counts up on scroll into view) ───── */
export function Counter({ value }: { value: string }) {
  const [display, setDisplay] = useState("0");
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const target = parseInt(value);
          const start = performance.now();
          const tick = (now: number) => {
            const p = Math.min((now - start) / 1400, 1);
            setDisplay(String(Math.round((1 - Math.pow(1 - p, 3)) * target)));
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.5 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [value]);

  return <span ref={ref}>{display}</span>;
}

/* ── Scroll-reveal hook (adds .visible to .reveal elements) */
export function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll(".reveal");
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("visible");
        }),
      { threshold: 0.1 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

/* ── Buttery smooth scroll (Lenis). Wheel/touch momentum is eased
   instead of the browser's stock jump-scroll. Elements carrying
   data-lenis-prevent (independently-scrolling panels/lists) are
   left alone so nested scroll areas still work natively. ── */
function useLenis(snap: boolean) {
  useEffect(() => {
    if (snap) document.documentElement.classList.add("snap-scroll");

    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (isMobile || prefersReducedMotion) {
      return () => { if (snap) document.documentElement.classList.remove("snap-scroll"); };
    }

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t: number) => 1 - Math.pow(1 - t, 3),
      smoothWheel: true,
      touchMultiplier: 1.2,
      allowNestedScroll: true,
    });

    let rafId: number;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
      if (snap) document.documentElement.classList.remove("snap-scroll");
    };
  }, [snap]);
}

/* ── Smooth scroll + section snap (long narrative pages) ── */
export function useSnapScroll() {
  useLenis(true);
}

/* ── Smooth scroll only, no snap (data/browsing pages) ── */
export function useSmoothScroll() {
  useLenis(false);
}
