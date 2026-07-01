import { useEffect, useRef, useState } from "react";

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

/* ── Section scroll-snap: settles the page on a section instead
   of stopping mid-way through it, so long pages read cleanly ── */
export function useSnapScroll() {
  useEffect(() => {
    document.documentElement.classList.add("snap-scroll");
    return () => document.documentElement.classList.remove("snap-scroll");
  }, []);
}
