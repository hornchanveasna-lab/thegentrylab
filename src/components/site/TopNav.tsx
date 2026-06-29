import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { loadConfig, type SiteConfig } from "@/lib/siteConfig";
import { GentryMark } from "@/components/site/GentryMark";
import { useLang } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { useCredits, formatCredits } from "@/lib/credits";

/* ── Dark/light helpers ─────────────────────────────────── */
function getStoredTheme(): "dark" | "light" {
  try { return (localStorage.getItem("tgl_theme") as "dark" | "light") || "dark"; } catch { return "dark"; }
}
function applyTheme(t: "dark" | "light") {
  document.documentElement.setAttribute("data-theme", t);
  try { localStorage.setItem("tgl_theme", t); } catch { /* */ }
}

export function TopNav({ cfg: cfgProp }: { cfg?: SiteConfig }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">(getStoredTheme);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { user, signInWithGoogle, signOut } = useAuth();
  const navigate = useNavigate();
  const { credits } = useCredits();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reactive config — subscribes to dashboard saves so changes reflect immediately
  const [cfg, setCfg] = useState<SiteConfig>(() => cfgProp ?? loadConfig());
  useEffect(() => {
    if (cfgProp) { setCfg(cfgProp); return; } // parent-controlled
    const handler = (e: Event) => setCfg((e as CustomEvent<SiteConfig>).detail);
    window.addEventListener("tgl-config-updated", handler);
    return () => window.removeEventListener("tgl-config-updated", handler);
  }, [cfgProp]);

  const { t } = useLang();
  const accent = cfg.accentColor;
  const logoColor = cfg.logoColor || accent;

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));
  useEffect(() => { applyTheme(theme); }, [theme]);

  // Base link definitions — labels come from cfg.navLinks if set, else i18n
  const NAV_LINK_BASE = [
    { to: "/",          id: "home",     fallbackLabel: t("nav.home")     },
    { to: "/map",       id: "map",      fallbackLabel: t("nav.map")      },
    { to: "/tracker",   id: "tracker",  fallbackLabel: t("nav.tracker")  },
    { to: "/news",      id: "news",     fallbackLabel: t("nav.news")     },
    { to: "/research",  id: "research", fallbackLabel: t("nav.research") },
    { to: "/about",     id: "about",    fallbackLabel: t("nav.about")    },
    { to: "/contact",   id: "contact",  fallbackLabel: t("nav.contact")  },
  ];

  // Filter by cfg.navLinks visibility; home is always shown
  const NAV_LINKS = NAV_LINK_BASE.filter((l) => {
    if (l.id === "home") return true;
    const override = cfg.navLinks?.find((n) => n.id === l.id);
    return override ? override.visible : true;
  }).map((l) => {
    const override = cfg.navLinks?.find((n) => n.id === l.id);
    return { to: l.to, label: override?.label || l.fallbackLabel };
  });

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  return (
    <>
    <nav className="sticky top-0 z-[1000] nav-bar backdrop-blur-md">
      <div className="flex items-center justify-between px-6 md:px-12 py-3.5 max-w-7xl mx-auto">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-4 group">
          {cfg.logoImage ? (
            <img src={cfg.logoImage} alt="Logo"
              className="h-9 w-auto shrink-0 object-contain transition-[filter] group-hover:drop-shadow-[0_0_10px_rgba(255,81,0,0.5)]" />
          ) : (
            <GentryMark color={logoColor} size={36}
              className="shrink-0 transition-[filter] group-hover:drop-shadow-[0_0_10px_rgba(255,81,0,0.7)]" />
          )}
          <div className="flex flex-col leading-none">
            <span className="font-extrabold text-[10px] uppercase tracking-[0.18em] nav-text-muted">{cfg.logoLine1}</span>
            <span className="font-extrabold text-[15px] uppercase tracking-tighter nav-text-primary leading-tight">{cfg.logoLine2}</span>
            <span className="font-extrabold text-[15px] uppercase tracking-tighter leading-tight" style={{ color: accent }}>{cfg.logoLine3}</span>
          </div>
          <span className="hidden lg:inline font-mono text-[10px] uppercase tracking-widest nav-text-muted border-l nav-border pl-4">
            {cfg.tagline}
          </span>
        </Link>

        {/* Desktop right */}
        <div className="hidden md:flex items-center gap-1 text-[11px] font-mono uppercase tracking-widest">
          {NAV_LINKS.map((l) => (
            <Link key={l.to} to={l.to}
              activeOptions={{ exact: true }}
              activeProps={{ className: "text-brand-accent" }}
              inactiveProps={{ className: "nav-link" }}
              className="px-3 py-2 transition-colors relative group"
            >
              {l.label}
              <span className="absolute bottom-0 left-3 right-3 h-px scale-x-0 group-hover:scale-x-100 transition-transform origin-left" style={{ backgroundColor: accent }} />
            </Link>
          ))}

          {/* Auth — sign in / user menu */}
          {user ? (
            <div ref={userMenuRef} className="relative">
              <button
                onClick={() => setUserMenuOpen((v) => !v)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-full nav-toggle-btn transition-all"
                aria-label="User menu"
              >
                {/* Credit badge */}
                {credits !== null && (
                  <span className="font-mono text-[8px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "rgba(255,81,0,0.15)", color: "#ff5100", border: "1px solid rgba(255,81,0,0.25)" }}>
                    {formatCredits(credits.balance)} cr
                  </span>
                )}
                {user.user_metadata?.avatar_url ? (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt={user.user_metadata?.full_name ?? "User"}
                    className="w-6 h-6 rounded-full object-cover"
                  />
                ) : (
                  <span className="w-6 h-6 rounded-full bg-brand-accent flex items-center justify-center text-[9px] font-bold text-black">
                    {(user.user_metadata?.full_name ?? user.email ?? "U")[0].toUpperCase()}
                  </span>
                )}
                <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" className="nav-text-muted opacity-50">
                  <path d="M0 2l4 4 4-4H0z"/>
                </svg>
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 nav-surface border nav-border rounded-xl shadow-2xl overflow-hidden z-50">

                  {/* Credit balance strip */}
                  {credits !== null && (
                    <div className="px-3 py-2 border-b nav-border flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ff5100" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        <span className="font-mono text-[9px] uppercase tracking-widest nav-text-muted">Credits</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-bold" style={{ color: "#ff5100" }}>{formatCredits(credits.balance)}</span>
                        <Link to="/credits" onClick={() => setUserMenuOpen(false)} className="font-mono text-[8px] uppercase tracking-widest px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(255,81,0,0.12)", color: "#ff5100" }}>
                          Buy
                        </Link>
                      </div>
                    </div>
                  )}

                  {/* Profile & Settings */}
                  <div className="px-3 py-2 border-b nav-border">
                    {[
                      { label: "Profile",  to: "/profile",  icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
                      { label: "Settings", to: "/settings", icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
                    ].map((item) => (
                      <button key={item.label}
                        onClick={() => { navigate({ to: item.to }); setUserMenuOpen(false); }}
                        className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md nav-text-muted hover:nav-text-primary hover:bg-white/5 transition-colors text-left">
                        <span className="opacity-60">{item.icon}</span>
                        <span className="text-[11px] font-medium">{item.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Tools */}
                  <div className="px-3 py-2.5 border-b nav-border">
                    <p className="font-mono text-[8px] uppercase tracking-[0.2em] nav-text-muted px-1 mb-1.5">Tools</p>
                    {[
                      { label: "AI Industrial Advisor", live: true,  to: "/tools/advisor" },
                      { label: "Site Scoring Engine",   live: false, to: null },
                      { label: "Permit Navigator",      live: false, to: null },
                      { label: "Utility Capacity Map",  live: false, to: null },
                      { label: "Cost Heat Map",         live: false, to: null },
                      { label: "Land Market Price",     live: false, to: null },
                    ].map((tool) => (
                      tool.live && tool.to ? (
                        <Link key={tool.label} to={tool.to} onClick={() => setUserMenuOpen(false)}
                          className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-white/5 transition-colors">
                          <span className="text-[11px] nav-text-primary font-medium">{tool.label}</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                        </Link>
                      ) : (
                        <div key={tool.label} className="flex items-center justify-between px-2 py-1.5 rounded-md opacity-40 cursor-not-allowed">
                          <span className="text-[11px] nav-text-primary font-medium">{tool.label}</span>
                          <span className="font-mono text-[8px] uppercase tracking-widest nav-text-muted">Soon</span>
                        </div>
                      )
                    ))}
                  </div>

                  {/* Sign out */}
                  <button
                    onClick={() => { signOut(); setUserMenuOpen(false); }}
                    className="w-full text-left px-4 py-2.5 font-mono text-[10px] uppercase tracking-widest nav-text-muted hover:nav-text-primary hover:bg-white/5 transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              to="/login"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full nav-toggle-btn font-mono text-[10px] uppercase tracking-widest nav-text-muted hover:nav-text-primary transition-all"
              aria-label="Sign in"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              Sign in
            </Link>
          )}

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="w-8 h-8 flex items-center justify-center rounded-full nav-toggle-btn transition-all"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                <circle cx="7.5" cy="7.5" r="3"/>
                <line x1="7.5" y1="1"   x2="7.5" y2="2.5"/>
                <line x1="7.5" y1="12.5" x2="7.5" y2="14"/>
                <line x1="1"   y1="7.5" x2="2.5" y2="7.5"/>
                <line x1="12.5" y1="7.5" x2="14" y2="7.5"/>
                <line x1="3.2" y1="3.2" x2="4.2" y2="4.2"/>
                <line x1="10.8" y1="10.8" x2="11.8" y2="11.8"/>
                <line x1="10.8" y1="3.2" x2="11.8" y2="4.2"/>
                <line x1="3.2" y1="10.8" x2="4.2" y2="11.8"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                <path d="M12 9.33A5.33 5.33 0 0 1 4.67 2a5.33 5.33 0 1 0 7.33 7.33z"/>
              </svg>
            )}
          </button>

          {/* Get advisory */}
          <Link to="/contact"
            className="ml-2 px-5 py-2 rounded-full text-[11px] font-mono uppercase tracking-widest transition-all"
            style={{ border: `1px solid ${accent}66`, color: accent }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = accent;
              (e.currentTarget as HTMLElement).style.color = "#000";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
              (e.currentTarget as HTMLElement).style.color = accent;
            }}
          >
            {t("nav.getAdvisory")}
          </Link>
        </div>

        {/* Mobile right */}
        <div className="md:hidden flex items-center gap-2">
          {/* Theme toggle */}
          <button onClick={toggleTheme} className="nav-toggle-btn p-1.5 rounded-full transition-all" aria-label="Toggle theme">
            {theme === "dark" ? (
              <svg width="14" height="14" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                <circle cx="7.5" cy="7.5" r="3"/>
                <line x1="7.5" y1="1" x2="7.5" y2="2.5"/>
                <line x1="7.5" y1="12.5" x2="7.5" y2="14"/>
                <line x1="1" y1="7.5" x2="2.5" y2="7.5"/>
                <line x1="12.5" y1="7.5" x2="14" y2="7.5"/>
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                <path d="M12 9.33A5.33 5.33 0 0 1 4.67 2a5.33 5.33 0 1 0 7.33 7.33z"/>
              </svg>
            )}
          </button>
          {/* Hamburger */}
          <button className="nav-toggle-btn p-1" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu">
            <div className="flex flex-col gap-1.5">
              <span className={`block w-5 h-px bg-current transition-all ${mobileOpen ? "rotate-45 translate-y-2" : ""}`} />
              <span className={`block w-5 h-px bg-current transition-all ${mobileOpen ? "opacity-0" : ""}`} />
              <span className={`block w-5 h-px bg-current transition-all ${mobileOpen ? "-rotate-45 -translate-y-2" : ""}`} />
            </div>
          </button>
        </div>
      </div>

    </nav>

    {/* Mobile menu — fixed overlay so it doesn't expand the sticky nav and block page scroll */}
    {mobileOpen && (
      <div className="md:hidden fixed inset-x-0 top-[64px] z-[999] nav-surface border-t nav-border overflow-y-auto max-h-[calc(100svh-64px)] flex flex-col gap-1 px-6 py-4">
        {NAV_LINKS.map((l) => (
          <Link key={l.to} to={l.to} onClick={() => setMobileOpen(false)}
            activeOptions={{ exact: true }}
            activeProps={{ className: "text-brand-accent" }}
            inactiveProps={{ className: "nav-text-muted" }}
            className="font-mono text-[11px] uppercase tracking-widest py-3 border-b nav-border transition-colors"
          >
            {l.label}
          </Link>
        ))}

        {/* Tools section */}
        <div className="pt-3 pb-1">
          <p className="font-mono text-[8px] uppercase tracking-[0.2em] nav-text-muted mb-2">AI Tools</p>
          <Link to="/tools/advisor" onClick={() => setMobileOpen(false)}
            className="flex items-center justify-between py-2.5 px-3 rounded-lg mb-1 transition-colors"
            style={{ backgroundColor: "rgba(255,81,0,0.08)", border: "1px solid rgba(255,81,0,0.18)" }}>
            <span className="font-mono text-[11px] uppercase tracking-widest" style={{ color: "#ff5100" }}>
              AI Industrial Advisor
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
          </Link>
          {[
            "Site Scoring Engine",
            "Permit Navigator",
            "Utility Capacity Map",
            "Cost Heat Map",
          ].map((tool) => (
            <div key={tool} className="flex items-center justify-between py-2 px-3 rounded-lg opacity-40 cursor-not-allowed mb-0.5">
              <span className="font-mono text-[10px] uppercase tracking-widest nav-text-muted">{tool}</span>
              <span className="font-mono text-[8px] uppercase tracking-widest nav-text-muted">Soon</span>
            </div>
          ))}
        </div>

        {/* Credits link for logged-in */}
        {user && credits !== null && (
          <Link to="/credits" onClick={() => setMobileOpen(false)}
            className="flex items-center justify-between py-2.5 px-3 rounded-lg mt-1 border-t nav-border pt-3">
            <span className="font-mono text-[10px] uppercase tracking-widest nav-text-muted">Credits</span>
            <span className="font-mono text-[11px] font-bold" style={{ color: "#ff5100" }}>
              {formatCredits(credits.balance)} cr
            </span>
          </Link>
        )}

        {/* Mobile auth */}
        {user ? (
          <div className="pt-3 border-t nav-border flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
              {user.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
              ) : (
                <span className="w-7 h-7 rounded-full bg-brand-accent flex items-center justify-center text-[9px] font-bold text-black">
                  {(user.user_metadata?.full_name ?? user.email ?? "U")[0].toUpperCase()}
                </span>
              )}
              <span className="font-mono text-[10px] uppercase tracking-widest nav-text-muted truncate max-w-[140px]">
                {user.user_metadata?.full_name ?? user.email}
              </span>
            </div>
            <button onClick={() => { signOut(); setMobileOpen(false); }}
              className="font-mono text-[10px] uppercase tracking-widest text-red-400/70 hover:text-red-400 transition-colors">
              Sign out
            </button>
          </div>
        ) : (
          <Link to="/login" onClick={() => setMobileOpen(false)}
            className="mt-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest nav-text-muted hover:nav-text-primary transition-colors">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            Sign in
          </Link>
        )}
      </div>
    )}
    </>
  );
}
