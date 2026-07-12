import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useCMProjects, type CMProject } from "@/lib/cm-data";
import { useCMLang } from "@/lib/cm-i18n";

export const inputCls = "w-full bg-white/5 rounded-xl border border-white/10 px-3.5 py-2.5 text-[13px] text-white placeholder-white/20 focus:outline-none focus:border-[#ff5100]/60 transition-colors";
export const labelCls = "font-mono text-[10px] uppercase tracking-widest text-white/35";

export function BackButton({ onClick, to }: { onClick?: () => void; to?: string }) {
  const content = (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 3L5 8l5 5" />
    </svg>
  );
  const cls = "w-9 h-9 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 transition-colors shrink-0";
  if (to) return <Link to={to} className={cls}>{content}</Link>;
  return <button onClick={onClick} className={cls}>{content}</button>;
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full sm:max-w-lg bg-[#0d0d0e] rounded-t-3xl sm:rounded-3xl max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 rounded-full bg-white/15 mx-auto mt-3 sm:hidden" />
        <div className="flex items-center justify-between px-6 pt-4 pb-2 sticky top-0 bg-[#0d0d0e] z-10">
          <h2 className="font-extrabold text-base tracking-tight text-white">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function FAB({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="fixed bottom-7 right-6 w-14 h-14 rounded-full flex items-center justify-center text-black shadow-[0_8px_24px_rgba(255,81,0,0.4)] active:scale-95 transition-transform z-30"
      style={{ backgroundColor: "#ff5100" }}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 3v14M3 10h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
    </button>
  );
}

export function PhotoPicker({ photos, setPhotos, disabled }: { photos: File[]; setPhotos: (fn: (p: File[]) => File[]) => void; disabled: boolean }) {
  const { t } = useCMLang();
  return (
    <label className="flex flex-col gap-1.5">
      <span className={labelCls}>{t("common.photos")}</span>
      <input type="file" accept="image/*" multiple disabled={disabled}
        onChange={(e) => setPhotos((p) => [...p, ...Array.from(e.target.files ?? [])])}
        className="text-[12px] text-white/50 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-white/10 file:text-white/60 file:text-[10px] file:font-mono file:uppercase file:tracking-widest" />
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-1">
          {photos.map((f, i) => (
            <div key={i} className="relative w-16 h-16">
              <img src={URL.createObjectURL(f)} alt="" className="w-16 h-16 rounded-xl object-cover" />
              <button type="button" onClick={() => setPhotos((p) => p.filter((_, idx) => idx !== i))}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center">×</button>
            </div>
          ))}
        </div>
      )}
    </label>
  );
}

const LAST_PROJECT_KEY = "cm_last_project_id";

/** Remembers the last project picked across all modules, so returning to any
 *  module (Site Diary, Punch List, Inspection, Safety, Submittal) defaults to
 *  wherever the user was last working — the point is speed, not reselecting. */
export function useSelectedProject(userId: string | undefined) {
  const { data: projects } = useCMProjects(userId);
  const [projectId, setProjectIdState] = useState<string>(() => {
    try { return localStorage.getItem(LAST_PROJECT_KEY) ?? ""; } catch { return ""; }
  });

  useEffect(() => {
    if (!projects || projects.length === 0) return;
    const stillExists = projects.some((p) => p.id === projectId);
    if (!projectId || !stillExists) setProjectIdState(projects[0].id);
  }, [projects, projectId]);

  const setProjectId = (id: string) => {
    setProjectIdState(id);
    try { localStorage.setItem(LAST_PROJECT_KEY, id); } catch { /* */ }
  };

  return { projects: projects ?? [], projectId, setProjectId };
}

export function ProjectPicker({ projects, value, onChange }: { projects: CMProject[]; value: string; onChange: (id: string) => void }) {
  const { t } = useCMLang();
  if (projects.length === 0) {
    return (
      <p className="text-[12px] text-white/40 mb-5">
        {t("common.createProjectFirst")} <Link to="/cm/projects" className="underline" style={{ color: "#ff5100" }}>{t("common.project")}</Link> {t("common.first")}
      </p>
    );
  }
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={`${inputCls} mb-5`}>
      {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
  );
}
