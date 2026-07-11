/**
 * Data layer for the Construction Management App (/pm/*).
 * User-scoped (RLS: owner_id = auth.uid()) — no static seed fallback, requires auth + Supabase.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";

const STALE_TIME = 60 * 1000;

export type ProjectStatus = "Planning" | "Active" | "On Hold" | "Completed";
export type TaskStatus = "To Do" | "In Progress" | "Blocked" | "Done";
export type TaskPriority = "Low" | "Medium" | "High";

export interface PMProject {
  id: string;
  owner_id: string;
  name: string;
  client: string | null;
  location: string | null;
  status: ProjectStatus;
  start_date: string | null;
  target_end_date: string | null;
  description: string | null;
  cover_image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface PMDailyLog {
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
  created_at: string;
  updated_at: string;
}

export interface PMTask {
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
  created_at: string;
  updated_at: string;
}

function requireSupabase() {
  if (!supabase) throw new Error("Supabase is not configured (missing VITE_SUPABASE_URL/ANON_KEY)");
  return supabase;
}

/* ── Projects ───────────────────────────────────────────── */
export function usePMProjects(userId: string | undefined) {
  return useQuery<PMProject[]>({
    queryKey: ["pm_projects", userId],
    enabled: !!userId && !!supabase,
    queryFn: async () => {
      const db = requireSupabase();
      const { data, error } = await db
        .from("pm_projects")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as PMProject[];
    },
    staleTime: STALE_TIME,
  });
}

export function usePMProject(projectId: string | undefined) {
  return useQuery<PMProject | null>({
    queryKey: ["pm_project", projectId],
    enabled: !!projectId && !!supabase,
    queryFn: async () => {
      const db = requireSupabase();
      const { data, error } = await db
        .from("pm_projects")
        .select("*")
        .eq("id", projectId)
        .maybeSingle();
      if (error) throw error;
      return data as PMProject | null;
    },
    staleTime: STALE_TIME,
  });
}

export async function createPMProject(
  ownerId: string,
  input: Pick<PMProject, "name"> & Partial<Pick<PMProject, "client" | "location" | "status" | "start_date" | "target_end_date" | "description">>,
) {
  const db = requireSupabase();
  const { data, error } = await db
    .from("pm_projects")
    .insert({ owner_id: ownerId, ...input })
    .select()
    .single();
  if (error) throw error;
  return data as PMProject;
}

export async function updatePMProject(id: string, patch: Partial<PMProject>) {
  const db = requireSupabase();
  const { error } = await db.from("pm_projects").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deletePMProject(id: string) {
  const db = requireSupabase();
  const { error } = await db.from("pm_projects").delete().eq("id", id);
  if (error) throw error;
}

/* ── Daily logs (site diary) ───────────────────────────────── */
export function usePMDailyLogs(projectId: string | undefined) {
  return useQuery<PMDailyLog[]>({
    queryKey: ["pm_daily_logs", projectId],
    enabled: !!projectId && !!supabase,
    queryFn: async () => {
      const db = requireSupabase();
      const { data, error } = await db
        .from("pm_daily_logs")
        .select("*")
        .eq("project_id", projectId)
        .order("log_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as PMDailyLog[];
    },
    staleTime: STALE_TIME,
  });
}

export async function createPMDailyLog(
  ownerId: string,
  projectId: string,
  input: Partial<Omit<PMDailyLog, "id" | "project_id" | "owner_id" | "created_at" | "updated_at">>,
) {
  const db = requireSupabase();
  const { data, error } = await db
    .from("pm_daily_logs")
    .insert({ owner_id: ownerId, project_id: projectId, ...input })
    .select()
    .single();
  if (error) throw error;
  return data as PMDailyLog;
}

export async function deletePMDailyLog(id: string) {
  const db = requireSupabase();
  const { error } = await db.from("pm_daily_logs").delete().eq("id", id);
  if (error) throw error;
}

/* ── Tasks ──────────────────────────────────────────────── */
export function usePMTasks(projectId: string | undefined) {
  return useQuery<PMTask[]>({
    queryKey: ["pm_tasks", projectId],
    enabled: !!projectId && !!supabase,
    queryFn: async () => {
      const db = requireSupabase();
      const { data, error } = await db
        .from("pm_tasks")
        .select("*")
        .eq("project_id", projectId)
        .order("sort_order")
        .order("created_at");
      if (error) throw error;
      return data as PMTask[];
    },
    staleTime: STALE_TIME,
  });
}

export async function createPMTask(
  ownerId: string,
  projectId: string,
  input: Pick<PMTask, "title"> & Partial<Pick<PMTask, "description" | "status" | "priority" | "assignee" | "due_date">>,
) {
  const db = requireSupabase();
  const { data, error } = await db
    .from("pm_tasks")
    .insert({ owner_id: ownerId, project_id: projectId, ...input })
    .select()
    .single();
  if (error) throw error;
  return data as PMTask;
}

export async function updatePMTask(id: string, patch: Partial<PMTask>) {
  const db = requireSupabase();
  const { error } = await db.from("pm_tasks").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deletePMTask(id: string) {
  const db = requireSupabase();
  const { error } = await db.from("pm_tasks").delete().eq("id", id);
  if (error) throw error;
}

/* ── Photo upload (pm-photos bucket, path-scoped by owner) ── */
export async function uploadPMPhoto(ownerId: string, projectId: string, file: File): Promise<string> {
  const db = requireSupabase();
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${ownerId}/${projectId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await db.storage.from("pm-photos").upload(path, file, { upsert: false });
  if (error) throw error;
  const { data } = db.storage.from("pm-photos").getPublicUrl(path);
  return data.publicUrl;
}
