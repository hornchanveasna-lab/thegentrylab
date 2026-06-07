import { useEffect, useMemo, useState } from "react";
import "leaflet/dist/leaflet.css";
import {
  CORRIDORS,
  LAYER_META,
  SITES,
  type Corridor,
  type LayerGroup,
  type MapSite,
} from "@/data/platform";

// Leaflet is browser-only. We lazy-load on mount to avoid SSR `window` errors.
type RL = typeof import("react-leaflet");
type L = typeof import("leaflet");

const ALL_LAYERS: LayerGroup[] = [
  "investment",
  "infrastructure",
  "utilities",
  "risk",
  "labor",
  "corridors",
];

const STATUS_COLOR: Record<string, string> = {
  Operational: "#34d399",
  "Under Construction": "#fbbf24",
  Planned: "#94a3b8",
};

export function IndustrialMap() {
  const [mods, setMods] = useState<{ rl: RL; L: L } | null>(null);
  const [active, setActive] = useState<Set<LayerGroup>>(new Set(ALL_LAYERS));
  const [selected, setSelected] = useState<MapSite | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancel = false;
    (async () => {
      const [rl, L] = await Promise.all([
        import("react-leaflet"),
        import("leaflet"),
      ]);
      if (!cancel) setMods({ rl, L });
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SITES.filter(
      (s) =>
        active.has(s.layer) &&
        (q === "" ||
          s.name.toLowerCase().includes(q) ||
          s.province.toLowerCase().includes(q)),
    );
  }, [active, query]);

  const visibleCorridors = useMemo(
    () => (active.has("corridors") ? CORRIDORS : []),
    [active],
  );

  const toggle = (g: LayerGroup) => {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });
  };

  return (
    <div className="relative h-[calc(100vh-3.5rem)] w-full bg-black">
      {/* Map */}
      <div className="absolute inset-0">
        {mods ? (
          <MapView
            mods={mods}
            sites={visible}
            corridors={visibleCorridors}
            onSelect={setSelected}
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-white/40 font-mono text-xs uppercase tracking-widest">
            Loading Cambodia industrial basemap…
          </div>
        )}
      </div>

      {/* Layer panel */}
      <div className="absolute top-4 left-4 z-[400] w-72 max-w-[calc(100vw-2rem)] bg-black/90 backdrop-blur border border-white/10 text-white">
        <div className="px-4 py-3 border-b border-white/10">
          <p className="font-mono text-[10px] uppercase tracking-widest text-brand-accent">
            Cambodia Industrial Map
          </p>
          <p className="font-extrabold text-sm uppercase tracking-tight mt-1">
            Layer Control
          </p>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search site or province…"
          className="w-full px-4 py-2 bg-transparent border-b border-white/10 text-xs placeholder:text-white/30 focus:outline-none focus:border-brand-accent"
        />
        <ul className="divide-y divide-white/5">
          {ALL_LAYERS.map((g) => {
            const meta = LAYER_META[g];
            const on = active.has(g);
            const count =
              g === "corridors"
                ? CORRIDORS.length
                : SITES.filter((s) => s.layer === g).length;
            return (
              <li key={g}>
                <button
                  onClick={() => toggle(g)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition"
                >
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{
                      backgroundColor: meta.color,
                      opacity: on ? 1 : 0.25,
                      boxShadow: on ? `0 0 8px ${meta.color}` : "none",
                    }}
                  />
                  <span className="flex-1">
                    <span className="block text-xs font-bold uppercase tracking-wide">
                      {meta.label}
                    </span>
                    <span className="block text-[10px] text-white/40 mt-0.5">
                      {meta.description}
                    </span>
                  </span>
                  <span className="font-mono text-[10px] text-white/40">
                    {count}
                  </span>
                  <span
                    className={`w-7 h-4 rounded-full relative transition ${on ? "bg-brand-accent" : "bg-white/15"}`}
                  >
                    <span
                      className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${on ? "left-3.5" : "left-0.5"}`}
                    />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="px-4 py-3 border-t border-white/10 font-mono text-[10px] uppercase tracking-widest text-white/40">
          {visible.length} sites · {visibleCorridors.length} corridors visible
        </div>
      </div>

      {/* Inspector */}
      {selected && (
        <Inspector site={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function Inspector({
  site,
  onClose,
}: {
  site: MapSite;
  onClose: () => void;
}) {
  const scoreColor =
    site.score !== undefined
      ? site.score >= 85
        ? "#34d399"
        : site.score >= 70
          ? "#fbbf24"
          : "#f43f5e"
      : "#94a3b8";

  return (
    <aside className="absolute top-4 right-4 z-[400] w-[336px] max-w-[calc(100vw-2rem)] bg-black/95 backdrop-blur border border-white/10 text-white flex flex-col max-h-[calc(100vh-6rem)] overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between px-4 py-3 border-b border-white/10 shrink-0">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-brand-accent">
            {LAYER_META[site.layer].label}
            {site.kind !== "corridor" && ` · ${site.kind}`}
          </p>
          <h3 className="font-extrabold text-base uppercase tracking-tight leading-tight mt-1">
            {site.name}
          </h3>
          <p className="font-mono text-[10px] text-white/40 mt-0.5">
            {site.province}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-white/40 hover:text-white text-xl leading-none ml-4 shrink-0"
          aria-label="Close inspector"
        >
          ×
        </button>
      </div>

      {/* Scrollable body */}
      <div className="overflow-y-auto flex-1 scrollbar-thin">
        {/* Core metadata */}
        <dl className="px-4 py-3 grid grid-cols-3 gap-y-3 text-[11px]">
          {site.status && (
            <>
              <dt className="col-span-1 font-mono text-[10px] uppercase tracking-widest text-white/40">Status</dt>
              <dd className="col-span-2 flex items-center gap-1.5">
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: STATUS_COLOR[site.status] ?? "#94a3b8" }}
                />
                <span style={{ color: STATUS_COLOR[site.status] ?? "#fff" }}>{site.status}</span>
              </dd>
            </>
          )}
          {site.size && <Row k="Size" v={site.size} />}
          {site.utilities && <Row k="Utilities" v={site.utilities} />}
          {site.road && <Row k="Access" v={site.road} />}
        </dl>

        {/* Suitability score */}
        {site.score !== undefined && (
          <div className="px-4 py-3 border-t border-white/10">
            <p className="font-mono text-[10px] uppercase tracking-widest text-white/40 mb-2">
              Suitability Score
            </p>
            <div className="flex items-end gap-3">
              <span className="text-3xl font-extrabold" style={{ color: scoreColor }}>
                {site.score}
              </span>
              <span className="font-mono text-[10px] text-white/40 mb-1">/ 100</span>
            </div>
            <div className="mt-2 h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${site.score}%`, backgroundColor: scoreColor }}
              />
            </div>
          </div>
        )}

        {/* Target industries */}
        {site.targetIndustries && site.targetIndustries.length > 0 && (
          <div className="px-4 py-3 border-t border-white/10">
            <p className="font-mono text-[10px] uppercase tracking-widest text-white/40 mb-2">
              Target Industries
            </p>
            <div className="flex flex-wrap gap-1.5">
              {site.targetIndustries.map((ind) => (
                <span
                  key={ind}
                  className="px-2 py-0.5 bg-brand-accent/10 border border-brand-accent/30 text-brand-accent font-mono text-[9px] uppercase tracking-wider"
                >
                  {ind}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Strengths */}
        {site.strengths && site.strengths.length > 0 && (
          <div className="px-4 py-3 border-t border-white/10">
            <p className="font-mono text-[10px] uppercase tracking-widest text-white/40 mb-2">
              Key Strengths
            </p>
            <ul className="space-y-1">
              {site.strengths.map((s) => (
                <li key={s} className="flex items-start gap-2 text-[11px] text-white/80">
                  <span className="text-[#34d399] shrink-0 mt-0.5">+</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Constraints */}
        {site.constraints && site.constraints.length > 0 && (
          <div className="px-4 py-3 border-t border-white/10">
            <p className="font-mono text-[10px] uppercase tracking-widest text-white/40 mb-2">
              Key Constraints
            </p>
            <ul className="space-y-1">
              {site.constraints.map((c) => (
                <li key={c} className="flex items-start gap-2 text-[11px] text-white/80">
                  <span className="text-[#f43f5e] shrink-0 mt-0.5">−</span>
                  {c}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* GentryLab recommendation */}
        {site.recommendation && (
          <div className="px-4 py-3 border-t border-white/10">
            <p className="font-mono text-[10px] uppercase tracking-widest text-brand-accent mb-2">
              GentryLab Advisory
            </p>
            <p className="text-[11px] text-white/80 leading-relaxed">
              {site.recommendation}
            </p>
          </div>
        )}

        {/* General notes */}
        {site.notes && !site.recommendation && (
          <p className="px-4 py-3 border-t border-white/10 text-xs text-white/70 leading-relaxed">
            {site.notes}
          </p>
        )}

        <div className="px-4 py-3 border-t border-white/10 font-mono text-[9px] uppercase tracking-widest text-white/30">
          Data illustrative · Verify before investment decision
        </div>
      </div>
    </aside>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="col-span-1 font-mono text-[10px] uppercase tracking-widest text-white/40">
        {k}
      </dt>
      <dd className="col-span-2 text-white/90 text-[11px]">{v}</dd>
    </>
  );
}

function MapView({
  mods,
  sites,
  corridors,
  onSelect,
}: {
  mods: { rl: RL; L: L };
  sites: MapSite[];
  corridors: Corridor[];
  onSelect: (s: MapSite) => void;
}) {
  const { MapContainer, TileLayer, CircleMarker, Tooltip, Polyline } = mods.rl;
  return (
    <MapContainer
      center={[12.2, 104.9]}
      zoom={7}
      minZoom={6}
      maxZoom={14}
      scrollWheelZoom
      style={{ height: "100%", width: "100%", background: "#0a0a0b" }}
      attributionControl={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
        subdomains={["a", "b", "c", "d"]}
      />
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
        subdomains={["a", "b", "c", "d"]}
      />

      {/* Corridors as polylines */}
      {corridors.map((corridor) => (
        <Polyline
          key={corridor.id}
          positions={corridor.waypoints}
          pathOptions={{
            color: corridor.color,
            weight: 3,
            opacity: 0.75,
            dashArray: corridor.id.includes("ring") ? "6 4" : undefined,
          }}
        >
          <Tooltip sticky direction="top" opacity={0.92}>
            <span
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: 10,
                color: corridor.color,
              }}
            >
              {corridor.shortName}
            </span>
            <span
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: 10,
                color: "#fff",
                marginLeft: 6,
              }}
            >
              {corridor.name.split("—")[1]?.trim()}
            </span>
          </Tooltip>
        </Polyline>
      ))}

      {/* Site markers */}
      {sites.map((s) => {
        const color = LAYER_META[s.layer].color;
        const isKeysite = s.score !== undefined && s.score >= 85;
        return (
          <CircleMarker
            key={s.id}
            center={[s.lat, s.lng]}
            radius={isKeysite ? 8 : 6}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: 0.85,
              weight: isKeysite ? 2 : 1.5,
            }}
            eventHandlers={{ click: () => onSelect(s) }}
          >
            <Tooltip direction="top" offset={[0, -6]} opacity={0.92}>
              <span
                style={{
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: 10,
                  color,
                }}
              >
                {s.kind.toUpperCase()}
              </span>
              <span
                style={{
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: 10,
                  color: "#fff",
                  marginLeft: 6,
                }}
              >
                {s.name}
              </span>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
