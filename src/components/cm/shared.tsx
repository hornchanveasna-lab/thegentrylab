import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useCMProjects, type CMProject, type CMPhotoModule } from "@/lib/cm-data";
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

/* ── Photo lightbox: pinch/double-tap zoom, swipe, filmstrip, save/share/show-in-report ── */

export interface PhotoLightboxItem {
  url: string;
  recordId?: string;
  module?: CMPhotoModule;
  projectId?: string;
  projectName?: string;
  caption?: string | null;
}

export const MODULE_ROUTES: Record<CMPhotoModule, "/cm/site-diary" | "/cm/inspection" | "/cm/punch-list" | "/cm/safety" | "/cm/submittal"> = {
  siteDiary: "/cm/site-diary",
  inspection: "/cm/inspection",
  punchList: "/cm/punch-list",
  safety: "/cm/safety",
  submittal: "/cm/submittal",
};

const PENDING_HIGHLIGHT_KEY = "cm_pending_highlight";

interface PendingHighlight { module: CMPhotoModule; recordId: string; photoUrl?: string }

/** Stashes where a photo lives so the destination module page can jump straight
 *  to it — the "Show in report" counterpart of Telegram's "Show in chat". */
export function setPendingHighlight(module: CMPhotoModule, recordId: string, projectId: string, photoUrl: string) {
  try {
    const pending: PendingHighlight = { module, recordId, photoUrl };
    sessionStorage.setItem(PENDING_HIGHLIGHT_KEY, JSON.stringify(pending));
    localStorage.setItem(LAST_PROJECT_KEY, projectId);
  } catch { /* */ }
}

function consumePendingHighlight(module: CMPhotoModule, recordId: string): PendingHighlight | null {
  try {
    const raw = sessionStorage.getItem(PENDING_HIGHLIGHT_KEY);
    if (!raw) return null;
    const pending = JSON.parse(raw) as PendingHighlight;
    if (pending.module === module && pending.recordId === recordId) {
      sessionStorage.removeItem(PENDING_HIGHLIGHT_KEY);
      return pending;
    }
  } catch { /* */ }
  return null;
}

/** Auto-expands, scrolls to, and briefly flashes a card when the router just
 *  arrived here via a "Show in report" jump from the Photos gallery. */
export function usePendingHighlight(module: CMPhotoModule, recordId: string, onMatch?: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const [flash, setFlash] = useState(false);
  const [matchedPhotoUrl, setMatchedPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    const pending = consumePendingHighlight(module, recordId);
    if (!pending) return;
    onMatch?.();
    setFlash(true);
    setMatchedPhotoUrl(pending.photoUrl ?? null);
    const t1 = setTimeout(() => {
      const target = pending.photoUrl
        ? (document.querySelector(`[data-photo-url="${CSS.escape(pending.photoUrl)}"]`) as HTMLElement | null)
        : null;
      (target ?? ref.current)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
    const t2 = setTimeout(() => setFlash(false), 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ref, flash, matchedPhotoUrl };
}

function ZoomableImage({ src, onSwipeLeft, onSwipeRight }: { src: string; onSwipeLeft: () => void; onSwipeRight: () => void }) {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; startPos: { x: number; y: number }; moved: boolean } | null>(null);
  const pinchRef = useRef<{ dist: number; scale: number } | null>(null);
  const lastTapRef = useRef(0);
  const pointers = useRef(new Map<number, { x: number; y: number }>());

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setDragging(true);
    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      pinchRef.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale };
      dragRef.current = null;
    } else if (pointers.current.size === 1) {
      dragRef.current = { startX: e.clientX, startY: e.clientY, startPos: pos, moved: false };
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinchRef.current) {
      const [a, b] = Array.from(pointers.current.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      setScale(Math.min(4, Math.max(1, pinchRef.current.scale * (dist / pinchRef.current.dist))));
    } else if (dragRef.current && pointers.current.size === 1) {
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragRef.current.moved = true;
      setPos(scale > 1 ? { x: dragRef.current.startPos.x + dx, y: dragRef.current.startPos.y + dy } : { x: dx, y: 0 });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size > 0) return;
    setDragging(false);
    const drag = dragRef.current;
    if (scale <= 1 && drag) {
      if (pos.x < -80) onSwipeLeft();
      else if (pos.x > 80) onSwipeRight();
      setPos({ x: 0, y: 0 });
    }
    if (drag && !drag.moved) {
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        setScale((s) => (s > 1 ? 1 : 2.2));
        setPos({ x: 0, y: 0 });
      }
      lastTapRef.current = now;
    }
    dragRef.current = null;
    pinchRef.current = null;
  };

  return (
    <div className="w-full h-full flex items-center justify-center overflow-hidden touch-none select-none"
      onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp}>
      <img src={src} alt="" draggable={false} className="max-w-full max-h-full object-contain"
        style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`, transition: dragging ? "none" : "transform 0.25s cubic-bezier(0.2,0.8,0.2,1)" }} />
    </div>
  );
}

export function PhotoLightbox({ items, index, onIndexChange, onClose, onShowInReport }: {
  items: PhotoLightboxItem[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
  onShowInReport?: (item: PhotoLightboxItem) => void;
}) {
  const { t } = useCMLang();
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const filmstripRef = useRef<HTMLDivElement>(null);
  const item = items[index];

  useEffect(() => {
    filmstripRef.current?.querySelector<HTMLElement>(`[data-idx="${index}"]`)
      ?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [index]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleSave = async () => {
    setMenuOpen(false);
    try {
      const res = await fetch(item.url);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `photo-${Date.now()}.jpg`;
      a.click();
      URL.revokeObjectURL(objectUrl);
      setToast(t("photos.saved"));
    } catch {
      window.open(item.url, "_blank");
      setToast(t("photos.saveFailed"));
    }
  };

  const handleShare = async () => {
    setMenuOpen(false);
    try {
      if (navigator.share) {
        await navigator.share({ url: item.url });
        return;
      }
      await navigator.clipboard.writeText(item.url);
      setToast(t("photos.linkCopied"));
    } catch {
      setToast(t("photos.shareFailed"));
    }
  };

  const goPrev = () => index > 0 && onIndexChange(index - 1);
  const goNext = () => index < items.length - 1 && onIndexChange(index + 1);

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col">
      <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 bg-gradient-to-b from-black/70 to-transparent">
        <button onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center bg-white/10 text-white/80 hover:text-white shrink-0">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3L5 8l5 5" /></svg>
        </button>
        <div className="text-center min-w-0 px-2 flex-1">
          {item.projectName && <p className="text-[12px] font-bold text-white/90 truncate">{item.projectName}</p>}
          {items.length > 1 && <p className="font-mono text-[10px] text-white/45">{t("photos.counter", { current: String(index + 1), total: String(items.length) })}</p>}
        </div>
        <div className="relative shrink-0">
          <button onClick={() => setMenuOpen((v) => !v)} className="w-9 h-9 rounded-full flex items-center justify-center bg-white/10 text-white/80 hover:text-white">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-11 w-52 rounded-2xl bg-[#181818] border border-white/10 overflow-hidden shadow-xl">
              {onShowInReport && item.recordId && (
                <button onClick={() => { setMenuOpen(false); onShowInReport(item); }}
                  className="w-full text-left px-4 py-3 text-[13px] text-white/85 hover:bg-white/5 border-b border-white/6">
                  {t("photos.showInReport")}
                </button>
              )}
              <button onClick={handleSave} className="w-full text-left px-4 py-3 text-[13px] text-white/85 hover:bg-white/5 border-b border-white/6">{t("photos.save")}</button>
              <button onClick={handleShare} className="w-full text-left px-4 py-3 text-[13px] text-white/85 hover:bg-white/5">{t("photos.share")}</button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 relative min-h-0" onClick={() => setMenuOpen(false)}>
        <ZoomableImage key={item.url} src={item.url} onSwipeLeft={goNext} onSwipeRight={goPrev} />
      </div>

      {item.caption && <p className="px-6 pb-2 text-center text-[12px] text-white/60 truncate shrink-0">{item.caption}</p>}

      {items.length > 1 && (
        <div ref={filmstripRef}
          className="flex gap-2 overflow-x-auto px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1 shrink-0 [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: "none" }}>
          {items.map((it, i) => (
            <button key={`${it.url}-${i}`} data-idx={i} onClick={() => onIndexChange(i)}
              className="shrink-0 w-12 h-12 rounded-lg overflow-hidden transition-opacity"
              style={{ outline: i === index ? "2px solid #ff5100" : "none", opacity: i === index ? 1 : 0.5 }}>
              <img src={it.url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {toast && <div className="absolute bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-white/15 backdrop-blur text-[12px] text-white z-30">{toast}</div>}
    </div>
  );
}
