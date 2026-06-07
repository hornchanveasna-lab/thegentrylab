import { Link } from "@tanstack/react-router";
import { useState } from "react";

const links = [
  { to: "/",          label: "Map"      },
  { to: "/tracker",   label: "Tracker"  },
  { to: "/news",      label: "News"     },
  { to: "/research",  label: "Research" },
  { to: "/about",     label: "About"    },
  { to: "/contact",   label: "Contact"  },
] as const;

export function TopNav() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-[1000] border-b border-white/8 bg-[#0a0a0b]/85 backdrop-blur-md">
      <div className="flex items-center justify-between px-6 md:px-12 py-3.5 max-w-7xl mx-auto">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 group">
          <svg
            width="28"
            height="28"
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="shrink-0 transition-[filter] group-hover:drop-shadow-[0_0_8px_rgba(255,81,0,0.8)]"
          >
            {/* Top bar */}
            <rect x="0" y="0"  width="100" height="22" fill="#ff5100" />
            {/* Left bar */}
            <rect x="0" y="0"  width="22"  height="100" fill="#ff5100" />
            {/* Bottom bar */}
            <rect x="0" y="78" width="100" height="22" fill="#ff5100" />
            {/* Middle tongue (G crossbar) */}
            <rect x="48" y="40" width="52" height="20" fill="#ff5100" />
          </svg>
          <span className="font-extrabold tracking-tighter text-sm uppercase text-white">
            The Gentry Lab
          </span>
          <span className="hidden sm:inline font-mono text-[10px] uppercase tracking-widest text-white/30 border-l border-white/10 pl-3">
            Industrial Intelligence · KH
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
              <span className="absolute bottom-0 left-3 right-3 h-px bg-brand-accent scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
            </Link>
          ))}
          <Link
            to="/contact"
            className="ml-3 px-5 py-2 rounded-full border border-brand-accent/40 text-brand-accent hover:bg-brand-accent hover:text-black transition-all text-[11px] font-mono uppercase tracking-widest"
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
