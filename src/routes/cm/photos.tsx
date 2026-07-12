import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useAuthCM } from "@/lib/auth-cm";
import { useCMLang } from "@/lib/cm-i18n";
import { useAllCMPhotos } from "@/lib/cm-data";

export const Route = createFileRoute("/cm/photos")({
  head: () => ({ meta: [{ title: "Photos — Construction Management App" }] }),
  component: CMPhotosPage,
});

function CMPhotosPage() {
  const { user, loading: authLoading, signInWithGoogle } = useAuthCM();
  const { t } = useCMLang();
  const { data: photos, isLoading } = useAllCMPhotos(user?.id);
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [lightbox, setLightbox] = useState<string | null>(null);

  const projects = useMemo(() => {
    const map = new Map<string, string>();
    (photos ?? []).forEach((p) => map.set(p.projectId, p.projectName));
    return Array.from(map.entries());
  }, [photos]);

  const filtered = (photos ?? []).filter((p) => projectFilter === "all" || p.projectId === projectFilter);

  if (authLoading) return <div className="min-h-screen bg-[#0a0a0b]" />;

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-white flex items-center justify-center px-4 font-sans">
        <button onClick={() => signInWithGoogle()}
          className="px-7 py-3 rounded-2xl text-[12px] uppercase tracking-widest text-black font-bold"
          style={{ backgroundColor: "#ff5100" }}>
          {t("common.signInGoogle")}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white font-sans">
      <main className="max-w-md mx-auto w-full px-4 pt-6 pb-16">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/cm" className="w-9 h-9 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 transition-colors shrink-0">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3L5 8l5 5" /></svg>
          </Link>
          <h1 className="text-xl font-extrabold tracking-tight text-white">{t("photos.title")}</h1>
        </div>

        {projects.length > 1 && (
          <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}
            className="w-full bg-white/5 rounded-xl border border-white/10 px-3.5 py-2.5 text-[13px] text-white mb-5 focus:outline-none focus:border-[#ff5100]/60">
            <option value="all">{t("photos.allProjects")}</option>
            {projects.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        )}

        {isLoading && <p className="text-white/30 text-sm">{t("common.loading")}</p>}
        {!isLoading && filtered.length === 0 && <p className="text-white/30 text-sm">{t("photos.noneYet")}</p>}

        <div className="grid grid-cols-3 gap-2.5">
          {filtered.map((p, i) => (
            <button key={`${p.url}-${i}`} onClick={() => setLightbox(p.url)} className="relative aspect-square group">
              <img src={p.url} alt="" className="w-full h-full rounded-2xl object-cover" />
              <span className="absolute bottom-1.5 left-1.5 right-1.5 font-mono text-[8px] px-1.5 py-0.5 rounded-full bg-black/70 text-white/60 truncate text-left">{p.projectName}</span>
            </button>
          ))}
        </div>
      </main>

      {lightbox && (
        <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-6" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className="max-w-full max-h-full rounded-2xl object-contain" />
          <button onClick={() => setLightbox(null)} className="absolute top-5 right-5 w-9 h-9 rounded-full bg-white/10 text-white/70 hover:text-white flex items-center justify-center text-xl">×</button>
        </div>
      )}
    </div>
  );
}
