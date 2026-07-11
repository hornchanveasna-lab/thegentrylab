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
  input: Pick<CMProject, "name"> & Partial<Pick<CMProject, "client" | "location" | "status" | "start_date" | "target_end_date" | "description">>,
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
