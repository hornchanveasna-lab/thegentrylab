import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { loadConfig, type SiteConfig } from "@/lib/siteConfig";
import { GentryMark } from "@/components/site/GentryMark";
import { useLang } from "@/lib/i18n";

export function TopNav({ cfg: cfgProp }: { cfg?: SiteConfig }) {
  const [mobileOpen, setMobileOpen] = useState(false);

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

  /* Always force dark mode — platform is dark-themed by design */
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "dark");
    try { localStorage.setItem("tgl_theme", "dark"); } catch { /* */ }
  }, []);

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
