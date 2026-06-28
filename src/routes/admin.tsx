import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef, useCallback } from "react";
import { DashboardBody } from "./dashboard";
import { useQueryClient } from "@tanstack/react-query";
import { APIProvider, Map, useMap } from "@vis.gl/react-google-maps";
import { useAuth } from "@/lib/auth";
import {
  useMapSites, useSiteImages, addSiteImage,
  deleteSiteImage, updateSiteField,
} from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { LAYER_META, type MapSite } from "@/data/platform";
import type { SiteImage } from "@/lib/data";
import { GentryMark } from "@/components/site/GentryMark";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

const ADMIN_EMAIL     = "horn.chanveasna@gmail.com";
const GMAPS_KEY       = import.meta.env.VITE_GOOGLE_MAPS_KEY as string;
const WEB_IMAGE_URL   = "https://mcxfukjopdnouicwacbn.supabase.co/functions/v1/web-image-fetch";
const STATUS_OPTS     = ["Operational", "Under Construction", "Planned"] as const;

/* ── Category groups ─────────────────────────────────────── */
const KIND_GROUP = (kind: string): "investment" | "energy-gen" | "energy-grid" | "infrastructure" | "environment" | "labor" | "other" => {
  if (["sez", "park", "factory", "logistics"].includes(kind)) return "investment";
  if (["powerplant", "solar"].includes(kind))                  return "energy-gen";
  if (["substation"].includes(kind))                           return "energy-grid";
  if (["port", "airport", "rail"].includes(kind))              return "infrastructure";
  if (["protected", "waste", "water_plant"].includes(kind))    return "environment";
  if (["hospital", "university", "tvet"].includes(kind))       return "labor";
  return "other";
};

/* ── Image helpers ───────────────────────────────────────── */
function compressImage(file: File, maxPx: number, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxPx || height > maxPx) {
        if (width >= height) { height = Math.round(height * maxPx / width); width = maxPx; }
        else                 { width  = Math.round(width  * maxPx / height); height = maxPx; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
      canvas.toBlob(b => b ? resolve(b) : reject(new Error("Compression failed")), "image/jpeg", quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Load failed")); };
    img.src = url;
  });
}

/** Fetch candidate images from an official website or by site name via the edge function. */
async function fetchWebImages(urlOrQuery: string, isUrl: boolean): Promise<string[]> {
  const body = isUrl ? { url: urlOrQuery } : { query: urlOrQuery };
  const res = await fetch(WEB_IMAGE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Edge function error: ${res.status}`);
  const data = await res.json();
  return (data.images ?? []) as string[];
}

/** Download an image URL and upload it to Supabase Storage, then insert site_images row. */
async function importWebImage(
  siteId: string, imageUrl: string, caption: string, sortOrder: number,
) {
  if (!supabase) throw new Error("No supabase");
  const proxyRes = await fetch(WEB_IMAGE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ download: imageUrl }),
  });
  if (!proxyRes.ok) throw new Error(`Proxy failed: ${proxyRes.status}`);
  const ct = proxyRes.headers.get("content-type") ?? "";
  if (!ct.startsWith("image/")) {
    const err = await proxyRes.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Not an image");
  }
  const blob = await proxyRes.blob();
  const ext  = blob.type.includes("png") ? "png" : "jpg";
  const compressed = await compressImage(new File([blob], `img.${ext}`, { type: blob.type }), 1920, 0.88);
  const path = `web/${siteId}/${Date.now()}.jpg`;
  const { error } = await supabase.storage.from("site-images").upload(path, compressed, { upsert: false, contentType: "image/jpeg" });
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from("site-images").getPublicUrl(path);
  await addSiteImage({ site_id: siteId, url: publicUrl, caption, source: "web", sort_order: sortOrder });
}

/* ── Login ───────────────────────────────────────────────── */
function LoginScreen({ onSignIn, denied }: { onSignIn: () => void; denied: boolean }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#080809]">
      <div className="w-sm px-8 py-10 rounded-2xl border border-white/8 bg-white/[0.02] flex flex-col items-center gap-6">
        <GentryMark color="#ff5100" size={40} />
        <div className="text-center">
          <h1 className="text-white font-bold text-lg">Admin Access</h1>
          <p className="text-white/30 text-[11px] font-mono mt-1">The Gentry Lab · Cambodia Industrial Intelligence</p>
        </div>
        {denied && (
          <div className="w-full px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-center">
            <p className="text-red-400 text-[11px] font-mono">Unauthorized account.</p>
          </div>
        )}
        <button onClick={onSignIn}
          className="w-full flex items-center justify-center gap-3 px-5 py-3 rounded-xl bg-white text-black font-semibold text-[13px] hover:bg-white/90 transition">
          <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#4285F4" d="M44.5 20H24v8.5h11.8C34.7 33.9 29.8 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z"/></svg>
          Sign in with Google
        </button>
        <p className="text-white/15 text-[10px] font-mono">Restricted access</p>
      </div>
    </div>
  );
}

/* ── Admin root ──────────────────────────────────────────── */
type AdminTab = "overview" | "map" | "images" | "config";

function AdminPage() {
  const { user, signInWithGoogle, signOut } = useAuth();
  const qc = useQueryClient();
  const { data: sites = [], isLoading } = useMapSites();

  const [denied, setDenied]       = useState(false);
  const [tab, setTab]             = useState<AdminTab>("map");
  const [selected, setSelected]   = useState<MapSite | null>(null);
  useEffect(() => {
    if (user && user.email !== ADMIN_EMAIL) { setDenied(true); signOut(); }
  }, [user, signOut]);

  if (!user || denied) return <LoginScreen onSignIn={signInWithGoogle} denied={denied} />;

  const stats = {
    total:       sites.length,
    operational: sites.filter(s => s.status === "Operational").length,
    scored:      sites.filter(s => s.score != null).length,
    avgScore:    Math.round(sites.filter(s => s.score != null).reduce((a, s) => a + s.score!, 0) / (sites.filter(s => s.score != null).length || 1)),
  };

  return (
    <div className="h-screen flex flex-col bg-[#080809] text-white overflow-hidden">
      {/* ── Top nav ── */}
      <header className="flex items-center gap-4 px-5 py-2.5 border-b border-white/8 shrink-0 z-50">
        <a href="/map" className="flex items-center gap-2 group">
          <GentryMark color="#ff5100" size={20} />
          <span className="font-mono text-[9px] uppercase tracking-widest text-white/25 group-hover:text-white/50 transition">Admin</span>
        </a>

        {/* Tabs */}
        <div className="flex items-center gap-1 ml-4">
          {(["overview", "map", "images", "config"] as AdminTab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-3 py-1.5 rounded-lg font-mono text-[10px] uppercase tracking-wider transition"
              style={{
                background: tab === t ? "rgba(255,81,0,0.1)" : "transparent",
                color:      tab === t ? "#ff5100" : "rgba(255,255,255,0.28)",
                border:     tab === t ? "1px solid rgba(255,81,0,0.22)" : "1px solid transparent",
              }}>
              {t === "map" ? "Map + Edit" : t === "config" ? "Site Config" : t}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        <div className="w-px h-4 bg-white/8" />
        <span className="font-mono text-[9px] text-white/20">{user.email}</span>
        <button onClick={signOut} className="font-mono text-[9px] text-white/20 hover:text-white/50 transition px-2 py-1 rounded border border-white/8 hover:border-white/18">Out</button>
      </header>

      {/* ── Body ── */}
      <div className="flex-1 overflow-hidden">
        {tab === "overview" && <OverviewTab sites={sites} stats={stats} isLoading={isLoading} />}
        {tab === "map"      && (
          <MapEditTab
            sites={sites}
            selected={selected}
            onSelect={setSelected}
            onSaved={(updated) => {
              setSelected(updated);
              qc.invalidateQueries({ queryKey: ["sites"] });
            }}
          />
        )}
        {tab === "images"   && <ImagesTab sites={sites} isLoading={isLoading} />}
        {tab === "config"   && <DashboardBody embedded />}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MAP + EDIT TAB
══════════════════════════════════════════════════════════ */
const DARK_MAP_STYLES = [
  { elementType: "geometry",               stylers: [{ color: "#0d1117" }] },
  { elementType: "labels.text.fill",       stylers: [{ color: "#7a8899" }] },
  { elementType: "labels.text.stroke",     stylers: [{ color: "#0d1117" }] },
  { featureType: "road.highway",           elementType: "geometry",         stylers: [{ color: "#1e2d3a" }] },
  { featureType: "poi",                    stylers: [{ visibility: "off" }] },
  { featureType: "transit",                stylers: [{ visibility: "off" }] },
  { featureType: "water",                  elementType: "geometry",         stylers: [{ color: "#0a1628" }] },
  { featureType: "landscape",              elementType: "geometry",         stylers: [{ color: "#0f1a22" }] },
  { featureType: "administrative.country", elementType: "geometry.stroke",  stylers: [{ color: "#445060" }, { weight: 1.5 }] },
] as google.maps.MapTypeStyle[];

function MapEditTab({ sites, selected, onSelect, onSaved }: {
  sites: MapSite[];
  selected: MapSite | null;
  onSelect: (s: MapSite) => void;
  onSaved: (s: MapSite) => void;
}) {
  const [drawMode,       setDrawMode]       = useState(false);
  const [polygonDrawn,   setPolygonDrawn]   = useState(false);
  const [savingBoundary, setSavingBoundary] = useState(false);
  // ref that BoundaryLayer populates so we can extract GeoJSON on save
  const drawnPolygonRef = useRef<google.maps.Polygon | null>(null);

  // Reset draw state when site changes
  useEffect(() => {
    setDrawMode(false);
    setPolygonDrawn(false);
    drawnPolygonRef.current = null;
  }, [selected?.id]);

  async function handleSaveBoundary() {
    const poly = drawnPolygonRef.current;
    if (!poly || !selected) return;
    const path = poly.getPath().getArray().map((pt) => [pt.lng(), pt.lat()]);
    if (path.length < 3) return;
    path.push(path[0]); // close ring
    const geojson = { type: "Polygon", coordinates: [path] };
    setSavingBoundary(true);
    await updateSiteField(selected.id, { boundary: geojson, updated_at: new Date().toISOString() });
    setSavingBoundary(false);
    setDrawMode(false);
    setPolygonDrawn(false);
    drawnPolygonRef.current = null;
    onSaved({ ...selected, boundary: geojson } as MapSite);
  }

  async function handleClearBoundary() {
    if (!selected) return;
    await updateSiteField(selected.id, { boundary: null, updated_at: new Date().toISOString() });
    onSaved({ ...selected, boundary: null } as MapSite);
  }

  return (
    <div className="flex h-full">
      {/* Map pane */}
      <div className="flex-1 relative">
        <APIProvider apiKey={GMAPS_KEY} libraries={["places", "drawing"]}>
          <Map
            defaultCenter={{ lat: 12.5657, lng: 104.991 }}
            defaultZoom={7}
            mapTypeId="satellite"
            disableDefaultUI
            className="w-full h-full"
          >
            <AdminPins sites={sites} selected={selected} onSelect={onSelect} />
            {selected && (
              <BoundaryLayer
                site={selected}
                drawMode={drawMode}
                onPolygonReady={(poly) => { drawnPolygonRef.current = poly; setPolygonDrawn(true); }}
                onCancel={() => { setDrawMode(false); setPolygonDrawn(false); }}
              />
            )}
          </Map>
        </APIProvider>

        {/* Draw mode instructions */}
        {drawMode && !polygonDrawn && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/90 border border-[#ff5100]/50 text-white px-4 py-2 rounded-lg font-mono text-[10px] text-center whitespace-nowrap">
            Click to place points · Double-click to finish · <span className="text-white/40">Esc to cancel</span>
          </div>
        )}
        {drawMode && polygonDrawn && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2">
            <div className="bg-black/90 border border-white/15 text-white/60 px-3 py-1.5 rounded-lg font-mono text-[10px]">
              Drag handles to adjust · then
            </div>
            <button onClick={handleSaveBoundary} disabled={savingBoundary}
              className="px-4 py-1.5 font-mono text-[10px] uppercase tracking-wider rounded-lg font-bold"
              style={{ backgroundColor: "#ff5100", color: "#fff", opacity: savingBoundary ? 0.6 : 1 }}>
              {savingBoundary ? "Saving…" : "Save Boundary"}
            </button>
            <button onClick={() => { setPolygonDrawn(false); drawnPolygonRef.current?.setMap(null); drawnPolygonRef.current = null; setDrawMode(true); }}
              className="px-3 py-1.5 font-mono text-[10px] text-white/40 hover:text-white/70 bg-black/70 border border-white/10 rounded-lg">
              Redraw
            </button>
          </div>
        )}

        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-black/70 backdrop-blur border border-white/10 rounded-xl px-4 py-3 flex flex-col gap-1.5">
          {(Object.entries(LAYER_META) as [string, { label: string; color: string }][])
            .filter(([k]) => k !== "corridors" && k !== "risk")
            .map(([, v]) => (
              <div key={v.label} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: v.color }} />
                <span className="font-mono text-[9px] text-white/50">{v.label}</span>
              </div>
            ))}
        </div>

        {/* Site count */}
        <div className="absolute top-3 left-3 bg-black/60 backdrop-blur border border-white/8 rounded-lg px-3 py-1.5">
          <span className="font-mono text-[9px] text-white/40">{sites.length} sites · click pin to edit</span>
        </div>
      </div>

      {/* Editor pane */}
      <div
        className="shrink-0 border-l border-white/8 overflow-y-auto bg-[#0a0a0b] transition-all duration-300"
        style={{ width: selected ? "420px" : "0px", minWidth: selected ? "420px" : "0px" }}
      >
        {selected && (
          <SiteEditor
            key={selected.id}
            site={selected}
            onSaved={onSaved}
            onClose={() => onSelect(null as unknown as MapSite)}
            onStartDraw={() => { setDrawMode(true); setPolygonDrawn(false); }}
            onClearBoundary={handleClearBoundary}
            isDrawing={drawMode}
          />
        )}
      </div>
    </div>
  );
}

/* ── Boundary draw + display layer (inside Map context) ── */
function BoundaryLayer({ site, drawMode, onPolygonReady, onCancel }: {
  site: MapSite;
  drawMode: boolean;
  onPolygonReady: (poly: google.maps.Polygon) => void;
  onCancel: () => void;
}) {
  const map = useMap();

  // Show existing saved boundary
  useEffect(() => {
    if (!map || !site.boundary || drawMode) return;
    const geo = site.boundary as { type: string; coordinates: number[][][] };
    if (!geo?.coordinates?.[0]) return;
    const ring = geo.type === "MultiPolygon"
      ? geo.coordinates[0][0]
      : geo.coordinates[0];
    const paths = ring.map(([lng, lat]) => ({ lat, lng }));
    const poly = new google.maps.Polygon({
      map: map as google.maps.Map,
      paths,
      fillColor: "#ff5100", fillOpacity: 0.15,
      strokeColor: "#ff5100", strokeOpacity: 0.9, strokeWeight: 2,
      clickable: false, zIndex: 1,
    });
    return () => poly.setMap(null);
  }, [map, site.id, site.boundary, drawMode]);

  // Drawing manager
  useEffect(() => {
    if (!map || !drawMode) return;
    // Pan & zoom to site
    map.panTo({ lat: site.lat, lng: site.lng });
    map.setZoom(16);

    const dm = new google.maps.drawing.DrawingManager({
      drawingMode: google.maps.drawing.OverlayType.POLYGON,
      drawingControl: false,
      polygonOptions: {
        fillColor: "#ff5100", fillOpacity: 0.2,
        strokeColor: "#ff5100", strokeWeight: 2.5,
        editable: true, draggable: false, zIndex: 10,
      },
    });
    dm.setMap(map as google.maps.Map);

    const listener = dm.addListener("polygoncomplete", (poly: google.maps.Polygon) => {
      dm.setDrawingMode(null);
      onPolygonReady(poly);
    });

    const keyHandler = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", keyHandler);

    return () => {
      google.maps.event.removeListener(listener);
      dm.setMap(null);
      window.removeEventListener("keydown", keyHandler);
    };
  }, [map, drawMode, site.lat, site.lng, onPolygonReady, onCancel]);

  return null;
}

/* ── Map pins rendered inside the Map context ──────────── */
function AdminPins({ sites, selected, onSelect }: {
  sites: MapSite[];
  selected: MapSite | null;
  onSelect: (s: MapSite) => void;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || !sites.length) return;
    const markers: google.maps.Marker[] = [];

    sites.forEach(site => {
      if (!site.lat || !site.lng) return;
      const color = LAYER_META[site.layer as keyof typeof LAYER_META]?.color ?? "#94a3b8";
      const isSelected = selected?.id === site.id;
      const size = isSelected ? 12 : 8;

      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size * 2 + 4}" height="${size * 2 + 4}">
        <circle cx="${size + 2}" cy="${size + 2}" r="${size}" fill="${color}" fill-opacity="${isSelected ? 1 : 0.75}" stroke="#fff" stroke-width="${isSelected ? 2 : 1}" stroke-opacity="0.6"/>
      </svg>`;

      const marker = new google.maps.Marker({
        position: { lat: site.lat, lng: site.lng },
        map,
        title: site.name,
        icon: {
          url: `data:image/svg+xml,${encodeURIComponent(svg)}`,
          anchor: new google.maps.Point(size + 2, size + 2),
        },
        zIndex: isSelected ? 100 : 1,
      });
      marker.addListener("click", () => {
        onSelect(site);
        map.panTo({ lat: site.lat, lng: site.lng });
      });
      markers.push(marker);
    });

    return () => markers.forEach(m => m.setMap(null));
  }, [map, sites, selected, onSelect]);

  return null;
}

/* ══════════════════════════════════════════════════════════
   SITE EDITOR — category-aware
══════════════════════════════════════════════════════════ */
function SiteEditor({ site, onSaved, onClose, onStartDraw, onClearBoundary, isDrawing }: {
  site: MapSite;
  onSaved: (s: MapSite) => void;
  onClose: () => void;
  onStartDraw?: () => void;
  onClearBoundary?: () => void;
  isDrawing?: boolean;
}) {
  const { data: images = [], refetch: refetchImages } = useSiteImages(site.id);
  const group = KIND_GROUP(site.kind);

  // Common fields
  const [f, setF] = useState({
    name:              site.name,
    status:            site.status ?? "",
    size:              site.size ?? "",
    province:          site.province,
    operator:          site.operator ?? "",
    year_commissioned: site.year_commissioned?.toString() ?? "",
    website:           site.website ?? "",
    phone:             site.phone ?? "",
    notes:             site.notes ?? "",
    road:              site.road ?? "",
    utilities:         site.utilities ?? "",
    target_industries: (site.targetIndustries ?? []).join(", "),
    strengths:         (site.strengths ?? []).join("\n"),
    constraints:       (site.constraints ?? []).join("\n"),
    recommendation:    site.recommendation ?? "",
    // Investment
    tenant_count:      site.tenant_count?.toString() ?? "",
    country_count:     site.country_count?.toString() ?? "",
    employee_count:    site.employee_count?.toString() ?? "",
    export_value_usd:  site.export_value_usd?.toString() ?? "",
    stock_ticker:      site.stock_ticker ?? "",
    zone_types:        (site.zone_types ?? []).join(", "),
    lease_rate_usd:    site.lease_rate_usd ?? "",
    plot_size_min_ha:  site.plot_size_min_ha?.toString() ?? "",
    airport_distance_km: site.airport_distance_km?.toString() ?? "",
    city_distance_km:  site.city_distance_km?.toString() ?? "",
    on_site_facilities: (site.on_site_facilities ?? []).join(", "),
    // Energy EIP
    energy_tariff_usd: site.energy_tariff_usd?.toString() ?? "",
    grid_uptime_pct:   site.grid_uptime_pct?.toString() ?? "",
    renewable_pct:     site.renewable_pct?.toString() ?? "",
    own_generation_mw: site.own_generation_mw?.toString() ?? "",
    substation_dist_km: site.substation_dist_km?.toString() ?? "",
    grid_capacity_mw:  site.grid_capacity_mw?.toString() ?? "",
    // Powerplant / substation
    capacity_mw:       site.capacity_mw?.toString() ?? "",
    energy_type:       site.energy_type ?? "",
    voltage_kv:        site.voltage_kv?.toString() ?? "",
    provinces_served:  (site.provinces_served ?? []).join(", "),
    seasonal_output_pct: site.seasonal_output_pct?.toString() ?? "",
    // Booleans as string
    backup_power:      site.backup_power != null ? (site.backup_power ? "Yes" : "No") : "",
    energy_policy:     site.energy_policy != null ? (site.energy_policy ? "Yes" : "No") : "",
    tenant_metering:   site.tenant_metering != null ? (site.tenant_metering ? "Yes" : "No") : "",
    // Source
    data_source_url:   site.data_source_url ?? "",
    // Connectivity
    port_distance_km:  site.port_distance_km?.toString() ?? "",
    nearest_port:      site.nearest_port ?? "",
    nearest_airport:   site.nearest_airport ?? "",
    border_distance_km: site.border_distance_km?.toString() ?? "",
    nearest_border:    site.nearest_border ?? "",
  });

  const set = (k: string, v: string) => setF(prev => ({ ...prev, [k]: v }));

  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [err,    setErr]    = useState("");

  async function handleSave() {
    setSaving(true); setErr("");
    const parseBool = (v: string) => v === "Yes" ? true : v === "No" ? false : null;
    const parseArr  = (v: string) => v.split(",").map(s => s.trim()).filter(Boolean);
    const parseLines = (v: string) => v.split("\n").map(s => s.trim()).filter(Boolean);

    const patch: Record<string, unknown> = {
      name:              f.name,
      status:            f.status || null,
      size:              f.size || null,
      province:          f.province,
      operator:          f.operator || null,
      year_commissioned: f.year_commissioned ? +f.year_commissioned : null,
      website:           f.website || null,
      phone:             f.phone || null,
      notes:             f.notes || null,
      road:              f.road || null,
      utilities:         f.utilities || null,
      target_industries: f.target_industries ? parseArr(f.target_industries) : null,
      strengths:         f.strengths  ? parseLines(f.strengths)  : null,
      constraints:       f.constraints ? parseLines(f.constraints) : null,
      recommendation:    f.recommendation || null,
      tenant_count:      f.tenant_count   ? +f.tenant_count   : null,
      country_count:     f.country_count  ? +f.country_count  : null,
      employee_count:    f.employee_count ? +f.employee_count : null,
      export_value_usd:  f.export_value_usd ? +f.export_value_usd : null,
      stock_ticker:      f.stock_ticker || null,
      zone_types:        f.zone_types ? parseArr(f.zone_types) : null,
      lease_rate_usd:    f.lease_rate_usd || null,
      plot_size_min_ha:  f.plot_size_min_ha  ? +f.plot_size_min_ha  : null,
      airport_distance_km: f.airport_distance_km ? +f.airport_distance_km : null,
      city_distance_km:  f.city_distance_km ? +f.city_distance_km : null,
      on_site_facilities: f.on_site_facilities ? parseArr(f.on_site_facilities) : null,
      energy_tariff_usd: f.energy_tariff_usd ? +f.energy_tariff_usd : null,
      grid_uptime_pct:   f.grid_uptime_pct   ? +f.grid_uptime_pct   : null,
      renewable_pct:     f.renewable_pct     ? +f.renewable_pct     : null,
      own_generation_mw: f.own_generation_mw ? +f.own_generation_mw : null,
      substation_dist_km: f.substation_dist_km ? +f.substation_dist_km : null,
      grid_capacity_mw:  f.grid_capacity_mw  ? +f.grid_capacity_mw  : null,
      capacity_mw:       f.capacity_mw   ? +f.capacity_mw   : null,
      energy_type:       f.energy_type   || null,
      voltage_kv:        f.voltage_kv    ? +f.voltage_kv    : null,
      provinces_served:  f.provinces_served ? parseArr(f.provinces_served) : null,
      seasonal_output_pct: f.seasonal_output_pct ? +f.seasonal_output_pct : null,
      backup_power:      parseBool(f.backup_power),
      energy_policy:     parseBool(f.energy_policy),
      tenant_metering:   parseBool(f.tenant_metering),
      data_source_url:   f.data_source_url || null,
      port_distance_km:  f.port_distance_km  ? +f.port_distance_km  : null,
      nearest_port:      f.nearest_port      || null,
      nearest_airport:   f.nearest_airport   || null,
      border_distance_km: f.border_distance_km ? +f.border_distance_km : null,
      nearest_border:    f.nearest_border    || null,
      updated_at:        new Date().toISOString(),
    };

    try {
      await updateSiteField(site.id, patch);
      setSaved(true); setTimeout(() => setSaved(false), 2500);
      onSaved({ ...site, ...patch, targetIndustries: patch.target_industries as string[] } as MapSite);
    } catch (e) { setErr(e instanceof Error ? e.message : "Save failed"); }
    setSaving(false);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Editor header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-white/8 shrink-0">
        <button onClick={onClose} className="text-white/30 hover:text-white/70 transition">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-mono text-[9px] text-white/20 uppercase tracking-widest truncate">{site.id}</p>
          <p className="text-[13px] font-semibold text-white truncate leading-tight">{site.name}</p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="shrink-0 px-4 py-1.5 font-mono text-[10px] uppercase tracking-wider rounded-lg transition font-bold"
          style={{ backgroundColor: saved ? "#059669" : "#ff5100", color: "#fff", opacity: saving ? 0.6 : 1 }}>
          {saving ? "…" : saved ? "Saved ✓" : "Save"}
        </button>
      </div>

      {/* Kind badge */}
      <div className="px-5 pt-3 pb-1 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <KindBadge kind={site.kind} />
          <span className="font-mono text-[9px] text-white/25">{site.province}</span>
          <span className="font-mono text-[9px] text-white/15">·</span>
          <span className="font-mono text-[9px] text-white/25 capitalize">{site.layer}</span>
          {site.score != null && (
            <>
              <span className="font-mono text-[9px] text-white/15">·</span>
              <span className="font-mono text-[9px]" style={{ color: site.score >= 70 ? "#34d399" : site.score >= 50 ? "#fbbf24" : "#94a3b8" }}>
                EIP {site.score}/100
              </span>
            </>
          )}
        </div>
        {err && <p className="mt-2 text-[11px] text-red-400 font-mono bg-red-500/8 px-2 py-1.5 rounded">{err}</p>}
      </div>

      {/* Scrollable fields */}
      <div className="flex-1 overflow-y-auto px-5 pb-8 space-y-5 pt-3">

        {/* ── COMMON ── */}
        <Sec label="Basic">
          <Row>
            <FI label="Name"     val={f.name}     set={v => set("name", v)} />
            <FI label="Province" val={f.province}  set={v => set("province", v)} />
          </Row>
          <Row>
            <Select label="Status" val={f.status} set={v => set("status", v)} opts={["", ...STATUS_OPTS]} />
            <FI label="Size"   val={f.size}   set={v => set("size", v)}   hint="800 ha" />
            <FI label="Est."   val={f.year_commissioned} set={v => set("year_commissioned", v)} hint="2010" />
          </Row>
          <Row>
            <FI label="Operator" val={f.operator} set={v => set("operator", v)} />
            <FI label="Phone"    val={f.phone}    set={v => set("phone", v)} hint="+855 …" />
          </Row>
          <FI label="Website" val={f.website} set={v => set("website", v)} hint="https://…" />
        </Sec>

        {/* ── INVESTMENT — SEZ / PARK / FACTORY / LOGISTICS ── */}
        {group === "investment" && <>
          {(site.kind === "sez" || site.kind === "park") && <>
            <Sec label="Tenants & Output">
              <Row>
                <FI label="Tenant Companies" val={f.tenant_count}   set={v => set("tenant_count", v)}   hint="45" />
                <FI label="Countries"        val={f.country_count}  set={v => set("country_count", v)}  hint="12" />
                <FI label="Employees"        val={f.employee_count} set={v => set("employee_count", v)} hint="25000" />
              </Row>
              <Row>
                <FI label="Annual Exports (USD)" val={f.export_value_usd} set={v => set("export_value_usd", v)} hint="1200000000" />
                <FI label="Stock Ticker"         val={f.stock_ticker}     set={v => set("stock_ticker", v)}     hint="CSEZ" />
              </Row>
            </Sec>

            <Sec label="Zone & Lease">
              <Row>
                <FI label="Zone Types (comma)"    val={f.zone_types}    set={v => set("zone_types", v)}    hint="Manufacturing, Logistics" />
                <FI label="Lease Rate (USD/sqm)"  val={f.lease_rate_usd} set={v => set("lease_rate_usd", v)} hint="3.5–6.0" />
              </Row>
              <Row>
                <FI label="Min Plot (ha)" val={f.plot_size_min_ha} set={v => set("plot_size_min_ha", v)} hint="0.5" />
                <FI label="Airport Dist (km)" val={f.airport_distance_km} set={v => set("airport_distance_km", v)} hint="35" />
                <FI label="City Dist (km)"    val={f.city_distance_km}    set={v => set("city_distance_km", v)}    hint="12" />
              </Row>
              <FI label="On-site Facilities (comma)" val={f.on_site_facilities} set={v => set("on_site_facilities", v)} hint="Dormitory, Canteen, Clinic, Bank" />
            </Sec>

            <Sec label="Energy (EIP)">
              <Row>
                <FI label="Tariff (USD/kWh)"  val={f.energy_tariff_usd} set={v => set("energy_tariff_usd", v)} hint="0.09" />
                <FI label="Grid Uptime (%)"   val={f.grid_uptime_pct}   set={v => set("grid_uptime_pct", v)}   hint="99.2" />
                <FI label="Renewable (%)"     val={f.renewable_pct}     set={v => set("renewable_pct", v)}     hint="15" />
              </Row>
              <Row>
                <FI label="Own Gen (MW)"      val={f.own_generation_mw}  set={v => set("own_generation_mw", v)}  hint="5" />
                <FI label="Substation Dist (km)" val={f.substation_dist_km} set={v => set("substation_dist_km", v)} hint="2.5" />
                <FI label="Grid Cap (MW)"     val={f.grid_capacity_mw}   set={v => set("grid_capacity_mw", v)}   hint="50" />
              </Row>
              <Row>
                <Select label="Backup Power"    val={f.backup_power}    set={v => set("backup_power", v)}    opts={["", "Yes", "No"]} />
                <Select label="Energy Policy"   val={f.energy_policy}   set={v => set("energy_policy", v)}   opts={["", "Yes", "No"]} />
                <Select label="Tenant Metering" val={f.tenant_metering} set={v => set("tenant_metering", v)} opts={["", "Yes", "No"]} />
              </Row>
            </Sec>
          </>}

          {site.kind === "factory" && (
            <Sec label="Factory Detail">
              <FI label="Employees" val={f.employee_count} set={v => set("employee_count", v)} hint="500" />
            </Sec>
          )}

          <Sec label="Target Industries">
            <FI label="Industries (comma)" val={f.target_industries} set={v => set("target_industries", v)} hint="Garment, Electronics, Food Processing" />
          </Sec>
        </>}

        {/* ── ENERGY — POWERPLANT / SOLAR ── */}
        {group === "energy-gen" && (
          <Sec label="Power Generation">
            <Row>
              <FI label="Capacity (MW)"    val={f.capacity_mw}   set={v => set("capacity_mw", v)}   hint="246" />
              <FI label="Energy Type"      val={f.energy_type}   set={v => set("energy_type", v)}   hint="Hydro / Solar / Coal" />
              <FI label="Seasonal Out (%)" val={f.seasonal_output_pct} set={v => set("seasonal_output_pct", v)} hint="72" />
            </Row>
            <Row>
              <FI label="Tariff (USD/kWh)" val={f.energy_tariff_usd} set={v => set("energy_tariff_usd", v)} hint="0.075" />
              <FI label="Voltage (kV)"     val={f.voltage_kv}         set={v => set("voltage_kv", v)}         hint="115" />
            </Row>
            <FI label="Provinces Served (comma)" val={f.provinces_served} set={v => set("provinces_served", v)} hint="Phnom Penh, Kandal" />
          </Sec>
        )}

        {/* ── ENERGY — SUBSTATION ── */}
        {group === "energy-grid" && (
          <Sec label="Substation">
            <Row>
              <FI label="Voltage (kV)"   val={f.voltage_kv}       set={v => set("voltage_kv", v)}       hint="115" />
              <FI label="Grid Cap (MW)"  val={f.grid_capacity_mw} set={v => set("grid_capacity_mw", v)} hint="120" />
            </Row>
            <FI label="Provinces Served (comma)" val={f.provinces_served} set={v => set("provinces_served", v)} hint="Phnom Penh, Kandal, Kampong Speu" />
          </Sec>
        )}

        {/* ── INFRASTRUCTURE ── */}
        {group === "infrastructure" && (
          <Sec label="Infrastructure">
            <Row>
              <FI label="Capacity (annual MT or flights)" val={f.capacity_mw} set={v => set("capacity_mw", v)} hint="1500000" />
              <FI label="Operator" val={f.operator} set={v => set("operator", v)} />
            </Row>
          </Sec>
        )}

        {/* ── ENVIRONMENT ── */}
        {group === "environment" && (
          <Sec label="Environment">
            <FI label="Capacity / Scale" val={f.capacity_mw} set={v => set("capacity_mw", v)} hint="500 ha or 200 t/day" />
          </Sec>
        )}

        {/* ── LABOR ── */}
        {group === "labor" && (
          <Sec label="Institution">
            <FI label="Capacity (students / beds)" val={f.employee_count} set={v => set("employee_count", v)} hint="5000" />
          </Sec>
        )}

        {/* ── COMMON LOWER FIELDS ── */}
        <Sec label="Location & Access">
          <Row>
            <FI label="Road / Access" val={f.road}      set={v => set("road", v)} />
            <FI label="Utilities"     val={f.utilities}  set={v => set("utilities", v)} />
          </Row>
          <Row>
            <FI label="Port (km)"     val={f.port_distance_km}     set={v => set("port_distance_km", v)}     hint="35" />
            <FI label="Nearest Port"  val={f.nearest_port}         set={v => set("nearest_port", v)}         hint="Sihanoukville Port" />
          </Row>
          <Row>
            <FI label="Airport (km)"  val={f.airport_distance_km}  set={v => set("airport_distance_km", v)}  hint="25" />
            <FI label="Nearest Airport" val={f.nearest_airport}    set={v => set("nearest_airport", v)}      hint="Techo International" />
          </Row>
          <Row>
            <FI label="Border (km)"   val={f.border_distance_km}   set={v => set("border_distance_km", v)}   hint="12" />
            <FI label="Nearest Border" val={f.nearest_border}      set={v => set("nearest_border", v)}       hint="Bavet/Vietnam" />
          </Row>
        </Sec>

        <Sec label="About / Notes">
          <TA label="Description" val={f.notes} set={v => set("notes", v)} rows={5} hint="Detailed description…" />
        </Sec>

        {(group === "investment" || group === "energy-gen") && (
          <Sec label="Analysis">
            <Row>
              <TA label="Strengths (one per line)"   val={f.strengths}   set={v => set("strengths", v)}   rows={4} hint="Direct Sihanoukville port access&#10;…" />
              <TA label="Constraints (one per line)" val={f.constraints} set={v => set("constraints", v)} rows={4} hint="Flood risk in wet season&#10;…" />
            </Row>
            <TA label="Recommendation" val={f.recommendation} set={v => set("recommendation", v)} rows={2} hint="Best suited for…" />
          </Sec>
        )}

        {/* EIP read-only */}
        {(site.eip_management != null || site.score != null) && (
          <Sec label="EIP Scores (read-only)">
            <div className="grid grid-cols-4 gap-2">
              {[["Mgmt", site.eip_management], ["Env", site.eip_environmental], ["Social", site.eip_social], ["Econ", site.eip_economic]]
                .map(([k, v]) => (
                  <div key={k} className="bg-white/3 rounded-lg px-3 py-2 text-center">
                    <p className="font-mono text-[8px] text-white/25 mb-1">{k}</p>
                    <p className="text-[15px] font-bold text-white/70">{v ?? "—"}<span className="text-[9px] text-white/20">/25</span></p>
                  </div>
                ))}
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {[["Total", site.score != null ? `${site.score}/100` : "—"], ["Tier", site.eip_tier ?? "—"], ["GPS", site.coordVerified ? "✓ Verified" : "Estimated"]]
                .map(([k, v]) => (
                  <div key={k} className="bg-white/3 rounded-lg px-3 py-2">
                    <p className="font-mono text-[8px] text-white/25 mb-1">{k}</p>
                    <p className="text-[12px] text-white/60">{v}</p>
                  </div>
                ))}
            </div>
          </Sec>
        )}

        {/* Boundary */}
        <Sec label="Boundary">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              {site.boundary
                ? <p className="font-mono text-[10px] text-green-400">✓ Boundary set</p>
                : <p className="font-mono text-[10px] text-white/25">No boundary drawn yet</p>
              }
            </div>
            {onStartDraw && (
              <button onClick={onStartDraw} disabled={isDrawing}
                className="px-3 py-1.5 font-mono text-[9px] uppercase tracking-wider border transition rounded"
                style={{
                  borderColor: isDrawing ? "rgba(255,81,0,0.4)" : "#ff5100",
                  color: isDrawing ? "rgba(255,81,0,0.5)" : "#ff5100",
                  backgroundColor: isDrawing ? "rgba(255,81,0,0.05)" : "transparent",
                }}>
                {isDrawing ? "Drawing…" : site.boundary ? "Redraw" : "Draw on map ↗"}
              </button>
            )}
            {site.boundary && onClearBoundary && (
              <button onClick={onClearBoundary}
                className="px-3 py-1.5 font-mono text-[9px] uppercase tracking-wider border border-white/10 text-white/30 hover:text-red-400 hover:border-red-400/30 transition rounded">
                Clear
              </button>
            )}
          </div>
          {site.boundary && (
            <p className="font-mono text-[9px] text-white/20 mt-1">
              {(() => {
                const geo = site.boundary as { type: string; coordinates: number[][][] };
                const ring = geo.type === "MultiPolygon" ? geo.coordinates[0][0] : geo.coordinates[0];
                return `${ring.length - 1} vertices`;
              })()}
            </p>
          )}
        </Sec>

        {/* Source */}
        <Sec label="Data Source">
          <FI label="Source URL" val={f.data_source_url} set={v => set("data_source_url", v)} hint="https://…" />
        </Sec>

        {/* Photos */}
        <ImageManager siteId={site.id} siteName={site.name} website={site.website} images={images} onRefetch={refetchImages} />
      </div>
    </div>
  );
}

function KindBadge({ kind }: { kind: string }) {
  const colors: Record<string, string> = {
    sez: "#ff5100", park: "#f97316", factory: "#fb923c", logistics: "#fbbf24",
    powerplant: "#a855f7", solar: "#c084fc", substation: "#818cf8",
    port: "#facc15", airport: "#fde68a", rail: "#fef08a",
    water_plant: "#38bdf8", hospital: "#34d399", university: "#4ade80",
    tvet: "#86efac", protected: "#22c55e", waste: "#6b7280",
  };
  const color = colors[kind] ?? "#94a3b8";
  return (
    <span className="font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded"
      style={{ backgroundColor: `${color}20`, color, border: `1px solid ${color}40` }}>
      {kind}
    </span>
  );
}

/* ══════════════════════════════════════════════════════════
   OVERVIEW TAB
══════════════════════════════════════════════════════════ */
function OverviewTab({ sites, stats, isLoading }: {
  sites: MapSite[];
  stats: { total: number; operational: number; scored: number; avgScore: number };
  isLoading: boolean;
}) {
  const byKind  = sites.reduce<Record<string, number>>((a, s) => { a[s.kind]  = (a[s.kind]  ?? 0) + 1; return a; }, {});
  const byLayer = sites.reduce<Record<string, number>>((a, s) => { a[s.layer] = (a[s.layer] ?? 0) + 1; return a; }, {});
  const tiers   = { "EIP+": 0, Advanced: 0, Developing: 0, Basic: 0, "—": 0 };
  sites.forEach(s => { const t = (s.eip_tier ?? "—") as keyof typeof tiers; tiers[t] = (tiers[t] ?? 0) + 1; });
  const tierColor: Record<string, string> = { "EIP+": "#34d399", Advanced: "#60a5fa", Developing: "#fbbf24", Basic: "#94a3b8", "—": "#374151" };

  if (isLoading) return <Loader />;
  return (
    <div className="overflow-y-auto h-full p-8">
      <div className="max-w-4xl mx-auto space-y-7">
        <div>
          <h2 className="text-xl font-bold text-white">Platform Overview</h2>
          <p className="font-mono text-[10px] text-white/25 mt-1">Cambodia Industrial Intelligence · {new Date().toLocaleDateString()}</p>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <SC label="Total Sites"    val={stats.total}       sub="all layers"                  color="#ff5100" />
          <SC label="Operational"    val={stats.operational} sub={`${Math.round(stats.operational / stats.total * 100)}% of total`} color="#34d399" />
          <SC label="EIP Scored"     val={stats.scored}      sub={`avg ${stats.avgScore}/100`}  color="#60a5fa" />
          <SC label="Unscored"       val={stats.total - stats.scored} sub="need scoring"         color="#94a3b8" />
        </div>

        <div className="grid grid-cols-2 gap-6">
          <ChartBlock title="By Kind" data={byKind} total={stats.total} color="#ff5100" />
          <ChartBlock title="By Layer" data={byLayer} total={stats.total} color="#60a5fa" />
        </div>

        <div className="bg-white/[0.03] border border-white/8 rounded-xl p-5">
          <p className="font-mono text-[9px] uppercase tracking-widest text-white/25 mb-4">EIP Tier Distribution</p>
          <div className="flex items-end gap-5">
            {Object.entries(tiers).map(([tier, count]) => (
              <div key={tier} className="flex flex-col items-center gap-2 flex-1">
                <span className="font-mono text-[11px]" style={{ color: tierColor[tier] }}>{count}</span>
                <div className="w-full rounded-t" style={{ height: `${Math.max(count / stats.total * 100, 3)}px`, backgroundColor: tierColor[tier], opacity: 0.55 }} />
                <span className="font-mono text-[9px] text-white/25">{tier}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 flex-wrap">
          {[["Map", "/map"], ["Tracker", "/tracker"], ["Dashboard", "/dashboard"]].map(([label, href]) => (
            <a key={label} href={href} target="_blank" rel="noopener noreferrer"
              className="px-4 py-2 rounded-lg border border-white/10 text-white/35 hover:text-white/65 hover:border-white/20 transition font-mono text-[10px] uppercase tracking-wider">
              {label} ↗
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChartBlock({ title, data, total, color }: { title: string; data: Record<string, number>; total: number; color: string }) {
  return (
    <div className="bg-white/[0.03] border border-white/8 rounded-xl p-5">
      <p className="font-mono text-[9px] uppercase tracking-widest text-white/25 mb-4">{title}</p>
      <div className="space-y-2">
        {Object.entries(data).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
          <div key={k} className="flex items-center gap-3">
            <span className="font-mono text-[9px] text-white/40 w-28 truncate capitalize">{k.replace("_", " ")}</span>
            <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${v / total * 100}%`, backgroundColor: color, opacity: 0.65 }} />
            </div>
            <span className="font-mono text-[9px] text-white/35 w-5 text-right">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SC({ label, val, sub, color }: { label: string; val: number; sub?: string; color: string }) {
  return (
    <div className="bg-white/[0.03] border border-white/8 rounded-xl px-5 py-4">
      <p className="font-mono text-[9px] uppercase tracking-widest text-white/25 mb-1.5">{label}</p>
      <p className="text-2xl font-bold" style={{ color }}>{val}</p>
      {sub && <p className="font-mono text-[10px] text-white/20 mt-1">{sub}</p>}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   IMAGES TAB
══════════════════════════════════════════════════════════ */
function ImagesTab({ sites, isLoading }: { sites: MapSite[]; isLoading: boolean }) {
  const [sel, setSel] = useState<MapSite | null>(null);
  const [q, setQ]     = useState("");
  const filtered = sites.filter(s => !q || s.name.toLowerCase().includes(q.toLowerCase()) || s.province.toLowerCase().includes(q.toLowerCase()));
  const { data: images = [], refetch } = useSiteImages(sel?.id ?? null);

  if (isLoading) return <Loader />;
  return (
    <div className="flex h-full">
      <aside className="w-56 shrink-0 border-r border-white/8 flex flex-col">
        <div className="p-3 border-b border-white/8">
          <input type="text" placeholder="Search…" value={q} onChange={e => setQ(e.target.value)}
            className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[12px] text-white placeholder:text-white/20 focus:outline-none focus:border-white/25" />
        </div>
        <div className="overflow-y-auto flex-1">
          {filtered.map(s => (
            <button key={s.id} onClick={() => setSel(s)}
              className="w-full text-left px-3 py-2 border-b border-white/5 transition"
              style={{ background: sel?.id === s.id ? "rgba(255,81,0,0.07)" : undefined }}>
              <p className="text-[11px] text-white/65 truncate">{s.name}</p>
              <p className="font-mono text-[9px] text-white/25 mt-0.5">{s.province} · {s.kind}</p>
            </button>
          ))}
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto bg-[#0a0a0b] p-6">
        {sel ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <KindBadge kind={sel.kind} />
              <p className="text-[14px] font-semibold text-white">{sel.name}</p>
              <p className="font-mono text-[10px] text-white/30">{images.length} photos</p>
            </div>
            <ImageManager siteId={sel.id} siteName={sel.name} website={sel.website} images={images} onRefetch={refetch} />
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-white/15 font-mono text-[11px]">Select a site</div>
        )}
      </main>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   IMAGE MANAGER
══════════════════════════════════════════════════════════ */
function ImageManager({ siteId, siteName, website, images, onRefetch }: {
  siteId: string; siteName: string; website?: string;
  images: SiteImage[]; onRefetch: () => void;
}) {
  const [urlInput,    setUrlInput]    = useState("");
  const [caption,     setCaption]     = useState("");
  const [adding,      setAdding]      = useState(false);
  const [searching,   setSearching]   = useState(false);
  const [importing,   setImporting]   = useState<string | null>(null);
  const [importingAll,setImportingAll]= useState(false);
  const [candidates,  setCandidates]  = useState<string[]>([]);
  const [uploadQueue, setUploadQueue] = useState<{ name: string; done: boolean; err?: string }[]>([]);
  const [dragging,    setDragging]    = useState(false);
  const [err,         setErr]         = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFetchWeb() {
    setSearching(true); setErr(""); setCandidates([]);
    try {
      const imgs = website
        ? await fetchWebImages(website, true)
        : await fetchWebImages(`${siteName} Cambodia industrial`, false);
      if (imgs.length === 0) setErr("No images found — try pasting a URL manually.");
      else setCandidates(imgs);
    } catch (e) { setErr(e instanceof Error ? e.message : "Fetch failed"); }
    setSearching(false);
  }

  async function handleImportCandidate(imgUrl: string) {
    setImporting(imgUrl); setErr("");
    try {
      await importWebImage(siteId, imgUrl, "Official photo", images.length);
      setCandidates(c => c.filter(u => u !== imgUrl));
      onRefetch();
    } catch (e) { setErr(e instanceof Error ? e.message : "Import failed"); }
    setImporting(null);
  }

  async function handleImportAll() {
    setImportingAll(true); setErr("");
    for (const url of [...candidates]) {
      try {
        await importWebImage(siteId, url, "Official photo", images.length);
        setCandidates(c => c.filter(u => u !== url));
        onRefetch();
      } catch { /* skip failed */ }
    }
    setImportingAll(false);
  }

  async function handleAddUrl() {
    if (!urlInput.trim()) return;
    setAdding(true); setErr("");
    try {
      await addSiteImage({ site_id: siteId, url: urlInput.trim(), caption: caption.trim() || undefined, source: "manual", sort_order: images.length });
      setUrlInput(""); setCaption(""); onRefetch();
    } catch (e) { setErr(e instanceof Error ? e.message : "Add failed"); }
    setAdding(false);
  }

  async function uploadFiles(files: FileList | File[]) {
    if (!supabase) return;
    const list = Array.from(files);
    setUploadQueue(list.map(f => ({ name: f.name, done: false })));
    setErr("");
    let order = images.length;
    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      try {
        const blob = await compressImage(file, 1920, 0.88);
        const path = `${siteId}/${Date.now()}-${i}.jpg`;
        const { error } = await supabase.storage.from("site-images").upload(path, blob, { upsert: false, contentType: "image/jpeg" });
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from("site-images").getPublicUrl(path);
        await addSiteImage({ site_id: siteId, url: publicUrl, source: "upload", sort_order: order++ });
        setUploadQueue(q => q.map((item, idx) => idx === i ? { ...item, done: true } : item));
      } catch (e) {
        setUploadQueue(q => q.map((item, idx) => idx === i ? { ...item, done: true, err: "failed" } : item));
      }
    }
    onRefetch();
    setTimeout(() => setUploadQueue([]), 2000);
    if (fileRef.current) fileRef.current.value = "";
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) uploadFiles(e.target.files);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false);
    if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files);
  }

  async function del(id: string) {
    try { await deleteSiteImage(id); onRefetch(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Delete failed"); }
  }

  const isUploading = uploadQueue.some(q => !q.done);

  return (
    <div className="space-y-3">
      {/* Header + fetch button */}
      <div className="flex items-center justify-between">
        <p className="font-mono text-[9px] uppercase tracking-widest text-white/25">Photos · {images.length}</p>
        <button onClick={handleFetchWeb} disabled={searching}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded font-mono text-[9px] uppercase tracking-wide border border-orange-500/30 text-orange-400/80 hover:border-orange-400/60 hover:text-orange-300 transition disabled:opacity-35">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          {searching ? "Searching…" : website ? "Fetch from website" : "Search web photos"}
        </button>
      </div>

      {/* Drag & drop upload zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        className="relative cursor-pointer rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-2 py-7"
        style={{ borderColor: dragging ? "#ff5100" : "rgba(255,255,255,0.1)", background: dragging ? "rgba(255,81,0,0.04)" : "rgba(255,255,255,0.015)" }}>
        <input ref={fileRef} type="file" accept="image/*" multiple onChange={onFileChange} className="hidden" id={`up-${siteId}`} />
        {isUploading ? (
          <div className="space-y-1 w-48">
            {uploadQueue.map((q, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: q.done ? "100%" : "60%", background: q.err ? "#ef4444" : "#ff5100" }} />
                </div>
                <span className="font-mono text-[8px] text-white/30 truncate w-24">{q.err ? "✗" : q.done ? "✓" : "…"} {q.name}</span>
              </div>
            ))}
          </div>
        ) : (
          <>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/20">
              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
            </svg>
            <p className="font-mono text-[10px] text-white/35">Drop photos here or <span className="text-orange-400/70">click to browse</span></p>
            <p className="font-mono text-[8px] text-white/18">Multiple files supported · Auto-compressed to 1920px JPEG</p>
          </>
        )}
      </div>

      {/* Candidate images from web fetch */}
      {candidates.length > 0 && (
        <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[8px] uppercase tracking-widest text-orange-400/70">
              {candidates.length} photos found
            </p>
            <div className="flex gap-2">
              <button onClick={handleImportAll} disabled={importingAll}
                className="px-2.5 py-1 font-mono text-[8px] uppercase tracking-wide rounded border border-orange-400/40 text-orange-400 hover:bg-orange-400/10 transition disabled:opacity-40">
                {importingAll ? "Importing…" : "Import all"}
              </button>
              <button onClick={() => setCandidates([])} className="font-mono text-[8px] text-white/25 hover:text-white/50 transition">Dismiss</button>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {candidates.map(url => (
              <button key={url} onClick={() => handleImportCandidate(url)} disabled={importing === url || importingAll}
                className="relative group aspect-video rounded overflow-hidden bg-white/5 border border-white/10 hover:border-orange-400/50 transition disabled:opacity-50">
                <img src={url} alt="" className="w-full h-full object-cover"
                  onError={e => { (e.currentTarget as HTMLImageElement).parentElement!.style.display = "none"; }} />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                  <span className="font-mono text-[8px] text-white uppercase tracking-wide">
                    {importing === url ? "…" : "+ Import"}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Current photos grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5">
          {images.map((img, i) => (
            <div key={img.id} className="relative group rounded-lg overflow-hidden aspect-video bg-white/5">
              <img src={img.url} alt={img.caption ?? `${i + 1}`} className="w-full h-full object-cover"
                onError={e => { (e.currentTarget as HTMLImageElement).style.opacity = "0.1"; }} />
              <div className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center gap-1 p-1.5">
                {img.caption && <p className="text-[8px] text-white/75 text-center line-clamp-2">{img.caption}</p>}
                <p className="font-mono text-[7px] text-white/30">{img.source}</p>
                <button onClick={() => del(img.id)} className="px-2 py-0.5 text-[8px] font-mono rounded text-red-400 border border-red-400/30 hover:bg-red-400/10 transition">Remove</button>
              </div>
              <div className="absolute top-1 left-1 font-mono text-[7px] px-1 rounded bg-black/60 text-white/35">{i + 1}</div>
            </div>
          ))}
        </div>
      )}

      {err && <p className="text-[10px] text-red-400 font-mono bg-red-500/8 px-2 py-1.5 rounded">{err}</p>}

      {/* Add by URL */}
      <div className="bg-white/[0.025] border border-white/8 rounded-xl p-3 space-y-2">
        <p className="font-mono text-[8px] uppercase tracking-widest text-white/20">Add by URL</p>
        <div className="flex gap-2">
          <input type="url" placeholder="https://…" value={urlInput} onChange={e => setUrlInput(e.target.value)}
            className="flex-1 px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[11px] text-white placeholder:text-white/15 focus:outline-none focus:border-white/22"
            onKeyDown={e => { if (e.key === "Enter") handleAddUrl(); }} />
          <button onClick={handleAddUrl} disabled={adding || !urlInput.trim()}
            className="px-3 py-1.5 font-mono text-[9px] uppercase tracking-wider rounded-lg"
            style={{ backgroundColor: "#ff5100", color: "#fff", opacity: (adding || !urlInput.trim()) ? 0.4 : 1 }}>
            {adding ? "…" : "Add"}
          </button>
        </div>
        <input type="text" placeholder="Caption (optional)" value={caption} onChange={e => setCaption(e.target.value)}
          className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[11px] text-white placeholder:text-white/15 focus:outline-none focus:border-white/22" />
      </div>
    </div>
  );
}

/* ── Shared UI primitives ─────────────────────────────── */
function Sec({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <p className="font-mono text-[8px] uppercase tracking-widest text-white/22 pb-1.5 border-b border-white/6">{label}</p>
      {children}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-2.5">{children}</div>;
}

function FI({ label, val, set, hint }: { label: string; val: string; set: (v: string) => void; hint?: string }) {
  return (
    <div className="flex-1 min-w-0">
      <label className="block font-mono text-[8px] uppercase tracking-widest text-white/28 mb-1">{label}</label>
      <input type="text" value={val} onChange={e => set(e.target.value)} placeholder={hint}
        className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[11px] text-white placeholder:text-white/14 focus:outline-none focus:border-white/22 transition" />
    </div>
  );
}

function TA({ label, val, set, rows = 3, hint }: { label: string; val: string; set: (v: string) => void; rows?: number; hint?: string }) {
  return (
    <div className="flex-1 min-w-0">
      <label className="block font-mono text-[8px] uppercase tracking-widest text-white/28 mb-1">{label}</label>
      <textarea value={val} onChange={e => set(e.target.value)} rows={rows} placeholder={hint}
        className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[11px] text-white placeholder:text-white/14 focus:outline-none focus:border-white/22 resize-y transition" />
    </div>
  );
}

function Select({ label, val, set, opts }: { label: string; val: string; set: (v: string) => void; opts: string[] }) {
  return (
    <div className="flex-1 min-w-0">
      <label className="block font-mono text-[8px] uppercase tracking-widest text-white/28 mb-1">{label}</label>
      <select value={val} onChange={e => set(e.target.value)}
        className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[11px] text-white focus:outline-none focus:border-white/22">
        {opts.map(o => <option key={o} value={o}>{o || "—"}</option>)}
      </select>
    </div>
  );
}

function Loader() {
  return (
    <div className="flex-1 flex items-center justify-center h-full">
      <p className="font-mono text-[10px] text-white/20">Loading…</p>
    </div>
  );
}
