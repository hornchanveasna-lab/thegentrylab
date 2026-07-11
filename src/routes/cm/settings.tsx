import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuthCM } from "@/lib/auth-cm";

export const Route = createFileRoute("/cm/settings")({
  component: CMSettingsPage,
});

function getStoredTheme(): "dark" | "light" {
  try { return (localStorage.getItem("tgl_theme") as "dark" | "light") || "dark"; } catch { return "dark"; }
}
function applyTheme(t: "dark" | "light") {
  document.documentElement.setAttribute("data-theme", t);
  try { localStorage.setItem("tgl_theme", t); } catch { /* */ }
}

function Row({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className="w-full flex items-center justify-between gap-3 px-4 py-3.5 bg-[#0d0d0e] first:rounded-t-2xl last:rounded-b-2xl border-b border-white/6 last:border-b-0 text-left"
    >
      {children}
    </Comp>
  );
}

function CMSettingsPage() {
  const { user, signOut } = useAuthCM();
  const [theme, setTheme] = useState<"dark" | "light">(getStoredTheme);
  useEffect(() => { applyTheme(theme); }, [theme]);

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white flex flex-col font-sans">
      <div className="max-w-md mx-auto w-full px-4 pt-6 pb-10 flex-1">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/cm" className="w-9 h-9 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 transition-colors shrink-0">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 3L5 8l5 5" />
            </svg>
          </Link>
          <h1 className="text-xl font-extrabold uppercase tracking-tight">Settings</h1>
        </div>

        {user && (
          <div className="flex items-center gap-3 px-4 py-4 mb-5 rounded-2xl bg-[#0d0d0e]">
            {user.user_metadata?.avatar_url ? (
              <img src={user.user_metadata.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover" />
            ) : (
              <span className="w-12 h-12 rounded-full bg-brand-accent flex items-center justify-center text-sm font-bold text-black">
                {(user.user_metadata?.full_name ?? user.email ?? "U")[0].toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <p className="text-[13px] font-bold truncate">{user.user_metadata?.full_name ?? "Signed in"}</p>
              <p className="text-[11px] text-white/40 truncate">{user.email}</p>
            </div>
          </div>
        )}

        <div className="rounded-2xl overflow-hidden mb-5">
          <Row onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}>
            <span className="text-[13px] text-white/85">Appearance</span>
            <span className="text-[12px] text-white/40 font-mono uppercase tracking-widest">{theme === "dark" ? "Dark" : "Light"}</span>
          </Row>
        </div>

        <div className="rounded-2xl overflow-hidden mb-5">
          <Row>
            <a href="https://thegentrylab.com" className="text-[13px] text-white/85">
              The Gentry Lab home
            </a>
            <span className="text-white/25">↗</span>
          </Row>
        </div>

        <button
          onClick={() => signOut()}
          className="w-full px-5 py-3.5 rounded-2xl text-[13px] font-bold text-red-400 bg-red-500/10 hover:bg-red-500/15 transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
