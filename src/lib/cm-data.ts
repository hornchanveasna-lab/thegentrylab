/**
 * Data layer for the Construction Management App (/cm/*), backed by its own
 * Supabase project (companies -> projects -> reports -> tasks/workforce/equipment/media).
 * Auth is Google via Supabase Auth; RLS is keyed on a synthetic telegram_id() bridged
 * into auth.jwt() user_metadata by the bootstrap_* RPCs (see supabase-cm migrations).
 */
import { useQuery } from "@tanstack/react-query";
import { supabaseCM } from "./supabase-cm";

const STALE_TIME = 30 * 1000;

export type CompanyRole = "owner" | "admin" | "manager" | "engineer" | "viewer";
export type ProjectRole = "manager" | "engineer" | "qc" | "safety" | "viewer";
export type ProjectStatus = "planning" | "active" | "on_hold" | "completed" | "cancelled";
export type ReportStatus = "draft" | "submitted" | "approved" | "rejected";
export type WeatherCond = "sunny" | "partly_cloudy" | "cloudy" | "light_rain" | "heavy_rain" | "storm";
export type TaskStatus = "not_started" | "ongoing" | "completed" | "delayed" | "suspended";
export type EquipStatus = "working" | "idle" | "breakdown" | "standby";

export const WEATHER_OPTIONS: WeatherCond[] = ["sunny", "partly_cloudy", "cloudy", "light_rain", "heavy_rain", "storm"];
export const TASK_STATUS_OPTIONS: TaskStatus[] = ["not_started", "ongoing", "completed", "delayed", "suspended"];
export const EQUIP_STATUS_OPTIONS: EquipStatus[] = ["working", "idle", "breakdown", "standby"];

export interface Company {
  id: string;
  name: string;
  name_kh: string | null;
  country: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Project {
  id: string;
  company_id: string;
  code: string | null;
  name: string;
  location: string | null;
  description: string | null;
  client_name: string | null;
  contract_value: number | null;
  currency: string | null;
  start_date: string | null;
  end_date: string | null;
  status: ProjectStatus;
  created_at: string;
}

export interface Report {
  id: string;
  project_id: string;
  report_number: number;
  report_date: string;
  status: ReportStatus;
  weather_am: WeatherCond | null;
  weather_pm: WeatherCond | null;
  temperature_am: number | null;
  temperature_pm: number | null;
  humidity_pct: number | null;
  summary: string | null;
  issues: string | null;
  created_by: string;
  submitted_at: string | null;
  approved_at: string | null;
  created_at: string;
}

export interface ReportTask {
  id: string;
  report_id: string;
  boq_item_id: string | null;
  description: string;
  location: string | null;
  trade: string | null;
  status: TaskStatus;
  progress_pct: number | null;
  qty_today: number | null;
  qty_unit: string | null;
  qty_cumulative: number | null;
  remarks: string | null;
  sort_order: number;
}

export interface WorkforceRecord {
  id: string;
  report_id: string;
  trade: string;
  subcontractor: string | null;
  count: number;
}

export interface EquipmentRecord {
  id: string;
  report_id: string;
  equipment_name: string;
  quantity: number;
  status: EquipStatus | null;
  remarks: string | null;
}

export interface MediaAttachment {
  id: string;
  report_id: string;
  report_task_id: string | null;
  media_type: "photo" | "video" | "document";
  bucket: string;
  storage_path: string;
  file_name: string | null;
  caption: string | null;
  created_at: string;
}

function db() {
  if (!supabaseCM) throw new Error("Construction Management App's Supabase client is not configured");
  return supabaseCM;
}

export interface TelegramUserRow {
  id: string;
  telegram_id: number;
  first_name: string;
  auth_user_id: string | null;
}

/** The `telegram_users` row bridged to this auth user (null until bootstrap runs). */
export function useMyTelegramUser(userId: string | undefined) {
  return useQuery<TelegramUserRow | null>({
    queryKey: ["cm_telegram_user", userId],
    enabled: !!userId && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db().from("telegram_users").select("*").eq("auth_user_id", userId).maybeSingle();
      if (error) throw error;
      return data as TelegramUserRow | null;
    },
    staleTime: STALE_TIME,
  });
}

/* ── Bootstrap (first-time setup) ───────────────────────── */
export async function bootstrapCompanyAndProject(companyName: string, projectName: string, displayName?: string) {
  const { data, error } = await db().rpc("bootstrap_company_and_project", {
    p_company_name: companyName,
    p_project_name: projectName,
    p_display_name: displayName ?? null,
  });
  if (error) throw error;
  return data![0] as { company_id: string; project_id: string; telegram_user_id: string; telegram_id: number };
}

export async function bootstrapProject(companyId: string, projectName: string) {
  const { data, error } = await db().rpc("bootstrap_project", {
    p_company_id: companyId,
    p_project_name: projectName,
  });
  if (error) throw error;
  return data![0] as { project_id: string };
}

/* ── Companies & Projects ───────────────────────────────── */
export function useMyCompanies(userId: string | undefined) {
  return useQuery<Company[]>({
    queryKey: ["cm_companies", userId],
    enabled: !!userId && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db().from("companies").select("*").order("created_at");
      if (error) throw error;
      return data as Company[];
    },
    staleTime: STALE_TIME,
  });
}

export function useCompanyProjects(companyId: string | undefined) {
  return useQuery<Project[]>({
    queryKey: ["cm_projects", companyId],
    enabled: !!companyId && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db().from("projects").select("*").eq("company_id", companyId).order("created_at", { ascending: false });
      if (error) throw error;
      return data as Project[];
    },
    staleTime: STALE_TIME,
  });
}

export function useProject(projectId: string | undefined) {
  return useQuery<Project | null>({
    queryKey: ["cm_project", projectId],
    enabled: !!projectId && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db().from("projects").select("*").eq("id", projectId).maybeSingle();
      if (error) throw error;
      return data as Project | null;
    },
    staleTime: STALE_TIME,
  });
}

/* ── Reports (site diary entries) ──────────────────────── */
export function useReports(projectId: string | undefined) {
  return useQuery<Report[]>({
    queryKey: ["cm_reports", projectId],
    enabled: !!projectId && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db().from("reports").select("*").eq("project_id", projectId)
        .order("report_date", { ascending: false }).order("report_number", { ascending: false });
      if (error) throw error;
      return data as Report[];
    },
    staleTime: STALE_TIME,
  });
}

export interface NewReportInput {
  report_date: string;
  weather_am: WeatherCond | null;
  weather_pm: WeatherCond | null;
  temperature_am: number | null;
  temperature_pm: number | null;
  humidity_pct: number | null;
  summary: string | null;
  issues: string | null;
}

export async function createReport(projectId: string, telegramUserId: string, input: NewReportInput) {
  const { data, error } = await db().from("reports").insert({
    project_id: projectId,
    created_by: telegramUserId,
    ...input,
  }).select().single();
  if (error) throw error;
  return data as Report;
}

export async function submitReport(reportId: string) {
  const { error } = await db().from("reports").update({ status: "submitted", submitted_at: new Date().toISOString() }).eq("id", reportId);
  if (error) throw error;
}

export async function deleteReport(reportId: string) {
  const { error } = await db().from("reports").delete().eq("id", reportId);
  if (error) throw error;
}

/* ── Report sub-records ─────────────────────────────────── */
export function useReportDetails(reportId: string | undefined) {
  return useQuery({
    queryKey: ["cm_report_details", reportId],
    enabled: !!reportId && !!supabaseCM,
    queryFn: async () => {
      const client = db();
      const [tasks, workforce, equipment, media] = await Promise.all([
        client.from("report_tasks").select("*").eq("report_id", reportId).order("sort_order"),
        client.from("workforce_records").select("*").eq("report_id", reportId).order("sort_order"),
        client.from("equipment_records").select("*").eq("report_id", reportId).order("sort_order"),
        client.from("media_attachments").select("*").eq("report_id", reportId).order("sort_order"),
      ]);
      if (tasks.error) throw tasks.error;
      if (workforce.error) throw workforce.error;
      if (equipment.error) throw equipment.error;
      if (media.error) throw media.error;
      return {
        tasks: tasks.data as ReportTask[],
        workforce: workforce.data as WorkforceRecord[],
        equipment: equipment.data as EquipmentRecord[],
        media: media.data as MediaAttachment[],
      };
    },
    staleTime: STALE_TIME,
  });
}

export async function createReportTask(reportId: string, input: Omit<ReportTask, "id" | "report_id" | "sort_order">) {
  const { error } = await db().from("report_tasks").insert({ report_id: reportId, ...input });
  if (error) throw error;
}

export async function createWorkforceRecord(reportId: string, input: { trade: string; subcontractor: string | null; count: number }) {
  const { error } = await db().from("workforce_records").insert({ report_id: reportId, ...input });
  if (error) throw error;
}

export async function createEquipmentRecord(reportId: string, input: { equipment_name: string; quantity: number; status: EquipStatus; remarks: string | null }) {
  const { error } = await db().from("equipment_records").insert({ report_id: reportId, ...input });
  if (error) throw error;
}

/** All photos across every report in a project (for the project-wide Photos tab). */
export function useProjectPhotos(projectId: string | undefined) {
  return useQuery<(MediaAttachment & { report_date: string })[]>({
    queryKey: ["cm_project_photos", projectId],
    enabled: !!projectId && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db()
        .from("media_attachments")
        .select("*, reports!inner(project_id, report_date)")
        .eq("reports.project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]).map((m) => ({ ...m, report_date: m.reports.report_date }));
    },
    staleTime: STALE_TIME,
  });
}

/* ── Media (photos) ─────────────────────────────────────── */
export async function uploadReportMedia(reportId: string, file: File, caption?: string): Promise<MediaAttachment> {
  const client = db();
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${reportId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error: upErr } = await client.storage.from("site-media").upload(path, file, { upsert: false });
  if (upErr) throw upErr;
  const { data, error } = await client.from("media_attachments").insert({
    report_id: reportId,
    media_type: "photo",
    bucket: "site-media",
    storage_path: path,
    file_name: file.name,
    caption: caption ?? null,
  }).select().single();
  if (error) throw error;
  return data as MediaAttachment;
}

export async function getMediaSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await db().storage.from("site-media").createSignedUrl(storagePath, 3600);
  if (error) throw error;
  return data.signedUrl;
}
