import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GentryMark } from "@/components/site/GentryMark";
import { useAuth } from "@/lib/auth";

function getStoredTheme(): "dark" | "light" {
  try { return (localStorage.getItem("tgl_theme") as "dark" | "light") || "dark"; } catch { return "dark"; }
}
function applyTheme(t: "dark" | "light") {
  document.documentElement.setAttribute("data-theme", t);
  try { localStorage.setItem("tgl_theme", t); } catch { /* */ }
}

export function PMHeader({ crumb }: { crumb?: string }) {
  const { user, signInWithGoogle, signOut } = useAuth();
  const [theme, setTheme] = useState<"dark" | "light">(getStoredTheme);
  useEffect(() => { applyTheme(theme); }, [theme]);

  return (
    <header className="sticky top-0 z-50 nav-bar backdrop-blur-md">
      <div className="flex items-center justify-between px-5 py-3 max-w-[1400px] mx-auto">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/pm" className="flex items-center gap-2.5 shrink-0 group">
            <GentryMark color="#ff5100" size={26} className="transition-[filter] group-hover:drop-shadow-[0_0_8px_rgba(255,81,0,0.6)]" />
            <div className="flex flex-col leading-none">
              <span className="font-extrabold text-[9px] uppercase tracking-[0.18em] nav-text-muted">The Gentry Lab</span>
              <span className="font-extrabold text-[13px] uppercase tracking-tighter nav-text-primary leading-tight">Site Diary</span>
            </div>
          </Link>
          {crumb && (
            <>
              <span className="nav-text-muted opacity-40 shrink-0">/</span>
              <span className="font-mono text-[11px] uppercase tracking-widest nav-text-muted truncate">{crumb}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link to="/" className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 nav-toggle-btn rounded-full font-mono text-[10px] uppercase tracking-widest nav-text-muted hover:nav-text-primary transition-all">
            ← thegentrylab.com
          </Link>
          <button
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            className="w-8 h-8 flex items-center justify-center rounded-full nav-toggle-btn transition-all"
            aria-label="Toggle theme"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? (
              <svg width="14" height="14" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                <circle cx="7.5" cy="7.5" r="3"/>
                <line x1="7.5" y1="1" x2="7.5" y2="2.5"/><line x1="7.5" y1="12.5" x2="7.5" y2="14"/>
                <line x1="1" y1="7.5" x2="2.5" y2="7.5"/><line x1="12.5" y1="7.5" x2="14" y2="7.5"/>
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                <path d="M12 9.33A5.33 5.33 0 0 1 4.67 2a5.33 5.33 0 1 0 7.33 7.33z"/>
              </svg>
            )}
          </button>
          {user ? (
            <button
              onClick={() => signOut()}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full nav-toggle-btn transition-all"
              title="Sign out"
            >
              {user.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
              ) : (
                <span className="w-6 h-6 rounded-full bg-brand-accent flex items-center justify-center text-[9px] font-bold text-black">
                  {(user.user_metadata?.full_name ?? user.email ?? "U")[0].toUpperCase()}
                </span>
              )}
              <span className="hidden md:inline font-mono text-[10px] uppercase tracking-widest nav-text-muted">Sign out</span>
            </button>
          ) : (
            <button
              onClick={() => signInWithGoogle()}
              className="px-4 py-1.5 rounded-full font-mono text-[10px] uppercase tracking-widest transition-all"
              style={{ border: "1px solid rgba(255,81,0,0.4)", color: "#ff5100" }}
            >
              Sign in
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
