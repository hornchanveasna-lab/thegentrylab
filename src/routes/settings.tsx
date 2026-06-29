import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TopNav } from "@/components/site/TopNav";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

const BASEMAPS = [
  { id: "dark",       label: "Dark"       },
  { id: "satellite",  label: "Satellite"  },
  { id: "light",      label: "Light"      },
  { id: "terrain",    label: "Terrain"    },
];


function Toggle({ on, onChange, label, sub }: { on: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-[13px] text-white/80">{label}</p>
        {sub && <p className="text-[11px] text-white/30 mt-0.5">{sub}</p>}
      </div>
      <button
        onClick={() => onChange(!on)}
        className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${on ? "bg-[#ff5100]" : "bg-white/10"}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : ""}`} />
      </button>
    </div>
  );
}

function RadioGroup<T extends string>({ label, options, value, onChange }: {
  label: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="font-mono text-[10px] uppercase tracking-widest text-white/40">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button key={o.id} onClick={() => onChange(o.id)}
            className={`px-4 py-2 rounded-lg text-[12px] font-mono border transition-all ${
              value === o.id
                ? "border-[#ff5100]/50 bg-[#ff5100]/10 text-[#ff5100]"
                : "border-white/10 text-white/40 hover:border-white/20 hover:text-white/60"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  // UI settings (localStorage)
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    try { return (localStorage.getItem("tgl_theme") as "dark" | "light") || "dark"; } catch { return "dark"; }
  });
const [defaultBasemap, setDefaultBasemap] = useState(() => {
    try { return localStorage.getItem("tgl_default_basemap") || "dark"; } catch { return "dark"; }
  });
  const [clusterSites, setClusterSites] = useState(() => {
    try { return localStorage.getItem("tgl_cluster_sites") !== "false"; } catch { return true; }
  });
  const [showCoords, setShowCoords] = useState(() => {
    try { return localStorage.getItem("tgl_show_coords") === "true"; } catch { return false; }
  });

  // DB setting
  const [weeklyDigest, setWeeklyDigest] = useState(true);
  const [digestLoaded, setDigestLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user) { navigate({ to: "/login" }); return; }
    if (!supabase) { setDigestLoaded(true); return; }
    supabase.from("profiles").select("weekly_digest").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        if (data) setWeeklyDigest(data.weekly_digest ?? true);
        setDigestLoaded(true);
      });
  }, [user, navigate]);

  const applyTheme = (t: "dark" | "light") => {
    setTheme(t);
    document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem("tgl_theme", t); } catch { /* */ }
  };

const save = async () => {
    // Persist all localStorage settings
    try {
      localStorage.setItem("tgl_default_basemap", defaultBasemap);
      localStorage.setItem("tgl_cluster_sites", String(clusterSites));
      localStorage.setItem("tgl_show_coords", String(showCoords));
    } catch { /* */ }

    // Persist DB setting
    if (user && supabase) {
      setSaving(true);
      await supabase.from("profiles").upsert({
        user_id: user.id,
        weekly_digest: weeklyDigest,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      setSaving(false);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-[#060608] text-white">
      <TopNav />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-xl font-bold tracking-tight">Settings</h1>
          <p className="text-[12px] text-white/40 font-mono mt-1">{user?.email}</p>
        </div>

        <div className="space-y-5">

          {/* Appearance */}
          <section className="bg-white/[0.025] border border-white/8 rounded-xl p-5 space-y-5">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">Appearance</h2>
            <RadioGroup label="Theme" options={[{ id: "dark", label: "Dark" }, { id: "light", label: "Light" }]} value={theme} onChange={applyTheme} />
          </section>

          {/* Map defaults */}
          <section className="bg-white/[0.025] border border-white/8 rounded-xl p-5 space-y-5">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">Map Defaults</h2>
            <RadioGroup label="Default Basemap" options={BASEMAPS} value={defaultBasemap} onChange={setDefaultBasemap} />
            <div className="space-y-3 pt-1 border-t border-white/5">
              <Toggle
                on={clusterSites}
                onChange={setClusterSites}
                label="Cluster investment sites"
                sub="Group nearby sites at lower zoom levels"
              />
              <Toggle
                on={showCoords}
                onChange={setShowCoords}
                label="Show coordinates on hover"
                sub="Display lat/lng when hovering the map"
              />
            </div>
          </section>

          {/* Notifications */}
          <section className="bg-white/[0.025] border border-white/8 rounded-xl p-5 space-y-4">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">Notifications</h2>
            {digestLoaded && (
              <Toggle
                on={weeklyDigest}
                onChange={setWeeklyDigest}
                label="Weekly intelligence digest"
                sub="Receive a weekly email summary of new sites, news, and research"
              />
            )}
          </section>

          {/* Account */}
          <section className="bg-white/[0.025] border border-white/8 rounded-xl p-5 space-y-4">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">Account</h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] text-white/80">Connected via Google</p>
                <p className="text-[11px] text-white/30 mt-0.5">{user?.email}</p>
              </div>
              <span className="font-mono text-[9px] uppercase tracking-widest px-2 py-1 rounded-full border border-emerald-400/30 text-emerald-400/70">
                Active
              </span>
            </div>
            <div className="pt-1 border-t border-white/5 flex gap-3 flex-wrap">
              <button onClick={() => navigate({ to: "/profile" })}
                className="font-mono text-[10px] uppercase tracking-widest text-white/40 hover:text-white/70 transition-colors">
                Edit Profile →
              </button>
              <button onClick={() => navigate({ to: "/credits" })}
                className="font-mono text-[10px] uppercase tracking-widest text-white/40 hover:text-white/70 transition-colors">
                Manage Credits →
              </button>
            </div>
          </section>

          {/* Danger zone */}
          <section className="bg-red-950/10 border border-red-900/20 rounded-xl p-5 space-y-4">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-red-400/50">Danger Zone</h2>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[13px] text-white/70">Sign out</p>
                <p className="text-[11px] text-white/30 mt-0.5">Sign out from this device</p>
              </div>
              <button onClick={handleSignOut}
                className="px-4 py-2 rounded-lg border border-white/10 font-mono text-[10px] uppercase tracking-widest text-white/50 hover:border-white/25 hover:text-white/70 transition-all">
                Sign Out
              </button>
            </div>
          </section>

          {/* Save */}
          <div className="flex justify-end pt-1">
            <button onClick={save} disabled={saving}
              className="px-6 py-2.5 rounded-full font-mono text-[11px] uppercase tracking-widest transition-all disabled:opacity-50"
              style={{ backgroundColor: saved ? "#22c55e" : "#ff5100", color: "#000" }}
            >
              {saving ? "Saving…" : saved ? "Saved ✓" : "Save Settings"}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
