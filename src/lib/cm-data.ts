/**
 * Data layer for the Construction Management App (/cm/*), backed by its own
 * Supabase project (own auth.users, standard auth.uid()-based RLS — no shared
 * account system, no custom JWT claims).
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabaseCM } from "./supabase-cm";

const STALE_TIME = 60 * 1000;

export type ProjectStatus = "Planning" | "Active" | "On Hold" | "Completed";
export type TaskStatus = "To Do" | "In Progress" | "Blocked" | "Done";
export type TaskPriority = "Low" | "Medium" | "High";

export interface CMProject {
  id: string;
  owner_id: string;
  name: string;
  client: string | null;
  address: string | null;
  location: string | null;
  location_map_url: string | null;
  status: ProjectStatus;
  start_date: string | null;
  target_end_date: string | null;
  description: string | null;
  client_logo_url: string | null;
  project_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface CMProjectConsultant {
  id: string;
  project_id: string;
  owner_id: string;
  name: string;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface CMManpowerRow {
  trade: string;
  company: string | null;
  count: number;
}

export interface CMDeliveryRow {
  material: string;
  quantity: string;
  unit: string | null;
  supplier: string | null;
  /** Links this delivery to a cm_boq_items row so quantities can be tallied
   *  against the BOQ's planned quantity; null for free-text "Custom" rows. */
  boq_item_id: string | null;
}

export type CMVisitorKind = "visitor" | "instruction";

export interface CMVisitorRow {
  name: string;
  organization: string | null;
  kind: CMVisitorKind;
  note: string;
}

export type CMDelayCause = "Weather" | "Material" | "Labor" | "Other";

export interface CMDelayRow {
  cause: CMDelayCause;
  description: string;
  hours_lost: number;
}

export interface CMDailyLog {
  id: string;
  project_id: string;
  owner_id: string;
  log_date: string;
  weather: string | null;
  temperature_c: number | null;
  progress_pct: number | null;
  activities: string | null;
  materials_used: string | null;
  equipment_used: string | null;
  issues: string | null;
  notes: string | null;
  manpower: CMManpowerRow[];
  deliveries: CMDeliveryRow[];
  visitors: CMVisitorRow[];
  delays: CMDelayRow[];
  photos: string[];
  photo_thumbs: string[];
  created_at: string;
  updated_at: string;
}

export interface CMTask {
  id: string;
  project_id: string;
  owner_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: string | null;
  due_date: string | null;
  sort_order: number;
  photos: string[];
  photo_thumbs: string[];
  created_at: string;
  updated_at: string;
}

function db() {
  if (!supabaseCM) throw new Error("Construction Management App's Supabase client is not configured");
  return supabaseCM;
}

/* ── Projects ───────────────────────────────────────────── */
export function useCMProjects(userId: string | undefined) {
  return useQuery<CMProject[]>({
    queryKey: ["cm_projects", userId],
    enabled: !!userId && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db().from("cm_projects").select("*").order("updated_at", { ascending: false });
      if (error) throw error;
      return data as CMProject[];
    },
    staleTime: STALE_TIME,
  });
}

export function useCMProject(projectId: string | undefined) {
  return useQuery<CMProject | null>({
    queryKey: ["cm_project", projectId],
    enabled: !!projectId && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db().from("cm_projects").select("*").eq("id", projectId).maybeSingle();
      if (error) throw error;
      return data as CMProject | null;
    },
    staleTime: STALE_TIME,
  });
}

export async function createCMProject(
  ownerId: string,
  input: Pick<CMProject, "name"> & Partial<Pick<CMProject, "client" | "address" | "location" | "location_map_url" | "status" | "start_date" | "target_end_date" | "description" | "project_code">>,
) {
  const { data, error } = await db().from("cm_projects").insert({ owner_id: ownerId, ...input }).select().single();
  if (error) throw error;
  return data as CMProject;
}

export async function updateCMProject(id: string, patch: Partial<CMProject>) {
  const { error } = await db().from("cm_projects").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteCMProject(id: string) {
  const { error } = await db().from("cm_projects").delete().eq("id", id);
  if (error) throw error;
}

/* ── Daily logs (site diary) ───────────────────────────────── */
export function useCMDailyLogs(projectId: string | undefined) {
  return useQuery<CMDailyLog[]>({
    queryKey: ["cm_daily_logs", projectId],
    enabled: !!projectId && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db().from("cm_daily_logs").select("*").eq("project_id", projectId)
        .order("log_date", { ascending: false }).order("created_at", { ascending: false });
      if (error) throw error;
      return data as CMDailyLog[];
    },
    staleTime: STALE_TIME,
  });
}

export async function createCMDailyLog(
  ownerId: string,
  projectId: string,
  input: Partial<Omit<CMDailyLog, "id" | "project_id" | "owner_id" | "created_at" | "updated_at">>,
) {
  const { data, error } = await db().from("cm_daily_logs").insert({ owner_id: ownerId, project_id: projectId, ...input }).select().single();
  if (error) throw error;
  return data as CMDailyLog;
}

export async function updateCMDailyLog(id: string, patch: Partial<CMDailyLog>) {
  const { error } = await db().from("cm_daily_logs").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteCMDailyLog(id: string) {
  const { error } = await db().from("cm_daily_logs").delete().eq("id", id);
  if (error) throw error;
}

/** Returns the existing diary entry for a project+day if one exists,
 *  otherwise creates it. Used so photos captured from the global Photos
 *  flow land in that day's real Site Diary entry instead of a new one.
 *  Two concurrent submissions for the same project+day could each pass the
 *  lookup and insert their own row — acceptable for a single-crew tool. */
export async function findOrCreateCMDailyLog(
  ownerId: string,
  projectId: string,
  logDate: string,
  createDefaults?: Partial<Omit<CMDailyLog, "id" | "project_id" | "owner_id" | "log_date" | "created_at" | "updated_at">>,
): Promise<CMDailyLog> {
  const { data: existing, error } = await db().from("cm_daily_logs").select("*")
    .eq("project_id", projectId).eq("log_date", logDate)
    .order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (error) throw error;
  if (existing) return existing as CMDailyLog;
  return createCMDailyLog(ownerId, projectId, { log_date: logDate, ...createDefaults });
}

/** Merges any project+day that has more than one `cm_daily_logs` row (a
 *  leftover from before `findOrCreateCMDailyLog` existed, or a race between
 *  two concurrent submissions) into a single entry, then deletes the
 *  extras. Array fields concatenate, narrative text fields join with a
 *  separator, and single-value fields keep the most recent non-null value.
 *  Returns whether anything was merged, so callers know to re-fetch. */
export async function mergeDuplicateCMDailyLogs(logs: CMDailyLog[]): Promise<boolean> {
  const groups = new Map<string, CMDailyLog[]>();
  for (const log of logs) {
    const key = `${log.project_id}|${log.log_date}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(log);
  }

  let mergedAny = false;
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => a.created_at.localeCompare(b.created_at));
    const [primary, ...dupes] = sorted;
    const latestNonNull = <T,>(pick: (l: CMDailyLog) => T | null) => [...sorted].reverse().map(pick).find((v) => v != null) ?? null;
    const joinText = (pick: (l: CMDailyLog) => string | null) => sorted.map(pick).filter((v): v is string => !!v).join("\n---\n") || null;

    await updateCMDailyLog(primary.id, {
      photos: sorted.flatMap((l) => l.photos),
      photo_thumbs: sorted.flatMap((l) => l.photo_thumbs),
      manpower: sorted.flatMap((l) => l.manpower),
      deliveries: sorted.flatMap((l) => l.deliveries),
      visitors: sorted.flatMap((l) => l.visitors),
      delays: sorted.flatMap((l) => l.delays),
      weather: latestNonNull((l) => l.weather),
      temperature_c: latestNonNull((l) => l.temperature_c),
      progress_pct: latestNonNull((l) => l.progress_pct),
      activities: joinText((l) => l.activities),
      materials_used: joinText((l) => l.materials_used),
      equipment_used: joinText((l) => l.equipment_used),
      issues: joinText((l) => l.issues),
      notes: joinText((l) => l.notes),
    });
    await Promise.all(dupes.map((d) => deleteCMDailyLog(d.id)));
    mergedAny = true;
  }
  return mergedAny;
}

export interface CMDailyLogWithProject extends CMDailyLog {
  projectName: string;
}

/** Site Diary's "All Projects" filter — same cross-project pattern as
 *  useAllCMPhotos, joined with the project name for display since multiple
 *  projects' entries now interleave by date. */
export function useAllCMDailyLogs(userId: string | undefined) {
  return useQuery<CMDailyLogWithProject[]>({
    queryKey: ["cm_all_daily_logs", userId],
    enabled: !!userId && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db().from("cm_daily_logs").select("*, cm_projects(name)")
        .order("log_date", { ascending: false }).order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as (CMDailyLog & { cm_projects: { name: string } | null })[]).map((r) => {
        const { cm_projects, ...log } = r;
        return { ...log, projectName: cm_projects?.name ?? "Untitled project" };
      });
    },
    staleTime: STALE_TIME,
  });
}

/* ── Tasks ──────────────────────────────────────────────── */
async function fetchCMTasksList(projectId: string): Promise<CMTask[]> {
  const { data, error } = await db().from("cm_tasks").select("*").eq("project_id", projectId).order("sort_order").order("created_at");
  if (error) throw error;
  return data as CMTask[];
}

export function useCMTasks(projectId: string | undefined) {
  return useQuery<CMTask[]>({
    queryKey: ["cm_tasks", projectId],
    enabled: !!projectId && !!supabaseCM,
    queryFn: () => fetchCMTasksList(projectId!),
    staleTime: STALE_TIME,
  });
}

export async function createCMTask(
  ownerId: string,
  projectId: string,
  input: Pick<CMTask, "title"> & Partial<Pick<CMTask, "description" | "status" | "priority" | "assignee" | "due_date">>,
) {
  const { data, error } = await db().from("cm_tasks").insert({ owner_id: ownerId, project_id: projectId, ...input }).select().single();
  if (error) throw error;
  return data as CMTask;
}

export async function updateCMTask(id: string, patch: Partial<CMTask>) {
  const { error } = await db().from("cm_tasks").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteCMTask(id: string) {
  const { error } = await db().from("cm_tasks").delete().eq("id", id);
  if (error) throw error;
}

/* ── Photo upload (site-media bucket) ──────────────────── */
export async function uploadCMPhoto(ownerId: string, projectId: string, file: File): Promise<string> {
  const client = db();
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${ownerId}/${projectId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await client.storage.from("site-media").upload(path, file, { upsert: false });
  if (error) throw error;
  const { data } = await client.storage.from("site-media").createSignedUrl(path, 60 * 60 * 24 * 365);
  return data?.signedUrl ?? path;
}

/** Decodes a File into an <img> via a transient object URL. Safe to revoke the
 *  URL as soon as the image has decoded — the bitmap stays usable afterward. */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const el = new Image();
    el.onload = () => { URL.revokeObjectURL(url); resolve(el); };
    el.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Failed to read photo")); };
    el.src = url;
  });
}

/** Loads a logo (or any other already-hosted image) for drawing onto a canvas.
 *  Needs crossOrigin set since these come from Supabase Storage on a different
 *  origin than the app — otherwise the canvas is "tainted" and toBlob() throws.
 *  Returns null on failure so one broken logo never blocks the whole stamp. */
function loadExternalImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const el = new Image();
    el.crossOrigin = "anonymous";
    el.onload = () => resolve(el);
    el.onerror = () => resolve(null);
    el.src = url;
  });
}

/** Pads an arbitrary (usually non-square) company logo onto a white square
 *  canvas, sized for use as a home-screen/favicon icon — Android and iOS
 *  both expect roughly-square icons, and most uploaded logos are wide
 *  badges rather than square marks. Returns null if the logo can't be
 *  loaded (e.g. blocked by CORS), so the caller can just keep the default
 *  app icon instead. */
export async function makeSquareIconDataUrl(logoUrl: string, size = 512): Promise<string | null> {
  const img = await loadExternalImage(logoUrl);
  if (!img) return null;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  const pad = size * 0.14;
  const maxDim = size - pad * 2;
  const scale = Math.min(maxDim / img.naturalWidth, maxDim / img.naturalHeight);
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
  return canvas.toDataURL("image/png");
}

export interface StampPhotoOptions {
  showCompanyLogo: boolean;
  showProjectInfo: boolean;
  showConsultantLogos: boolean;
  monotoneLogos: boolean;
  timestamp: boolean;
  companyLogoUrl?: string | null;
  clientLogoUrl?: string | null;
  consultantLogoUrls?: string[];
  projectName?: string | null;
  projectCode?: string | null;
  location?: string | null;
}

function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const n = parseInt(clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Recolors a logo to one flat tint, tolerating both asset styles brands
 *  actually hand us: true transparent PNGs (where the existing alpha
 *  channel already is the silhouette) and flattened logos with an opaque
 *  white/light background (common for JPEGs and "flattened" PNG exports).
 *  For the latter, `source-in` on the untouched alpha channel would just
 *  paint the whole opaque box solid — so when the image carries no real
 *  transparency, alpha is instead derived from luminance (near-white
 *  background -> transparent, dark ink -> opaque), turning the ink itself
 *  into the silhouette. Runs the pixel analysis at the logo's own native
 *  resolution rather than the (often much smaller) target stamp size —
 *  thin knockout strokes and small icon marks get anti-aliased into a
 *  featureless blur if downsampled before the alpha mask is derived, so
 *  the caller's `drawImage` does that scaling instead, after tinting. */
function monotoneTint(logo: HTMLImageElement, w: number, h: number, color: string): HTMLCanvasElement {
  const srcW = logo.naturalWidth || w;
  const srcH = logo.naturalHeight || h;
  const canvas = document.createElement("canvas");
  canvas.width = srcW;
  canvas.height = srcH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.drawImage(logo, 0, 0, srcW, srcH);
  const img = ctx.getImageData(0, 0, srcW, srcH);
  const data = img.data;
  const totalPixels = data.length / 4;
  let transparentCount = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 200) transparentCount++;
  }
  const hasRealAlpha = transparentCount > totalPixels * 0.02;
  const [tr, tg, tb] = hexToRgb(color);
  for (let i = 0; i < data.length; i += 4) {
    const alpha = hasRealAlpha
      ? data[i + 3]
      : Math.round(255 - (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]));
    data[i] = tr;
    data[i + 1] = tg;
    data[i + 2] = tb;
    data[i + 3] = alpha;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** Runs a logo URL through the exact same monotone algorithm used when
 *  burning the photo stamp, so a settings-page "preview monotone" toggle
 *  shows the real result instead of a rough CSS-filter approximation.
 *  Returns null if the image can't be loaded (e.g. CORS). */
export async function monotonePreviewUrl(logoUrl: string, color = "#ffffff"): Promise<string | null> {
  const img = await loadExternalImage(logoUrl);
  if (!img) return null;
  const canvas = monotoneTint(img, img.naturalWidth, img.naturalHeight, color);
  return canvas.toDataURL("image/png");
}

/** Draws a logo clipped to its own rounded-rect — softening its corners
 *  directly instead of putting a backing chip or outline behind it. When
 *  `monotone` is set, the logo's silhouette is kept but every opaque pixel
 *  is recolored to a single flat tint — matching the stamp's own text
 *  color for a consistent, single-ink, premium look instead of a row of
 *  differently-colored brand marks. */
function drawRoundedLogo(ctx: CanvasRenderingContext2D, logo: HTMLImageElement, x: number, y: number, w: number, h: number, monotone?: string) {
  ctx.save();
  roundedRectPath(ctx, x, y, w, h, Math.min(w, h) * 0.16);
  ctx.clip();
  if (monotone) {
    ctx.drawImage(monotoneTint(logo, w, h, monotone), x, y, w, h);
  } else {
    ctx.drawImage(logo, x, y, w, h);
  }
  ctx.restore();
}

/** Burns project identification onto a photo before it's uploaded, so the
 *  record stays legible even if it's later exported or shared outside the
 *  app. Layout: company logo alone top-right; project name/code/location
 *  text bottom-left; client logo stacked directly above the centered row
 *  of consultant logos, bottom-middle; capture date/time bottom-right.
 *  Every logo is clipped to its own rounded corners with nothing drawn
 *  behind or around it. Text keeps a soft drop-shadow for legibility over
 *  any background. Keeps the original pixel dimensions — this is the
 *  full-quality photo that gets stored, not a thumbnail. */
export async function stampPhoto(file: File, opts: StampPhotoOptions): Promise<File> {
  if (!opts.showCompanyLogo && !opts.showProjectInfo && !opts.showConsultantLogos && !opts.timestamp) return file;
  const img = await loadImage(file);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0);

  const scale = Math.max(1, canvas.width / 1000);
  const pad = 16 * scale;
  const monotoneColor = opts.monotoneLogos ? "#ffffff" : undefined;

  const fillShadowedText = (text: string, x: number, y: number) => {
    ctx.shadowColor = "rgba(0,0,0,0.9)";
    ctx.shadowBlur = 6 * scale;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1 * scale;
    ctx.fillText(text, x, y);
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  };

  if (opts.showCompanyLogo && opts.companyLogoUrl) {
    // ── top-right: company logo, alone, rounded corners ──
    const companyLogo = await loadExternalImage(opts.companyLogoUrl);
    if (companyLogo) {
      const h = 52 * scale;
      const w = (companyLogo.naturalWidth / companyLogo.naturalHeight) * h;
      drawRoundedLogo(ctx, companyLogo, canvas.width - pad - w, pad, w, h, monotoneColor);
    }
  }

  if (opts.showProjectInfo) {
    // ── bottom-left: project name/code/location text ──
    const lines: { text: string; fontSize: number; weight: number }[] = [];
    if (opts.projectName) lines.push({ text: opts.projectName, fontSize: 21 * scale, weight: 700 });
    if (opts.projectCode) lines.push({ text: opts.projectCode, fontSize: 14 * scale, weight: 500 });
    if (opts.location) lines.push({ text: opts.location, fontSize: 14 * scale, weight: 500 });

    const lineGap = 4 * scale;
    const textBlockH = lines.reduce((s, l) => s + l.fontSize, 0) + lineGap * Math.max(0, lines.length - 1);
    if (lines.length > 0) {
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      let ly = canvas.height - pad - textBlockH;
      for (const l of lines) {
        ctx.font = `${l.weight} ${l.fontSize}px sans-serif`;
        ctx.fillStyle = "#fff";
        fillShadowedText(l.text, pad, ly);
        ly += l.fontSize + lineGap;
      }
    }
  }

  {
    // ── bottom-middle, stacked: client logo directly above the centered
    // row of consultant logos, so the two read as one grouped mark ──
    const clientLogo = opts.showProjectInfo && opts.clientLogoUrl ? await loadExternalImage(opts.clientLogoUrl) : null;
    const consultantLogos = opts.showConsultantLogos
      ? (await Promise.all((opts.consultantLogoUrls ?? []).map(loadExternalImage))).filter((l): l is HTMLImageElement => !!l)
      : [];

    let stackBottomY = canvas.height - pad;
    if (consultantLogos.length > 0) {
      const maxRowWidth = canvas.width * 0.5;
      const gap = 8 * scale;
      let logoH = 36 * scale;
      const widthAt = (h: number) => consultantLogos.reduce((sum, l) => sum + (l.naturalWidth / l.naturalHeight) * h, 0) + gap * (consultantLogos.length - 1);
      while (widthAt(logoH) > maxRowWidth && logoH > 16 * scale) logoH -= 2 * scale;
      let x = (canvas.width - widthAt(logoH)) / 2;
      const y = stackBottomY - logoH;
      for (const logo of consultantLogos) {
        const w = (logo.naturalWidth / logo.naturalHeight) * logoH;
        drawRoundedLogo(ctx, logo, x, y, w, logoH, monotoneColor);
        x += w + gap;
      }
      stackBottomY = y - 10 * scale;
    }
    if (clientLogo) {
      const h = 48 * scale;
      const w = (clientLogo.naturalWidth / clientLogo.naturalHeight) * h;
      const x = (canvas.width - w) / 2;
      drawRoundedLogo(ctx, clientLogo, x, stackBottomY - h, w, h, monotoneColor);
    }
  }

  // ── bottom-right: capture date/time, e.g. "Sun-12-Jul-2026" / "02:11:45 PM" ──
  if (opts.timestamp) {
    const now = new Date();
    const dateStr = `${now.toLocaleDateString("en-US", { weekday: "short" })}-${String(now.getDate()).padStart(2, "0")}-${now.toLocaleDateString("en-US", { month: "short" })}-${now.getFullYear()}`;
    let hours = now.getHours();
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    const timeStr = `${String(hours).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")} ${ampm}`;

    const dateFontSize = 16 * scale;
    const timeFontSize = 14 * scale;
    const lineGap = 3 * scale;

    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    let y = canvas.height - pad;
    ctx.font = `500 ${timeFontSize}px sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    fillShadowedText(timeStr, canvas.width - pad, y);
    y -= timeFontSize + lineGap;
    ctx.font = `700 ${dateFontSize}px sans-serif`;
    ctx.fillStyle = "#fff";
    fillShadowedText(dateStr, canvas.width - pad, y);
  }

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
}

/** A small, fast-loading rendition for grid/calendar/filmstrip tiles — the
 *  original full-quality file is uploaded separately and untouched, so this
 *  only affects how quickly thumbnails load, never the stored photo quality. */
export async function makeThumbnail(file: File, maxDim = 480): Promise<File> {
  const img = await loadImage(file);
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.72));
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.\w+$/, "-thumb.jpg"), { type: "image/jpeg" });
}

/** Uploads the file at full quality, plus a small companion thumbnail, in parallel. */
export async function uploadCMPhotoWithThumb(ownerId: string, projectId: string, file: File): Promise<{ url: string; thumbUrl: string }> {
  const thumbFile = await makeThumbnail(file);
  const [url, thumbUrl] = await Promise.all([
    uploadCMPhoto(ownerId, projectId, file),
    uploadCMPhoto(ownerId, projectId, thumbFile),
  ]);
  return { url, thumbUrl };
}

const PHOTO_MODULE_TABLE: Record<CMPhotoModule, string> = {
  siteDiary: "cm_daily_logs",
  inspection: "cm_inspections",
  punchList: "cm_tasks",
  safety: "cm_safety_records",
  submittal: "cm_submittals",
};

function storagePathFromSignedUrl(url: string): string | null {
  try {
    const marker = "/object/sign/site-media/";
    const idx = new URL(url).pathname.indexOf(marker);
    return idx === -1 ? null : decodeURIComponent(new URL(url).pathname.slice(idx + marker.length));
  } catch {
    return null;
  }
}

/** Removes one photo from its record's photos/photo_thumbs arrays — the
 *  long-press delete action in the Photos gallery — and best-effort deletes
 *  the underlying storage objects so removed photos don't keep costing
 *  storage. */
export async function deleteCMPhoto(module: CMPhotoModule, recordId: string, url: string) {
  const table = PHOTO_MODULE_TABLE[module];
  const client = db();
  const { data, error } = await client.from(table).select("photos, photo_thumbs").eq("id", recordId).single();
  if (error) throw error;
  const row = data as { photos: string[]; photo_thumbs: string[] };
  const idx = row.photos.indexOf(url);
  const thumbUrl = idx !== -1 ? row.photo_thumbs?.[idx] : undefined;
  const photos = row.photos.filter((_, i) => i !== idx);
  const photo_thumbs = (row.photo_thumbs ?? []).filter((_, i) => i !== idx);

  const { error: updErr } = await client.from(table).update({ photos, photo_thumbs }).eq("id", recordId);
  if (updErr) throw updErr;

  const paths = [storagePathFromSignedUrl(url), thumbUrl ? storagePathFromSignedUrl(thumbUrl) : null].filter((p): p is string => !!p);
  if (paths.length > 0) {
    try { await client.storage.from("site-media").remove(paths); } catch { /* best-effort cleanup, non-fatal */ }
  }
}

export async function uploadCMLogo(ownerId: string, projectId: string, file: File): Promise<string> {
  const client = db();
  const ext = file.name.split(".").pop() || "png";
  const path = `${ownerId}/${projectId}/logo-${Date.now()}.${ext}`;
  const { error } = await client.storage.from("site-media").upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = await client.storage.from("site-media").createSignedUrl(path, 60 * 60 * 24 * 365);
  return data?.signedUrl ?? path;
}

/* ── Project consultants (a project can have several: structural, MEP, etc.) ── */
export function useCMProjectConsultants(projectId: string | undefined) {
  return useQuery<CMProjectConsultant[]>({
    queryKey: ["cm_project_consultants", projectId],
    enabled: !!projectId && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db().from("cm_project_consultants").select("*").eq("project_id", projectId).order("created_at");
      if (error) throw error;
      return data as CMProjectConsultant[];
    },
    staleTime: STALE_TIME,
  });
}

export async function createCMProjectConsultant(ownerId: string, projectId: string, name: string) {
  const { data, error } = await db().from("cm_project_consultants").insert({ owner_id: ownerId, project_id: projectId, name }).select().single();
  if (error) throw error;
  return data as CMProjectConsultant;
}

export async function updateCMProjectConsultant(id: string, patch: Partial<Pick<CMProjectConsultant, "name" | "logo_url">>) {
  const { error } = await db().from("cm_project_consultants").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteCMProjectConsultant(id: string) {
  const { error } = await db().from("cm_project_consultants").delete().eq("id", id);
  if (error) throw error;
}

/* ── Photos across all of a user's projects (global gallery) ─ */
export type CMPhotoModule = "siteDiary" | "inspection" | "punchList" | "safety" | "submittal";

export interface CMPhotoWithContext {
  url: string;
  thumbUrl: string;
  date: string;
  createdAt: string;
  projectId: string;
  projectName: string;
  module: CMPhotoModule;
  caption: string | null;
  recordId: string;
}

type PhotoRow = { id: string; photos: string[]; photo_thumbs: string[]; project_id: string; created_at: string; cm_projects: { name: string } | null };

/** Reverses each record's own photo array so the most-recently-appended
 *  photo (the last one pushed onto `photos`) sorts first within that
 *  record, then tags every photo with the record's `created_at` so the
 *  cross-record merge below can order strictly by real timestamp instead
 *  of the day-only date string used for grouping/labels. */
function photoRowsToContext<T extends PhotoRow>(rows: T[], module: CMPhotoModule, date: (r: T) => string, caption: (r: T) => string | null): CMPhotoWithContext[] {
  return rows.flatMap((r) => {
    const photos = [...r.photos].reverse();
    const thumbs = [...r.photo_thumbs].reverse();
    return photos.map((url, i) => ({
      url, thumbUrl: thumbs[i] || url, module, date: date(r), createdAt: r.created_at, projectId: r.project_id, recordId: r.id,
      projectName: r.cm_projects?.name ?? "Untitled project", caption: caption(r),
    }));
  });
}

export function useAllCMPhotos(userId: string | undefined) {
  return useQuery<CMPhotoWithContext[]>({
    queryKey: ["cm_all_photos", userId],
    enabled: !!userId && !!supabaseCM,
    queryFn: async () => {
      const client = db();
      const [logs, inspections, safety, tasks, submittals] = await Promise.all([
        client.from("cm_daily_logs").select("id, photos, photo_thumbs, log_date, activities, project_id, created_at, cm_projects(name)"),
        client.from("cm_inspections").select("id, photos, photo_thumbs, inspection_date, title, project_id, created_at, cm_projects(name)"),
        client.from("cm_safety_records").select("id, photos, photo_thumbs, record_date, title, project_id, created_at, cm_projects(name)"),
        client.from("cm_tasks").select("id, photos, photo_thumbs, created_at, title, project_id, cm_projects(name)"),
        client.from("cm_submittals").select("id, photos, photo_thumbs, submitted_date, created_at, title, project_id, cm_projects(name)"),
      ]);
      for (const r of [logs, inspections, safety, tasks, submittals]) if (r.error) throw r.error;

      const all = [
        ...photoRowsToContext(logs.data as unknown as (PhotoRow & { log_date: string; activities: string | null })[],
          "siteDiary", (r) => r.log_date, (r) => r.activities?.slice(0, 60) || null),
        ...photoRowsToContext(inspections.data as unknown as (PhotoRow & { inspection_date: string; title: string })[],
          "inspection", (r) => r.inspection_date, (r) => r.title),
        ...photoRowsToContext(safety.data as unknown as (PhotoRow & { record_date: string; title: string })[],
          "safety", (r) => r.record_date, (r) => r.title),
        ...photoRowsToContext(tasks.data as unknown as (PhotoRow & { created_at: string; title: string })[],
          "punchList", (r) => r.created_at.slice(0, 10), (r) => r.title),
        ...photoRowsToContext(submittals.data as unknown as (PhotoRow & { submitted_date: string | null; created_at: string; title: string })[],
          "submittal", (r) => r.submitted_date ?? r.created_at.slice(0, 10), (r) => r.title),
      ];
      return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    staleTime: STALE_TIME,
  });
}

/* ── Equipment (per project) ───────────────────────────── */
export type EquipmentStatus = "Operational" | "Maintenance" | "Out of Service";

export interface CMEquipment {
  id: string;
  project_id: string;
  owner_id: string;
  name: string;
  type: string | null;
  quantity: number;
  status: EquipmentStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useCMEquipment(projectId: string | undefined) {
  return useQuery<CMEquipment[]>({
    queryKey: ["cm_equipment", projectId],
    enabled: !!projectId && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db().from("cm_equipment").select("*").eq("project_id", projectId).order("created_at");
      if (error) throw error;
      return data as CMEquipment[];
    },
    staleTime: STALE_TIME,
  });
}

export async function createCMEquipment(
  ownerId: string,
  projectId: string,
  input: Pick<CMEquipment, "name"> & Partial<Pick<CMEquipment, "type" | "quantity" | "status" | "notes">>,
) {
  const { data, error } = await db().from("cm_equipment").insert({ owner_id: ownerId, project_id: projectId, ...input }).select().single();
  if (error) throw error;
  return data as CMEquipment;
}

export async function updateCMEquipment(id: string, patch: Partial<CMEquipment>) {
  const { error } = await db().from("cm_equipment").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteCMEquipment(id: string) {
  const { error } = await db().from("cm_equipment").delete().eq("id", id);
  if (error) throw error;
}

/* ── Checklist items (per project) ─────────────────────── */
export interface CMChecklistItem {
  id: string;
  project_id: string;
  owner_id: string;
  title: string;
  category: string | null;
  is_done: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export function useCMChecklistItems(projectId: string | undefined) {
  return useQuery<CMChecklistItem[]>({
    queryKey: ["cm_checklist_items", projectId],
    enabled: !!projectId && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db().from("cm_checklist_items").select("*").eq("project_id", projectId).order("sort_order").order("created_at");
      if (error) throw error;
      return data as CMChecklistItem[];
    },
    staleTime: STALE_TIME,
  });
}

export async function createCMChecklistItem(
  ownerId: string,
  projectId: string,
  input: Pick<CMChecklistItem, "title"> & Partial<Pick<CMChecklistItem, "category">>,
) {
  const { data, error } = await db().from("cm_checklist_items").insert({ owner_id: ownerId, project_id: projectId, ...input }).select().single();
  if (error) throw error;
  return data as CMChecklistItem;
}

export async function updateCMChecklistItem(id: string, patch: Partial<CMChecklistItem>) {
  const { error } = await db().from("cm_checklist_items").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteCMChecklistItem(id: string) {
  const { error } = await db().from("cm_checklist_items").delete().eq("id", id);
  if (error) throw error;
}

/* ── Directory contacts (global, cross-project) ────────── */
export interface CMDirectoryContact {
  id: string;
  owner_id: string;
  name: string;
  company: string | null;
  trade: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useCMDirectoryContacts(userId: string | undefined) {
  return useQuery<CMDirectoryContact[]>({
    queryKey: ["cm_directory_contacts", userId],
    enabled: !!userId && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db().from("cm_directory_contacts").select("*").order("name");
      if (error) throw error;
      return data as CMDirectoryContact[];
    },
    staleTime: STALE_TIME,
  });
}

export async function createCMDirectoryContact(
  ownerId: string,
  input: Pick<CMDirectoryContact, "name"> & Partial<Pick<CMDirectoryContact, "company" | "trade" | "phone" | "email" | "notes">>,
) {
  const { data, error } = await db().from("cm_directory_contacts").insert({ owner_id: ownerId, ...input }).select().single();
  if (error) throw error;
  return data as CMDirectoryContact;
}

export async function updateCMDirectoryContact(id: string, patch: Partial<CMDirectoryContact>) {
  const { error } = await db().from("cm_directory_contacts").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteCMDirectoryContact(id: string) {
  const { error } = await db().from("cm_directory_contacts").delete().eq("id", id);
  if (error) throw error;
}

/* ── Project subcontractors (directory contact ↔ project) ─ */
export interface CMProjectSubcontractor {
  id: string;
  project_id: string;
  owner_id: string;
  contact_id: string;
  role_on_project: string | null;
  created_at: string;
  contact: CMDirectoryContact;
}

export function useCMProjectSubcontractors(projectId: string | undefined) {
  return useQuery<CMProjectSubcontractor[]>({
    queryKey: ["cm_project_subcontractors", projectId],
    enabled: !!projectId && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db()
        .from("cm_project_subcontractors")
        .select("*, contact:cm_directory_contacts(*)")
        .eq("project_id", projectId)
        .order("created_at");
      if (error) throw error;
      return data as unknown as CMProjectSubcontractor[];
    },
    staleTime: STALE_TIME,
  });
}

export async function addCMProjectSubcontractor(ownerId: string, projectId: string, contactId: string, roleOnProject: string | null) {
  const { error } = await db().from("cm_project_subcontractors").insert({
    owner_id: ownerId, project_id: projectId, contact_id: contactId, role_on_project: roleOnProject,
  });
  if (error) throw error;
}

export async function removeCMProjectSubcontractor(id: string) {
  const { error } = await db().from("cm_project_subcontractors").delete().eq("id", id);
  if (error) throw error;
}

/* ── BOQ items (per project) ───────────────────────────── */
export interface CMBOQItem {
  id: string;
  project_id: string;
  owner_id: string;
  description: string;
  unit: string | null;
  quantity: number;
  unit_cost: number;
  category: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export function useCMBOQItems(projectId: string | undefined) {
  return useQuery<CMBOQItem[]>({
    queryKey: ["cm_boq_items", projectId],
    enabled: !!projectId && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db().from("cm_boq_items").select("*").eq("project_id", projectId).order("sort_order").order("created_at");
      if (error) throw error;
      return data as CMBOQItem[];
    },
    staleTime: STALE_TIME,
  });
}

export async function createCMBOQItem(
  ownerId: string,
  projectId: string,
  input: Pick<CMBOQItem, "description"> & Partial<Pick<CMBOQItem, "unit" | "quantity" | "unit_cost" | "category">>,
) {
  const { data, error } = await db().from("cm_boq_items").insert({ owner_id: ownerId, project_id: projectId, ...input }).select().single();
  if (error) throw error;
  return data as CMBOQItem;
}

export async function updateCMBOQItem(id: string, patch: Partial<CMBOQItem>) {
  const { error } = await db().from("cm_boq_items").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteCMBOQItem(id: string) {
  const { error } = await db().from("cm_boq_items").delete().eq("id", id);
  if (error) throw error;
}

/* ── Schedule items (WBS plan-vs-actual, per project) ──── */
export interface CMScheduleItem {
  id: string;
  project_id: string;
  owner_id: string;
  group_label: string;
  title: string;
  boq_category: string | null;
  plan_start: string;
  plan_finish: string;
  weight: number;
  actual_percent: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export function useCMScheduleItems(projectId: string | undefined) {
  return useQuery<CMScheduleItem[]>({
    queryKey: ["cm_schedule_items", projectId],
    enabled: !!projectId && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db().from("cm_schedule_items").select("*").eq("project_id", projectId).order("sort_order").order("plan_start");
      if (error) throw error;
      return data as CMScheduleItem[];
    },
    staleTime: STALE_TIME,
  });
}

export async function createCMScheduleItem(
  ownerId: string,
  projectId: string,
  input: Pick<CMScheduleItem, "group_label" | "title" | "plan_start" | "plan_finish"> & Partial<Pick<CMScheduleItem, "boq_category" | "weight" | "actual_percent">>,
) {
  const { data, error } = await db().from("cm_schedule_items").insert({ owner_id: ownerId, project_id: projectId, ...input }).select().single();
  if (error) throw error;
  return data as CMScheduleItem;
}

export async function updateCMScheduleItem(id: string, patch: Partial<CMScheduleItem>) {
  const { error } = await db().from("cm_schedule_items").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteCMScheduleItem(id: string) {
  const { error } = await db().from("cm_schedule_items").delete().eq("id", id);
  if (error) throw error;
}

/** Linear ramp 0→100 between start and finish (inclusive), clamped; a
 *  same-day span is a step function switching at that single date. */
function linearRamp(start: string, finish: string, date: string): number {
  if (start === finish) return date >= start ? 100 : 0;
  if (date <= start) return 0;
  if (date >= finish) return 100;
  const span = new Date(finish).getTime() - new Date(start).getTime();
  const elapsed = new Date(date).getTime() - new Date(start).getTime();
  return (elapsed / span) * 100;
}

/** A single activity's plan-completion ramp for a given day. */
export function scheduleItemPlanPercent(item: CMScheduleItem, date: string): number {
  return linearRamp(item.plan_start, item.plan_finish, date);
}

/** Weighted-average plan% across all of a project's schedule items for a
 *  given day — the "Plan" line of the S-curve. */
export function projectPlanPercent(items: CMScheduleItem[], date: string): number {
  if (items.length === 0) return 0;
  const totalWeight = items.reduce((s, i) => s + i.weight, 0) || 1;
  return items.reduce((s, i) => s + i.weight * scheduleItemPlanPercent(i, date), 0) / totalWeight;
}

function isoDateRange(from: string, to: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(from);
  const end = new Date(to);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

export interface SCurvePoint {
  date: string;
  manpower: number;
  plan: number;
  actual: number | null;
}

/** Builds the S-Curve series for a project: daily manpower headcount (bars),
 *  a Plan % line (weighted linear ramp across schedule items, or a straight
 *  line between the contract dates if no schedule items exist yet), and an
 *  Actual % line (the last known Site Diary `progress_pct`, forward-filled
 *  between entries — mirrors how these paper S-curves plot actual progress). */
export function buildSCurveSeries(project: CMProject, logs: CMDailyLog[], scheduleItems: CMScheduleItem[]): SCurvePoint[] {
  const candidateDates = [
    project.start_date, project.target_end_date,
    ...logs.map((l) => l.log_date),
    ...scheduleItems.flatMap((i) => [i.plan_start, i.plan_finish]),
  ].filter((d): d is string => !!d);
  if (candidateDates.length === 0) return [];

  const from = candidateDates.reduce((a, b) => (a < b ? a : b));
  const to = candidateDates.reduce((a, b) => (a > b ? a : b));

  const manpowerByDate = new Map<string, number>();
  const progressByDate = new Map<string, number>();
  for (const log of logs) {
    manpowerByDate.set(log.log_date, log.manpower.reduce((s, m) => s + m.count, 0));
    if (log.progress_pct != null) progressByDate.set(log.log_date, log.progress_pct);
  }

  let lastActual: number | null = null;
  return isoDateRange(from, to).map((date) => {
    if (progressByDate.has(date)) lastActual = progressByDate.get(date)!;
    return {
      date,
      manpower: manpowerByDate.get(date) ?? 0,
      plan: scheduleItems.length > 0
        ? projectPlanPercent(scheduleItems, date)
        : project.start_date && project.target_end_date
          ? linearRamp(project.start_date, project.target_end_date, date)
          : 0,
      actual: lastActual,
    };
  });
}

/* ── Inspections (per project) ─────────────────────────── */
export type InspectionStatus = "Scheduled" | "Passed" | "Failed" | "Not Applicable";

export interface CMInspection {
  id: string;
  project_id: string;
  owner_id: string;
  title: string;
  status: InspectionStatus;
  inspector: string | null;
  inspection_date: string;
  notes: string | null;
  photos: string[];
  photo_thumbs: string[];
  created_at: string;
  updated_at: string;
}

export function useCMInspections(projectId: string | undefined) {
  return useQuery<CMInspection[]>({
    queryKey: ["cm_inspections", projectId],
    enabled: !!projectId && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db().from("cm_inspections").select("*").eq("project_id", projectId).order("inspection_date", { ascending: false });
      if (error) throw error;
      return data as CMInspection[];
    },
    staleTime: STALE_TIME,
  });
}

export async function createCMInspection(
  ownerId: string,
  projectId: string,
  input: Pick<CMInspection, "title"> & Partial<Pick<CMInspection, "status" | "inspector" | "inspection_date" | "notes">>,
) {
  const { data, error } = await db().from("cm_inspections").insert({ owner_id: ownerId, project_id: projectId, ...input }).select().single();
  if (error) throw error;
  return data as CMInspection;
}

export async function updateCMInspection(id: string, patch: Partial<CMInspection>) {
  const { error } = await db().from("cm_inspections").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteCMInspection(id: string) {
  const { error } = await db().from("cm_inspections").delete().eq("id", id);
  if (error) throw error;
}

/* ── Safety records (per project) ──────────────────────── */
export type SafetyRecordType = "Incident" | "Toolbox Talk" | "Hazard Observation";
export type SafetySeverity = "Low" | "Medium" | "High" | "Critical";
export type SafetyStatus = "Open" | "Resolved";

export interface CMSafetyRecord {
  id: string;
  project_id: string;
  owner_id: string;
  record_type: SafetyRecordType;
  title: string;
  description: string | null;
  severity: SafetySeverity;
  record_date: string;
  involved: string | null;
  photos: string[];
  photo_thumbs: string[];
  status: SafetyStatus;
  created_at: string;
  updated_at: string;
}

export function useCMSafetyRecords(projectId: string | undefined) {
  return useQuery<CMSafetyRecord[]>({
    queryKey: ["cm_safety_records", projectId],
    enabled: !!projectId && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db().from("cm_safety_records").select("*").eq("project_id", projectId).order("record_date", { ascending: false });
      if (error) throw error;
      return data as CMSafetyRecord[];
    },
    staleTime: STALE_TIME,
  });
}

export async function createCMSafetyRecord(
  ownerId: string,
  projectId: string,
  input: Pick<CMSafetyRecord, "title"> & Partial<Pick<CMSafetyRecord, "record_type" | "description" | "severity" | "record_date" | "involved" | "status">>,
) {
  const { data, error } = await db().from("cm_safety_records").insert({ owner_id: ownerId, project_id: projectId, ...input }).select().single();
  if (error) throw error;
  return data as CMSafetyRecord;
}

export async function updateCMSafetyRecord(id: string, patch: Partial<CMSafetyRecord>) {
  const { error } = await db().from("cm_safety_records").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteCMSafetyRecord(id: string) {
  const { error } = await db().from("cm_safety_records").delete().eq("id", id);
  if (error) throw error;
}

/* ── Submittals (per project) ──────────────────────────── */
export type SubmittalStatus = "Draft" | "Submitted" | "Under Review" | "Approved" | "Approved as Noted" | "Revise & Resubmit" | "Rejected";

export interface CMSubmittal {
  id: string;
  project_id: string;
  owner_id: string;
  title: string;
  spec_section: string | null;
  status: SubmittalStatus;
  submitted_date: string | null;
  due_date: string | null;
  reviewer: string | null;
  revision: number;
  notes: string | null;
  photos: string[];
  photo_thumbs: string[];
  created_at: string;
  updated_at: string;
}

async function fetchCMSubmittalsList(projectId: string): Promise<CMSubmittal[]> {
  const { data, error } = await db().from("cm_submittals").select("*").eq("project_id", projectId).order("created_at", { ascending: false });
  if (error) throw error;
  return data as CMSubmittal[];
}

export function useCMSubmittals(projectId: string | undefined) {
  return useQuery<CMSubmittal[]>({
    queryKey: ["cm_submittals", projectId],
    enabled: !!projectId && !!supabaseCM,
    queryFn: () => fetchCMSubmittalsList(projectId!),
    staleTime: STALE_TIME,
  });
}

export async function createCMSubmittal(
  ownerId: string,
  projectId: string,
  input: Pick<CMSubmittal, "title"> & Partial<Pick<CMSubmittal, "spec_section" | "status" | "submitted_date" | "due_date" | "reviewer" | "notes">>,
) {
  const { data, error } = await db().from("cm_submittals").insert({ owner_id: ownerId, project_id: projectId, ...input }).select().single();
  if (error) throw error;
  return data as CMSubmittal;
}

export async function updateCMSubmittal(id: string, patch: Partial<CMSubmittal>) {
  const { error } = await db().from("cm_submittals").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteCMSubmittal(id: string) {
  const { error } = await db().from("cm_submittals").delete().eq("id", id);
  if (error) throw error;
}

/* ── Cross-module daily activity (Site Diary "Today's Activity", Reports) ── */
export interface CMDailyActivity {
  inspections: CMInspection[];
  safetyRecords: CMSafetyRecord[];
  tasks: CMTask[];
  submittals: CMSubmittal[];
}

function emptyCMDailyActivity(): CMDailyActivity {
  return { inspections: [], safetyRecords: [], tasks: [], submittals: [] };
}

export interface CMDailyPhoto {
  url: string;
  thumbUrl: string;
  module: CMPhotoModule;
  recordId: string;
}

/** Flattens a day's cross-module activity into one photo list, so Site
 *  Diary can show every picture taken that day — not just its own — in a
 *  single combined gallery. */
export function flattenCMDailyActivityPhotos(activity: CMDailyActivity | undefined): CMDailyPhoto[] {
  if (!activity) return [];
  const fromRows = <T extends { id: string; photos: string[]; photo_thumbs: string[] }>(rows: T[], module: CMPhotoModule) =>
    rows.flatMap((r) => r.photos.map((url, i) => ({ url, thumbUrl: r.photo_thumbs[i] || url, module, recordId: r.id })));
  return [
    ...fromRows(activity.inspections, "inspection"),
    ...fromRows(activity.safetyRecords, "safety"),
    ...fromRows(activity.tasks, "punchList"),
    ...fromRows(activity.submittals, "submittal"),
  ];
}

/** Punch List tasks have no clean "activity day" field, so — consistent with
 *  useAllCMPhotos — a task is bucketed under its creation day, not the day
 *  its status last changed. Submittals fall back to created_at the same way
 *  when submitted_date is unset. */
function activityDayOfTask(t: CMTask): string {
  return t.created_at.slice(0, 10);
}
function activityDayOfSubmittal(s: CMSubmittal): string {
  return s.submitted_date ?? s.created_at.slice(0, 10);
}

/** Shared fetch behind both daily-activity hooks below. Inspections/safety
 *  are queried directly by their date range; tasks/submittals are deduped
 *  against the same query-cache keys useCMTasks/useCMSubmittals already use
 *  (via queryClient.fetchQuery) and then filtered in memory by day, so
 *  visiting Punch List/Submittals first means this costs zero extra
 *  network calls. */
async function fetchCMDailyActivityRange(
  queryClient: ReturnType<typeof useQueryClient>,
  projectId: string,
  fromDate: string,
  toDate: string,
): Promise<Map<string, CMDailyActivity>> {
  const [inspections, safety, tasks, submittals] = await Promise.all([
    db().from("cm_inspections").select("*").eq("project_id", projectId).gte("inspection_date", fromDate).lte("inspection_date", toDate),
    db().from("cm_safety_records").select("*").eq("project_id", projectId).gte("record_date", fromDate).lte("record_date", toDate),
    queryClient.fetchQuery({ queryKey: ["cm_tasks", projectId], queryFn: () => fetchCMTasksList(projectId), staleTime: STALE_TIME }),
    queryClient.fetchQuery({ queryKey: ["cm_submittals", projectId], queryFn: () => fetchCMSubmittalsList(projectId), staleTime: STALE_TIME }),
  ]);
  if (inspections.error) throw inspections.error;
  if (safety.error) throw safety.error;

  const map = new Map<string, CMDailyActivity>();
  const bucket = (date: string) => {
    let entry = map.get(date);
    if (!entry) { entry = emptyCMDailyActivity(); map.set(date, entry); }
    return entry;
  };
  for (const r of inspections.data as CMInspection[]) bucket(r.inspection_date).inspections.push(r);
  for (const r of safety.data as CMSafetyRecord[]) bucket(r.record_date).safetyRecords.push(r);
  for (const r of tasks) {
    const day = activityDayOfTask(r);
    if (day >= fromDate && day <= toDate) bucket(day).tasks.push(r);
  }
  for (const r of submittals) {
    const day = activityDayOfSubmittal(r);
    if (day >= fromDate && day <= toDate) bucket(day).submittals.push(r);
  }
  return map;
}

/** One project's cross-module activity (Inspection/Safety/Punch List/
 *  Submittal) for a single day — used by Site Diary's "Today's Activity". */
export function useCMDailyActivity(projectId: string | undefined, date: string | undefined, opts?: { enabled?: boolean }) {
  const queryClient = useQueryClient();
  const query = useQuery<Map<string, CMDailyActivity>>({
    queryKey: ["cm_daily_activity_range", projectId, date, date],
    enabled: !!projectId && !!date && !!supabaseCM && (opts?.enabled ?? true),
    queryFn: () => fetchCMDailyActivityRange(queryClient, projectId!, date!, date!),
    staleTime: STALE_TIME,
  });
  return { ...query, data: query.data?.get(date ?? "") ?? emptyCMDailyActivity() };
}

/** Same cross-module activity, bucketed per day across a date range — used
 *  by Reports so it costs one query per module for the whole visible range
 *  instead of one per rendered day. */
export function useCMDailyActivityRange(projectId: string | undefined, fromDate: string, toDate: string) {
  const queryClient = useQueryClient();
  return useQuery<Map<string, CMDailyActivity>>({
    queryKey: ["cm_daily_activity_range", projectId, fromDate, toDate],
    enabled: !!projectId && !!supabaseCM,
    queryFn: () => fetchCMDailyActivityRange(queryClient, projectId!, fromDate, toDate),
    staleTime: STALE_TIME,
  });
}

/* ── Account settings (company branding, language) ─────── */
export interface CMAccountSettings {
  owner_id: string;
  company_name: string | null;
  company_logo_url: string | null;
  language: "en" | "km" | "zh";
  photo_show_company_logo: boolean;
  photo_show_project_info: boolean;
  photo_show_consultant_logos: boolean;
  photo_monotone_logos: boolean;
  photo_timestamp: boolean;
  created_at: string;
  updated_at: string;
}

export function useCMAccountSettings(userId: string | undefined) {
  return useQuery<CMAccountSettings | null>({
    queryKey: ["cm_account_settings", userId],
    enabled: !!userId && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db().from("cm_account_settings").select("*").eq("owner_id", userId).maybeSingle();
      if (error) throw error;
      return data as CMAccountSettings | null;
    },
    staleTime: STALE_TIME,
  });
}

export async function upsertCMAccountSettings(ownerId: string, patch: Partial<Omit<CMAccountSettings, "owner_id" | "created_at" | "updated_at">>) {
  const { error } = await db().from("cm_account_settings").upsert({ owner_id: ownerId, ...patch }, { onConflict: "owner_id" });
  if (error) throw error;
}

export async function uploadCMCompanyLogo(ownerId: string, file: File): Promise<string> {
  const client = db();
  const ext = file.name.split(".").pop() || "png";
  const path = `${ownerId}/company-logo-${Date.now()}.${ext}`;
  const { error } = await client.storage.from("site-media").upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = await client.storage.from("site-media").createSignedUrl(path, 60 * 60 * 24 * 365);
  return data?.signedUrl ?? path;
}
