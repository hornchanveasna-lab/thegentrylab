import { createFileRoute, Link } from "@tanstack/react-router";
import { TopNav } from "@/components/site/TopNav";
import { IndustrialMap } from "@/components/site/IndustrialMap";

export const Route = createFileRoute("/map")({
  component: MapPage,
});

function MapPage() {
  return (
    <div className="h-screen overflow-hidden bg-[#0a0a0b] text-white flex flex-col">
      <TopNav />
      {/* Header strip */}
      <div className="border-b border-white/8 bg-[#0d0d0e]">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-4 flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-white/35 mb-0.5">
              SeerMap · Interactive Intelligence
            </p>
            <h1 className="font-extrabold text-lg uppercase tracking-tight text-white leading-none">
              Cambodia Industrial Landscape
            </h1>
          </div>
          <div className="hidden md:flex items-center gap-6">
            {[
              { dot: "#ff5100", label: "SEZs & Parks" },
              { dot: "#facc15", label: "Infrastructure" },
              { dot: "#38bdf8", label: "Utilities" },
              { dot: "#34d399", label: "Corridors" },
              { dot: "#f43f5e", label: "Risk Zones" },
            ].map((l) => (
              <span key={l.label} className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-white/35">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: l.dot }} />
                {l.label}
              </span>
            ))}
            <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-brand-accent">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-accent pulse-dot" />
              Live
            </span>
            <Link to="/methodology" className="font-mono text-[10px] uppercase tracking-widest text-white/35 hover:text-white transition-colors">
              Methodology ↗
            </Link>
          </div>
        </div>
      </div>
      {/* Full-height map */}
      <div className="flex-1 min-h-0">
        <IndustrialMap />
      </div>
    </div>
  );
}
