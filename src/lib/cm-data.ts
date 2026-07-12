/**
 * Data layer for the Construction Management App (/cm/*), backed by its own
 * Supabase project (own auth.users, standard auth.uid()-based RLS — no shared
 * account system, no custom JWT claims).
 */
import { useQuery } from "@tanstack/react-query";
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
  location: string | null;
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

export interface CMDailyLog {
  id: string;
  project_id: string;
  owner_id: string;
  log_date: string;
  weather: string | null;
  temperature_c: number | null;
  workforce_count: number | null;
  progress_pct: number | null;
  activities: string | null;
  materials_used: string | null;
  equipment_used: string | null;
  issues: string | null;
  notes: string | null;
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
  input: Pick<CMProject, "name"> & Partial<Pick<CMProject, "client" | "location" | "status" | "start_date" | "target_end_date" | "description" | "project_code">>,
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

/* ── Tasks ──────────────────────────────────────────────── */
export function useCMTasks(projectId: string | undefined) {
  return useQuery<CMTask[]>({
    queryKey: ["cm_tasks", projectId],
    enabled: !!projectId && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db().from("cm_tasks").select("*").eq("project_id", projectId).order("sort_order").order("created_at");
      if (error) throw error;
      return data as CMTask[];
    },
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

export interface StampPhotoOptions {
  watermark: boolean;
  timestamp: boolean;
  companyLogoUrl?: string | null;
  clientLogoUrl?: string | null;
  consultantLogoUrls?: string[];
  projectName?: string | null;
  projectCode?: string | null;
  location?: string | null;
}

/** Burns project identification onto a photo before it's uploaded, so the
 *  record stays legible even if it's later exported or shared outside the
 *  app. Layout: the company logo sits alone, top-right, plain (no shadow —
 *  logos don't need one). Bottom-left holds the project logo beside the
 *  project name/code/location, with every consultant logo in a row directly
 *  beneath. Bottom-right holds the capture date/time. Text keeps a soft
 *  drop-shadow for legibility over any background. Keeps the original pixel
 *  dimensions — this is the full-quality photo that gets stored, not a
 *  thumbnail. */
export async function stampPhoto(file: File, opts: StampPhotoOptions): Promise<File> {
  if (!opts.watermark && !opts.timestamp) return file;
  const img = await loadImage(file);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0);

  const scale = Math.max(1, canvas.width / 1000);
  const pad = 16 * scale;

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

  if (opts.watermark) {
    // ── top-right: company logo, alone, plain ──
    const companyLogo = opts.companyLogoUrl ? await loadExternalImage(opts.companyLogoUrl) : null;
    if (companyLogo) {
      const companyLogoH = 52 * scale;
      const w = (companyLogo.naturalWidth / companyLogo.naturalHeight) * companyLogoH;
      ctx.drawImage(companyLogo, canvas.width - pad - w, pad, w, companyLogoH);
    }

    // ── bottom-left: project logo + project name/code/location, with every
    //    consultant logo in a row directly beneath ──
    let leftCursorY = canvas.height - pad;

    const consultantLogos = (await Promise.all((opts.consultantLogoUrls ?? []).map(loadExternalImage))).filter(
      (l): l is HTMLImageElement => !!l,
    );
    if (consultantLogos.length > 0) {
      const maxRowWidth = canvas.width * 0.6;
      const gap = 8 * scale;
      let logoH = 40 * scale;
      const widthAt = (h: number) => consultantLogos.reduce((sum, l) => sum + (l.naturalWidth / l.naturalHeight) * h, 0) + gap * (consultantLogos.length - 1);
      while (widthAt(logoH) > maxRowWidth && logoH > 18 * scale) logoH -= 2 * scale;
      let x = pad;
      const y = leftCursorY - logoH;
      for (const logo of consultantLogos) {
        const w = (logo.naturalWidth / logo.naturalHeight) * logoH;
        ctx.drawImage(logo, x, y, w, logoH);
        x += w + gap;
      }
      leftCursorY -= logoH + pad * 0.5;
    }

    const projectLogo = opts.clientLogoUrl ? await loadExternalImage(opts.clientLogoUrl) : null;
    const lines: { text: string; fontSize: number; weight: number }[] = [];
    if (opts.projectName) lines.push({ text: opts.projectName, fontSize: 21 * scale, weight: 700 });
    if (opts.projectCode) lines.push({ text: opts.projectCode, fontSize: 14 * scale, weight: 500 });
    if (opts.location) lines.push({ text: opts.location, fontSize: 14 * scale, weight: 500 });

    const projectLogoH = 64 * scale;
    const lineGap = 4 * scale;
    const textBlockH = lines.reduce((s, l) => s + l.fontSize, 0) + lineGap * Math.max(0, lines.length - 1);

    let leftX = pad;
    if (projectLogo) {
      const w = (projectLogo.naturalWidth / projectLogo.naturalHeight) * projectLogoH;
      ctx.drawImage(projectLogo, leftX, leftCursorY - projectLogoH, w, projectLogoH);
      leftX += w + pad * 0.7;
    }
    if (lines.length > 0) {
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      let ly = leftCursorY - textBlockH;
      for (const l of lines) {
        ctx.font = `${l.weight} ${l.fontSize}px sans-serif`;
        ctx.fillStyle = "#fff";
        fillShadowedText(l.text, leftX, ly);
        ly += l.fontSize + lineGap;
      }
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
  projectId: string;
  projectName: string;
  module: CMPhotoModule;
  caption: string | null;
  recordId: string;
}

type PhotoRow = { id: string; photos: string[]; photo_thumbs: string[]; project_id: string; cm_projects: { name: string } | null };

function photoRowsToContext<T extends PhotoRow>(rows: T[], module: CMPhotoModule, date: (r: T) => string, caption: (r: T) => string | null): CMPhotoWithContext[] {
  return rows.flatMap((r) =>
    r.photos.map((url, i) => ({
      url, thumbUrl: r.photo_thumbs[i] || url, module, date: date(r), projectId: r.project_id, recordId: r.id,
      projectName: r.cm_projects?.name ?? "Untitled project", caption: caption(r),
    })),
  );
}

export function useAllCMPhotos(userId: string | undefined) {
  return useQuery<CMPhotoWithContext[]>({
    queryKey: ["cm_all_photos", userId],
    enabled: !!userId && !!supabaseCM,
    queryFn: async () => {
      const client = db();
      const [logs, inspections, safety, tasks, submittals] = await Promise.all([
        client.from("cm_daily_logs").select("id, photos, photo_thumbs, log_date, activities, project_id, cm_projects(name)"),
        client.from("cm_inspections").select("id, photos, photo_thumbs, inspection_date, title, project_id, cm_projects(name)"),
        client.from("cm_safety_records").select("id, photos, photo_thumbs, record_date, title, project_id, cm_projects(name)"),
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
      return all.sort((a, b) => b.date.localeCompare(a.date));
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

export function useCMSubmittals(projectId: string | undefined) {
  return useQuery<CMSubmittal[]>({
    queryKey: ["cm_submittals", projectId],
    enabled: !!projectId && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db().from("cm_submittals").select("*").eq("project_id", projectId).order("created_at", { ascending: false });
      if (error) throw error;
      return data as CMSubmittal[];
    },
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

/* ── Account settings (company branding, language) ─────── */
export interface CMAccountSettings {
  owner_id: string;
  company_name: string | null;
  company_logo_url: string | null;
  language: "en" | "km" | "zh";
  photo_watermark: boolean;
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
