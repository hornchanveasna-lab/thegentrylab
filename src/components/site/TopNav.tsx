import { Link } from "@tanstack/react-router";

const links = [
  { to: "/", label: "Map" },
  { to: "/tracker", label: "Tracker" },
  { to: "/news", label: "News" },
  { to: "/research", label: "Research" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
] as const;

export function TopNav() {
  return (
    <nav className="sticky top-0 z-[1000] border-b border-white/10 bg-black/80 backdrop-blur">
      <div className="flex items-center justify-between px-6 py-3">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-7 h-7 bg-brand-accent flex items-center justify-center">
            <div className="w-3 h-3 border border-black/60 rotate-45" />
          </div>
          <span className="font-extrabold tracking-tighter text-base uppercase text-white">
            The Gentry Lab
          </span>
          <span className="hidden sm:inline font-mono text-[10px] uppercase tracking-widest text-white/40 border-l border-white/10 pl-3">
            Industrial Intelligence · KH
          </span>
        </Link>
        <div className="hidden md:flex gap-1 text-[11px] font-mono uppercase tracking-widest">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              activeOptions={{ exact: true }}
              activeProps={{ className: "text-brand-accent bg-white/5" }}
              inactiveProps={{ className: "text-white/60 hover:text-white" }}
              className="px-3 py-2 transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
