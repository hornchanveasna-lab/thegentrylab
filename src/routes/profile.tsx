import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TopNav } from "@/components/site/TopNav";
import { useSmoothScroll } from "@/components/site/Counter";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
});

const INDUSTRIES = [
  "Manufacturing", "Logistics & Warehousing", "Energy", "Agriculture",
  "Technology", "Real Estate", "Finance & Investment", "Textiles",
  "Food Processing", "Automotive", "Pharmaceuticals", "Construction",
];

interface Profile {
  display_name: string;
  job_title: string;
  company: string;
  industry_focus: string[];
  country: string;
  linkedin_url: string;
  bio: string;
  weekly_digest: boolean;
}

const EMPTY: Profile = {
  display_name: "", job_title: "", company: "",
  industry_focus: [], country: "", linkedin_url: "", bio: "", weekly_digest: true,
};

function Field({
  label, value, onChange, placeholder, textarea, hint,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; textarea?: boolean; hint?: string;
}) {
  const base = "w-full bg-white/[0.03] border border-white/10 px-3 py-2.5 text-[13px] text-white placeholder-white/20 focus:outline-none focus:border-[#ff5100]/50 transition-colors rounded-lg";
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">{label}</span>
      {textarea ? (
        <textarea className={`${base} resize-y min-h-[80px]`} value={value} placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className={base} value={value} placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)} />
      )}
      {hint && <p className="text-[10px] text-white/25 font-mono">{hint}</p>}
    </label>
  );
}

export default function ProfilePage() {
  useSmoothScroll();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { navigate({ to: "/login" }); return; }
    if (!supabase) { setLoading(false); return; }
    supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setProfile({
            display_name: data.display_name ?? user.user_metadata?.full_name ?? "",
            job_title: data.job_title ?? "",
            company: data.company ?? "",
            industry_focus: data.industry_focus ?? [],
            country: data.country ?? "",
            linkedin_url: data.linkedin_url ?? "",
            bio: data.bio ?? "",
            weekly_digest: data.weekly_digest ?? true,
          });
        } else {
          setProfile((p) => ({ ...p, display_name: user.user_metadata?.full_name ?? "" }));
        }
        setLoading(false);
      });
  }, [user, navigate]);

  const toggle = (ind: string) =>
    setProfile((p) => ({
      ...p,
      industry_focus: p.industry_focus.includes(ind)
        ? p.industry_focus.filter((x) => x !== ind)
        : [...p.industry_focus, ind],
    }));

  const save = async () => {
    if (!user || !supabase) return;
    setSaving(true);
    await supabase.from("profiles").upsert({
      user_id: user.id,
      ...profile,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060608] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-[#ff5100] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const avatar = user?.user_metadata?.avatar_url;
  const initials = (profile.display_name || user?.email || "U")[0].toUpperCase();

  return (
    <div className="min-h-screen bg-[#060608] text-white">
      <TopNav />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">

        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
          {avatar ? (
            <img src={avatar} alt="" className="w-14 h-14 rounded-full object-cover ring-2 ring-white/10" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-[#ff5100] flex items-center justify-center text-xl font-bold text-black">
              {initials}
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold tracking-tight">Profile</h1>
            <p className="text-[12px] text-white/40 font-mono mt-0.5">{user?.email}</p>
          </div>
        </div>

        <div className="space-y-6">

          {/* Basic info */}
          <section className="bg-white/[0.025] border border-white/8 rounded-xl p-5 space-y-4">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">Basic Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Display Name" value={profile.display_name} onChange={(v) => setProfile((p) => ({ ...p, display_name: v }))} placeholder="Your name" />
              <Field label="Job Title" value={profile.job_title} onChange={(v) => setProfile((p) => ({ ...p, job_title: v }))} placeholder="e.g. Investment Director" />
              <Field label="Company / Organisation" value={profile.company} onChange={(v) => setProfile((p) => ({ ...p, company: v }))} placeholder="e.g. Mekong Capital" />
              <Field label="Country / Region" value={profile.country} onChange={(v) => setProfile((p) => ({ ...p, country: v }))} placeholder="e.g. Cambodia" />
            </div>
            <Field label="LinkedIn URL" value={profile.linkedin_url} onChange={(v) => setProfile((p) => ({ ...p, linkedin_url: v }))} placeholder="https://linkedin.com/in/yourname" hint="Helps us tailor intelligence relevant to your network" />
            <Field label="About / Bio" value={profile.bio} onChange={(v) => setProfile((p) => ({ ...p, bio: v }))} placeholder="Brief background — investment focus, regions of interest…" textarea />
          </section>

          {/* Industry focus */}
          <section className="bg-white/[0.025] border border-white/8 rounded-xl p-5 space-y-3">
            <div>
              <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">Industry Focus</h2>
              <p className="text-[11px] text-white/30 mt-1">Select all sectors relevant to your work</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {INDUSTRIES.map((ind) => {
                const active = profile.industry_focus.includes(ind);
                return (
                  <button key={ind} onClick={() => toggle(ind)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-mono tracking-wide border transition-all ${
                      active
                        ? "bg-[#ff5100]/15 border-[#ff5100]/40 text-[#ff5100]"
                        : "border-white/10 text-white/40 hover:border-white/25 hover:text-white/60"
                    }`}
                  >
                    {ind}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Save */}
          <div className="flex items-center justify-between pt-1">
            <button onClick={() => navigate({ to: "/settings" })}
              className="font-mono text-[10px] uppercase tracking-widest text-white/30 hover:text-white/60 transition-colors">
              → Settings
            </button>
            <button onClick={save} disabled={saving}
              className="px-6 py-2.5 rounded-full font-mono text-[11px] uppercase tracking-widest transition-all disabled:opacity-50"
              style={{ backgroundColor: saved ? "#22c55e" : "#ff5100", color: "#000" }}
            >
              {saving ? "Saving…" : saved ? "Saved ✓" : "Save Profile"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
