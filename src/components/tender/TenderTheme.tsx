/**
 * TenderAI hooks into the site-wide light/dark theme (document.documentElement's
 * data-theme attribute + localStorage "tgl_theme", same mechanism as the main
 * site's TopNav — see src/components/site/TopNav.tsx) rather than maintaining
 * its own separate toggle, so a user's theme choice is consistent everywhere.
 *
 * TenderAI's screens are built almost entirely from Tailwind arbitrary-value
 * utilities (bg-white/10, text-white/40, bg-[#0a0a0b], ...). Most of those are
 * already covered by the global [data-theme="light"] override sweep in
 * styles.css; the handful that aren't (specific to TenderAI's own classes,
 * e.g. bg-[#0d0d10]) are covered by a small supplementary block scoped to
 * `.tenderai-scope` (applied to each shell's root) so it can't affect any
 * other app's pages.
 */
import { useEffect, useState } from "react";

export type TenderTheme = "dark" | "light";
const STORAGE_KEY = "tgl_theme";

function readStoredTheme(): TenderTheme {
  if (typeof window === "undefined") return "dark";
  try {
    return (window.localStorage.getItem(STORAGE_KEY) as TenderTheme) || "dark";
  } catch {
    return "dark";
  }
}

function applyTheme(t: TenderTheme) {
  document.documentElement.setAttribute("data-theme", t);
  try { window.localStorage.setItem(STORAGE_KEY, t); } catch { /* ignore */ }
}

export function useTenderTheme(): { theme: TenderTheme; toggleTheme: () => void } {
  const [theme, setTheme] = useState<TenderTheme>(readStoredTheme);

  useEffect(() => {
    // Pick up the current page-load value in case a different tab/page
    // already applied a theme to <html> before this route mounted.
    const current = document.documentElement.getAttribute("data-theme");
    if (current === "light" || current === "dark") setTheme(current);
  }, []);

  function toggleTheme() {
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      applyTheme(next);
      return next;
    });
  }

  return { theme, toggleTheme };
}

export function ThemeToggleButton() {
  const { theme, toggleTheme } = useTenderTheme();
  return (
    <button
      onClick={toggleTheme}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="w-7 h-7 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors shrink-0"
    >
      {theme === "dark" ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="4.5" fill="currentColor" />
          <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M12 2.5v2.5M12 19v2.5M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2.5 12H5M19 12h2.5M4.2 19.8l1.8-1.8M18 6l1.8-1.8" />
          </g>
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.7 14.9A8.5 8.5 0 0 1 9.1 3.3a8.5 8.5 0 1 0 11.6 11.6Z" />
        </svg>
      )}
    </button>
  );
}
