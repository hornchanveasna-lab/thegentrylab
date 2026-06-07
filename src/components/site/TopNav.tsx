import { Link } from "@tanstack/react-router";
import { useState } from "react";
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

export function TopNav({ cfg: cfgProp }: { cfg?: SiteConfig }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const cfg = cfgProp ?? loadConfig();
  const accent = cfg.accentColor;
  const logoColor = cfg.logoColor || accent;

  return (
    <nav className="sticky top-0 z-[1000] border-b border-white/8 bg-[#0a0a0b]/85 backdrop-blur-md">
      <div className="flex items-center justify-between px-6 md:px-12 py-3.5 max-w-7xl mx-auto">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-4 group">
          {/* Logo mark — uploaded image OR official G mark */}
          {cfg.logoImage ? (
            <img
              src={cfg.logoImage}
              alt="Logo"
              className="h-9 w-auto shrink-0 object-contain transition-[filter] group-hover:drop-shadow-[0_0_10px_rgba(255,81,0,0.5)]"
            />
          ) : (
            <GentryMark
              color={logoColor}
              size={36}
              className="shrink-0 transition-[filter] group-hover:drop-shadow-[0_0_10px_rgba(255,81,0,0.7)]"
            />
          )}
          {/* Wordmark */}
          <div className="flex flex-col leading-none">
            <span className="font-extrabold text-[10px] uppercase tracking-[0.18em] text-white/50">
              {cfg.logoLine1}
            </span>
            <span className="font-extrabold text-[15px] uppercase tracking-tighter text-white leading-tight">
              {cfg.logoLine2}
            </span>
            <span className="font-extrabold text-[15px] uppercase tracking-tighter leading-tight" style={{ color: accent }}>
              {cfg.logoLine3}
            </span>
          </div>
          <span className="hidden lg:inline font-mono text-[10px] uppercase tracking-widest text-white/25 border-l border-white/10 pl-4">
            {cfg.tagline}
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-1 text-[11px] font-mono uppercase tracking-widest">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              activeOptions={{ exact: true }}
              activeProps={{ className: "text-brand-accent" }}
              inactiveProps={{ className: "text-white/45 hover:text-white" }}
              className="px-3 py-2 transition-colors relative group"
            >
              {l.label}
              <span className="absolute bottom-0 left-3 right-3 h-px scale-x-0 group-hover:scale-x-100 transition-transform origin-left" style={{ backgroundColor: accent }} />
            </Link>
          ))}
          <Link
            to="/contact"
            className="ml-3 px-5 py-2 rounded-full text-[11px] font-mono uppercase tracking-widest transition-all hover:text-black"
            style={{
              border: `1px solid ${accent}66`,
              color: accent,
            }}
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

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-white/60 hover:text-white p-1"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          <div className="flex flex-col gap-1.5">
            <span className={`block w-5 h-px bg-current transition-all ${mobileOpen ? "rotate-45 translate-y-2" : ""}`} />
            <span className={`block w-5 h-px bg-current transition-all ${mobileOpen ? "opacity-0" : ""}`} />
            <span className={`block w-5 h-px bg-current transition-all ${mobileOpen ? "-rotate-45 -translate-y-2" : ""}`} />
          </div>
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-white/8 bg-[#0a0a0b] px-6 py-4 flex flex-col gap-1">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              onClick={() => setMobileOpen(false)}
              activeOptions={{ exact: true }}
              activeProps={{ className: "text-brand-accent" }}
              inactiveProps={{ className: "text-white/50" }}
              className="font-mono text-[11px] uppercase tracking-widest py-3 border-b border-white/5 transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
