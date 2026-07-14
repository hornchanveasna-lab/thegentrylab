/**
 * Data layer for the Construction Management App (/cm/*), backed by its own
 * Supabase project (own auth.users, standard auth.uid()-based RLS — no shared
 * account system, no custom JWT claims).
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabaseCM } from "./supabase-cm";

const STALE_TIME = 60 * 1000;

export type ProjectStatus =
  | "Draft" | "Tender" | "Planning" | "Pre-Construction" | "Active" | "On Hold" | "Delayed"
  | "Defect Liability" | "Handover" | "Completed" | "Closed" | "Archived";
export type ProjectHealth = "Green" | "Amber" | "Red";
export type ProjectSector =
  | "Industrial" | "Warehouse" | "Factory" | "Commercial" | "Residential" | "Infrastructure"
  | "Airport" | "Stadium" | "Logistics" | "Healthcare" | "Education" | "Other";
export type TaskStatus = "To Do" | "In Progress" | "Blocked" | "Done";
export type TaskPriority = "Low" | "Medium" | "High";

export const CM_PROJECT_SECTORS: ProjectSector[] = [
  "Industrial", "Warehouse", "Factory", "Commercial", "Residential", "Infrastructure",
  "Airport", "Stadium", "Logistics", "Healthcare", "Education", "Other",
];

export interface CMProject {
  id: string;
  owner_id: string;
  name: string;
  client: string | null;
  address: string | null;
  location: string | null;
  location_map_url: string | null;
  status: ProjectStatus;
  health: ProjectHealth;
  sector: ProjectSector | null;
  contract_value: number | null;
  currency: string | null;
  start_date: string | null;
  target_end_date: string | null;
  description: string | null;
  client_logo_url: string | null;
  project_code: string | null;
  disabled_disciplines: string[];
  doc_module_codes: Record<string, string>;
  revision_format: string;
  doc_footer: string | null;
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
  /** Links this row to a cm_manpower_roster entry so trade/company can be
   *  picked instead of retyped; null for free-text "Custom" rows. */
  roster_item_id: string | null;
}

export interface CMDeliveryRow {
  material: string;
  quantity: string;
  unit: string | null;
  supplier: string | null;
  /** Links this delivery to a cm_boq_items row so quantities can be tallied
   *  against the BOQ's planned quantity; null for free-text "Custom" rows. */
  boq_item_id: string | null;
  photos: string[];
  photo_thumbs: string[];
}

export type CMVisitorKind = "visitor" | "instruction";

export interface CMVisitorRow {
  name: string;
  organization: string | null;
  kind: CMVisitorKind;
  note: string;
  photos: string[];
  photo_thumbs: string[];
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
  /** Auto-generated document number, e.g. "ZIN-SD-2026-0001" — null for
   *  entries created before this feature shipped, or if numbering failed
   *  (best-effort; never blocks log creation). */
  doc_number: string | null;
  weather: string | null;
  temperature_c: number | null;
  rain_start_time: string | null;
  rain_end_time: string | null;
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
  doc_number: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  location_id: string | null;
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
  input: Pick<CMProject, "name"> & Partial<Pick<CMProject, "client" | "address" | "location" | "location_map_url" | "status" | "health" | "sector" | "contract_value" | "currency" | "start_date" | "target_end_date" | "description" | "project_code">>,
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

/* ── Project favorites (per-user, not per-owner — any team member can star
 *  a project independently of everyone else's picks) ─────────────────── */
export function useCMProjectFavorites(userId: string | undefined) {
  return useQuery<Set<string>>({
    queryKey: ["cm_project_favorites", userId],
    enabled: !!userId && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db().from("cm_project_favorites").select("project_id").eq("user_id", userId);
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.project_id as string));
    },
    staleTime: STALE_TIME,
  });
}

export async function setCMProjectFavorite(userId: string, projectId: string, isFavorite: boolean) {
  if (isFavorite) {
    const { error } = await db().from("cm_project_favorites").upsert({ user_id: userId, project_id: projectId }, { onConflict: "project_id,user_id" });
    if (error) throw error;
  } else {
    const { error } = await db().from("cm_project_favorites").delete().eq("user_id", userId).eq("project_id", projectId);
    if (error) throw error;
  }
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

/** Shared document-numbering helper for every module's create function.
 *  Reads the project's configured module code (falling back to
 *  `fallbackCode` if unset), then asks the `cm_next_doc_number` RPC for the
 *  next sequence for that project/module/year. Numbering is best-effort —
 *  a failure (missing RPC, network) never blocks record creation, it just
 *  leaves doc_number null. Uses the record's own date (not wall-clock
 *  "today") so backdated entries keep the correct year segment. */
async function generateCMDocNumber(projectId: string, moduleKey: string, fallbackCode: string, dateStr?: string): Promise<string | null> {
  try {
    const year = new Date(dateStr ?? new Date().toISOString().slice(0, 10)).getFullYear();
    const { data: proj } = await db().from("cm_projects").select("doc_module_codes").eq("id", projectId).maybeSingle();
    const moduleCode = (proj?.doc_module_codes as Record<string, string> | null)?.[moduleKey] || fallbackCode;
    const { data } = await db().rpc("cm_next_doc_number", {
      p_project_id: projectId, p_module_key: moduleKey, p_module_code: moduleCode, p_year: year,
    });
    return data ?? null;
  } catch {
    return null;
  }
}

export async function createCMDailyLog(
  ownerId: string,
  projectId: string,
  input: Partial<Omit<CMDailyLog, "id" | "project_id" | "owner_id" | "created_at" | "updated_at">>,
) {
  const docNumber = await generateCMDocNumber(projectId, "site_diary", "SD", input.log_date);
  const { data, error } = await db().from("cm_daily_logs")
    .insert({ owner_id: ownerId, project_id: projectId, doc_number: docNumber, ...input }).select().single();
  if (error) throw error;
  logCMActivity(projectId, ownerId, "created", "site_diary", data.id, { doc_number: docNumber });
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
  input: Pick<CMTask, "title"> & Partial<Pick<CMTask, "description" | "status" | "priority" | "location_id" | "assignee" | "due_date">>,
) {
  const docNumber = await generateCMDocNumber(projectId, "punch_list", "PNL");
  const { data, error } = await db().from("cm_tasks").insert({ owner_id: ownerId, project_id: projectId, doc_number: docNumber, ...input }).select().single();
  if (error) throw error;
  logCMActivity(projectId, ownerId, "created", "punch_list", data.id, { title: data.title });
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

/** Named people (Directory contacts) attached to a consultant company —
 *  separate from the consultant's own name/logo_url (used for photo-stamp
 *  branding), same "contact + free-text role" shape as
 *  CMProjectSubcontractor. */
export interface CMConsultantPerson {
  id: string;
  consultant_id: string;
  contact_id: string;
  role: string | null;
  created_at: string;
  contact: CMDirectoryContact;
}

export function useCMConsultantPeople(consultantId: string | undefined) {
  return useQuery<CMConsultantPerson[]>({
    queryKey: ["cm_consultant_people", consultantId],
    enabled: !!consultantId && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db()
        .from("cm_consultant_people")
        .select("*, contact:cm_directory_contacts(*)")
        .eq("consultant_id", consultantId)
        .order("created_at");
      if (error) throw error;
      return data as unknown as CMConsultantPerson[];
    },
    staleTime: STALE_TIME,
  });
}

export async function addCMConsultantPerson(consultantId: string, contactId: string, role: string | null) {
  const { error } = await db().from("cm_consultant_people").insert({ consultant_id: consultantId, contact_id: contactId, role });
  if (error) throw error;
}

export async function removeCMConsultantPerson(id: string) {
  const { error } = await db().from("cm_consultant_people").delete().eq("id", id);
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

/* ── Shared master data ───────────────────────────────── */
/** Common discipline classification, shared across modules (Inspection,
 *  Submittal, and future ones) instead of each hand-rolling its own list. */
export const DISCIPLINES = [
  "architecture", "structural", "civil", "steel_structure", "mechanical",
  "electrical", "plumbing", "fire_protection", "infrastructure", "roofing",
  "cladding", "landscape", "safety", "quality", "general",
] as const;
export type Discipline = typeof DISCIPLINES[number];

/** Disciplines a project's pickers should actually show — DISCIPLINES minus
 *  whatever this project's admin disabled in Settings, so a small project
 *  isn't forced to scroll past 15 trades it doesn't use. */
export function enabledDisciplines(project: Pick<CMProject, "disabled_disciplines"> | null | undefined): Discipline[] {
  const disabled = new Set(project?.disabled_disciplines ?? []);
  return DISCIPLINES.filter((d) => !disabled.has(d));
}

export async function setCMProjectDisciplineEnabled(project: CMProject, discipline: Discipline, enabled: boolean) {
  const next = enabled
    ? project.disabled_disciplines.filter((d) => d !== discipline)
    : [...project.disabled_disciplines, discipline];
  await updateCMProject(project.id, { disabled_disciplines: next });
}

/** Per-project location hierarchy (Building → Floor → Zone → Area), unlike
 *  DISCIPLINES which is a fixed global list — every project defines its own
 *  buildings/floors/zones, so this is owner-managed data, not a constant. */
export type CMLocationLevel = "building" | "floor" | "zone" | "area";

export interface CMProjectLocation {
  id: string;
  project_id: string;
  parent_id: string | null;
  name: string;
  level: CMLocationLevel;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export function useCMProjectLocations(projectId: string | undefined) {
  return useQuery<CMProjectLocation[]>({
    queryKey: ["cm_project_locations", projectId],
    enabled: !!projectId && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db().from("cm_project_locations").select("*").eq("project_id", projectId).order("sort_order").order("created_at");
      if (error) throw error;
      return data as CMProjectLocation[];
    },
    staleTime: STALE_TIME,
  });
}

export async function createCMProjectLocation(projectId: string, parentId: string | null, name: string, level: CMLocationLevel) {
  const { data, error } = await db().from("cm_project_locations").insert({ project_id: projectId, parent_id: parentId, name, level }).select().single();
  if (error) throw error;
  return data as CMProjectLocation;
}

export async function updateCMProjectLocation(id: string, patch: Partial<Pick<CMProjectLocation, "name" | "level" | "sort_order">>) {
  const { error } = await db().from("cm_project_locations").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteCMProjectLocation(id: string) {
  const { error } = await db().from("cm_project_locations").delete().eq("id", id);
  if (error) throw error;
}

/** "Building B1 › Ground Floor › Production Zone" — walks the parent_id
 *  chain client-side so FieldSelect (whose options are plain label strings)
 *  needs no structural changes to show a breadcrumb instead of a flat list. */
export function locationBreadcrumb(location: CMProjectLocation, all: CMProjectLocation[]): string {
  const chain: string[] = [location.name];
  let current = location;
  while (current.parent_id) {
    const parent = all.find((l) => l.id === current.parent_id);
    if (!parent) break;
    chain.unshift(parent.name);
    current = parent;
  }
  return chain.join(" › ");
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

/** Owner-scoped company entity (global, cross-project — like Directory
 *  contacts, a company is reused across every project the owner runs).
 *  Linked from Directory contacts via company_id; the plain `company` text
 *  field on CMDirectoryContact stays mirrored so existing string-based
 *  consumers (distinctCMCompanyNames, Subcontractor/People grouping) keep
 *  working unchanged. Not yet linked from Manpower/Project Members/
 *  Consultants — a later round once this pilot is validated. */
export type CompanyType =
  | "Client" | "Developer" | "Consultant" | "Architect" | "Designer" | "Main Contractor"
  | "Subcontractor" | "Supplier" | "Manufacturer" | "Testing Agency" | "Authority" | "Other";
export const CM_COMPANY_TYPES: CompanyType[] = [
  "Client", "Developer", "Consultant", "Architect", "Designer", "Main Contractor",
  "Subcontractor", "Supplier", "Manufacturer", "Testing Agency", "Authority", "Other",
];
export type CompanyStatus = "Active" | "Inactive";

export interface CMCompany {
  id: string;
  owner_id: string;
  name: string;
  short_name: string | null;
  company_type: CompanyType | null;
  registration_number: string | null;
  tax_number: string | null;
  address: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  primary_contact: string | null;
  logo_url: string | null;
  stamp_url: string | null;
  status: CompanyStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useCMCompanies(ownerId: string | undefined) {
  return useQuery<CMCompany[]>({
    queryKey: ["cm_companies", ownerId],
    enabled: !!ownerId && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db().from("cm_companies").select("*").order("name");
      if (error) throw error;
      return data as CMCompany[];
    },
    staleTime: STALE_TIME,
  });
}

export async function createCMCompany(
  ownerId: string,
  name: string,
  patch: Partial<Omit<CMCompany, "id" | "owner_id" | "name" | "created_at" | "updated_at">> = {},
): Promise<CMCompany> {
  const { data, error } = await db().from("cm_companies").insert({ owner_id: ownerId, name, ...patch }).select().single();
  if (error) throw error;
  return data as CMCompany;
}

export async function updateCMCompany(id: string, patch: Partial<Omit<CMCompany, "id" | "owner_id" | "created_at" | "updated_at">>) {
  const { error } = await db().from("cm_companies").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteCMCompany(id: string) {
  const { error } = await db().from("cm_companies").delete().eq("id", id);
  if (error) throw error;
}

export async function uploadCMCompanyMasterLogo(ownerId: string, companyId: string, file: File): Promise<string> {
  const client = db();
  const ext = file.name.split(".").pop() || "png";
  const path = `${ownerId}/companies/${companyId}-logo-${Date.now()}.${ext}`;
  const { error } = await client.storage.from("site-media").upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = await client.storage.from("site-media").createSignedUrl(path, 60 * 60 * 24 * 365);
  return data?.signedUrl ?? path;
}

export async function uploadCMCompanyStamp(ownerId: string, companyId: string, file: File): Promise<string> {
  const client = db();
  const ext = file.name.split(".").pop() || "png";
  const path = `${ownerId}/companies/${companyId}-stamp-${Date.now()}.${ext}`;
  const { error } = await client.storage.from("site-media").upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = await client.storage.from("site-media").createSignedUrl(path, 60 * 60 * 24 * 365);
  return data?.signedUrl ?? path;
}

/* ── Audit log — a lightweight "what changed" trail for project settings.
 *  Not wired into every mutation in the app (that would mean touching
 *  dozens of call sites); covers the settings-area mutations added or
 *  touched this round. Failure to log never blocks the underlying action. */
export interface CMAuditLogEntry {
  id: string;
  project_id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  detail: Record<string, unknown> | null;
  created_at: string;
}

export function useCMAuditLog(projectId: string | undefined) {
  return useQuery<CMAuditLogEntry[]>({
    queryKey: ["cm_audit_log", projectId],
    enabled: !!projectId && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db().from("cm_audit_log").select("*").eq("project_id", projectId)
        .order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data as CMAuditLogEntry[];
    },
    staleTime: STALE_TIME,
  });
}

/** Per-record activity log — unlike useCMAuditLog (project-wide, capped at
 *  50 rows), this filters directly by entity so a record's own history is
 *  never pushed out by unrelated activity elsewhere in the project. */
export function useCMEntityAuditLog(entityType: string, entityId: string | undefined) {
  return useQuery<CMAuditLogEntry[]>({
    queryKey: ["cm_audit_log_entity", entityType, entityId],
    enabled: !!entityId && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db().from("cm_audit_log").select("*")
        .eq("entity_type", entityType).eq("entity_id", entityId).order("created_at", { ascending: false });
      if (error) throw error;
      return data as CMAuditLogEntry[];
    },
    staleTime: STALE_TIME,
  });
}

export async function logCMActivity(
  projectId: string,
  actorId: string,
  action: string,
  entityType: string,
  entityId?: string | null,
  detail?: Record<string, unknown> | null,
) {
  try {
    await db().from("cm_audit_log").insert({
      project_id: projectId, actor_id: actorId, action, entity_type: entityType,
      entity_id: entityId ?? null, detail: detail ?? null,
    });
  } catch { /* logging is best-effort; never block the underlying action */ }
}

/* ── Comments (polymorphic — any record in any module) ──── */
export interface CMComment {
  id: string;
  project_id: string;
  entity_type: string;
  entity_id: string;
  author_id: string;
  body: string;
  created_at: string;
}

export function useCMComments(entityType: string, entityId: string | undefined) {
  return useQuery<CMComment[]>({
    queryKey: ["cm_comments", entityType, entityId],
    enabled: !!entityId && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db().from("cm_comments").select("*")
        .eq("entity_type", entityType).eq("entity_id", entityId).order("created_at", { ascending: true });
      if (error) throw error;
      return data as CMComment[];
    },
    staleTime: STALE_TIME,
  });
}

export async function addCMComment(projectId: string, entityType: string, entityId: string, authorId: string, body: string) {
  const { data, error } = await db().from("cm_comments")
    .insert({ project_id: projectId, entity_type: entityType, entity_id: entityId, author_id: authorId, body }).select().single();
  if (error) throw error;
  return data as CMComment;
}

export async function deleteCMComment(id: string) {
  const { error } = await db().from("cm_comments").delete().eq("id", id);
  if (error) throw error;
}

/* ── Notifications (in-app only — no email/push provider configured) ──── */
export interface CMNotification {
  id: string;
  project_id: string;
  user_id: string;
  event_key: string;
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
}

export function useCMNotifications(userId: string | undefined) {
  return useQuery<CMNotification[]>({
    queryKey: ["cm_notifications", userId],
    enabled: !!userId && !!supabaseCM,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await db().from("cm_notifications").select("*")
        .eq("user_id", userId).order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data as CMNotification[];
    },
    staleTime: STALE_TIME,
  });
}

/** Best-effort — a notification failing to insert should never block the
 *  action that triggered it (assignment, status change, etc.). */
export async function notifyCMUser(
  projectId: string, userId: string, eventKey: string, title: string,
  body?: string | null, entityType?: string | null, entityId?: string | null,
) {
  try {
    await db().from("cm_notifications").insert({
      project_id: projectId, user_id: userId, event_key: eventKey, title,
      body: body ?? null, entity_type: entityType ?? null, entity_id: entityId ?? null,
    });
  } catch { /* best-effort */ }
}

export async function markCMNotificationRead(id: string) {
  const { error } = await db().from("cm_notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function markAllCMNotificationsRead(userId: string) {
  const { error } = await db().from("cm_notifications").update({ read_at: new Date().toISOString() }).eq("user_id", userId).is("read_at", null);
  if (error) throw error;
}

/* ── Work packages (per project) ───────────────────────── */
export interface CMWorkPackage {
  id: string;
  project_id: string;
  owner_id: string;
  name: string;
  company_id: string | null;
  discipline: Discipline | null;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export function useCMWorkPackages(projectId: string | undefined) {
  return useQuery<CMWorkPackage[]>({
    queryKey: ["cm_work_packages", projectId],
    enabled: !!projectId && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db().from("cm_work_packages").select("*").eq("project_id", projectId)
        .order("sort_order").order("created_at");
      if (error) throw error;
      return data as CMWorkPackage[];
    },
    staleTime: STALE_TIME,
  });
}

export async function createCMWorkPackage(
  ownerId: string,
  projectId: string,
  input: Pick<CMWorkPackage, "name"> & Partial<Pick<CMWorkPackage, "company_id" | "discipline" | "description">>,
) {
  const { data, error } = await db().from("cm_work_packages").insert({ owner_id: ownerId, project_id: projectId, ...input }).select().single();
  if (error) throw error;
  return data as CMWorkPackage;
}

export async function updateCMWorkPackage(id: string, patch: Partial<Pick<CMWorkPackage, "name" | "company_id" | "discipline" | "description" | "sort_order">>) {
  const { error } = await db().from("cm_work_packages").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteCMWorkPackage(id: string) {
  const { error } = await db().from("cm_work_packages").delete().eq("id", id);
  if (error) throw error;
}

/* ── Workflow steps — configurable approval chain per module. Storage and
 *  settings UI only; no module currently reads these to gate its own
 *  status transitions (Site Diary/Inspection/etc. keep their existing
 *  approval logic untouched), so this documents intent rather than
 *  enforcing it yet. ── */
export type WorkflowApproverType = "role" | "company" | "user";

export interface CMWorkflowStep {
  id: string;
  project_id: string;
  owner_id: string;
  module_key: string;
  step_order: number;
  approver_type: WorkflowApproverType;
  approver_value: string;
  parallel: boolean;
  required_comment: boolean;
  required_signature: boolean;
  escalation_days: number | null;
  created_at: string;
  updated_at: string;
}

export function useCMWorkflowSteps(projectId: string | undefined) {
  return useQuery<CMWorkflowStep[]>({
    queryKey: ["cm_workflow_steps", projectId],
    enabled: !!projectId && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db().from("cm_workflow_steps").select("*").eq("project_id", projectId)
        .order("module_key").order("step_order");
      if (error) throw error;
      return data as CMWorkflowStep[];
    },
    staleTime: STALE_TIME,
  });
}

export async function createCMWorkflowStep(
  ownerId: string,
  projectId: string,
  input: Pick<CMWorkflowStep, "module_key" | "approver_type" | "approver_value"> & Partial<Pick<CMWorkflowStep, "step_order" | "parallel" | "required_comment" | "required_signature" | "escalation_days">>,
) {
  const { data, error } = await db().from("cm_workflow_steps").insert({ owner_id: ownerId, project_id: projectId, ...input }).select().single();
  if (error) throw error;
  return data as CMWorkflowStep;
}

export async function updateCMWorkflowStep(id: string, patch: Partial<Omit<CMWorkflowStep, "id" | "project_id" | "owner_id" | "created_at" | "updated_at">>) {
  const { error } = await db().from("cm_workflow_steps").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteCMWorkflowStep(id: string) {
  const { error } = await db().from("cm_workflow_steps").delete().eq("id", id);
  if (error) throw error;
}

/* ── Checklist templates ("Forms and Templates") — named, reusable
 *  checklists tagged by module. Storage and CRUD only; Inspection/Safety/
 *  etc. don't yet offer "start from a template" when creating a record —
 *  that consumption is a follow-up. ── */
export interface CMChecklistTemplate {
  id: string;
  project_id: string;
  owner_id: string;
  module_key: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface CMChecklistTemplateItem {
  id: string;
  template_id: string;
  title: string;
  sort_order: number;
  created_at: string;
}

export function useCMChecklistTemplates(projectId: string | undefined) {
  return useQuery<CMChecklistTemplate[]>({
    queryKey: ["cm_checklist_templates", projectId],
    enabled: !!projectId && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db().from("cm_checklist_templates").select("*").eq("project_id", projectId).order("created_at");
      if (error) throw error;
      return data as CMChecklistTemplate[];
    },
    staleTime: STALE_TIME,
  });
}

export function useCMChecklistTemplateItems(templateId: string | undefined) {
  return useQuery<CMChecklistTemplateItem[]>({
    queryKey: ["cm_checklist_template_items", templateId],
    enabled: !!templateId && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db().from("cm_checklist_template_items").select("*").eq("template_id", templateId).order("sort_order").order("created_at");
      if (error) throw error;
      return data as CMChecklistTemplateItem[];
    },
    staleTime: STALE_TIME,
  });
}

export async function createCMChecklistTemplate(ownerId: string, projectId: string, moduleKey: string, name: string) {
  const { data, error } = await db().from("cm_checklist_templates").insert({ owner_id: ownerId, project_id: projectId, module_key: moduleKey, name }).select().single();
  if (error) throw error;
  return data as CMChecklistTemplate;
}

export async function deleteCMChecklistTemplate(id: string) {
  const { error } = await db().from("cm_checklist_templates").delete().eq("id", id);
  if (error) throw error;
}

export async function addCMChecklistTemplateItem(templateId: string, title: string, sortOrder = 0) {
  const { data, error } = await db().from("cm_checklist_template_items").insert({ template_id: templateId, title, sort_order: sortOrder }).select().single();
  if (error) throw error;
  return data as CMChecklistTemplateItem;
}

export async function deleteCMChecklistTemplateItem(id: string) {
  const { error } = await db().from("cm_checklist_template_items").delete().eq("id", id);
  if (error) throw error;
}

/* ── Notification rules — event + recipient configuration only. No send
 *  pipeline exists in this app (no email/push integration), so these
 *  rules currently document intent rather than triggering anything. ── */
export type NotificationRecipientType = "role" | "company" | "user" | "module";

export interface CMNotificationRule {
  id: string;
  project_id: string;
  owner_id: string;
  event_key: string;
  recipient_type: NotificationRecipientType;
  recipient_value: string;
  created_at: string;
}

export const NOTIFICATION_EVENTS = [
  "new_assignment", "approval_required", "rejection", "overdue_action",
  "critical_safety_issue", "late_submittal", "inspection_reminder",
  "certificate_expiry", "daily_report_missing",
] as const;
export type NotificationEvent = typeof NOTIFICATION_EVENTS[number];

export function useCMNotificationRules(projectId: string | undefined) {
  return useQuery<CMNotificationRule[]>({
    queryKey: ["cm_notification_rules", projectId],
    enabled: !!projectId && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db().from("cm_notification_rules").select("*").eq("project_id", projectId).order("created_at");
      if (error) throw error;
      return data as CMNotificationRule[];
    },
    staleTime: STALE_TIME,
  });
}

export async function createCMNotificationRule(
  ownerId: string, projectId: string, eventKey: NotificationEvent, recipientType: NotificationRecipientType, recipientValue: string,
) {
  const { data, error } = await db().from("cm_notification_rules")
    .insert({ owner_id: ownerId, project_id: projectId, event_key: eventKey, recipient_type: recipientType, recipient_value: recipientValue })
    .select().single();
  if (error) throw error;
  return data as CMNotificationRule;
}

export async function deleteCMNotificationRule(id: string) {
  const { error } = await db().from("cm_notification_rules").delete().eq("id", id);
  if (error) throw error;
}

/* ── Directory contacts (global, cross-project) ────────── */
export interface CMDirectoryContact {
  id: string;
  owner_id: string;
  name: string;
  company: string | null;
  company_id: string | null;
  trade: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  photo_url: string | null;
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
  input: Pick<CMDirectoryContact, "name"> & Partial<Pick<CMDirectoryContact, "company" | "company_id" | "trade" | "phone" | "email" | "notes">>,
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

/** Face photo for a Directory contact — same storage bucket as
 *  uploadCMLogo, but path-scoped by contactId since contacts are global
 *  (not project-scoped) rather than per-project. */
export async function uploadCMContactPhoto(ownerId: string, contactId: string, file: File): Promise<string> {
  const client = db();
  const ext = file.name.split(".").pop() || "png";
  const path = `${ownerId}/contacts/${contactId}-${Date.now()}.${ext}`;
  const { error } = await client.storage.from("site-media").upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = await client.storage.from("site-media").createSignedUrl(path, 60 * 60 * 24 * 365);
  return data?.signedUrl ?? path;
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

/* ── Manpower roster (predefined trade/company pairs per project) ─
 *  Site Diary's daily manpower rows pick from this list via
 *  `roster_item_id` instead of retyping trade/company every day —
 *  same "predefined + custom fallback" shape as Deliveries' boq_item_id,
 *  not a duplicate of the headcount data itself (that still lives only
 *  on `cm_daily_logs.manpower`). */
export interface CMManpowerRosterItem {
  id: string;
  project_id: string;
  owner_id: string;
  trade: string;
  company: string | null;
  created_at: string;
}

export function useCMManpowerRoster(projectId: string | undefined) {
  return useQuery<CMManpowerRosterItem[]>({
    queryKey: ["cm_manpower_roster", projectId],
    enabled: !!projectId && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db().from("cm_manpower_roster").select("*").eq("project_id", projectId).order("trade");
      if (error) throw error;
      return data as CMManpowerRosterItem[];
    },
    staleTime: STALE_TIME,
  });
}

export async function addCMManpowerRosterItem(ownerId: string, projectId: string, trade: string, company: string | null) {
  const { error } = await db().from("cm_manpower_roster").insert({ owner_id: ownerId, project_id: projectId, trade, company });
  if (error) throw error;
}

export async function removeCMManpowerRosterItem(id: string) {
  const { error } = await db().from("cm_manpower_roster").delete().eq("id", id);
  if (error) throw error;
}

/* ── Project members & invites. RLS is now project-role-aware across every
 *  project-scoped table (cm_project_role() Postgres function), so a member
 *  who accepts an invite can actually read/write Site Diary/Photos/BOQ/etc.
 *  per their role, not just show up in a Team list. ──────────────────── */
export type CMMemberRole = "admin" | "member" | "visitor";

/** Job-function role — orthogonal to CMMemberRole. `role` stays the coarse
 *  RLS access tier (unchanged); `job_role` additionally drives a per-module
 *  permission matrix (cm_role_permissions) that can only narrow access, and
 *  defaults to fully permissive while null — a member never assigned one
 *  behaves exactly as they do today.
 *
 *  Stored as free text (not a fixed union) so an owner can add roles beyond
 *  the 18 built-ins below — CM_JOB_ROLES is only the curated starter list
 *  used to seed pickers; useCMCustomJobRoles() surfaces any additional ones
 *  already in use. */
export type CMJobRole = string;

export const CM_JOB_ROLES: CMJobRole[] = [
  "project_manager", "site_engineer", "site_supervisor", "qa_qc_engineer",
  "safety_officer", "architect", "structural_engineer", "mep_engineer",
  "surveyor", "planning_engineer", "document_controller", "store_keeper",
  "procurement_officer", "subcontractor", "consultant",
  "client_representative", "owners_representative", "inspector_auditor",
];

/** Every job-role picker shows custom roles right after Project Manager
 *  (not tacked on at the end) — an owner's own custom roles tend to be
 *  senior, PM-adjacent titles specific to how their company is organized,
 *  so they read better grouped near the top than buried after all 18
 *  built-ins. */
export function orderedJobRoles(customRoles: CMJobRole[]): CMJobRole[] {
  const [first, ...rest] = CM_JOB_ROLES;
  return [first, ...customRoles, ...rest];
}

/** Custom job roles an owner has created — either by toggling a permission
 *  for a brand-new role name on the Role Permissions page, or by typing one
 *  directly onto a team member. Both sources feed every job-role picker so
 *  a custom role stays usable everywhere once created either way. */
export function useCMCustomJobRoles(ownerId: string | undefined) {
  return useQuery<string[]>({
    queryKey: ["cm_custom_job_roles", ownerId],
    enabled: !!ownerId && !!supabaseCM,
    queryFn: async () => {
      const known = new Set<string>(CM_JOB_ROLES);
      const [fromMatrix, fromMembers] = await Promise.all([
        db().from("cm_role_permissions").select("job_role").eq("owner_id", ownerId),
        db().from("cm_project_members").select("job_role, project:cm_projects!inner(owner_id)").eq("project.owner_id", ownerId).not("job_role", "is", null),
      ]);
      if (fromMatrix.error) throw fromMatrix.error;
      if (fromMembers.error) throw fromMembers.error;
      const set = new Set<string>();
      for (const r of fromMatrix.data ?? []) if (!known.has(r.job_role)) set.add(r.job_role);
      for (const r of (fromMembers.data ?? []) as { job_role: string | null }[]) if (r.job_role && !known.has(r.job_role)) set.add(r.job_role);
      return Array.from(set).sort();
    },
    staleTime: STALE_TIME,
  });
}

/** Display label for a job role — built-ins go through i18n (`team.jobRole.*`),
 *  custom roles just show the raw text the owner typed (already human-readable,
 *  there's no translation for something that doesn't exist ahead of time). */
export function jobRoleLabel(role: CMJobRole, t: (key: string) => string): string {
  return CM_JOB_ROLES.includes(role) ? t(`team.jobRole.${role}`) : role;
}

/** Per-module action matrix, keyed by job_role — the enforcement layer that
 *  job_role exists to drive. A missing row (or job_role === null) means
 *  "not opted in yet" and every action is permitted, mirroring the RLS
 *  fallback in cm_role_permission() so client and server never disagree. */
export type CMModuleKey =
  | "site_diary" | "punch_list" | "inspection" | "safety" | "submittal"
  | "equipment" | "boq" | "schedule" | "manpower" | "people" | "settings";
export type CMPermissionAction = "view" | "create" | "edit" | "approve" | "delete";

/** `owner_id === null` rows are the shared global default matrix (seeded
 *  in Round 1); an owner_id-scoped row overrides the global default for
 *  every project that owner runs, without affecting anyone else's. */
export interface CMRolePermission {
  owner_id: string | null;
  job_role: CMJobRole;
  module_key: CMModuleKey;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_approve: boolean;
  can_delete: boolean;
}

export function useCMRolePermissions(projectOwnerId: string | undefined) {
  return useQuery<CMRolePermission[]>({
    queryKey: ["cm_role_permissions", projectOwnerId],
    enabled: !!supabaseCM,
    queryFn: async () => {
      const query = db().from("cm_role_permissions").select("*");
      const { data, error } = await (projectOwnerId
        ? query.or(`owner_id.is.null,owner_id.eq.${projectOwnerId}`)
        : query.is("owner_id", null));
      if (error) throw error;
      return data as CMRolePermission[];
    },
    staleTime: 60 * 60 * 1000,
  });
}

export async function setCMRolePermission(
  ownerId: string, jobRole: CMJobRole, moduleKey: CMModuleKey,
  patch: Partial<Pick<CMRolePermission, "can_view" | "can_create" | "can_edit" | "can_approve" | "can_delete">>,
  fallbackDefaults: Pick<CMRolePermission, "can_view" | "can_create" | "can_edit" | "can_approve" | "can_delete">,
) {
  const { data: existing, error: findError } = await db().from("cm_role_permissions").select("id")
    .eq("owner_id", ownerId).eq("job_role", jobRole).eq("module_key", moduleKey).maybeSingle();
  if (findError) throw findError;
  if (existing) {
    const { error } = await db().from("cm_role_permissions").update(patch).eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await db().from("cm_role_permissions")
      .insert({ owner_id: ownerId, job_role: jobRole, module_key: moduleKey, ...fallbackDefaults, ...patch });
    if (error) throw error;
  }
}

export interface CMProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: CMMemberRole;
  job_role: CMJobRole | null;
  position: string | null;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  /** Links this member to their Directory contact — set automatically at
   *  accept-time by matching (or creating) a contact with the same email
   *  under the project owner's address book. */
  contact_id: string | null;
  /** Which company this person belongs to on this project (grouping label
   *  for the unified People view) — prefilled from the matched contact's
   *  company at accept-time, editable afterward independent of it. */
  company: string | null;
  invited_by: string | null;
  created_at: string;
}

export function useCMProjectMembers(projectId: string | undefined) {
  return useQuery<CMProjectMember[]>({
    queryKey: ["cm_project_members", projectId],
    enabled: !!projectId && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db().from("cm_project_members").select("*").eq("project_id", projectId).order("created_at");
      if (error) throw error;
      return data as CMProjectMember[];
    },
    staleTime: STALE_TIME,
  });
}

export async function updateCMMemberRole(id: string, role: CMMemberRole) {
  const { error } = await db().from("cm_project_members").update({ role }).eq("id", id);
  if (error) throw error;
}

export async function updateCMMemberJobRole(id: string, jobRole: CMJobRole | null) {
  const { error } = await db().from("cm_project_members").update({ job_role: jobRole }).eq("id", id);
  if (error) throw error;
}

export async function updateCMMemberPosition(id: string, position: string | null) {
  const { error } = await db().from("cm_project_members").update({ position }).eq("id", id);
  if (error) throw error;
}

export async function updateCMMemberCompany(id: string, company: string | null) {
  const { error } = await db().from("cm_project_members").update({ company }).eq("id", id);
  if (error) throw error;
}

export async function removeCMProjectMember(id: string) {
  const { error } = await db().from("cm_project_members").delete().eq("id", id);
  if (error) throw error;
}

export interface CMProjectInvite {
  id: string;
  project_id: string;
  token: string;
  role: CMMemberRole;
  job_role: CMJobRole | null;
  created_by: string;
  revoked_at: string | null;
  created_at: string;
}

/** Result of the cm_get_invite_by_token RPC — an invite plus its parent
 *  project's owner/name, so the join route can show which project this is
 *  and upsert the invitee's Directory contact under the right owner,
 *  before the invitee is a project member (and so can't read cm_projects
 *  directly yet). */
export interface CMInviteWithProject extends CMProjectInvite {
  project_owner_id: string;
  project_name: string;
}

export function useCMProjectInvites(projectId: string | undefined) {
  return useQuery<CMProjectInvite[]>({
    queryKey: ["cm_project_invites", projectId],
    enabled: !!projectId && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db().from("cm_project_invites").select("*").eq("project_id", projectId).order("created_at", { ascending: false });
      if (error) throw error;
      return data as CMProjectInvite[];
    },
    staleTime: STALE_TIME,
  });
}

export async function createCMProjectInvite(createdBy: string, projectId: string, role: CMMemberRole, jobRole: CMJobRole | null = null) {
  const token = crypto.randomUUID();
  const { data, error } = await db().from("cm_project_invites").insert({ project_id: projectId, token, role, job_role: jobRole, created_by: createdBy }).select().single();
  if (error) throw error;
  return data as CMProjectInvite;
}

export async function revokeCMProjectInvite(id: string) {
  const { error } = await db().from("cm_project_invites").update({ revoked_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

/** Looks up an invite by token via a SECURITY DEFINER RPC rather than a
 *  direct table select — the invitee has no role on the project yet, so a
 *  plain RLS-gated select on cm_project_invites would be unreadable to
 *  them (and a permissive `using (true)` policy would leak every project's
 *  invite tokens to any signed-in user). The RPC also joins in the parent
 *  project's owner_id/name, which the join route needs before the invitee
 *  is a member of anything. */
export function useCMInviteByToken(token: string | undefined) {
  return useQuery<CMInviteWithProject | null>({
    queryKey: ["cm_project_invite", token],
    enabled: !!token && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db().rpc("cm_get_invite_by_token", { p_token: token }).maybeSingle();
      if (error) throw error;
      return (data as CMInviteWithProject | null) ?? null;
    },
    staleTime: 0,
  });
}

/** Finds an existing Directory contact by (owner, email) and refreshes its
 *  name, or creates one — via a SECURITY DEFINER RPC since this runs as the
 *  invitee, who has no write access to the project owner's contacts. */
export async function upsertCMDirectoryContactByEmail(ownerId: string, email: string, name: string, photoUrl: string | null = null): Promise<CMDirectoryContact> {
  const { data, error } = await db().rpc("cm_upsert_contact_from_invite", { p_owner_id: ownerId, p_email: email, p_name: name, p_photo_url: photoUrl }).single();
  if (error) throw error;
  return data as CMDirectoryContact;
}

/** Creates (or, on repeat visits to the same link, reuses) the invitee's
 *  own cm_project_members row from the invite + their own signed-in
 *  Supabase user — satisfies the `insert ... with check (user_id =
 *  auth.uid())` policy since this always runs as the invitee. `intake` is
 *  whatever the join-flow's one-time form captured (name editable from the
 *  Google default, position typed in fresh). Also upserts a matching
 *  Directory contact by email (creating one under the project owner's
 *  address book on first join, or reusing it on repeat visits) and links
 *  it via contact_id/company, so the invitee shows up in the owner's
 *  Contacts as soon as they join. */
export async function acceptCMProjectInvite(
  invite: CMInviteWithProject,
  user: { id: string; email?: string; user_metadata?: Record<string, unknown> },
  intake: { displayName: string; position: string | null },
) {
  const { data: existing, error: findError } = await db()
    .from("cm_project_members").select("*").eq("project_id", invite.project_id).eq("user_id", user.id).maybeSingle();
  if (findError) throw findError;
  if (existing) return existing as CMProjectMember;

  const avatarUrl = (user.user_metadata?.avatar_url as string) ?? null;
  const contact = user.email && intake.displayName
    ? await upsertCMDirectoryContactByEmail(invite.project_owner_id, user.email, intake.displayName, avatarUrl)
    : null;

  const { data, error } = await db().from("cm_project_members").insert({
    project_id: invite.project_id,
    user_id: user.id,
    role: invite.role,
    job_role: invite.job_role,
    email: user.email ?? null,
    display_name: intake.displayName || null,
    avatar_url: avatarUrl,
    position: intake.position,
    contact_id: contact?.id ?? null,
    company: contact?.company ?? null,
    invited_by: invite.created_by,
  }).select().single();
  if (error) throw error;
  return data as CMProjectMember;
}

/** Union of every company name already in use for a project's People list —
 *  feeds the company FieldSelect's searchable/creatable autocomplete so an
 *  owner/admin doesn't have to retype a name that's already used elsewhere
 *  in the same project. */
export function distinctCMCompanyNames(
  members: CMProjectMember[],
  subcontractors: CMProjectSubcontractor[],
  consultants: CMProjectConsultant[],
): string[] {
  const set = new Set<string>();
  for (const m of members) if (m.company) set.add(m.company);
  for (const s of subcontractors) if (s.contact.company) set.add(s.contact.company);
  for (const c of consultants) set.add(c.name);
  return Array.from(set).sort();
}

export interface CMLinkedMember {
  contact_id: string;
  avatar_url: string | null;
  display_name: string | null;
  role: CMMemberRole;
}

/** Every project member (across all of this owner's projects) that's linked
 *  to a Directory contact — keyed by contact_id, feeds Contacts' "this
 *  person is also on the platform" badge, Telegram-style. */
export function useCMLinkedMembersByContact(ownerId: string | undefined) {
  return useQuery<CMLinkedMember[]>({
    queryKey: ["cm_linked_members", ownerId],
    enabled: !!ownerId && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db()
        .from("cm_project_members")
        .select("contact_id, avatar_url, display_name, role, project:cm_projects!inner(owner_id)")
        .eq("project.owner_id", ownerId)
        .not("contact_id", "is", null);
      if (error) throw error;
      return (data as unknown as (CMLinkedMember & { project: { owner_id: string } })[])
        .map(({ project: _project, ...m }) => m);
    },
    staleTime: STALE_TIME,
  });
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

/** Tags a captured photo (from the general Photos capture flow, whichever
 *  module it ends up attached to) with a BOQ line item it documents progress
 *  for — independent of the photo's parent record, since one capture session
 *  can spread photos across five different tables depending on module. */
export interface CMPhotoBoqTag {
  id: string;
  project_id: string;
  owner_id: string;
  boq_item_id: string;
  photo_url: string;
  created_at: string;
}

export function useCMPhotoBoqTags(projectId: string | undefined) {
  return useQuery<CMPhotoBoqTag[]>({
    queryKey: ["cm_photo_boq_tags", projectId],
    enabled: !!projectId && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db().from("cm_photo_boq_tags").select("*").eq("project_id", projectId);
      if (error) throw error;
      return data as CMPhotoBoqTag[];
    },
    staleTime: STALE_TIME,
  });
}

export async function createCMPhotoBoqTag(ownerId: string, projectId: string, boqItemId: string, photoUrl: string) {
  const { error } = await db().from("cm_photo_boq_tags").insert({ owner_id: ownerId, project_id: projectId, boq_item_id: boqItemId, photo_url: photoUrl });
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
  doc_number: string | null;
  title: string;
  status: InspectionStatus;
  discipline: Discipline | null;
  location_id: string | null;
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
  input: Pick<CMInspection, "title"> & Partial<Pick<CMInspection, "status" | "discipline" | "location_id" | "inspector" | "inspection_date" | "notes">>,
) {
  const docNumber = await generateCMDocNumber(projectId, "inspection", "WIR", input.inspection_date);
  const { data, error } = await db().from("cm_inspections").insert({ owner_id: ownerId, project_id: projectId, doc_number: docNumber, ...input }).select().single();
  if (error) throw error;
  logCMActivity(projectId, ownerId, "created", "inspection", data.id, { title: data.title });
  return data as CMInspection;
}

export async function updateCMInspection(id: string, patch: Partial<CMInspection>) {
  const { data, error } = await db().from("cm_inspections").update(patch).eq("id", id).select().single();
  if (error) throw error;
  if (patch.status === "Failed" && data) {
    notifyCMUser(data.project_id, data.owner_id, "rejection", data.title, data.doc_number, "inspection", data.id);
  }
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
  doc_number: string | null;
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
  const docNumber = await generateCMDocNumber(projectId, "safety", "HSE", input.record_date);
  const { data, error } = await db().from("cm_safety_records").insert({ owner_id: ownerId, project_id: projectId, doc_number: docNumber, ...input }).select().single();
  if (error) throw error;
  logCMActivity(projectId, ownerId, "created", "safety", data.id, { title: data.title });
  if (data.severity === "Critical") {
    const { data: proj } = await db().from("cm_projects").select("owner_id").eq("id", projectId).maybeSingle();
    if (proj?.owner_id) notifyCMUser(projectId, proj.owner_id, "critical_safety_issue", data.title, data.doc_number, "safety", data.id);
  }
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

export const SUBMITTAL_TYPES = [
  "Shop Drawing", "Material Submittal", "Method Statement", "Material Sample", "Technical Datasheet",
  "Calculation", "RFI", "ITP", "Test Report", "As-Built Drawing", "O&M Manual", "Warranty", "Closeout Document",
] as const;
export type SubmittalType = typeof SUBMITTAL_TYPES[number];

/** A: Approved, B: Approved with Comments, C: Revise and Resubmit, D: Rejected, E: For Information. */
export const APPROVAL_CODES = ["A", "B", "C", "D", "E"] as const;
export type ApprovalCode = typeof APPROVAL_CODES[number];

export interface CMSubmittal {
  id: string;
  project_id: string;
  owner_id: string;
  doc_number: string | null;
  title: string;
  submittal_type: SubmittalType | null;
  spec_section: string | null;
  discipline: Discipline | null;
  status: SubmittalStatus;
  approval_code: ApprovalCode | null;
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
  input: Pick<CMSubmittal, "title"> & Partial<Pick<CMSubmittal, "submittal_type" | "spec_section" | "discipline" | "status" | "approval_code" | "submitted_date" | "due_date" | "reviewer" | "notes">>,
) {
  const docNumber = await generateCMDocNumber(projectId, "submittal", "SUB");
  const { data, error } = await db().from("cm_submittals").insert({ owner_id: ownerId, project_id: projectId, doc_number: docNumber, ...input }).select().single();
  if (error) throw error;
  logCMActivity(projectId, ownerId, "created", "submittal", data.id, { title: data.title });
  return data as CMSubmittal;
}

export async function updateCMSubmittal(id: string, patch: Partial<CMSubmittal>) {
  const { data, error } = await db().from("cm_submittals").update(patch).eq("id", id).select().single();
  if (error) throw error;
  if ((patch.status === "Rejected" || patch.status === "Revise & Resubmit") && data) {
    notifyCMUser(data.project_id, data.owner_id, "rejection", data.title, data.doc_number, "submittal", data.id);
  }
}

export async function deleteCMSubmittal(id: string) {
  const { error } = await db().from("cm_submittals").delete().eq("id", id);
  if (error) throw error;
}

/** One matched record from useCMGlobalSearch, across every module. */
export interface CMSearchResult {
  module: CMPhotoModule | "equipment" | "boq" | "schedule";
  id: string;
  title: string;
  subtitle: string | null;
  docNumber: string | null;
  to: string;
}

/** Searches every module's records within one project by title/doc number/
 *  description/company/person — the fields spec section 22 calls out.
 *  Scoped to a single project (matching how every list page already works
 *  in this app) rather than across all projects, since each source hook
 *  is itself per-project. */
export function useCMGlobalSearch(projectId: string | undefined, query: string): CMSearchResult[] {
  const { data: logs } = useCMDailyLogs(projectId);
  const { data: tasks } = useCMTasks(projectId);
  const { data: inspections } = useCMInspections(projectId);
  const { data: safetyRecords } = useCMSafetyRecords(projectId);
  const { data: submittals } = useCMSubmittals(projectId);
  const { data: equipment } = useCMEquipment(projectId);
  const { data: boqItems } = useCMBOQItems(projectId);
  const { data: scheduleItems } = useCMScheduleItems(projectId);

  const q = query.trim().toLowerCase();
  if (!q) return [];
  const matches = (...fields: (string | null | undefined)[]) => fields.some((f) => f?.toLowerCase().includes(q));

  const results: CMSearchResult[] = [];
  for (const l of logs ?? []) {
    if (matches(l.doc_number, l.activities, l.notes, l.log_date)) {
      results.push({ module: "siteDiary", id: l.id, title: l.log_date, subtitle: l.doc_number, docNumber: l.doc_number, to: "/cm/site-diary" });
    }
  }
  for (const x of tasks ?? []) {
    if (matches(x.doc_number, x.title, x.description, x.assignee)) {
      results.push({ module: "punchList", id: x.id, title: x.title, subtitle: x.assignee, docNumber: x.doc_number, to: "/cm/punch-list" });
    }
  }
  for (const x of inspections ?? []) {
    if (matches(x.doc_number, x.title, x.inspector, x.notes)) {
      results.push({ module: "inspection", id: x.id, title: x.title, subtitle: x.inspector, docNumber: x.doc_number, to: "/cm/inspection" });
    }
  }
  for (const x of safetyRecords ?? []) {
    if (matches(x.doc_number, x.title, x.description, x.involved)) {
      results.push({ module: "safety", id: x.id, title: x.title, subtitle: x.involved, docNumber: x.doc_number, to: "/cm/safety" });
    }
  }
  for (const x of submittals ?? []) {
    if (matches(x.doc_number, x.title, x.spec_section, x.reviewer)) {
      results.push({ module: "submittal", id: x.id, title: x.title, subtitle: x.reviewer, docNumber: x.doc_number, to: "/cm/submittal" });
    }
  }
  for (const x of equipment ?? []) {
    if (matches(x.name, x.type, x.notes)) {
      results.push({ module: "equipment", id: x.id, title: x.name, subtitle: x.type, docNumber: null, to: "/cm/equipment" });
    }
  }
  for (const x of boqItems ?? []) {
    if (matches(x.description, x.category)) {
      results.push({ module: "boq", id: x.id, title: x.description, subtitle: x.category, docNumber: null, to: "/cm/boq" });
    }
  }
  for (const x of scheduleItems ?? []) {
    if (matches(x.title, x.group_label)) {
      results.push({ module: "schedule", id: x.id, title: x.title, subtitle: x.group_label, docNumber: null, to: "/cm/schedule" });
    }
  }
  return results;
}

/** A record from another module that shares something concrete with the
 *  current record — the only two links the schema actually supports today:
 *  same location_id (Inspection <-> Punch List) and same discipline
 *  (Inspection <-> Submittal). Safety and Site Diary aren't included since
 *  neither table has a location_id or discipline column to match on. */
export interface CMRelatedItem {
  module: CMPhotoModule;
  id: string;
  docNumber: string | null;
  title: string;
  to: string;
}

export function useCMRelatedItems(
  projectId: string | undefined,
  self: { module: CMPhotoModule; id: string; locationId?: string | null; discipline?: string | null },
): CMRelatedItem[] {
  const { data: inspections } = useCMInspections(projectId);
  const { data: tasks } = useCMTasks(projectId);
  const { data: submittals } = useCMSubmittals(projectId);

  const items: CMRelatedItem[] = [];
  const isSelf = (module: CMPhotoModule, id: string) => module === self.module && id === self.id;

  if (self.locationId) {
    for (const x of inspections ?? []) {
      if (x.location_id === self.locationId && !isSelf("inspection", x.id)) {
        items.push({ module: "inspection", id: x.id, docNumber: x.doc_number, title: x.title, to: "/cm/inspection" });
      }
    }
    for (const x of tasks ?? []) {
      if (x.location_id === self.locationId && !isSelf("punchList", x.id)) {
        items.push({ module: "punchList", id: x.id, docNumber: x.doc_number, title: x.title, to: "/cm/punch-list" });
      }
    }
  }
  if (self.discipline) {
    for (const x of inspections ?? []) {
      if (x.discipline === self.discipline && !isSelf("inspection", x.id) && !items.some((i) => i.module === "inspection" && i.id === x.id)) {
        items.push({ module: "inspection", id: x.id, docNumber: x.doc_number, title: x.title, to: "/cm/inspection" });
      }
    }
    for (const x of submittals ?? []) {
      if (x.discipline === self.discipline && !isSelf("submittal", x.id)) {
        items.push({ module: "submittal", id: x.id, docNumber: x.doc_number, title: x.title, to: "/cm/submittal" });
      }
    }
  }
  return items;
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
  projects_view: "card" | "list";
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
