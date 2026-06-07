import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { loadConfig, type SiteConfig } from "@/lib/siteConfig";
import { GentryMark } from "@/components/site/GentryMark";

const links = [
  { to: "/",          label: "Home"     },
  { to: "/map",       label: "Map"      },
  { to: "/tracker",   label: "Tracker"  },
  { to: "/news",      label: "News"     },
  { to: "/research",  label: "Research" },
  { to: "/about",     label: "About"    },
  { to: "/contact",   label: "Contact"  },
] as const;

const LANGUAGES = [
  { code: "kh", flag: "🇰🇭" },
  { code: "cn", flag: "🇨🇳" },
  { code: "en", flag: "🇬🇧" },
  { code: "fr", flag: "🇫🇷" },
  { code: "kr", flag: "🇰🇷" },
  { code: "jp", flag: "🇯🇵" },
] as const;

type LangCode = typeof LANGUAGES[number]["code"];

/* ── Dark/light mode helpers ─────────────────────────── */
function getStoredTheme(): "dark" | "light" {
  try { return (localStorage.getItem("tgl_theme") as "dark" | "light") || "dark"; } catch { return "dark"; }
}
function applyTheme(t: "dark" | "light") {
  document.documentElement.setAttribute("data-theme", t);
  try { localStorage.setItem("tgl_theme", t); } catch { /* */ }
}

/* ── Language helpers ────────────────────────────────── */
function getStoredLang(): LangCode {
  try { return (localStorage.getItem("tgl_lang") as LangCode) || "en"; } catch { return "en"; }
}

export function TopNav({ cfg: cfgProp }: { cfg?: SiteConfig }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">(getStoredTheme);
  const [lang, setLang] = useState<LangCode>(getStoredLang);

  const cfg = cfgProp ?? loadConfig();
  const accent = cfg.accentColor;
  const logoColor = cfg.logoColor || accent;

  /* Apply theme on mount + change */
  useEffect(() => { applyTheme(theme); }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));
  const setLanguage = (code: LangCode) => {
    setLang(code);
    try { localStorage.setItem("tgl_lang", code); } catch { /* */ }
  };

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

        {/* Desktop right side */}
        <div className="hidden md:flex items-center gap-1 text-[11px] font-mono uppercase tracking-widest">
          {links.map((l) => (
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

          {/* Divider */}
          <span className="w-px h-5 nav-divider mx-2" />

          {/* Language flags */}
          <div className="flex items-center gap-0.5">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => setLanguage(l.code)}
                title={l.code.toUpperCase()}
                className="w-7 h-7 flex items-center justify-center rounded transition-all text-base leading-none"
                style={{
                  opacity: lang === l.code ? 1 : 0.35,
                  transform: lang === l.code ? "scale(1.15)" : "scale(1)",
                  filter: lang === l.code ? "drop-shadow(0 0 4px rgba(255,81,0,0.5))" : "none",
                }}
              >
                {l.flag}
              </button>
            ))}
          </div>

          {/* Divider */}
          <span className="w-px h-5 nav-divider mx-2" />

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="w-8 h-8 flex items-center justify-center rounded-full nav-toggle-btn transition-all"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              /* Sun icon */
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
              /* Moon icon */
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
            Get advisory
          </Link>
        </div>

        {/* Mobile right */}
        <div className="md:hidden flex items-center gap-2">
          {/* Compact flags */}
          <div className="flex items-center gap-0.5">
            {LANGUAGES.map((l) => (
              <button key={l.code} onClick={() => setLanguage(l.code)}
                className="w-6 h-6 flex items-center justify-center text-sm leading-none"
                style={{ opacity: lang === l.code ? 1 : 0.3 }}>
                {l.flag}
              </button>
            ))}
          </div>
          {/* Theme toggle mobile */}
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
          {links.map((l) => (
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
