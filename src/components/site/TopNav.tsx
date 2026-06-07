import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { loadConfig, type SiteConfig } from "@/lib/siteConfig";
import { GentryMark } from "@/components/site/GentryMark";
import { LANG_FLAGS, LANG_NAMES, LANG_ORDER, setLang, useLang, type LangCode } from "@/lib/i18n";

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
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  // Reactive config — subscribes to dashboard saves so changes reflect immediately
  const [cfg, setCfg] = useState<SiteConfig>(() => cfgProp ?? loadConfig());
  useEffect(() => {
    if (cfgProp) { setCfg(cfgProp); return; } // parent-controlled
    const handler = (e: Event) => setCfg((e as CustomEvent<SiteConfig>).detail);
    window.addEventListener("tgl-config-updated", handler);
    return () => window.removeEventListener("tgl-config-updated", handler);
  }, [cfgProp]);

  const { lang, t } = useLang();
  const accent = cfg.accentColor;
  const logoColor = cfg.logoColor || accent;

  useEffect(() => { applyTheme(theme); }, [theme]);

  /* Close lang dropdown on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  const selectLang = (code: LangCode) => {
    setLang(code);
    setLangOpen(false);
  };

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

  return (
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

          <span className="w-px h-5 nav-divider mx-2" />

          {/* ── Language dropdown ─────────────────── */}
          <div ref={langRef} className="relative">
            <button
              onClick={() => setLangOpen((v) => !v)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 nav-toggle-btn rounded transition-all hover:bg-white/5"
              title="Change language"
            >
              <span className="text-base leading-none">{LANG_FLAGS[lang]}</span>
              <span className="font-mono text-[10px] uppercase tracking-widest hidden lg:block">{lang.toUpperCase()}</span>
              <svg width="9" height="9" viewBox="0 0 9 9" fill="none" className="opacity-40"
                style={{ transform: langOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
                <path d="M1.5 3l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            </button>

            {langOpen && (
              <div className="absolute right-0 top-full mt-1 w-44 nav-surface border nav-border shadow-2xl z-50 overflow-hidden">
                {LANG_ORDER.map((code) => (
                  <button
                    key={code}
                    onClick={() => selectLang(code)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all hover:bg-white/5"
                    style={{
                      backgroundColor: lang === code ? `${accent}12` : undefined,
                      borderLeft: lang === code ? `2px solid ${accent}` : "2px solid transparent",
                    }}
                  >
                    <span className="text-base leading-none">{LANG_FLAGS[code]}</span>
                    <span className="font-mono text-[10px] uppercase tracking-widest nav-text-muted">
                      {LANG_NAMES[code]}
                    </span>
                    {lang === code && (
                      <svg width="9" height="9" viewBox="0 0 9 9" fill="none" className="ml-auto shrink-0" style={{ color: accent }}>
                        <path d="M1.5 4.5l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <span className="w-px h-5 nav-divider mx-2" />

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
          {/* Compact lang dropdown */}
          <div ref={undefined} className="relative">
            <button onClick={() => setLangOpen((v) => !v)}
              className="flex items-center gap-1 nav-toggle-btn px-2 py-1.5 rounded">
              <span className="text-base leading-none">{LANG_FLAGS[lang]}</span>
              <svg width="8" height="8" viewBox="0 0 9 9" fill="none" className="opacity-40"
                style={{ transform: langOpen ? "rotate(180deg)" : undefined, transition: "transform .2s" }}>
                <path d="M1.5 3l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            </button>
            {langOpen && (
              <div className="absolute right-0 top-full mt-1 w-40 nav-surface border nav-border shadow-2xl z-50">
                {LANG_ORDER.map((code) => (
                  <button key={code} onClick={() => selectLang(code)}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 transition"
                    style={{ borderLeft: lang === code ? `2px solid ${accent}` : "2px solid transparent" }}>
                    <span className="text-sm">{LANG_FLAGS[code]}</span>
                    <span className="font-mono text-[10px] uppercase tracking-widest nav-text-muted">{LANG_NAMES[code]}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Theme toggle */}
          <button onClick={toggleTheme} className="nav-toggle-btn p-1.5 rounded-full transition-all">
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

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t nav-border nav-surface px-6 py-4 flex flex-col gap-1">
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
        </div>
      )}
    </nav>
  );
}
