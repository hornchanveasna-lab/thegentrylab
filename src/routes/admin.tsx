import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
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

const ADMIN_EMAIL = "horn.chanveasna@gmail.com";
const EDGE_URL = "https://mcxfukjopdnouicwacbn.supabase.co/functions/v1/satellite-fetch";

/* ── Image compression ──────────────────────────────────────────── */
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

/* ── Satellite fetch via Edge Function ──────────────────────────── */
async function fetchAndUploadSatellite(
  siteId: string, lat: number, lng: number,
  zoom: number, caption: string, sortOrder: number,
): Promise<string> {
  if (!supabase) throw new Error("No supabase client");
  const res = await fetch(`${EDGE_URL}?lat=${lat}&lng=${lng}&zoom=${zoom}&size=800x450`);
  if (!res.ok) throw new Error(`Satellite fetch failed: ${res.status}`);
  const blob = await res.blob();
  const file = new File([blob], "satellite.jpg", { type: "image/jpeg" });
  const compressed = await compressImage(file, 1920, 0.88);
  const path = `satellite/${siteId}/${zoom}-${Date.now()}.jpg`;
  const { error: upErr } = await supabase.storage
    .from("site-images")
    .upload(path, compressed, { upsert: false, contentType: "image/jpeg" });
  if (upErr) throw upErr;
  const { data: { publicUrl } } = supabase.storage.from("site-images").getPublicUrl(path);
  await addSiteImage({ site_id: siteId, url: publicUrl, caption, source: "google_satellite", sort_order: sortOrder });
  return publicUrl;
}

/* ── Login screen ───────────────────────────────────────────────── */
function LoginScreen({ onSignIn, denied }: { onSignIn: () => void; denied: boolean }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#080809]">
      <div className="w-full max-w-sm px-8 py-10 rounded-2xl border border-white/8 bg-white/[0.02] flex flex-col items-center gap-6">
        <GentryMark color="#ff5100" size={40} />
        <div className="text-center">
          <h1 className="text-white font-bold text-lg tracking-tight">Admin Access</h1>
          <p className="text-white/35 text-[12px] font-mono mt-1">The Gentry Lab · Intelligence Platform</p>
        </div>
        {denied && (
          <div className="w-full px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-center">
            <p className="text-red-400 text-[11px] font-mono">Access denied. Authorized accounts only.</p>
          </div>
        )}
        <button
          onClick={onSignIn}
          className="w-full flex items-center justify-center gap-3 px-5 py-3 rounded-xl bg-white text-black font-semibold text-[13px] hover:bg-white/90 transition"
        >
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#4285F4" d="M44.5 20H24v8.5h11.8C34.7 33.9 29.8 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z"/>
            <path fill="#34A853" d="M6.3 14.7l7 5.1C15 16.1 19.1 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 16.3 2 9.7 7.4 6.3 14.7z" opacity=".5"/>
          </svg>
          Sign in with Google
        </button>
        <p className="text-white/20 text-[10px] font-mono text-center">Restricted to authorized accounts</p>
      </div>
    </div>
  );
}

/* ── Main admin page ────────────────────────────────────────────── */
function AdminPage() {
  const { user, signInWithGoogle, signOut } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: sites = [], isLoading } = useMapSites();

  const [denied, setDenied] = useState(false);
  const [tab, setTab] = useState<"overview" | "sites" | "images">("overview");
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState("all");
  const [selected, setSelected] = useState<MapSite | null>(null);

  const [batchStatus, setBatchStatus] = useState<string | null>(null);
  const [batching, setBatching] = useState(false);

  // Enforce whitelist
  useEffect(() => {
    if (user && user.email !== ADMIN_EMAIL) {
      setDenied(true);
      signOut();
    }
  }, [user, signOut]);

  if (!user || denied) {
    return <LoginScreen onSignIn={signInWithGoogle} denied={denied} />;
  }

  async function handleBatchSatellite() {
    if (batching || !supabase) return;
    setBatching(true); setBatchStatus("Scanning sites...");
    try {
      const { data: existing } = await supabase.from("site_images").select("site_id");
      const withImages = new Set((existing ?? []).map((r: { site_id: string }) => r.site_id));
      const missing = sites.filter((s) => s.lat && s.lng && !withImages.has(s.id));
      setBatchStatus(`${missing.length} sites need photos. Starting...`);
      const kindZoom: Record<string, number> = { sez: 14, park: 15 };
      let done = 0;
      for (const site of missing) {
        const zoom = kindZoom[site.kind] ?? 16;
        try {
          await fetchAndUploadSatellite(site.id, site.lat, site.lng, zoom, "Satellite view", 0);
          await fetchAndUploadSatellite(site.id, site.lat, site.lng, Math.max(zoom - 2, 12), "Area context", 1);
          done++;
          setBatchStatus(`${done}/${missing.length} — ${site.name}`);
        } catch { /* skip failures */ }
      }
      qc.invalidateQueries({ queryKey: ["site_images"] });
      setBatchStatus(`Done — ${done} sites updated`);
    } catch (e: unknown) {
      setBatchStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
    setBatching(false);
  }

  const filtered = sites.filter((s) => {
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.province.toLowerCase().includes(search.toLowerCase());
    const matchKind = kindFilter === "all" || s.kind === kindFilter;
    return matchSearch && matchKind;
  });

  const kinds = ["all", ...Array.from(new Set(sites.map((s) => s.kind))).sort()];
  const withScore = sites.filter((s) => s.score != null).length;
  const withImages = sites.filter((s) => s.image_url).length;
  const operational = sites.filter((s) => s.status === "Operational").length;

  return (
    <div className="min-h-screen flex flex-col bg-[#080809] text-white">
      {/* Top nav */}
      <header className="flex items-center gap-4 px-6 py-3 border-b border-white/8 shrink-0 bg-[#080809]/95 backdrop-blur sticky top-0 z-50">
        <a href="/map" className="flex items-center gap-2.5 group">
          <GentryMark color="#ff5100" size={20} />
          <span className="font-mono text-[10px] uppercase tracking-widest text-white/30 group-hover:text-white/60 transition">Admin</span>
        </a>

        {/* Tabs */}
        <div className="flex items-center gap-1 ml-6">
          {(["overview", "sites", "images"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setSelected(null); }}
              className="px-3 py-1.5 rounded-lg font-mono text-[10px] uppercase tracking-wider transition"
              style={{
                background: tab === t ? "rgba(255,81,0,0.12)" : "transparent",
                color: tab === t ? "#ff5100" : "rgba(255,255,255,0.3)",
                border: tab === t ? "1px solid rgba(255,81,0,0.25)" : "1px solid transparent",
              }}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Batch satellite */}
        <div className="flex items-center gap-3">
          {batchStatus && (
            <span className="font-mono text-[10px] text-blue-400/70 max-w-[260px] truncate">{batchStatus}</span>
          )}
          <button
            onClick={handleBatchSatellite}
            disabled={batching || isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-[9px] uppercase tracking-wider transition border"
            style={{
              borderColor: batching ? "rgba(96,165,250,0.2)" : "rgba(96,165,250,0.35)",
              color: batching ? "rgba(96,165,250,0.4)" : "rgba(96,165,250,0.8)",
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 010 20M2 12h20"/>
            </svg>
            {batching ? "Running..." : "Satellite all"}
          </button>
        </div>

        <div className="w-px h-4 bg-white/10" />
        <span className="font-mono text-[10px] text-white/25">{user.email}</span>
        <button onClick={signOut} className="font-mono text-[9px] uppercase tracking-wider text-white/25 hover:text-white/60 transition px-2 py-1 rounded border border-white/8 hover:border-white/20">
          Sign out
        </button>
        <a href="/map" className="font-mono text-[9px] uppercase tracking-wider text-white/25 hover:text-white/60 transition">← Map</a>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex">
        {tab === "overview" && (
          <OverviewTab
            sites={sites}
            withScore={withScore}
            operational={operational}
            withImages={withImages}
            isLoading={isLoading}
          />
        )}

        {tab === "sites" && (
          <>
            {/* Sidebar */}
            <aside className="w-[260px] shrink-0 flex flex-col border-r border-white/8 bg-[#080809]">
              <div className="p-3 space-y-2 border-b border-white/8">
                <input
                  type="text"
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-[12px] text-white placeholder:text-white/20 focus:outline-none focus:border-white/25"
                />
                <div className="flex gap-1 flex-wrap">
                  {kinds.map((k) => (
                    <button
                      key={k}
                      onClick={() => setKindFilter(k)}
                      className="px-2 py-0.5 rounded font-mono text-[9px] uppercase tracking-wide transition"
                      style={{
                        background: kindFilter === k ? "rgba(255,81,0,0.15)" : "rgba(255,255,255,0.04)",
                        color: kindFilter === k ? "#ff5100" : "rgba(255,255,255,0.3)",
                        border: kindFilter === k ? "1px solid rgba(255,81,0,0.3)" : "1px solid transparent",
                      }}
                    >
                      {k}
                    </button>
                  ))}
                </div>
                <p className="font-mono text-[9px] text-white/20 text-right">{filtered.length} sites</p>
              </div>
              <div className="overflow-y-auto flex-1">
                {isLoading ? (
                  <p className="p-4 font-mono text-[10px] text-white/25">Loading...</p>
                ) : filtered.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSelected(s)}
                    className="w-full text-left px-3 py-2.5 border-b border-white/5 transition group"
                    style={{ background: selected?.id === s.id ? "rgba(255,81,0,0.06)" : undefined }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0 transition"
                        style={{ backgroundColor: s.status === "Operational" ? "#34d399" : s.status === "Under Construction" ? "#fbbf24" : "#475569" }} />
                      <span className="text-[12px] font-medium text-white/80 group-hover:text-white truncate transition">{s.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 pl-3.5">
                      <span className="font-mono text-[9px] text-white/25">{s.province}</span>
                      <span className="font-mono text-[9px] text-white/15">·</span>
                      <span className="font-mono text-[9px] text-white/20">{s.kind}</span>
                      {s.score != null && (
                        <>
                          <span className="font-mono text-[9px] text-white/15">·</span>
                          <span className="font-mono text-[9px]" style={{ color: s.score >= 70 ? "#34d399" : s.score >= 50 ? "#fbbf24" : "#94a3b8" }}>
                            {s.score}pt
                          </span>
                        </>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </aside>

            {/* Editor */}
            <main className="flex-1 overflow-y-auto bg-[#0a0a0b]">
              {selected ? (
                <SiteEditor
                  site={selected}
                  key={selected.id}
                  onSaved={(updated) => {
                    setSelected(updated);
                    qc.invalidateQueries({ queryKey: ["sites"] });
                  }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-white/15">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  <p className="font-mono text-[11px]">Select a site to edit</p>
                </div>
              )}
            </main>
          </>
        )}

        {tab === "images" && (
          <ImageBrowserTab sites={sites} isLoading={isLoading} />
        )}
      </div>
    </div>
  );
}

/* ── Overview tab ───────────────────────────────────────────────── */
function OverviewTab({ sites, withScore, operational, withImages, isLoading }: {
  sites: MapSite[]; withScore: number; operational: number; withImages: number; isLoading: boolean;
}) {
  const byKind = sites.reduce<Record<string, number>>((acc, s) => {
    acc[s.kind] = (acc[s.kind] ?? 0) + 1; return acc;
  }, {});

  const byLayer = sites.reduce<Record<string, number>>((acc, s) => {
    acc[s.layer] = (acc[s.layer] ?? 0) + 1; return acc;
  }, {});

  const avgScore = sites.filter((s) => s.score != null).reduce((a, s) => a + s.score!, 0) / (withScore || 1);

  const tierColors: Record<string, string> = {
    "EIP+": "#34d399", "Advanced": "#60a5fa", "Developing": "#fbbf24", "Basic": "#94a3b8",
  };

  if (isLoading) return <div className="flex-1 flex items-center justify-center"><p className="font-mono text-[11px] text-white/20">Loading...</p></div>;

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h2 className="text-[22px] font-bold text-white mb-1">Platform Overview</h2>
          <p className="font-mono text-[11px] text-white/30">The Gentry Lab — Cambodia Industrial Intelligence</p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard label="Total Sites" value={sites.length} sub="across all layers" />
          <StatCard label="Operational" value={operational} sub={`${Math.round(operational / sites.length * 100)}% of total`} color="#34d399" />
          <StatCard label="EIP Scored" value={withScore} sub={`avg ${Math.round(avgScore)}/100`} color="#60a5fa" />
          <StatCard label="With Photos" value={withImages} sub={`${sites.length - withImages} still missing`} color="#fbbf24" />
        </div>

        {/* By kind */}
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white/[0.03] border border-white/8 rounded-xl p-5">
            <p className="font-mono text-[9px] uppercase tracking-widest text-white/30 mb-4">Sites by Kind</p>
            <div className="space-y-2.5">
              {Object.entries(byKind).sort((a, b) => b[1] - a[1]).map(([kind, count]) => (
                <div key={kind} className="flex items-center gap-3">
                  <span className="font-mono text-[10px] text-white/50 w-24 truncate capitalize">{kind}</span>
                  <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${count / sites.length * 100}%`, backgroundColor: "#ff5100", opacity: 0.7 }} />
                  </div>
                  <span className="font-mono text-[10px] text-white/40 w-6 text-right">{count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white/[0.03] border border-white/8 rounded-xl p-5">
            <p className="font-mono text-[9px] uppercase tracking-widest text-white/30 mb-4">Sites by Layer</p>
            <div className="space-y-2.5">
              {Object.entries(byLayer).sort((a, b) => b[1] - a[1]).map(([layer, count]) => (
                <div key={layer} className="flex items-center gap-3">
                  <span className="font-mono text-[10px] text-white/50 w-24 truncate capitalize">{layer}</span>
                  <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${count / sites.length * 100}%`, backgroundColor: "#60a5fa", opacity: 0.7 }} />
                  </div>
                  <span className="font-mono text-[10px] text-white/40 w-6 text-right">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* EIP tiers */}
        <div className="bg-white/[0.03] border border-white/8 rounded-xl p-5">
          <p className="font-mono text-[9px] uppercase tracking-widest text-white/30 mb-4">EIP Tier Distribution</p>
          <div className="flex items-end gap-4">
            {Object.entries(tierColors).map(([tier, color]) => {
              const count = sites.filter((s) => s.eip_tier === tier).length;
              return (
                <div key={tier} className="flex flex-col items-center gap-2 flex-1">
                  <span className="font-mono text-[11px]" style={{ color }}>{count}</span>
                  <div className="w-full rounded-t" style={{ height: `${Math.max(count / sites.length * 120, 4)}px`, backgroundColor: color, opacity: 0.5 }} />
                  <span className="font-mono text-[9px] text-white/30">{tier}</span>
                </div>
              );
            })}
            <div className="flex flex-col items-center gap-2 flex-1">
              <span className="font-mono text-[11px] text-white/30">{sites.filter((s) => !s.eip_tier).length}</span>
              <div className="w-full rounded-t bg-white/8" style={{ height: `${Math.max(sites.filter((s) => !s.eip_tier).length / sites.length * 120, 4)}px` }} />
              <span className="font-mono text-[9px] text-white/20">Unscored</span>
            </div>
          </div>
        </div>

        {/* Quick links */}
        <div className="flex gap-3">
          <a href="/map" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-white/10 text-white/40 hover:text-white/70 hover:border-white/20 transition font-mono text-[10px] uppercase tracking-wider">
            Open Map ↗
          </a>
          <a href="/tracker" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-white/10 text-white/40 hover:text-white/70 hover:border-white/20 transition font-mono text-[10px] uppercase tracking-wider">
            Tracker ↗
          </a>
        </div>
      </div>
    </div>
  );
}

/* ── Site editor ────────────────────────────────────────────────── */
const STATUS_OPTIONS = ["Operational", "Under Construction", "Planned"] as const;

function SiteEditor({ site, onSaved }: { site: MapSite; onSaved: (s: MapSite) => void }) {
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
    strengths:         (site.strengths ?? []).join("\n"),
    constraints:       (site.constraints ?? []).join("\n"),
  });

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");

  function set(k: string, v: string) { setFields((f) => ({ ...f, [k]: v })); }

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
        target_industries: fields.target_industries ? fields.target_industries.split(",").map((s) => s.trim()).filter(Boolean) : null,
        utilities:         fields.utilities || null,
        road:              fields.road || null,
        strengths:         fields.strengths ? fields.strengths.split("\n").map((s) => s.trim()).filter(Boolean) : null,
        constraints:       fields.constraints ? fields.constraints.split("\n").map((s) => s.trim()).filter(Boolean) : null,
        updated_at:        new Date().toISOString(),
      };
      await updateSiteField(site.id, patch);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      onSaved({ ...site, ...patch, targetIndustries: patch.target_industries as string[] } as MapSite);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Save failed");
    }
    setSaving(false);
  }

  return (
    <div className="max-w-2xl mx-auto px-8 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-widest text-white/20 mb-1">{site.id}</p>
          <h2 className="text-[20px] font-bold text-white leading-tight">{site.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="font-mono text-[10px] text-white/30">{site.province}</span>
            <span className="text-white/15">·</span>
            <span className="font-mono text-[10px] text-white/25 capitalize">{site.kind}</span>
            <span className="text-white/15">·</span>
            <span className="font-mono text-[10px] text-white/20 capitalize">{site.layer}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {site.website && (
            <a href={site.website} target="_blank" rel="noopener noreferrer"
              className="font-mono text-[10px] text-blue-400/70 hover:text-blue-300 transition">↗ Site</a>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 font-mono text-[11px] uppercase tracking-wider rounded-lg transition font-bold"
            style={{ backgroundColor: saved ? "#059669" : "#ff5100", color: "#fff", opacity: saving ? 0.6 : 1 }}
          >
            {saving ? "Saving..." : saved ? "Saved ✓" : "Save"}
          </button>
        </div>
      </div>
      {err && <p className="mb-5 text-[11px] text-red-400 font-mono bg-red-500/10 px-3 py-2 rounded-lg">{err}</p>}

      <div className="space-y-6">
        {/* Basic */}
        <Section label="Basic Info">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Name" value={fields.name} onChange={(v) => set("name", v)} />
            <Field label="Province" value={fields.province} onChange={(v) => set("province", v)} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-widest text-white/30 mb-1.5">Status</label>
              <select
                value={fields.status}
                onChange={(e) => set("status", e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-[12px] text-white focus:outline-none focus:border-white/25"
              >
                <option value="">—</option>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <Field label="Size" value={fields.size} onChange={(v) => set("size", v)} placeholder="800 ha" />
            <Field label="Year Est." value={fields.year_commissioned} onChange={(v) => set("year_commissioned", v)} placeholder="2010" />
          </div>
        </Section>

        {/* Contact */}
        <Section label="Contact & Web">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Operator" value={fields.operator} onChange={(v) => set("operator", v)} />
            <Field label="Phone" value={fields.phone} onChange={(v) => set("phone", v)} placeholder="+855 ..." />
          </div>
          <Field label="Website" value={fields.website} onChange={(v) => set("website", v)} placeholder="https://..." />
        </Section>

        {/* Location */}
        <Section label="Location & Access">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Road / Access" value={fields.road} onChange={(v) => set("road", v)} />
            <Field label="Utilities" value={fields.utilities} onChange={(v) => set("utilities", v)} />
          </div>
        </Section>

        {/* Intelligence */}
        <Section label="Intelligence">
          <Field label="Target Industries (comma-separated)" value={fields.target_industries} onChange={(v) => set("target_industries", v)} placeholder="Manufacturing, Garment, Logistics" />
          <TextArea label="Notes / About" value={fields.notes} onChange={(v) => set("notes", v)} rows={5} placeholder="Site description..." />
          <div className="grid grid-cols-2 gap-4">
            <TextArea label="Strengths (one per line)" value={fields.strengths} onChange={(v) => set("strengths", v)} rows={4} placeholder="Strategic coastal location near port&#10;Strong SEZ incentive package..." />
            <TextArea label="Constraints (one per line)" value={fields.constraints} onChange={(v) => set("constraints", v)} rows={4} placeholder="Limited skilled workforce&#10;Flood risk in wet season..." />
          </div>
        </Section>

        {/* Read-only */}
        <Section label="EIP Scores (read-only)">
          <div className="grid grid-cols-4 gap-3">
            {[
              ["Management", site.eip_management],
              ["Environmental", site.eip_environmental],
              ["Social", site.eip_social],
              ["Economic", site.eip_economic],
            ].map(([k, v]) => (
              <div key={k} className="bg-white/3 rounded-lg px-3 py-2.5">
                <p className="font-mono text-[8px] uppercase tracking-widest text-white/20 mb-1">{k}</p>
                <p className="text-[14px] font-bold text-white/70">{v ?? "—"}<span className="text-[10px] text-white/25">/25</span></p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-3 mt-3">
            {[
              ["Total Score", site.score != null ? `${site.score}/100` : "—"],
              ["Tier", site.eip_tier ?? "—"],
              ["Port Dist", site.port_distance_km != null ? `${Math.round(site.port_distance_km)} km` : "—"],
              ["GPS", site.coordVerified ? "✓ Verified" : "Estimated"],
            ].map(([k, v]) => (
              <div key={k} className="bg-white/3 rounded-lg px-3 py-2.5">
                <p className="font-mono text-[8px] uppercase tracking-widest text-white/20 mb-1">{k}</p>
                <p className="text-[12px] text-white/60">{v}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Images */}
        <ImageManager siteId={site.id} lat={site.lat} lng={site.lng} images={images} onRefetch={refetchImages} />
      </div>
    </div>
  );
}

/* ── Image browser tab ──────────────────────────────────────────── */
function ImageBrowserTab({ sites, isLoading }: { sites: MapSite[]; isLoading: boolean }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filtered = sites.filter((s) => !search || s.name.toLowerCase().includes(search.toLowerCase()));

  if (isLoading) return <div className="flex-1 flex items-center justify-center"><p className="font-mono text-[11px] text-white/20">Loading...</p></div>;

  return (
    <div className="flex-1 overflow-hidden flex">
      <aside className="w-[220px] shrink-0 border-r border-white/8 flex flex-col">
        <div className="p-3 border-b border-white/8">
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-[12px] text-white placeholder:text-white/20 focus:outline-none focus:border-white/25"
          />
        </div>
        <div className="overflow-y-auto flex-1">
          {filtered.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedId(s.id)}
              className="w-full text-left px-3 py-2 border-b border-white/5 transition"
              style={{ background: selectedId === s.id ? "rgba(255,81,0,0.06)" : undefined }}
            >
              <p className="text-[11px] text-white/70 truncate">{s.name}</p>
              <p className="font-mono text-[9px] text-white/25 mt-0.5">{s.province}</p>
            </button>
          ))}
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto bg-[#0a0a0b]">
        {selectedId ? (
          <ImagePanel siteId={selectedId} lat={sites.find((s) => s.id === selectedId)?.lat ?? 0} lng={sites.find((s) => s.id === selectedId)?.lng ?? 0} />
        ) : (
          <div className="flex items-center justify-center h-full text-white/15 font-mono text-[11px]">Select a site</div>
        )}
      </main>
    </div>
  );
}

function ImagePanel({ siteId, lat, lng }: { siteId: string; lat: number; lng: number }) {
  const { data: images = [], refetch } = useSiteImages(siteId);
  return (
    <div className="p-6">
      <p className="font-mono text-[9px] uppercase tracking-widest text-white/25 mb-4">{siteId} · {images.length} photos</p>
      <ImageManager siteId={siteId} lat={lat} lng={lng} images={images} onRefetch={refetch} />
    </div>
  );
}

/* ── Image manager ──────────────────────────────────────────────── */
function ImageManager({ siteId, lat, lng, images, onRefetch }: {
  siteId: string; lat: number; lng: number;
  images: SiteImage[]; onRefetch: () => void;
}) {
  const [urlInput, setUrlInput] = useState("");
  const [caption, setCaption] = useState("");
  const [adding, setAdding] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fetchingSat, setFetchingSat] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFetchSatellite() {
    if (!lat || !lng) return;
    setFetchingSat(true); setErr("");
    try {
      const kindZoom: Record<string, number> = { sez: 14, park: 15 };
      const zoom = kindZoom[siteId.split("-")[0]] ?? 16;
      await fetchAndUploadSatellite(siteId, lat, lng, zoom, "Satellite view", images.length);
      await fetchAndUploadSatellite(siteId, lat, lng, Math.max(zoom - 2, 12), "Area context", images.length + 1);
      onRefetch();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Satellite fetch failed");
    }
    setFetchingSat(false);
  }

  async function handleAddUrl() {
    if (!urlInput.trim()) return;
    setAdding(true); setErr("");
    try {
      await addSiteImage({ site_id: siteId, url: urlInput.trim(), caption: caption.trim() || undefined, source: "manual", sort_order: images.length });
      setUrlInput(""); setCaption(""); onRefetch();
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
      const compressed = await compressImage(file, 1920, 0.88);
      const path = `${siteId}/${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage.from("site-images").upload(path, compressed, { upsert: false, contentType: "image/jpeg" });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from("site-images").getPublicUrl(path);
      await addSiteImage({ site_id: siteId, url: publicUrl, source: "upload", sort_order: images.length });
      onRefetch();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleDelete(id: string) {
    try { await deleteSiteImage(id); onRefetch(); }
    catch (e: unknown) { setErr(e instanceof Error ? e.message : "Delete failed"); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[9px] uppercase tracking-widest text-white/30">Photos · {images.length}</p>
        {lat && lng && (
          <button
            onClick={handleFetchSatellite}
            disabled={fetchingSat}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-[9px] uppercase tracking-wider transition border border-blue-500/25 text-blue-400/70 hover:border-blue-400/50 hover:text-blue-300 disabled:opacity-40"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 010 20M2 12h20"/>
            </svg>
            {fetchingSat ? "Fetching..." : "Satellite"}
          </button>
        )}
      </div>

      {/* Image grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {images.map((img, i) => (
            <div key={img.id} className="relative group rounded-lg overflow-hidden aspect-video bg-white/5">
              <img src={img.url} alt={img.caption ?? `Photo ${i + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = "0.15"; }} />
              <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center gap-1.5 p-2">
                {img.caption && <p className="text-[9px] text-white/80 text-center line-clamp-2">{img.caption}</p>}
                <p className="font-mono text-[8px] text-white/35">{img.source}</p>
                <button onClick={() => handleDelete(img.id)}
                  className="px-2 py-0.5 text-[9px] font-mono rounded text-red-400 border border-red-400/30 hover:bg-red-400/10 transition">
                  Remove
                </button>
              </div>
              <div className="absolute top-1 left-1 font-mono text-[8px] px-1 rounded bg-black/60 text-white/40">{i + 1}</div>
            </div>
          ))}
        </div>
      )}

      {err && <p className="text-[11px] text-red-400 font-mono bg-red-500/10 px-3 py-2 rounded-lg">{err}</p>}

      {/* Add controls */}
      <div className="bg-white/[0.025] border border-white/8 rounded-xl p-4 space-y-3">
        <p className="font-mono text-[9px] uppercase tracking-widest text-white/25">Add Photo</p>
        <input
          type="url" placeholder="https://example.com/photo.jpg"
          value={urlInput} onChange={(e) => setUrlInput(e.target.value)}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-[12px] text-white placeholder:text-white/15 focus:outline-none focus:border-white/25"
          onKeyDown={(e) => { if (e.key === "Enter") handleAddUrl(); }}
        />
        <div className="flex gap-2">
          <input
            type="text" placeholder="Caption (optional)"
            value={caption} onChange={(e) => setCaption(e.target.value)}
            className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-[12px] text-white placeholder:text-white/15 focus:outline-none focus:border-white/25"
          />
          <button onClick={handleAddUrl} disabled={adding || !urlInput.trim()}
            className="px-4 py-2 font-mono text-[10px] uppercase tracking-wider rounded-lg transition"
            style={{ backgroundColor: "#ff5100", color: "#fff", opacity: (adding || !urlInput.trim()) ? 0.4 : 1 }}>
            {adding ? "..." : "Add"}
          </button>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <div className="flex-1 h-px bg-white/8" />
          <span className="font-mono text-[9px] text-white/20">or upload file</span>
          <div className="flex-1 h-px bg-white/8" />
        </div>
        <div className="flex items-center gap-3">
          <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" id={`img-upload-${siteId}`} />
          <label htmlFor={`img-upload-${siteId}`}
            className="cursor-pointer flex items-center gap-2 px-3 py-2 border border-white/12 rounded-lg font-mono text-[10px] uppercase tracking-wider text-white/40 hover:border-white/25 hover:text-white/70 transition">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            {uploading ? "Uploading..." : "Choose image"}
          </label>
          <p className="font-mono text-[9px] text-white/20">Auto-compressed to 1920px JPEG</p>
        </div>
      </div>
    </div>
  );
}

/* ── Small helpers ──────────────────────────────────────────────── */
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="font-mono text-[9px] uppercase tracking-widest text-white/25 pb-2 border-b border-white/6">{label}</p>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block font-mono text-[9px] uppercase tracking-widest text-white/30 mb-1.5">{label}</label>
      <input
        type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-[12px] text-white placeholder:text-white/15 focus:outline-none focus:border-white/25 transition"
      />
    </div>
  );
}

function TextArea({ label, value, onChange, rows = 4, placeholder }: { label: string; value: string; onChange: (v: string) => void; rows?: number; placeholder?: string }) {
  return (
    <div>
      <label className="block font-mono text-[9px] uppercase tracking-widest text-white/30 mb-1.5">{label}</label>
      <textarea
        value={value} onChange={(e) => onChange(e.target.value)} rows={rows} placeholder={placeholder}
        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-[12px] text-white placeholder:text-white/15 focus:outline-none focus:border-white/25 resize-y transition"
      />
    </div>
  );
}

function StatCard({ label, value, sub, color = "#ff5100" }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-white/[0.03] border border-white/8 rounded-xl px-5 py-4">
      <p className="font-mono text-[9px] uppercase tracking-widest text-white/30 mb-2">{label}</p>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      {sub && <p className="font-mono text-[10px] text-white/25 mt-1">{sub}</p>}
    </div>
  );
}
