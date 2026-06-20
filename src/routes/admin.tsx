import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useMapSites, useSiteImages, addSiteImage, deleteSiteImage, updateSiteField } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import type { MapSite } from "@/data/platform";
import type { SiteImage } from "@/lib/data";
import { GentryMark } from "@/components/site/GentryMark";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

const STATUS_OPTIONS = ["Operational", "Under Construction", "Planned"] as const;

function AdminPage() {
  const { user, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const { data: sites = [], isLoading } = useMapSites();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<MapSite | null>(null);
  const [batchStatus, setBatchStatus] = useState<string | null>(null);
  const [batching, setBatching] = useState(false);

  async function handleBatchSatellite() {
    if (batching) return;
    setBatching(true);
    setBatchStatus("Querying sites missing images...");
    try {
      if (!supabase) throw new Error("No supabase client");
      // Get all site_ids that already have images
      const { data: existing } = await supabase
        .from("site_images")
        .select("site_id");
      const withImages = new Set((existing ?? []).map((r: { site_id: string }) => r.site_id));

      const missing = sites.filter((s) => s.lat && s.lng && !withImages.has(s.id));
      setBatchStatus(`Found ${missing.length} sites without photos. Processing...`);

      let done = 0;
      const kindZoom: Record<string, number> = { sez: 14, park: 15 };
      for (const site of missing) {
        const zoom = kindZoom[site.kind] ?? 16;
        try {
          await fetchAndUploadSatellite(site.id, site.lat, site.lng, zoom, "Satellite view", 0);
          await fetchAndUploadSatellite(site.id, site.lat, site.lng, Math.max(zoom - 2, 12), "Area context", 1);
          done++;
          setBatchStatus(`${done}/${missing.length} done — ${site.name}`);
        } catch {
          // skip failures silently, continue batch
        }
      }
      setBatchStatus(`Done — ${done} sites updated.`);
    } catch (e: unknown) {
      setBatchStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
    setBatching(false);
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black gap-4">
        <GentryMark color="#ff5100" size={36} />
        <p className="text-white/60 font-mono text-sm">Admin access required</p>
        <button
          onClick={signInWithGoogle}
          className="px-6 py-3 bg-white text-black font-bold text-sm rounded-lg hover:opacity-90 transition"
        >
          Sign in with Google
        </button>
        <button onClick={() => navigate({ to: "/" })} className="text-white/30 font-mono text-xs hover:text-white/60 transition">
          ← Back to map
        </button>
      </div>
    );
  }

  const filtered = sites.filter((s) =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.province.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#0d0d0e] text-white">
      {/* Top bar */}
      <header className="flex items-center gap-4 px-5 py-3 border-b border-white/10 shrink-0">
        <a href="/map" className="flex items-center gap-2 group">
          <GentryMark color="#ff5100" size={22} />
          <span className="font-mono text-[10px] uppercase tracking-widest text-white/40 group-hover:text-white/70 transition">Map Admin</span>
        </a>
        <div className="flex-1" />
        {batchStatus && (
          <span className="font-mono text-[10px] text-blue-400/70 max-w-xs truncate">{batchStatus}</span>
        )}
        <button
          onClick={handleBatchSatellite}
          disabled={batching || isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-blue-500/30 rounded font-mono text-[9px] uppercase tracking-wider text-blue-400 hover:border-blue-400/60 hover:text-blue-300 transition disabled:opacity-40"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 010 20M2 12h20"/>
          </svg>
          {batching ? "Batching..." : "Satellite all"}
        </button>
        <span className="font-mono text-[10px] text-white/30">{user.email}</span>
        <a href="/map" className="font-mono text-[10px] uppercase tracking-widest text-white/30 hover:text-white/70 transition">← Map</a>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left — site list */}
        <aside className="w-[280px] shrink-0 flex flex-col border-r border-white/10 overflow-hidden">
          <div className="p-3 border-b border-white/10">
            <input
              type="text"
              placeholder="Search sites..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-[12px] text-white placeholder:text-white/25 focus:outline-none focus:border-white/30"
            />
            <p className="mt-2 font-mono text-[9px] text-white/25 text-right">{filtered.length} sites</p>
          </div>
          <div className="overflow-y-auto flex-1">
            {isLoading ? (
              <p className="p-4 font-mono text-[10px] text-white/30">Loading...</p>
            ) : filtered.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelected(s)}
                className="w-full text-left px-3 py-2.5 border-b border-white/5 hover:bg-white/5 transition"
                style={{ backgroundColor: selected?.id === s.id ? "rgba(255,255,255,0.07)" : undefined }}
              >
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: s.status === "Operational" ? "#34d399" : s.status === "Under Construction" ? "#fbbf24" : "#94a3b8" }} />
                  <span className="text-[12px] font-medium text-white truncate">{s.name}</span>
                </div>
                <p className="font-mono text-[9px] text-white/30 mt-0.5 pl-3.5">{s.province} · {s.kind}</p>
              </button>
            ))}
          </div>
        </aside>

        {/* Right — editor */}
        <main className="flex-1 overflow-y-auto">
          {selected ? (
            <SiteEditor
              site={selected}
              key={selected.id}
              onSaved={(updated) => setSelected(updated)}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-white/20">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              <p className="font-mono text-[11px]">Select a site to edit</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

/* ── Site Editor ────────────────────────────────────────── */
function SiteEditor({ site, onSaved }: { site: MapSite; onSaved: (s: MapSite) => void }) {
  const qc = useQueryClient();
  const { data: images = [], refetch: refetchImages } = useSiteImages(site.id);

  const [fields, setFields] = useState({
    name:              site.name,
    status:            site.status ?? "",
    size:              site.size ?? "",
    province:          site.province,
    operator:          site.operator ?? "",
    year_commissioned: site.year_commissioned?.toString() ?? "",
    website:           site.website ?? "",
    phone:             site.phone ?? "",
    notes:             site.notes ?? "",
    target_industries: (site.targetIndustries ?? []).join(", "),
    utilities:         site.utilities ?? "",
    road:              site.road ?? "",
  });

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");

  async function handleSave() {
    setSaving(true); setErr("");
    try {
      const patch: Record<string, unknown> = {
        name:              fields.name,
        status:            fields.status || null,
        size:              fields.size || null,
        province:          fields.province,
        operator:          fields.operator || null,
        year_commissioned: fields.year_commissioned ? parseInt(fields.year_commissioned) : null,
        website:           fields.website || null,
        phone:             fields.phone || null,
        notes:             fields.notes || null,
        target_industries: fields.target_industries
          ? fields.target_industries.split(",").map((s) => s.trim()).filter(Boolean)
          : null,
        utilities: fields.utilities || null,
        road:      fields.road || null,
        updated_at: new Date().toISOString(),
      };
      await updateSiteField(site.id, patch);
      qc.invalidateQueries({ queryKey: ["sites"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved({ ...site, ...patch, targetIndustries: patch.target_industries as string[] } as MapSite);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Save failed");
    }
    setSaving(false);
  }

  function set(k: string, v: string) {
    setFields((f) => ({ ...f, [k]: v }));
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-widest text-white/30 mb-1">{site.id}</p>
          <h2 className="text-[18px] font-bold text-white">{site.name}</h2>
          <p className="font-mono text-[10px] text-white/40 mt-0.5">{site.province} · {site.kind} · {site.layer}</p>
        </div>
        <div className="flex items-center gap-3">
          {site.website && (
            <a href={site.website} target="_blank" rel="noopener noreferrer"
              className="font-mono text-[10px] text-blue-400 hover:text-blue-300 transition">
              Open site ↗
            </a>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 font-mono text-[11px] uppercase tracking-wider rounded transition"
            style={{ backgroundColor: saved ? "#34d399" : "#ff5100", color: "#fff", opacity: saving ? 0.6 : 1 }}
          >
            {saving ? "Saving..." : saved ? "Saved ✓" : "Save"}
          </button>
        </div>
      </div>
      {err && <p className="mb-4 text-[11px] text-red-400 font-mono">{err}</p>}

      {/* Fields */}
      <section className="space-y-4 mb-8">
        <SectionLabel>Basic info</SectionLabel>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Name" value={fields.name} onChange={(v) => set("name", v)} />
          <Field label="Province" value={fields.province} onChange={(v) => set("province", v)} />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block font-mono text-[9px] uppercase tracking-widest text-white/35 mb-1.5">Status</label>
            <select
              value={fields.status}
              onChange={(e) => set("status", e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-[12px] text-white focus:outline-none focus:border-white/30"
            >
              <option value="">—</option>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <Field label="Size" value={fields.size} onChange={(v) => set("size", v)} placeholder="800 ha" />
          <Field label="Year est." value={fields.year_commissioned} onChange={(v) => set("year_commissioned", v)} placeholder="2025" />
        </div>

        <SectionLabel>Contact & web</SectionLabel>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Operator" value={fields.operator} onChange={(v) => set("operator", v)} />
          <Field label="Phone" value={fields.phone} onChange={(v) => set("phone", v)} placeholder="+855 87 811 888" />
        </div>
        <Field label="Website" value={fields.website} onChange={(v) => set("website", v)} placeholder="https://..." />

        <SectionLabel>Location & access</SectionLabel>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Road / access" value={fields.road} onChange={(v) => set("road", v)} />
          <Field label="Utilities" value={fields.utilities} onChange={(v) => set("utilities", v)} />
        </div>

        <SectionLabel>Intelligence</SectionLabel>
        <Field
          label="Target industries (comma-separated)"
          value={fields.target_industries}
          onChange={(v) => set("target_industries", v)}
          placeholder="Manufacturing, Garment, Logistics"
        />
        <div>
          <label className="block font-mono text-[9px] uppercase tracking-widest text-white/35 mb-1.5">Notes / About</label>
          <textarea
            value={fields.notes}
            onChange={(e) => set("notes", e.target.value)}
            rows={6}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-[12px] text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 resize-y"
            placeholder="Detailed description of the site..."
          />
        </div>
      </section>

      {/* Images */}
      <ImageManager siteId={site.id} lat={site.lat} lng={site.lng} images={images} onRefetch={refetchImages} />

      {/* Read-only info */}
      <section className="mt-8 pt-6 border-t border-white/8">
        <SectionLabel>Read-only data</SectionLabel>
        <div className="grid grid-cols-3 gap-3 mt-3">
          {[
            ["EIP Score", site.score != null ? `${site.score}/100` : "—"],
            ["Tier", site.eip_tier ?? "—"],
            ["Port", site.port_distance_km != null ? `${Math.round(site.port_distance_km)} km` : "—"],
            ["Elevation", site.elevation_m != null ? `${site.elevation_m} m` : "—"],
            ["Flood risk", site.flood_risk != null ? (site.flood_risk ? "Yes" : "No") : "—"],
            ["GPS", site.coordVerified ? "Verified" : "Estimated"],
          ].map(([k, v]) => (
            <div key={k} className="bg-white/3 rounded px-3 py-2">
              <p className="font-mono text-[8px] uppercase tracking-widest text-white/25 mb-1">{k}</p>
              <p className="text-[12px] text-white/70">{v}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ── Image compression ──────────────────────────────────── */
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
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error("Canvas compression failed")),
        "image/jpeg", quality
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
    img.src = url;
  });
}

/* ── Satellite fetch via Edge Function ──────────────────── */
const EDGE_URL = "https://mcxfukjopdnouicwacbn.supabase.co/functions/v1/satellite-fetch";

async function fetchAndUploadSatellite(
  siteId: string,
  lat: number,
  lng: number,
  zoom: number,
  caption: string,
  sortOrder: number,
): Promise<string> {
  if (!supabase) throw new Error("No supabase client");

  // 1. Fetch image via edge function proxy (key lives server-side)
  const res = await fetch(`${EDGE_URL}?lat=${lat}&lng=${lng}&zoom=${zoom}&size=800x450`);
  if (!res.ok) throw new Error(`Satellite fetch failed: ${res.status}`);
  const blob = await res.blob();

  // 2. Compress to max 1920px JPEG
  const file = new File([blob], "satellite.jpg", { type: "image/jpeg" });
  const compressed = await compressImage(file, 1920, 0.88);

  // 3. Upload to Supabase Storage
  const path = `satellite/${siteId}/${zoom}-${Date.now()}.jpg`;
  const { error: upErr } = await supabase.storage
    .from("site-images")
    .upload(path, compressed, { upsert: false, contentType: "image/jpeg" });
  if (upErr) throw upErr;

  const { data: { publicUrl } } = supabase.storage.from("site-images").getPublicUrl(path);

  // 4. Insert site_images record
  await addSiteImage({ site_id: siteId, url: publicUrl, caption, source: "google_satellite", sort_order: sortOrder });
  return publicUrl;
}

/* ── Image Manager ──────────────────────────────────────── */
function ImageManager({ siteId, lat, lng, images, onRefetch }: {
  siteId: string;
  lat: number;
  lng: number;
  images: SiteImage[];
  onRefetch: () => void;
}) {
  const [urlInput, setUrlInput] = useState("");
  const [caption, setCaption] = useState("");
  const [adding, setAdding] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fetchingSat, setFetchingSat] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleAddUrl() {
    if (!urlInput.trim()) return;
    setAdding(true); setErr("");
    try {
      await addSiteImage({
        site_id: siteId,
        url: urlInput.trim(),
        caption: caption.trim() || undefined,
        source: "manual",
        sort_order: images.length,
      });
      setUrlInput(""); setCaption("");
      onRefetch();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to add image");
    }
    setAdding(false);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !supabase) return;
    setUploading(true); setErr("");
    try {
      // Compress + resize to max 1920px, JPEG 88% — works for any input size/format
      const compressed = await compressImage(file, 1920, 0.88);
      const path = `${siteId}/${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("site-images")
        .upload(path, compressed, { upsert: false, contentType: "image/jpeg" });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from("site-images").getPublicUrl(path);
      await addSiteImage({
        site_id: siteId,
        url: publicUrl,
        source: "upload",
        sort_order: images.length,
      });
      onRefetch();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleFetchSatellite() {
    if (!lat || !lng) return;
    setFetchingSat(true); setErr("");
    try {
      const kindZoom: Record<string, number> = { sez: 14, park: 15, factory: 16, powerplant: 16, substation: 16 };
      const zoom = kindZoom[siteId.split("-")[0]] ?? 15;
      await fetchAndUploadSatellite(siteId, lat, lng, zoom, "Satellite view", images.length);
      await fetchAndUploadSatellite(siteId, lat, lng, zoom - 2, "Area context", images.length + 1);
      onRefetch();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Satellite fetch failed");
    }
    setFetchingSat(false);
  }

  async function handleDelete(id: string) {
    try {
      await deleteSiteImage(id);
      onRefetch();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <section>
      <SectionLabel>Photos ({images.length})</SectionLabel>

      {/* Current images grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mt-3 mb-4">
          {images.map((img, i) => (
            <div key={img.id} className="relative group rounded overflow-hidden aspect-video bg-white/5">
              <img src={img.url} alt={img.caption ?? `Photo ${i + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = "0.2"; }} />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center gap-2">
                {img.caption && (
                  <p className="text-[9px] text-white/80 text-center px-2 line-clamp-2">{img.caption}</p>
                )}
                <p className="font-mono text-[8px] text-white/40">{img.source}</p>
                <button
                  onClick={() => handleDelete(img.id)}
                  className="px-2 py-1 text-[9px] font-mono uppercase tracking-wider rounded text-red-400 border border-red-400/40 hover:bg-red-400/10 transition"
                >
                  Delete
                </button>
              </div>
              <div className="absolute top-1 left-1 font-mono text-[8px] px-1 rounded"
                style={{ backgroundColor: "rgba(0,0,0,0.6)", color: "rgba(255,255,255,0.5)" }}>
                {i + 1}
              </div>
            </div>
          ))}
        </div>
      )}

      {err && <p className="mb-3 text-[11px] text-red-400 font-mono">{err}</p>}

      {/* Add by URL */}
      <div className="bg-white/3 rounded-lg p-4 space-y-3 border border-white/8">
        <p className="font-mono text-[10px] uppercase tracking-widest text-white/40">Add photo by URL</p>
        <input
          type="url"
          placeholder="https://example.com/photo.jpg"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-[12px] text-white placeholder:text-white/20 focus:outline-none focus:border-white/30"
          onKeyDown={(e) => { if (e.key === "Enter") handleAddUrl(); }}
        />
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Caption (optional)"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded text-[12px] text-white placeholder:text-white/20 focus:outline-none focus:border-white/30"
          />
          <button
            onClick={handleAddUrl}
            disabled={adding || !urlInput.trim()}
            className="px-4 py-2 font-mono text-[10px] uppercase tracking-wider rounded transition"
            style={{ backgroundColor: "#ff5100", color: "#fff", opacity: (adding || !urlInput.trim()) ? 0.5 : 1 }}
          >
            {adding ? "Adding..." : "Add"}
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-white/8" />
          <span className="font-mono text-[9px] text-white/25">or upload file</span>
          <div className="flex-1 h-px bg-white/8" />
        </div>

        {/* File upload */}
        <div className="flex items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleUpload}
            className="hidden"
            id="img-upload"
          />
          <label
            htmlFor="img-upload"
            className="cursor-pointer flex items-center gap-2 px-4 py-2 border border-white/15 rounded font-mono text-[10px] uppercase tracking-wider text-white/50 hover:border-white/35 hover:text-white/80 transition"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            {uploading ? "Uploading..." : "Choose image"}
          </label>
          <p className="font-mono text-[9px] text-white/25">Any size · auto-compressed to 1920px JPEG</p>
        </div>

        {/* Satellite auto-fetch */}
        {lat && lng ? (
          <>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-white/8" />
              <span className="font-mono text-[9px] text-white/25">or fetch from satellite</span>
              <div className="flex-1 h-px bg-white/8" />
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleFetchSatellite}
                disabled={fetchingSat}
                className="flex items-center gap-2 px-4 py-2 border border-blue-500/30 rounded font-mono text-[10px] uppercase tracking-wider text-blue-400 hover:border-blue-400/60 hover:text-blue-300 transition disabled:opacity-40"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 010 20M2 12h20"/>
                </svg>
                {fetchingSat ? "Fetching..." : "Fetch satellite + context"}
              </button>
              <p className="font-mono text-[9px] text-white/25">2 photos · satellite zoom + area overview</p>
            </div>
          </>
        ) : (
          <p className="font-mono text-[9px] text-white/20">No coordinates — cannot fetch satellite</p>
        )}
      </div>
    </section>
  );
}

/* ── Small helpers ──────────────────────────────────────── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[9px] uppercase tracking-widest text-white/30 pt-2 border-t border-white/8">
      {children}
    </p>
  );
}

function Field({ label, value, onChange, placeholder }: {
  label: string; value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block font-mono text-[9px] uppercase tracking-widest text-white/35 mb-1.5">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-[12px] text-white placeholder:text-white/20 focus:outline-none focus:border-white/30"
      />
    </div>
  );
}
