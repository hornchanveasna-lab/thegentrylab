/**
 * Data layer for the Construction Management App (/cm/*), backed by its own
 * Supabase project (own auth.users, standard auth.uid()-based RLS — no shared
 * account system, no custom JWT claims).
 */
import { useMemo } from "react";
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
export type TaskStatus = "To Do" | "In Progress" | "Blocked" | "Ready for Check" | "Done";
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
  /** Which feature modules (of ACTIVE_MODULE_KEYS) are turned off for this
   *  project — same shape/pattern as disabled_disciplines. Toggle only;
   *  nothing yet hides nav tiles or routes based on this list. */
  disabled_modules: string[];
  doc_module_codes: Record<string, string>;
  revision_format: string;
  doc_footer: string | null;
  /** Per-project override of the Equipment status list; null = use EQUIPMENT_STATUS_OPTIONS. */
  equipment_status_options: string[] | null;
  /** % variance (plan - actual) at which cmScheduleStatus reports "Delayed". Defaults to 10. */
  schedule_delay_threshold_pct: number;
  /** Per-project override/addition to Manpower's DEFAULT_TRADES suggestion list. */
  manpower_default_trades: string[] | null;
  /** Suggested BOQ category list (BOQ has no built-in list; free text otherwise). */
  boq_default_categories: string[] | null;
  /** Per-module New-entry defaults and behavior toggles, e.g.
   *  { punch_list: { priority: "High", requireAfterPhoto: true }, safety: { recordType: "...", severity: "Low" } }.
   *  Generic JSON so new modules/fields don't need their own migration. */
  module_defaults: Record<string, Record<string, unknown>> | null;
  /** Last computed `cmProjectHealthScore` snapshot, so a load can detect a
   *  drop since the previous view and fire a notification. Null until the
   *  score has been checked at least once. */
  last_health_score: number | null;
  last_health_checked_at: string | null;
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
  /** Worker category (Engineer, Skilled Worker, Operator…) — missing on
   *  rows created before the Manpower module round; treat as unset. */
  category?: string | null;
  /** Links the crew to a cm_project_locations row; null/missing = project-wide. */
  location_id?: string | null;
  /** Free-text related work activity, e.g. "Steel Column Erection". */
  activity?: string | null;
  /** Per-worker hours for the day. Missing on old rows — labor-hour math
   *  falls back to 8h normal / 0h OT so historical totals stay sensible. */
  normal_hours?: number | null;
  ot_hours?: number | null;
  /** Workforce photos for this crew (photo-first entry) — stored on the row
   *  itself so the picture travels with the shared Site Diary record. */
  photos?: string[];
  photo_thumbs?: string[];
}

/** Worker categories per the Manpower spec — a fixed suggestion list, not a
 *  constraint; rows may still carry any free-text category. */
export const CM_WORKER_CATEGORIES = [
  "Project Management", "Engineer", "Supervisor", "Foreman", "Skilled Worker",
  "General Worker", "Operator", "Driver", "Safety Staff", "QA/QC Staff",
  "Surveyor", "Technician", "Other",
] as const;

/** Labor Hours = Worker Count × Working Hours, normal and OT kept separate.
 *  Rows without hours (pre-module data) count as 8h normal / 0h OT. */
export function cmLaborHours(rows: CMManpowerRow[]) {
  let normal = 0, ot = 0;
  for (const r of rows) {
    normal += r.count * (r.normal_hours ?? 8);
    ot += r.count * (r.ot_hours ?? 0);
  }
  return { normal, ot, total: normal + ot };
}

/** Where a reported BOQ quantity sits in the commercial pipeline:
 *  Reported (site team) -> Accepted (QA/QC or consultant) -> Claimed
 *  (included in a payment application) -> Certified (client/consultant
 *  sign-off, which may differ from the claimed amount). */
export type CMQuantityStatus = "Reported" | "Accepted" | "Claimed" | "Certified";
export const QUANTITY_STATUS_ORDER: CMQuantityStatus[] = ["Reported", "Accepted", "Claimed", "Certified"];

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
  /** Missing on rows created before this field existed — treat as "Reported". */
  status?: CMQuantityStatus;
  /** Only meaningful once status is "Certified"; the consultant/client may
   *  certify a different quantity than what was claimed. Falls back to
   *  `quantity` when absent. */
  certified_quantity?: string | null;
  /** Set when this delivery is pulled into an IPC snapshot (status
   *  "Claimed" -> included in a Draft IPC) — prevents a later IPC from
   *  double-counting it. Missing on rows created before IPCs existed. */
  ipc_id?: string | null;
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
  /** The single Punch List Document ("one document to send in and out")
   *  this item belongs to — every item raised on the same project/day
   *  shares one document_id, and the document (not the item) carries the
   *  doc_number and the Issue/Close workflow. Null on items created before
   *  documents existed. */
  document_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  location_id: string | null;
  assignee: string | null;
  due_date: string | null;
  sort_order: number;
  /** Before photos — taken when the punch item is raised. */
  photos: string[];
  photo_thumbs: string[];
  /** After photos — uploaded by the responsible company once the defect
   *  is fixed, for the engineer to compare against the before photos. */
  after_photos: string[];
  after_photo_thumbs: string[];
  files: CMFileAttachment[];
  /** Set when an engineer accepts (closes) the punch from "Ready for
   *  Check" — null again if a later reopen sends it back for rework. */
  verified_by: string | null;
  closed_at: string | null;
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
export async function fetchCMDailyLogsList(projectId: string): Promise<CMDailyLog[]> {
  const { data, error } = await db().from("cm_daily_logs").select("*").eq("project_id", projectId)
    .order("log_date", { ascending: false }).order("created_at", { ascending: false });
  if (error) throw error;
  return data as CMDailyLog[];
}

export function useCMDailyLogs(projectId: string | undefined) {
  return useQuery<CMDailyLog[]>({
    queryKey: ["cm_daily_logs", projectId],
    enabled: !!projectId && !!supabaseCM,
    queryFn: () => fetchCMDailyLogsList(projectId!),
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

/** Day-scoped sibling of `generateCMDocNumber` — the sequence resets every
 *  calendar day instead of running for the whole project/year, so the code
 *  itself carries the day (e.g. `PRJ-PL-2026-08-09-01`), matching modules
 *  whose list groups records into day sections (Punch List). */
async function generateCMDocNumberDaily(projectId: string, moduleKey: string, fallbackCode: string, dateStr: string): Promise<string | null> {
  try {
    const { data: proj } = await db().from("cm_projects").select("doc_module_codes").eq("id", projectId).maybeSingle();
    const moduleCode = (proj?.doc_module_codes as Record<string, string> | null)?.[moduleKey] || fallbackCode;
    const { data } = await db().rpc("cm_next_doc_number_daily", {
      p_project_id: projectId, p_module_key: moduleKey, p_module_code: moduleCode, p_doc_date: dateStr,
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

export interface CMTaskWithProject extends CMTask {
  projectName: string;
}

/** Punch List's "All Projects" filter — same cross-project pattern as
 *  useAllCMDailyLogs, joined with the project name for display. */
export function useAllCMTasks(userId: string | undefined) {
  return useQuery<CMTaskWithProject[]>({
    queryKey: ["cm_all_tasks", userId],
    enabled: !!userId && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db().from("cm_tasks").select("*, cm_projects(name)").order("sort_order").order("created_at");
      if (error) throw error;
      return (data as unknown as (CMTask & { cm_projects: { name: string } | null })[]).map((r) => {
        const { cm_projects, ...rec } = r;
        return { ...rec, projectName: cm_projects?.name ?? "Untitled project" };
      });
    },
    staleTime: STALE_TIME,
  });
}

/* ── Punch List Documents ─────────────────────────────────
 *  "One document to send in and out": every punch item raised on a given
 *  project/day shares a single Punch List Document, which carries the one
 *  doc_number and its own Draft → Issued → Closed workflow — Issued means
 *  it's gone out to the contractor, Closed means it's come back. Individual
 *  cm_tasks rows are untouched (own id, status, photos, comments) so
 *  everything already built on them keeps working; they just belong to a
 *  document via document_id. */
export type CMPunchListDocStatus = "Draft" | "Issued" | "Closed";

export interface CMPunchListDocument {
  id: string;
  project_id: string;
  owner_id: string;
  doc_number: string | null;
  doc_date: string;
  status: CMPunchListDocStatus;
  issued_at: string | null;
  issued_by: string | null;
  closed_at: string | null;
  closed_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useCMPunchListDocuments(projectId: string | undefined) {
  return useQuery<CMPunchListDocument[]>({
    queryKey: ["cm_punch_list_documents", projectId],
    enabled: !!projectId && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db().from("cm_punch_list_documents").select("*").eq("project_id", projectId).order("doc_date", { ascending: false });
      if (error) throw error;
      return data as CMPunchListDocument[];
    },
    staleTime: STALE_TIME,
  });
}

export interface CMPunchListDocumentWithProject extends CMPunchListDocument {
  projectName: string;
}

/** Punch List's "All Projects" filter for documents — same cross-project
 *  pattern as useAllCMTasks. */
export function useAllCMPunchListDocuments(userId: string | undefined) {
  return useQuery<CMPunchListDocumentWithProject[]>({
    queryKey: ["cm_all_punch_list_documents", userId],
    enabled: !!userId && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db().from("cm_punch_list_documents").select("*, cm_projects(name)").order("doc_date", { ascending: false });
      if (error) throw error;
      return (data as unknown as (CMPunchListDocument & { cm_projects: { name: string } | null })[]).map((r) => {
        const { cm_projects, ...doc } = r;
        return { ...doc, projectName: cm_projects?.name ?? "Untitled project" };
      });
    },
    staleTime: STALE_TIME,
  });
}

export function useCMPunchListDocument(id: string | undefined) {
  return useQuery<CMPunchListDocument | null>({
    queryKey: ["cm_punch_list_document", id],
    enabled: !!id && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db().from("cm_punch_list_documents").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as CMPunchListDocument | null;
    },
    staleTime: STALE_TIME,
  });
}

/** Finds (or creates) the one Punch List Document for a project/day —
 *  mirrors findOrCreateCMDailyLog's find-or-create pattern for Site Diary.
 *  The unique (project_id, doc_date) constraint means a losing concurrent
 *  insert just refetches the winner rather than failing the capture. */
export async function findOrCreateCMPunchListDocument(ownerId: string, projectId: string, docDate: string): Promise<CMPunchListDocument> {
  const { data: existing } = await db().from("cm_punch_list_documents").select("*").eq("project_id", projectId).eq("doc_date", docDate).maybeSingle();
  if (existing) return existing as CMPunchListDocument;

  const docNumber = await generateCMDocNumberDaily(projectId, "punch_list", "PL", docDate);
  const { data, error } = await db().from("cm_punch_list_documents")
    .insert({ owner_id: ownerId, project_id: projectId, doc_date: docDate, doc_number: docNumber })
    .select().single();
  if (error) {
    const { data: winner } = await db().from("cm_punch_list_documents").select("*").eq("project_id", projectId).eq("doc_date", docDate).maybeSingle();
    if (winner) return winner as CMPunchListDocument;
    throw error;
  }
  return data as CMPunchListDocument;
}

/** Sends the document out to the contractor — items can still be worked
 *  through, but the document itself is now "in flight". */
export async function issueCMPunchListDocument(id: string, projectId: string, actorId: string, docNumber: string | null) {
  const { error } = await db().from("cm_punch_list_documents")
    .update({ status: "Issued", issued_at: new Date().toISOString(), issued_by: actorId }).eq("id", id);
  if (error) throw error;
  logCMActivity(projectId, actorId, "issued", "punch_list_document", id, { doc_number: docNumber });
}

/** Marks the document as returned/received — the "sent in" half of the
 *  round trip. */
export async function closeCMPunchListDocument(id: string, projectId: string, actorId: string, docNumber: string | null) {
  const { error } = await db().from("cm_punch_list_documents")
    .update({ status: "Closed", closed_at: new Date().toISOString(), closed_by: actorId }).eq("id", id);
  if (error) throw error;
  logCMActivity(projectId, actorId, "closed", "punch_list_document", id, { doc_number: docNumber });
}

export async function createCMTask(
  ownerId: string,
  projectId: string,
  input: Pick<CMTask, "title"> & Partial<Pick<CMTask, "description" | "status" | "priority" | "location_id" | "assignee" | "due_date">>,
  /** Attaches the item to this specific Punch List Document instead of
   *  resolving (or creating) today's document for the project — used when
   *  adding an item from inside an already-open, not-necessarily-today
   *  document. */
  documentId?: string,
) {
  const docId = documentId ?? (await findOrCreateCMPunchListDocument(ownerId, projectId, new Date().toISOString().slice(0, 10))).id;
  const { data, error } = await db().from("cm_tasks").insert({ owner_id: ownerId, project_id: projectId, document_id: docId, ...input }).select().single();
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

/** Any-file attachment — same bucket/signing as photos, but keeps the
 *  original filename, size and MIME type since these aren't necessarily
 *  images (PDFs, DWG, DOCX, XLSX... for submittal approval documents). */
export interface CMFileAttachment {
  name: string;
  url: string;
  size: number;
  type: string;
}

export async function uploadCMFile(ownerId: string, projectId: string, file: File): Promise<CMFileAttachment> {
  const url = await uploadCMPhoto(ownerId, projectId, file);
  return { name: file.name, url, size: file.size, type: file.type };
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
  /** Moment to burn into the stamp. Defaults to now — pass the original
   *  capture time for photos uploaded later (e.g. from the offline outbox)
   *  so the stamp reflects when the photo was actually taken, not when it
   *  finally synced. */
  captureTime?: Date;
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
    const now = opts.captureTime ?? new Date();
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

/** Burns the account's company/client/consultant stamp (same as the Photos
 *  module's capture flow) onto every captured photo before upload, then
 *  uploads each at full quality plus a thumbnail. This is the one place
 *  every module's camera capture should route through so the stamp stays
 *  consistent everywhere instead of only on Photos-module captures. */
export async function stampAndUploadCMPhotos(ownerId: string, projectId: string, files: File[], captureTime?: Date): Promise<{ url: string; thumbUrl: string }[]> {
  if (files.length === 0) return [];
  const [{ data: account }, { data: project }, { data: consultants }] = await Promise.all([
    db().from("cm_account_settings").select("*").eq("owner_id", ownerId).maybeSingle(),
    db().from("cm_projects").select("*").eq("id", projectId).maybeSingle(),
    db().from("cm_project_consultants").select("*").eq("project_id", projectId),
  ]);
  const acc = account as CMAccountSettings | null;
  const proj = project as CMProject | null;
  const stampOpts: StampPhotoOptions = {
    showCompanyLogo: acc?.photo_show_company_logo ?? true,
    showProjectInfo: acc?.photo_show_project_info ?? true,
    showConsultantLogos: acc?.photo_show_consultant_logos ?? true,
    monotoneLogos: acc?.photo_monotone_logos ?? false,
    timestamp: acc?.photo_timestamp ?? true,
    companyLogoUrl: acc?.company_logo_url ?? null,
    clientLogoUrl: proj?.client_logo_url ?? null,
    consultantLogoUrls: ((consultants ?? []) as CMProjectConsultant[]).map((c) => c.logo_url).filter((u): u is string => !!u),
    projectName: proj?.name ?? null,
    projectCode: proj?.project_code ?? null,
    location: proj?.location ?? null,
    captureTime,
  };
  const stamped = await Promise.all(files.map((f) => stampPhoto(f, stampOpts)));
  return Promise.all(stamped.map((f) => uploadCMPhotoWithThumb(ownerId, projectId, f)));
}

export interface CMStampedImageUpload extends CMFileAttachment {
  thumbUrl: string;
}

/** The quick-upload "Upload or Capture" action accepts any file, mixing real
 *  photos (from the device camera) with documents (PDFs, DWG, XLSX). Only
 *  the photos should get the branding stamp — burning today's date onto a
 *  scanned document would misrepresent it as captured today. Splits the
 *  picked files by MIME type, stamps and uploads the images through the same
 *  pipeline as every other camera capture, and uploads the rest untouched. */
export async function uploadCMQuickCaptureFiles(ownerId: string, projectId: string, files: File[]): Promise<{ images: CMStampedImageUpload[]; otherFiles: CMFileAttachment[] }> {
  const imageFiles = files.filter((f) => f.type.startsWith("image/"));
  const otherFiles = files.filter((f) => !f.type.startsWith("image/"));
  const [uploadedImages, uploadedOther] = await Promise.all([
    stampAndUploadCMPhotos(ownerId, projectId, imageFiles),
    Promise.all(otherFiles.map((f) => uploadCMFile(ownerId, projectId, f))),
  ]);
  const images = uploadedImages.map((u, i) => ({
    name: imageFiles[i].name, url: u.url, size: imageFiles[i].size, type: imageFiles[i].type, thumbUrl: u.thumbUrl,
  }));
  return { images, otherFiles: uploadedOther };
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
        client.from("cm_daily_logs").select("id, photos, photo_thumbs, log_date, activities, manpower, deliveries, visitors, project_id, created_at, cm_projects(name)"),
        client.from("cm_inspections").select("id, photos, photo_thumbs, inspection_date, title, project_id, created_at, cm_projects(name)"),
        client.from("cm_safety_records").select("id, photos, photo_thumbs, record_date, title, project_id, created_at, cm_projects(name)"),
        client.from("cm_tasks").select("id, photos, photo_thumbs, created_at, title, project_id, cm_projects(name)"),
        client.from("cm_submittals").select("id, photos, photo_thumbs, submitted_date, created_at, title, project_id, cm_projects(name)"),
      ]);
      for (const r of [logs, inspections, safety, tasks, submittals]) if (r.error) throw r.error;

      // Photos embedded inside a daily log's structured rows (manpower
      // crews, deliveries, visitors) live on the row JSON, not the log's
      // own photos[] — flatten them in so the gallery shows everything the
      // Site Diary day shows, deep-linking back to the same log record.
      type EmbeddedPhotoRow = { photos?: string[]; photo_thumbs?: string[] };
      const logRows = logs.data as unknown as (PhotoRow & {
        log_date: string; activities: string | null;
        manpower: CMManpowerRow[] | null; deliveries: CMDeliveryRow[] | null; visitors: CMVisitorRow[] | null;
      })[];
      const embedded: CMPhotoWithContext[] = logRows.flatMap((l) => {
        const fromRows = <R extends EmbeddedPhotoRow>(rows: R[] | null, cap: (r: R) => string | null) =>
          (rows ?? []).flatMap((r) => (r.photos ?? []).map((url, i) => ({
            url, thumbUrl: (r.photo_thumbs ?? [])[i] || url, module: "siteDiary" as const,
            date: l.log_date, createdAt: l.created_at, projectId: l.project_id, recordId: l.id,
            projectName: l.cm_projects?.name ?? "Untitled project", caption: cap(r),
          })));
        return [
          ...fromRows(l.manpower, (r) => [r.company, r.trade].filter(Boolean).join(" — ") || null),
          ...fromRows(l.deliveries, (r) => r.material || null),
          ...fromRows(l.visitors, (r) => r.name || null),
        ];
      });

      const all = [
        ...embedded,
        ...photoRowsToContext(logRows, "siteDiary", (r) => r.log_date, (r) => r.activities?.slice(0, 60) || null),
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

/** The 11 real feature modules a project can turn off — excludes "people"
 *  and "settings", which are structural, not optional features. */
export const ACTIVE_MODULE_KEYS: CMModuleKey[] = [
  "site_diary", "punch_list", "inspection", "safety", "submittal",
  "equipment", "boq", "schedule", "manpower", "contracts", "instructions",
];

export function enabledModules(project: Pick<CMProject, "disabled_modules"> | null | undefined): CMModuleKey[] {
  const disabled = new Set(project?.disabled_modules ?? []);
  return ACTIVE_MODULE_KEYS.filter((m) => !disabled.has(m));
}

export async function setCMProjectModuleEnabled(project: CMProject, moduleKey: CMModuleKey, enabled: boolean) {
  const next = enabled
    ? project.disabled_modules.filter((m) => m !== moduleKey)
    : [...project.disabled_modules, moduleKey];
  await updateCMProject(project.id, { disabled_modules: next });
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
  files: CMFileAttachment[];
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

export interface CMEquipmentWithProject extends CMEquipment {
  projectName: string;
}

/** Equipment's "All Projects" filter — same cross-project pattern as
 *  useAllCMDailyLogs, joined with the project name for display. */
export function useAllCMEquipment(userId: string | undefined) {
  return useQuery<CMEquipmentWithProject[]>({
    queryKey: ["cm_all_equipment", userId],
    enabled: !!userId && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db().from("cm_equipment").select("*, cm_projects(name)").order("created_at");
      if (error) throw error;
      return (data as unknown as (CMEquipment & { cm_projects: { name: string } | null })[]).map((r) => {
        const { cm_projects, ...rec } = r;
        return { ...rec, projectName: cm_projects?.name ?? "Untitled project" };
      });
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

/** Cross-project audit trail for App Settings — RLS already scopes
 *  `cm_audit_log` selects to rows whose project the signed-in user has a
 *  role on, so a plain unfiltered query naturally returns only what this
 *  owner/member is allowed to see across every one of their projects. */
export function useCMGlobalAuditLog(userId: string | undefined) {
  return useQuery<CMAuditLogEntry[]>({
    queryKey: ["cm_audit_log_global", userId],
    enabled: !!userId && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db().from("cm_audit_log").select("*")
        .order("created_at", { ascending: false }).limit(300);
      if (error) throw error;
      return data as CMAuditLogEntry[];
    },
    staleTime: STALE_TIME,
  });
}

/** Members across several projects in one query — used to resolve an audit
 *  entry's actor_id to a display name in the global (cross-project) log,
 *  where a single useCMProjectMembers(projectId) call isn't enough. */
export function useCMAllProjectMembers(projectIds: string[]) {
  const key = [...projectIds].sort().join(",");
  return useQuery<CMProjectMember[]>({
    queryKey: ["cm_project_members_multi", key],
    enabled: projectIds.length > 0 && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db().from("cm_project_members").select("*").in("project_id", projectIds);
      if (error) throw error;
      return data as CMProjectMember[];
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
  "certificate_expiry", "daily_report_missing", "health_score_dropped",
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

/* ── Planned manpower (spec §14) — planning targets per date/company/trade,
 *  compared against the actual crews recorded on cm_daily_logs.manpower for
 *  the same date. Matching is by company+trade text, so a plan row lights up
 *  Under-resourced / On plan / Over-resourced without any hard link. ──── */
export interface CMManpowerPlan {
  id: string;
  project_id: string;
  owner_id: string;
  plan_date: string;
  company: string | null;
  trade: string;
  activity: string | null;
  planned_count: number;
  created_at: string;
  updated_at: string;
}

export function useCMManpowerPlans(projectId: string | undefined) {
  return useQuery<CMManpowerPlan[]>({
    queryKey: ["cm_manpower_plans", projectId],
    enabled: !!projectId && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db().from("cm_manpower_plans").select("*").eq("project_id", projectId).order("plan_date", { ascending: false }).order("trade");
      if (error) throw error;
      return data as CMManpowerPlan[];
    },
    staleTime: STALE_TIME,
  });
}

export async function createCMManpowerPlan(
  ownerId: string,
  projectId: string,
  input: Pick<CMManpowerPlan, "plan_date" | "company" | "trade" | "activity" | "planned_count">,
) {
  const { error } = await db().from("cm_manpower_plans").insert({ owner_id: ownerId, project_id: projectId, ...input });
  if (error) throw error;
}

export async function updateCMManpowerPlan(id: string, patch: Partial<Pick<CMManpowerPlan, "company" | "trade" | "activity" | "planned_count">>) {
  const { error } = await db().from("cm_manpower_plans").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function deleteCMManpowerPlan(id: string) {
  const { error } = await db().from("cm_manpower_plans").delete().eq("id", id);
  if (error) throw error;
}

/* ── Named worker attendance (spec §9 Level 2) — an optional layer on top
 *  of headcount-only recording. The worker register is project-scoped;
 *  attendance is one row per worker per date (upserted on toggle). It never
 *  writes into cm_daily_logs.manpower by itself — the UI offers an explicit
 *  "add to headcount" action instead, so nothing merges silently. ─────── */
export interface CMWorker {
  id: string;
  project_id: string;
  owner_id: string;
  name: string;
  worker_code: string | null;
  company: string | null;
  trade: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type CMAttendanceStatus = "Present" | "Absent" | "Leave";

export interface CMWorkerAttendance {
  id: string;
  project_id: string;
  owner_id: string;
  worker_id: string;
  att_date: string;
  status: CMAttendanceStatus;
  check_in: string | null;
  check_out: string | null;
  normal_hours: number;
  ot_hours: number;
  created_at: string;
  updated_at: string;
}

export function useCMWorkers(projectId: string | undefined) {
  return useQuery<CMWorker[]>({
    queryKey: ["cm_workers", projectId],
    enabled: !!projectId && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db().from("cm_workers").select("*").eq("project_id", projectId).order("company").order("name");
      if (error) throw error;
      return data as CMWorker[];
    },
    staleTime: STALE_TIME,
  });
}

export async function createCMWorker(
  ownerId: string,
  projectId: string,
  input: Pick<CMWorker, "name" | "worker_code" | "company" | "trade">,
) {
  const { error } = await db().from("cm_workers").insert({ owner_id: ownerId, project_id: projectId, ...input });
  if (error) throw error;
}

export async function deleteCMWorker(id: string) {
  const { error } = await db().from("cm_workers").delete().eq("id", id);
  if (error) throw error;
}

export function useCMWorkerAttendance(projectId: string | undefined, date: string) {
  return useQuery<CMWorkerAttendance[]>({
    queryKey: ["cm_worker_attendance", projectId, date],
    enabled: !!projectId && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db().from("cm_worker_attendance").select("*").eq("project_id", projectId).eq("att_date", date);
      if (error) throw error;
      return data as CMWorkerAttendance[];
    },
    staleTime: STALE_TIME,
  });
}

/** One row per worker per date — toggling a status upserts; clearing a
 *  status deletes the row so an untouched worker stays genuinely unrecorded
 *  rather than defaulting to Absent. */
export async function setCMWorkerAttendance(
  ownerId: string,
  projectId: string,
  workerId: string,
  date: string,
  status: CMAttendanceStatus | null,
) {
  if (status == null) {
    const { error } = await db().from("cm_worker_attendance").delete().eq("worker_id", workerId).eq("att_date", date);
    if (error) throw error;
    return;
  }
  const { error } = await db().from("cm_worker_attendance").upsert(
    {
      owner_id: ownerId, project_id: projectId, worker_id: workerId, att_date: date,
      status, normal_hours: status === "Present" ? 8 : 0, ot_hours: 0,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "worker_id,att_date" },
  );
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
  "project_manager", "construction_manager", "contract_administrator", "site_engineer", "site_supervisor", "qa_qc_engineer",
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
  | "equipment" | "boq" | "schedule" | "manpower" | "people" | "settings"
  | "contracts" | "instructions";
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

/** A person can hold a different job role on every project they belong to
 *  (spec section 29) — this is the cross-project view of that, for the
 *  Profile screen, joined against the project's name/code for display. */
export interface CMMyMembership {
  project_id: string;
  project_name: string;
  project_code: string | null;
  role: CMMemberRole;
  job_role: CMJobRole | null;
}

export function useCMMyMemberships(userId: string | undefined) {
  return useQuery<CMMyMembership[]>({
    queryKey: ["cm_my_memberships", userId],
    enabled: !!userId && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db().from("cm_project_members")
        .select("project_id, role, job_role, project:cm_projects!inner(name, project_code)")
        .eq("user_id", userId);
      if (error) throw error;
      return (data as unknown as Array<{ project_id: string; role: CMMemberRole; job_role: CMJobRole | null; project: { name: string; project_code: string | null } }>)
        .map((r) => ({ project_id: r.project_id, project_name: r.project.name, project_code: r.project.project_code, role: r.role, job_role: r.job_role }));
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

/* ── BOQ versions (Tender / Contract / Approved Baseline / Revised, etc.) ─
 * Only one version per project is ever the live "Approved Baseline" at a
 * time — approving a new one automatically supersedes the previous. */
export type CMBOQVersionStatus = "Draft" | "Imported" | "Under Review" | "Approved Baseline" | "Superseded" | "Archived";
export const BOQ_VERSION_STATUSES: CMBOQVersionStatus[] = ["Draft", "Imported", "Under Review", "Approved Baseline", "Superseded", "Archived"];

export interface CMBOQVersion {
  id: string;
  project_id: string;
  owner_id: string;
  version_number: number;
  name: string;
  status: CMBOQVersionStatus;
  locked: boolean;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useCMBOQVersions(projectId: string | undefined) {
  return useQuery<CMBOQVersion[]>({
    queryKey: ["cm_boq_versions", projectId],
    enabled: !!projectId && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db().from("cm_boq_versions").select("*").eq("project_id", projectId).order("version_number");
      if (error) throw error;
      return data as CMBOQVersion[];
    },
    staleTime: STALE_TIME,
  });
}

/** The version a viewer should land on by default: the live Approved
 *  Baseline if one exists, otherwise the most recently created non-archived
 *  version (typically the only Draft when a project has just one). */
export function activeCMBOQVersion(versions: CMBOQVersion[] | undefined): CMBOQVersion | null {
  if (!versions || versions.length === 0) return null;
  const baseline = versions.find((v) => v.status === "Approved Baseline");
  if (baseline) return baseline;
  const live = versions.filter((v) => v.status !== "Archived" && v.status !== "Superseded");
  if (live.length === 0) return versions[versions.length - 1];
  return live.reduce((latest, v) => (v.version_number > latest.version_number ? v : latest), live[0]);
}

export async function createCMBOQVersion(ownerId: string, projectId: string, name: string, existingVersions: CMBOQVersion[]) {
  const nextNumber = existingVersions.length > 0 ? Math.max(...existingVersions.map((v) => v.version_number)) + 1 : 1;
  const { data, error } = await db().from("cm_boq_versions")
    .insert({ owner_id: ownerId, project_id: projectId, version_number: nextNumber, name, status: "Draft" }).select().single();
  if (error) throw error;
  return data as CMBOQVersion;
}

/** Copies every item from `sourceVersionId` into a brand-new Draft version —
 *  the only sanctioned way to change an Approved Baseline's numbers, so the
 *  original approved record stays untouched until the revision is itself
 *  approved (which then supersedes the source). */
export async function createCMBOQRevision(ownerId: string, projectId: string, sourceVersion: CMBOQVersion, existingVersions: CMBOQVersion[]) {
  const revision = await createCMBOQVersion(ownerId, projectId, `${sourceVersion.name.replace(/ V\d+$/, "")} V${existingVersions.length + 1} (Revision)`, existingVersions);
  const { data: sourceItems, error } = await db().from("cm_wbs_nodes").select("*").eq("boq_version_id", sourceVersion.id);
  if (error) throw error;
  if (sourceItems && sourceItems.length > 0) {
    // Same parent folder, fresh id, new version — the folder itself isn't
    // duplicated, only the costed leaf nodes it contains.
    const copies = (sourceItems as CMWBSNode[]).map(({ id: _id, created_at: _c, updated_at: _u, ...rest }) => ({ ...rest, boq_version_id: revision.id }));
    const { error: insertError } = await db().from("cm_wbs_nodes").insert(copies);
    if (insertError) throw insertError;
  }
  return revision;
}

/** Approves `version` as the new commercial baseline — locks it (original
 *  quantity/rate become read-only) and supersedes whichever version was
 *  previously the Approved Baseline for this project, if any. */
export async function approveCMBOQBaseline(projectId: string, versionId: string, userId: string, allVersions: CMBOQVersion[]) {
  const previousBaseline = allVersions.find((v) => v.status === "Approved Baseline" && v.id !== versionId);
  if (previousBaseline) {
    const { error } = await db().from("cm_boq_versions").update({ status: "Superseded" }).eq("id", previousBaseline.id);
    if (error) throw error;
  }
  const { error } = await db().from("cm_boq_versions")
    .update({ status: "Approved Baseline", locked: true, approved_by: userId, approved_at: new Date().toISOString() })
    .eq("id", versionId);
  if (error) throw error;
  await logCMActivity(projectId, userId, "approved_baseline", "boq", versionId, {});
}

/* ── BOQ items — WBS leaf nodes with quantity/rate set ──── */
/** A costed WBS leaf, viewed as a BOQ line. `description`/`category` are
 *  computed from the node's own `name`/parent so every existing BOQ call
 *  site keeps reading the same shape it always has. */
export type CMBOQItem = CMWBSNode & {
  description: string;
  quantity: number;
  unit_cost: number;
  category: string | null;
  /** @deprecated a BOQ item IS a wbs node now — use `id`/`parent_id` directly. */
  wbs_node_id: string | null;
  version_id: string | null;
};

function toBOQItem(node: CMWBSNode, all: CMWBSNode[]): CMBOQItem {
  return {
    ...node,
    description: node.name,
    quantity: node.quantity ?? 0,
    unit_cost: node.unit_cost ?? 0,
    category: wbsParentName(node, all),
    wbs_node_id: node.id,
    version_id: node.boq_version_id,
  };
}

export function useCMBOQItems(projectId: string | undefined) {
  const query = useCMWBSNodes(projectId);
  const data = useMemo(() => {
    if (!query.data) return query.data;
    const boqLeaves = query.data.filter((n) => n.quantity != null);
    return boqLeaves.map((n) => toBOQItem(n, query.data!));
  }, [query.data]);
  return { ...query, data };
}

/** Most of the app (Dashboard, Reports, Schedule, Site Diary, Search,
 *  Project Insight) should only ever see the one *effective* set of BOQ
 *  items — otherwise a project with a superseded version plus its revision
 *  would double-count everything. Only the BOQ module itself browses across
 *  versions on purpose. */
export function useActiveCMBOQItems(projectId: string | undefined) {
  const itemsQuery = useCMBOQItems(projectId);
  const versionsQuery = useCMBOQVersions(projectId);
  const active = activeCMBOQVersion(versionsQuery.data);
  const data = useMemo(() => {
    if (!itemsQuery.data) return itemsQuery.data;
    if (!active) return itemsQuery.data.filter((i) => !i.version_id);
    return itemsQuery.data.filter((i) => i.version_id === active.id);
  }, [itemsQuery.data, active]);
  return { ...itemsQuery, data };
}

export async function createCMBOQItem(
  ownerId: string,
  projectId: string,
  input: Pick<CMBOQItem, "description"> & Partial<Pick<CMBOQItem, "unit" | "quantity" | "unit_cost" | "category" | "version_id" | "wbs_node_id">>,
  allNodes: CMWBSNode[] = [],
): Promise<CMBOQItem> {
  const parentId = input.wbs_node_id
    ?? (await findOrCreateWBSFolder(ownerId, projectId, input.category ?? "Uncategorized", "Category", allNodes)).id;
  const node = await createCMWBSNode(ownerId, projectId, {
    name: input.description,
    parent_id: parentId,
    level: "Item",
    unit: input.unit ?? null,
    quantity: input.quantity ?? 0,
    unit_cost: input.unit_cost ?? 0,
    boq_version_id: input.version_id ?? null,
  });
  return toBOQItem(node, [...allNodes, node]);
}

export async function updateCMBOQItem(id: string, patch: Partial<CMBOQItem>) {
  const { description, category: _category, wbs_node_id: _wbsNodeId, version_id, ...rest } = patch;
  await updateCMWBSNode(id, {
    ...(description !== undefined ? { name: description } : {}),
    ...(version_id !== undefined ? { boq_version_id: version_id } : {}),
    ...rest,
  } as Partial<CMWBSNode>);
}

export async function deleteCMBOQItem(id: string) {
  await deleteCMWBSNode(id);
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

/* ── Schedule items — WBS leaf nodes with plan_start/plan_finish set ── */
/** A scheduled WBS leaf, viewed as a schedule activity. `title`/`group_label`
 *  are computed from the node's own `name`/parent, same facade as
 *  `CMBOQItem`. A node can be both a `CMBOQItem` and a `CMScheduleItem` at
 *  once — that's how cost and schedule tie to the same piece of work. */
export type CMScheduleItem = CMWBSNode & {
  title: string;
  group_label: string;
  plan_start: string;
  plan_finish: string;
  weight: number;
  /** @deprecated a schedule item IS a wbs node now — use `id`/`parent_id` directly. */
  wbs_node_id: string | null;
  /** @deprecated no longer a stored link — a node with both quantity and
   *  plan_start set is inherently "the same item," no FK needed. */
  boq_item_id: string | null;
  boq_category: string | null;
};

function toScheduleItem(node: CMWBSNode, all: CMWBSNode[]): CMScheduleItem {
  return {
    ...node,
    title: node.name,
    group_label: wbsParentName(node, all) ?? "Ungrouped",
    plan_start: node.plan_start!,
    plan_finish: node.plan_finish!,
    weight: node.weight ?? 0,
    wbs_node_id: node.id,
    boq_item_id: node.quantity != null ? node.id : null,
    boq_category: wbsParentName(node, all),
  };
}

/** Simple derived status per the Schedule spec §6 — computed, not stored,
 *  so it can never drift from the numbers ("status should update
 *  automatically where possible"). On Hold/Cancelled aren't derivable and
 *  are deliberately not modeled yet. */
export type CMScheduleStatus = "Not Started" | "In Progress" | "Completed" | "Delayed";

export function cmScheduleStatus(item: CMScheduleItem, date: string, delayThresholdPct = 10): CMScheduleStatus {
  if (item.actual_percent >= 100) return "Completed";
  if (item.plan_finish < date) return "Delayed";
  const plan = scheduleItemPlanPercent(item, date);
  if (item.actual_percent === 0 && plan === 0) return "Not Started";
  if (plan - item.actual_percent > delayThresholdPct) return "Delayed";
  return item.actual_percent === 0 ? "Not Started" : "In Progress";
}

/** Quantity-weighted delivered % per BOQ category, from Site Diary
 *  deliveries linked to BOQ items — the "progress from site records" a
 *  schedule activity's linked category can suggest. */
export function cmBOQCategoryProgress(boqItems: CMBOQItem[], logs: CMDailyLog[]): Map<string, number> {
  const deliveredById = new Map<string, number>();
  for (const l of logs) {
    for (const d of l.deliveries) {
      if (!d.boq_item_id) continue;
      deliveredById.set(d.boq_item_id, (deliveredById.get(d.boq_item_id) ?? 0) + (parseFloat(d.quantity) || 0));
    }
  }
  const byCategory = new Map<string, { planned: number; delivered: number }>();
  for (const b of boqItems) {
    if (!b.category || b.quantity <= 0) continue;
    const acc = byCategory.get(b.category) ?? { planned: 0, delivered: 0 };
    acc.planned += b.quantity;
    acc.delivered += Math.min(deliveredById.get(b.id) ?? 0, b.quantity);
    byCategory.set(b.category, acc);
  }
  const result = new Map<string, number>();
  for (const [cat, { planned, delivered }] of byCategory) {
    if (planned > 0) result.set(cat, Math.round((delivered / planned) * 100));
  }
  return result;
}

/** Delivered % per individual BOQ line (not per category) — the suggestion
 *  source for schedule activities linked via the real `boq_item_id` FK
 *  instead of the fragile `boq_category` string match. */
export function cmBOQItemProgress(boqItems: CMBOQItem[], logs: CMDailyLog[]): Map<string, number> {
  const deliveredById = new Map<string, number>();
  for (const l of logs) {
    for (const d of l.deliveries) {
      if (!d.boq_item_id) continue;
      deliveredById.set(d.boq_item_id, (deliveredById.get(d.boq_item_id) ?? 0) + (parseFloat(d.quantity) || 0));
    }
  }
  const result = new Map<string, number>();
  for (const b of boqItems) {
    if (b.quantity <= 0) continue;
    result.set(b.id, Math.round((Math.min(deliveredById.get(b.id) ?? 0, b.quantity) / b.quantity) * 100));
  }
  return result;
}

export function useCMScheduleItems(projectId: string | undefined) {
  const query = useCMWBSNodes(projectId);
  const data = useMemo(() => {
    if (!query.data) return query.data;
    const schedLeaves = query.data.filter((n) => n.plan_start != null && n.plan_finish != null);
    return schedLeaves.map((n) => toScheduleItem(n, query.data!));
  }, [query.data]);
  return { ...query, data };
}

export async function createCMScheduleItem(
  ownerId: string,
  projectId: string,
  input: Pick<CMScheduleItem, "group_label" | "title" | "plan_start" | "plan_finish"> & Partial<Pick<CMScheduleItem, "boq_category" | "boq_item_id" | "wbs_node_id" | "weight" | "actual_percent" | "activity_code" | "location_id">>,
  allNodes: CMWBSNode[] = [],
): Promise<CMScheduleItem> {
  const parentId = input.wbs_node_id
    ?? (await findOrCreateWBSFolder(ownerId, projectId, input.group_label, "Group", allNodes)).id;
  const node = await createCMWBSNode(ownerId, projectId, {
    name: input.title,
    parent_id: parentId,
    level: "Activity",
    plan_start: input.plan_start,
    plan_finish: input.plan_finish,
    weight: input.weight ?? 0,
    actual_percent: input.actual_percent ?? 0,
    activity_code: input.activity_code ?? null,
    location_id: input.location_id ?? null,
  });
  return toScheduleItem(node, [...allNodes, node]);
}

export async function updateCMScheduleItem(id: string, patch: Partial<CMScheduleItem>) {
  const { title, group_label: _groupLabel, wbs_node_id: _wbsNodeId, boq_item_id: _boqItemId, boq_category: _boqCategory, ...rest } = patch;
  await updateCMWBSNode(id, {
    ...(title !== undefined ? { name: title } : {}),
    ...rest,
  } as Partial<CMWBSNode>);
}

export async function deleteCMScheduleItem(id: string) {
  await deleteCMWBSNode(id);
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

/** Project health, computed from the schedule instead of a hand-set label
 *  (the manual Green/Amber/Red field could sit at its "Green" default while
 *  the schedule screamed Behind — two contradictory signals on one screen).
 *  Ahead / On Schedule / Behind by actual-vs-plan variance; NoSchedule when
 *  a project has no activities to judge by. */
export type CMComputedHealth = "Ahead" | "OnSchedule" | "Behind" | "NoSchedule";

export function cmComputedHealth(items: CMScheduleItem[], date: string): { health: CMComputedHealth; planned: number; actual: number; variance: number } {
  if (items.length === 0) return { health: "NoSchedule", planned: 0, actual: 0, variance: 0 };
  const planned = projectPlanPercent(items, date);
  const totalWeight = items.reduce((s, i) => s + i.weight, 0) || 1;
  const actual = items.reduce((s, i) => s + i.weight * i.actual_percent, 0) / totalWeight;
  const variance = actual - planned;
  const health: CMComputedHealth = variance > 3 ? "Ahead" : variance >= -3 ? "OnSchedule" : "Behind";
  return { health, planned, actual, variance };
}

/** How far along each `CMQuantityStatus` counts a delivered quantity toward
 *  its BOQ line's cost progress — a claimed-but-not-yet-certified quantity
 *  is real progress, just less certain than a certified one. */
const QUANTITY_STATUS_WEIGHT: Record<CMQuantityStatus, number> = {
  Reported: 0.25, Accepted: 0.5, Claimed: 0.75, Certified: 1,
};

/** Cost-weighted delivery progress across the active BOQ, joined to Site
 *  Diary deliveries via the real `boq_item_id` FK (never the fragile
 *  `boq_category` string match). Each BOQ line's contribution is capped at
 *  its own planned quantity so over-delivery on one line can't offset
 *  shortfall on another. Returns 0-100; 0 when there's no costed BOQ. */
function cmBOQCostProgress(boqItems: CMBOQItem[], logs: CMDailyLog[]): number {
  const deliveredWeightedById = new Map<string, number>();
  for (const log of logs) {
    for (const d of log.deliveries) {
      if (!d.boq_item_id) continue;
      const qty = parseFloat(d.quantity) || 0;
      if (qty <= 0) continue;
      const weight = QUANTITY_STATUS_WEIGHT[d.status ?? "Reported"] ?? QUANTITY_STATUS_WEIGHT.Reported;
      deliveredWeightedById.set(d.boq_item_id, (deliveredWeightedById.get(d.boq_item_id) ?? 0) + qty * weight);
    }
  }
  let earned = 0;
  let planned = 0;
  for (const b of boqItems) {
    const lineValue = b.quantity * b.unit_cost;
    if (lineValue <= 0) continue;
    planned += lineValue;
    const fraction = Math.min(1, (deliveredWeightedById.get(b.id) ?? 0) / b.quantity);
    earned += lineValue * fraction;
  }
  return planned > 0 ? (earned / planned) * 100 : 0;
}

/** Weights for `cmProjectHealthScore`'s three components. Cost carries the
 *  most weight since it's the hardest signal to fake (it requires real
 *  delivered-and-accepted quantities, not just a manually-typed percent). */
export const CM_HEALTH_SCORE_WEIGHTS = { cost: 0.4, schedule: 0.35, qualitySafety: 0.25 } as const;

export type CMHealthBand = "Green" | "Amber" | "Red";

export interface CMProjectHealthScore {
  score: number;
  band: CMHealthBand;
  components: {
    costProgress: { value: number; weight: number };
    scheduleProgress: { value: number; weight: number };
    qualitySafety: { value: number; weight: number };
  };
  varianceVsPlan: number;
}

/** The one real cross-module signal in the app: cost (from BOQ delivery
 *  status), schedule (from `cmComputedHealth`), and quality/safety (from
 *  open counts) combined into a single 0-100 score instead of three numbers
 *  shown side by side. Quality/safety is a capped penalty so no single open
 *  issue can zero out an otherwise healthy project. */
export function cmProjectHealthScore(
  boqItems: CMBOQItem[],
  logs: CMDailyLog[],
  scheduleItems: CMScheduleItem[],
  openSafetyCount: number,
  openQualityCount: number,
  criticalSafetyCount: number,
  date: string,
): CMProjectHealthScore {
  const costProgress = cmBOQCostProgress(boqItems, logs);
  const { actual: scheduleProgress, variance } = cmComputedHealth(scheduleItems, date);
  const qualitySafety = 100 - Math.min(50, criticalSafetyCount * 15 + openSafetyCount * 3 + openQualityCount * 2);
  const w = CM_HEALTH_SCORE_WEIGHTS;
  const score = Math.round(costProgress * w.cost + scheduleProgress * w.schedule + qualitySafety * w.qualitySafety);
  const band: CMHealthBand = score >= 80 ? "Green" : score >= 60 ? "Amber" : "Red";
  return {
    score, band,
    components: {
      costProgress: { value: costProgress, weight: w.cost },
      scheduleProgress: { value: scheduleProgress, weight: w.schedule },
      qualitySafety: { value: qualitySafety, weight: w.qualitySafety },
    },
    varianceVsPlan: variance,
  };
}

/** Schedule items across every project the signed-in user can see (RLS
 *  scopes the unfiltered select) — lets the Portfolio compute each card's
 *  health in one query instead of one per project. */
export function useCMAllScheduleItems(userId: string | undefined) {
  return useQuery<CMScheduleItem[]>({
    queryKey: ["cm_schedule_items_all", userId],
    enabled: !!userId && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db().from("cm_wbs_nodes").select("*").not("plan_start", "is", null);
      if (error) throw error;
      const nodes = data as CMWBSNode[];
      return nodes.map((n) => toScheduleItem(n, nodes));
    },
    staleTime: STALE_TIME,
  });
}

/* ── Work Breakdown Structure (parent_id tree, per project) ─────────────
 *  Same adjacency-list pattern as CMProjectLocation (§ above) — a
 *  construction WBS is human-edited, which parent_id handles as a single
 *  update per reparent, unlike nested-set's expensive renumbering.
 *
 *  Unlimited-depth free-form folders, not a fixed taxonomy: a project can
 *  nest Zone → Building → Floor → work category → as many levels as it
 *  actually needs ("group group group like folder"). `level` is a free-text
 *  label used only for display (e.g. "Zone", "Building", "Discipline") —
 *  the tree shape and `wbsIsLeaf` (no children) are what the app reasons
 *  about, not the label.
 *
 *  BOQ items and Schedule items link here via their own wbs_node_id FK
 *  (many-to-one via a shared parent — one activity often spans several BOQ
 *  lines) rather than a direct 1:1 link between the two. Schedule items may
 *  link at any level (a folder-level activity can represent a whole work
 *  package, or a leaf-level one a single item). BOQ items — and their
 *  quantity/rate — are only meaningful at leaf nodes; the UI enforces this
 *  since it's a modeling rule, not a database constraint. */
export type CMWBSLevel = string;

/** The single source of truth for project structure — a WBS node doubles as
 *  a BOQ line item (when `quantity`/`unit_cost` are set) and/or a schedule
 *  activity (when `plan_start`/`plan_finish` are set), so cost and schedule
 *  never drift into a separate tree from the structure they describe. See
 *  `CMBOQItem`/`CMScheduleItem` below for the narrowed views consumers use. */
export interface CMWBSNode {
  id: string;
  project_id: string;
  owner_id: string;
  parent_id: string | null;
  code: string | null;
  name: string;
  level: CMWBSLevel;
  sort_order: number;
  location_id: string | null;
  unit: string | null;
  quantity: number | null;
  unit_cost: number | null;
  boq_version_id: string | null;
  plan_start: string | null;
  plan_finish: string | null;
  weight: number | null;
  actual_percent: number;
  activity_code: string | null;
  created_at: string;
  updated_at: string;
}

export function useCMWBSNodes(projectId: string | undefined) {
  return useQuery<CMWBSNode[]>({
    queryKey: ["cm_wbs_nodes", projectId],
    enabled: !!projectId && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db().from("cm_wbs_nodes").select("*").eq("project_id", projectId).order("sort_order").order("created_at");
      if (error) throw error;
      return data as CMWBSNode[];
    },
    staleTime: STALE_TIME,
  });
}

type CMWBSNodeWritable = Pick<CMWBSNode, "name"> & Partial<Omit<CMWBSNode, "id" | "project_id" | "owner_id" | "name" | "created_at" | "updated_at">>;

export async function createCMWBSNode(ownerId: string, projectId: string, input: CMWBSNodeWritable) {
  const { data, error } = await db().from("cm_wbs_nodes").insert({ owner_id: ownerId, project_id: projectId, ...input }).select().single();
  if (error) throw error;
  return data as CMWBSNode;
}

export async function updateCMWBSNode(id: string, patch: Partial<Omit<CMWBSNode, "id" | "project_id" | "owner_id" | "created_at" | "updated_at">>) {
  const { error } = await db().from("cm_wbs_nodes").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteCMWBSNode(id: string) {
  const { error } = await db().from("cm_wbs_nodes").delete().eq("id", id);
  if (error) throw error;
}

/** "Foundations › Package A › Excavation" — same walk-the-parent-chain
 *  approach as locationBreadcrumb. */
export function wbsBreadcrumb(node: CMWBSNode, all: CMWBSNode[]): string {
  const chain: string[] = [node.name];
  let current = node;
  while (current.parent_id) {
    const parent = all.find((n) => n.id === current.parent_id);
    if (!parent) break;
    chain.unshift(parent.name);
    current = parent;
  }
  return chain.join(" › ");
}

/** A leaf is a node no other node lists as its parent — the only level BOQ
 *  quantity/rate should attach to. Folders (Zone, Building, work category,
 *  ...) exist purely to group leaves and other folders. */
export function wbsIsLeaf(node: CMWBSNode, all: CMWBSNode[]): boolean {
  return !all.some((n) => n.parent_id === node.id);
}

/** Immediate parent's name, or null at the root — the BOQ/Schedule
 *  "category"/"group" label is now just a node's position in the tree
 *  rather than a stored free-text field. */
export function wbsParentName(node: CMWBSNode, all: CMWBSNode[]): string | null {
  if (!node.parent_id) return null;
  return all.find((n) => n.id === node.parent_id)?.name ?? null;
}

/** Finds a root-level folder by (level, name), creating it if missing —
 *  lets BOQ/Schedule writers keep passing a plain "category"/"group label"
 *  string (import pipelines, the AI ingest apply flow, manual entry) without
 *  the caller having to navigate the tree themselves. */
async function findOrCreateWBSFolder(
  ownerId: string, projectId: string, name: string, level: string, all: CMWBSNode[],
): Promise<CMWBSNode> {
  const existing = all.find((n) => n.parent_id === null && n.level === level && n.name === name);
  if (existing) return existing;
  return createCMWBSNode(ownerId, projectId, { name, level, parent_id: null });
}

/** Depth-first flatten with each node's indent depth, root-first — the
 *  shape every WBS tree view (picker, review list) wants. */
export function wbsFlatten(all: CMWBSNode[]): { node: CMWBSNode; depth: number }[] {
  const byParent = new Map<string | null, CMWBSNode[]>();
  for (const n of all) {
    const key = n.parent_id;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(n);
  }
  for (const list of byParent.values()) list.sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
  const out: { node: CMWBSNode; depth: number }[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const n of byParent.get(parentId) ?? []) {
      out.push({ node: n, depth });
      walk(n.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

/** Per-project AI usage balance for the WBS/Schedule ingest tool — mirrors
 *  the public advisor's `user_credits` shape, but billed against a project
 *  instead of a site account since CM users authenticate against a separate
 *  auth server. Row is created lazily server-side (`cm_ai_ensure_credits`)
 *  on first use; reading it here is select-only, RLS-gated the same way as
 *  every other project-scoped table — balance can only change through the
 *  ingest endpoint's server-side RPC calls, never a direct client write. */
export interface CMAiCredits {
  project_id: string;
  owner_id: string;
  balance: number;
  lifetime_granted: number;
  lifetime_spent: number;
  updated_at: string;
}

export function useCMAiCredits(projectId: string | undefined) {
  return useQuery<CMAiCredits | null>({
    queryKey: ["cm_ai_credits", projectId],
    enabled: !!projectId && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db().from("cm_ai_credits").select("*").eq("project_id", projectId).maybeSingle();
      if (error) throw error;
      return data as CMAiCredits | null;
    },
    staleTime: STALE_TIME,
  });
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

export const INSPECTION_TYPES = [
  "Work Inspection Request", "Material Inspection Request", "Mock-up Inspection", "Pre-pour Inspection",
  "Hold Point Inspection", "Witness Point Inspection", "Testing Request", "Factory Inspection",
  "Final Inspection", "Joint Inspection",
] as const;
export type InspectionType = typeof INSPECTION_TYPES[number];

export interface CMInspection {
  id: string;
  project_id: string;
  owner_id: string;
  doc_number: string | null;
  title: string;
  status: InspectionStatus;
  inspection_type: InspectionType | null;
  discipline: Discipline | null;
  location_id: string | null;
  inspector: string | null;
  inspection_date: string;
  notes: string | null;
  drawing_ref: string | null;
  method_statement_ref: string | null;
  itp_ref: string | null;
  photos: string[];
  photo_thumbs: string[];
  files: CMFileAttachment[];
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

export interface CMInspectionWithProject extends CMInspection {
  projectName: string;
}

/** Inspection's "All Projects" filter — same cross-project pattern as
 *  useAllCMDailyLogs, joined with the project name for display. */
export function useAllCMInspections(userId: string | undefined) {
  return useQuery<CMInspectionWithProject[]>({
    queryKey: ["cm_all_inspections", userId],
    enabled: !!userId && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db().from("cm_inspections").select("*, cm_projects(name)").order("inspection_date", { ascending: false });
      if (error) throw error;
      return (data as unknown as (CMInspection & { cm_projects: { name: string } | null })[]).map((r) => {
        const { cm_projects, ...rec } = r;
        return { ...rec, projectName: cm_projects?.name ?? "Untitled project" };
      });
    },
    staleTime: STALE_TIME,
  });
}

export async function createCMInspection(
  ownerId: string,
  projectId: string,
  input: Pick<CMInspection, "title"> & Partial<Pick<CMInspection, "status" | "inspection_type" | "discipline" | "location_id" | "inspector" | "inspection_date" | "notes" | "drawing_ref" | "method_statement_ref" | "itp_ref">>,
) {
  const fallbackCode = input.inspection_type === "Material Inspection Request" ? "MIR" : "WIR";
  const docNumber = await generateCMDocNumber(projectId, "inspection", fallbackCode, input.inspection_date);
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
export const SAFETY_RECORD_TYPES = [
  "Safety Observation", "Unsafe Act", "Unsafe Condition", "Near Miss", "Incident", "Accident",
  "Toolbox Talk", "Safety Induction", "Permit to Work", "Safety Inspection", "Corrective Action",
  "PPE Check", "Equipment Safety Check",
] as const;
export type SafetyRecordType = typeof SAFETY_RECORD_TYPES[number];
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
  files: CMFileAttachment[];
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

export interface CMSafetyRecordWithProject extends CMSafetyRecord {
  projectName: string;
}

/** Safety's "All Projects" filter — same cross-project pattern as
 *  useAllCMDailyLogs, joined with the project name for display. */
export function useAllCMSafetyRecords(userId: string | undefined) {
  return useQuery<CMSafetyRecordWithProject[]>({
    queryKey: ["cm_all_safety_records", userId],
    enabled: !!userId && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db().from("cm_safety_records").select("*, cm_projects(name)").order("record_date", { ascending: false });
      if (error) throw error;
      return (data as unknown as (CMSafetyRecord & { cm_projects: { name: string } | null })[]).map((r) => {
        const { cm_projects, ...rec } = r;
        return { ...rec, projectName: cm_projects?.name ?? "Untitled project" };
      });
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
  /** Approval documents of any type (PDF, DWG, DOCX, XLSX...) — separate
   *  from photos since these aren't thumbnailed as images. */
  files: CMFileAttachment[];
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

export interface CMSubmittalWithProject extends CMSubmittal {
  projectName: string;
}

/** Submittal's "All Projects" filter — same cross-project pattern as
 *  useAllCMDailyLogs, joined with the project name for display. */
export function useAllCMSubmittals(userId: string | undefined) {
  return useQuery<CMSubmittalWithProject[]>({
    queryKey: ["cm_all_submittals", userId],
    enabled: !!userId && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db().from("cm_submittals").select("*, cm_projects(name)").order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as (CMSubmittal & { cm_projects: { name: string } | null })[]).map((r) => {
        const { cm_projects, ...rec } = r;
        return { ...rec, projectName: cm_projects?.name ?? "Untitled project" };
      });
    },
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
  if (data.status === "Submitted" || data.status === "Under Review") {
    const { data: proj } = await db().from("cm_projects").select("owner_id").eq("id", projectId).maybeSingle();
    if (proj?.owner_id) notifyCMUser(projectId, proj.owner_id, "approval_required", data.title, data.doc_number, "submittal", data.id);
  }
  return data as CMSubmittal;
}

export async function updateCMSubmittal(id: string, patch: Partial<CMSubmittal>) {
  const { data, error } = await db().from("cm_submittals").update(patch).eq("id", id).select().single();
  if (error) throw error;
  if (patch.status === "Rejected" && data) {
    notifyCMUser(data.project_id, data.owner_id, "rejection", data.title, data.doc_number, "submittal", data.id);
  } else if (patch.status === "Revise & Resubmit" && data) {
    notifyCMUser(data.project_id, data.owner_id, "revision_required", data.title, data.doc_number, "submittal", data.id);
  } else if ((patch.status === "Submitted" || patch.status === "Under Review") && data) {
    const { data: proj } = await db().from("cm_projects").select("owner_id").eq("id", data.project_id).maybeSingle();
    if (proj?.owner_id) notifyCMUser(data.project_id, proj.owner_id, "approval_required", data.title, data.doc_number, "submittal", data.id);
  }
}

export async function deleteCMSubmittal(id: string) {
  const { error } = await db().from("cm_submittals").delete().eq("id", id);
  if (error) throw error;
}

/* ── Contracts (Contract Administration — a project can have multiple:
 *  main contract, subcontractor packages, supply contracts...) ──────── */
export const CONTRACT_TYPES = ["Main Contract", "Subcontract", "Supply Contract", "Consultancy Contract", "Other"] as const;
export type ContractType = typeof CONTRACT_TYPES[number];
export const CONTRACT_STATUSES = ["Active", "Completed", "Terminated", "Closed"] as const;
export type ContractStatus = typeof CONTRACT_STATUSES[number];

export interface CMContract {
  id: string;
  project_id: string;
  owner_id: string;
  contract_number: string | null;
  title: string;
  contract_type: ContractType;
  counterparty_company_id: string | null;
  currency: string | null;
  contract_value: number | null;
  start_date: string | null;
  completion_date: string | null;
  status: ContractStatus;
  notes: string | null;
  files: CMFileAttachment[];
  created_at: string;
  updated_at: string;
}

export function useCMContracts(projectId: string | undefined) {
  return useQuery<CMContract[]>({
    queryKey: ["cm_contracts", projectId],
    enabled: !!projectId && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db().from("cm_contracts").select("*").eq("project_id", projectId).order("created_at");
      if (error) throw error;
      return data as CMContract[];
    },
    staleTime: STALE_TIME,
  });
}

export interface CMContractWithProject extends CMContract {
  projectName: string;
}

/** Contracts' "All Projects" filter — same cross-project pattern as
 *  useAllCMDailyLogs, joined with the project name for display. */
export function useAllCMContracts(userId: string | undefined) {
  return useQuery<CMContractWithProject[]>({
    queryKey: ["cm_all_contracts", userId],
    enabled: !!userId && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db().from("cm_contracts").select("*, cm_projects(name)").order("created_at");
      if (error) throw error;
      return (data as unknown as (CMContract & { cm_projects: { name: string } | null })[]).map((r) => {
        const { cm_projects, ...rec } = r;
        return { ...rec, projectName: cm_projects?.name ?? "Untitled project" };
      });
    },
    staleTime: STALE_TIME,
  });
}

export async function createCMContract(
  ownerId: string, projectId: string,
  input: Pick<CMContract, "title"> & Partial<Pick<CMContract, "contract_number" | "contract_type" | "counterparty_company_id" | "currency" | "contract_value" | "start_date" | "completion_date" | "status" | "notes">>,
) {
  const { data, error } = await db().from("cm_contracts").insert({ owner_id: ownerId, project_id: projectId, ...input }).select().single();
  if (error) throw error;
  logCMActivity(projectId, ownerId, "created", "contract", data.id, { title: data.title });
  return data as CMContract;
}

export async function updateCMContract(id: string, patch: Partial<CMContract>) {
  const { error } = await db().from("cm_contracts").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteCMContract(id: string) {
  const { error } = await db().from("cm_contracts").delete().eq("id", id);
  if (error) throw error;
}

/* ── Interim Payment Certificates (per contract) ─────────────────────────
 *  Builds on top of — not a parallel copy of — the existing CMQuantityStatus
 *  pipeline. Creating an IPC snapshots the delivery rows currently sitting
 *  at "Claimed" (linked via boq_item_id, within the period, not already
 *  pulled into an earlier IPC) into frozen cm_ipc_line_items rows, so a
 *  later delivery edit never rewrites a submitted IPC. Certifying is what
 *  writes certified_quantity back onto those underlying CMDeliveryRows and
 *  flips their status to "Certified", closing the loop. Workflow is
 *  strictly linear (Draft→Submitted→Certified→Paid) — corrections go on
 *  the *next* IPC as a deduction line, not by editing history. */
export type CMIPCStatus = "Draft" | "Submitted" | "Certified" | "Paid";

export interface CMIPCDeductionRow {
  description: string;
  amount: number;
}

export interface CMIPC {
  id: string;
  project_id: string;
  owner_id: string;
  contract_id: string;
  ipc_number: number;
  period_start: string;
  period_end: string;
  status: CMIPCStatus;
  gross_value_this_period: number;
  cumulative_gross_to_date: number;
  retention_pct: number;
  retention_held_this_period: number;
  cumulative_retention_held: number;
  advance_recovery_this_period: number;
  other_deductions: CMIPCDeductionRow[];
  net_payable_this_period: number;
  certified_value: number | null;
  submitted_at: string | null;
  certified_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CMIPCLineItem {
  id: string;
  ipc_id: string;
  boq_item_id: string;
  claimed_quantity: number;
  unit_cost_snapshot: number;
  certified_quantity: number | null;
  created_at: string;
}

export function useCMIPCs(projectId: string | undefined) {
  return useQuery<CMIPC[]>({
    queryKey: ["cm_ipcs", projectId],
    enabled: !!projectId && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db().from("cm_ipcs").select("*").eq("project_id", projectId).order("ipc_number", { ascending: false });
      if (error) throw error;
      return data as CMIPC[];
    },
    staleTime: STALE_TIME,
  });
}

export function useCMIPC(id: string | undefined) {
  return useQuery<CMIPC | null>({
    queryKey: ["cm_ipc", id],
    enabled: !!id && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db().from("cm_ipcs").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as CMIPC | null;
    },
    staleTime: STALE_TIME,
  });
}

export function useCMIPCLineItems(ipcId: string | undefined) {
  return useQuery<CMIPCLineItem[]>({
    queryKey: ["cm_ipc_line_items", ipcId],
    enabled: !!ipcId && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db().from("cm_ipc_line_items").select("*").eq("ipc_id", ipcId);
      if (error) throw error;
      return data as CMIPCLineItem[];
    },
    staleTime: STALE_TIME,
  });
}

interface ClaimedDeliveryRef {
  logId: string;
  index: number;
  boqItemId: string;
  quantity: number;
}

/** Finds every delivery row across the project's logs that's eligible for a
 *  new IPC: linked to a BOQ item, status "Claimed", within the period, and
 *  not already pulled into an earlier IPC (`ipc_id` unset) — this last
 *  check is what prevents a second IPC from double-counting a delivery a
 *  prior IPC already claimed. */
function findClaimableDeliveries(logs: CMDailyLog[], periodStart: string, periodEnd: string): ClaimedDeliveryRef[] {
  const refs: ClaimedDeliveryRef[] = [];
  for (const log of logs) {
    if (log.log_date < periodStart || log.log_date > periodEnd) continue;
    log.deliveries.forEach((row, index) => {
      if (row.boq_item_id && row.status === "Claimed" && !row.ipc_id) {
        refs.push({ logId: log.id, index, boqItemId: row.boq_item_id, quantity: parseFloat(row.quantity) || 0 });
      }
    });
  }
  return refs;
}

/** Creates a Draft IPC: snapshots currently-claimed deliveries into frozen
 *  line items, then stamps those source deliveries with this IPC's id so
 *  they can never be pulled into a later IPC too. */
export async function createCMIPC(
  ownerId: string, projectId: string, contractId: string,
  periodStart: string, periodEnd: string,
  boqItems: CMBOQItem[], logs: CMDailyLog[], previousIPCs: CMIPC[],
  opts?: { retentionPct?: number; advanceRecovery?: number; otherDeductions?: CMIPCDeductionRow[] },
): Promise<CMIPC> {
  const retentionPct = opts?.retentionPct ?? 0;
  const advanceRecovery = opts?.advanceRecovery ?? 0;
  const otherDeductions = opts?.otherDeductions ?? [];

  const claimable = findClaimableDeliveries(logs, periodStart, periodEnd);
  const qtyByBoqItem = new Map<string, number>();
  for (const ref of claimable) {
    qtyByBoqItem.set(ref.boqItemId, (qtyByBoqItem.get(ref.boqItemId) ?? 0) + ref.quantity);
  }

  const boqById = new Map(boqItems.map((b) => [b.id, b]));
  const lineItems: { boq_item_id: string; claimed_quantity: number; unit_cost_snapshot: number }[] = [];
  let grossValue = 0;
  for (const [boqItemId, qty] of qtyByBoqItem) {
    const boq = boqById.get(boqItemId);
    if (!boq) continue;
    lineItems.push({ boq_item_id: boqItemId, claimed_quantity: qty, unit_cost_snapshot: boq.unit_cost });
    grossValue += qty * boq.unit_cost;
  }

  const ipcNumber = previousIPCs.reduce((max, i) => Math.max(max, i.ipc_number), 0) + 1;
  const priorGross = previousIPCs.reduce((s, i) => s + i.gross_value_this_period, 0);
  const priorRetention = previousIPCs.reduce((s, i) => s + i.retention_held_this_period, 0);
  const retentionHeld = grossValue * (retentionPct / 100);
  const otherDeductionsTotal = otherDeductions.reduce((s, d) => s + d.amount, 0);
  const netPayable = grossValue - retentionHeld - advanceRecovery - otherDeductionsTotal;

  const { data: ipc, error } = await db().from("cm_ipcs").insert({
    owner_id: ownerId, project_id: projectId, contract_id: contractId, ipc_number: ipcNumber,
    period_start: periodStart, period_end: periodEnd, status: "Draft",
    gross_value_this_period: grossValue, cumulative_gross_to_date: priorGross + grossValue,
    retention_pct: retentionPct, retention_held_this_period: retentionHeld,
    cumulative_retention_held: priorRetention + retentionHeld,
    advance_recovery_this_period: advanceRecovery, other_deductions: otherDeductions,
    net_payable_this_period: netPayable,
  }).select().single();
  if (error) throw error;

  if (lineItems.length > 0) {
    const { error: liError } = await db().from("cm_ipc_line_items").insert(lineItems.map((l) => ({ ipc_id: ipc.id, ...l })));
    if (liError) throw liError;
  }

  // Stamp the source deliveries with this IPC's id, grouped by log so each
  // log gets a single update rather than one per delivery row.
  const refsByLog = new Map<string, ClaimedDeliveryRef[]>();
  for (const ref of claimable) {
    if (!refsByLog.has(ref.logId)) refsByLog.set(ref.logId, []);
    refsByLog.get(ref.logId)!.push(ref);
  }
  for (const [logId, refs] of refsByLog) {
    const log = logs.find((l) => l.id === logId);
    if (!log) continue;
    const indices = new Set(refs.map((r) => r.index));
    const nextDeliveries = log.deliveries.map((row, i) => (indices.has(i) ? { ...row, ipc_id: ipc.id } : row));
    await updateCMDailyLog(logId, { deliveries: nextDeliveries });
  }

  logCMActivity(projectId, ownerId, "created", "ipc", ipc.id, { ipc_number: ipcNumber, gross_value_this_period: grossValue });
  return ipc as CMIPC;
}

export async function submitCMIPC(id: string, projectId: string, actorId: string, ipcNumber: number) {
  const { error } = await db().from("cm_ipcs").update({ status: "Submitted", submitted_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
  logCMActivity(projectId, actorId, "submitted", "ipc", id, { ipc_number: ipcNumber });
}

/** Certifies an IPC: records the certified quantity per line item, then
 *  writes that back onto every underlying CMDeliveryRow this IPC claimed —
 *  proportionally scaling each row's own certified_quantity by how much of
 *  its line's total was actually certified — and flips those rows' status
 *  to "Certified" so they can never resurface in a later IPC. */
export async function certifyCMIPC(
  ipc: CMIPC, lineItems: CMIPCLineItem[], certifiedQuantities: Map<string, number>,
  logs: CMDailyLog[], actorId: string,
): Promise<void> {
  let certifiedValue = 0;
  for (const line of lineItems) {
    const certifiedQty = certifiedQuantities.get(line.id) ?? line.claimed_quantity;
    certifiedValue += certifiedQty * line.unit_cost_snapshot;
    const { error } = await db().from("cm_ipc_line_items").update({ certified_quantity: certifiedQty }).eq("id", line.id);
    if (error) throw error;

    const ratio = line.claimed_quantity > 0 ? certifiedQty / line.claimed_quantity : 0;
    for (const log of logs) {
      let changed = false;
      const nextDeliveries = log.deliveries.map((row) => {
        if (row.ipc_id !== ipc.id || row.boq_item_id !== line.boq_item_id) return row;
        changed = true;
        const ownQty = parseFloat(row.quantity) || 0;
        return { ...row, status: "Certified" as const, certified_quantity: (ownQty * ratio).toFixed(2) };
      });
      if (changed) await updateCMDailyLog(log.id, { deliveries: nextDeliveries });
    }
  }

  const { error } = await db().from("cm_ipcs").update({
    status: "Certified", certified_at: new Date().toISOString(), certified_value: certifiedValue,
  }).eq("id", ipc.id);
  if (error) throw error;
  logCMActivity(ipc.project_id, actorId, "certified", "ipc", ipc.id, { ipc_number: ipc.ipc_number, certified_value: certifiedValue });
}

export async function payCMIPC(id: string, projectId: string, actorId: string, ipcNumber: number) {
  const { error } = await db().from("cm_ipcs").update({ status: "Paid", paid_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
  logCMActivity(projectId, actorId, "paid", "ipc", id, { ipc_number: ipcNumber });
}

export interface CashFlowPoint {
  date: string;
  plannedValue: number;
  submittedValue: number | null;
  certifiedValue: number | null;
}

/** Cash-flow S-curve, sibling to buildSCurveSeries — reuses
 *  projectPlanPercent unchanged for the planned $ line (× contract value),
 *  with the actual line stepping at each IPC's certified_at (a dashed
 *  "provisional" line steps at submitted_at). Coexists alongside the
 *  existing percent-based S-curve rather than replacing it. */
export function buildCashFlowSCurve(contract: CMContract, scheduleItems: CMScheduleItem[], ipcs: CMIPC[]): CashFlowPoint[] {
  if (!contract.start_date || !contract.completion_date || !contract.contract_value) return [];
  const dates = isoDateRange(contract.start_date, contract.completion_date);
  const certified = ipcs.filter((i): i is CMIPC & { certified_at: string } => !!i.certified_at).sort((a, b) => a.certified_at.localeCompare(b.certified_at));
  const submitted = ipcs.filter((i): i is CMIPC & { submitted_at: string } => !!i.submitted_at).sort((a, b) => a.submitted_at.localeCompare(b.submitted_at));

  return dates.map((date) => {
    const plannedValue = contract.contract_value! * (projectPlanPercent(scheduleItems, date) / 100);
    const certifiedToDate = certified.filter((i) => i.certified_at <= date);
    const submittedToDate = submitted.filter((i) => i.submitted_at <= date);
    return {
      date,
      plannedValue,
      certifiedValue: certifiedToDate.length > 0 ? certifiedToDate.reduce((s, i) => s + (i.certified_value ?? i.gross_value_this_period), 0) : null,
      submittedValue: submittedToDate.length > 0 ? submittedToDate.reduce((s, i) => s + i.gross_value_this_period, 0) : null,
    };
  });
}

/* ── Instructions (Contract Administration — formal instructions issued
 *  under a specific contract; acknowledged by the recipient, then carried
 *  through impact assessment and execution to closure) ─────────────── */
export const INSTRUCTION_SOURCE_TYPES = ["Client", "Consultant", "Contractor", "Internal"] as const;
export type InstructionSourceType = typeof INSTRUCTION_SOURCE_TYPES[number];
export const INSTRUCTION_STATUSES = ["Issued", "Acknowledged", "Impact Assessment", "Executing", "Completed", "Closed"] as const;
export type InstructionStatus = typeof INSTRUCTION_STATUSES[number];
export const INSTRUCTION_PRIORITIES = ["Low", "Medium", "High", "Critical"] as const;
export type InstructionPriority = typeof INSTRUCTION_PRIORITIES[number];
export const ACK_RESPONSES = ["Acknowledged", "Clarification Requested", "Rejected"] as const;
export type AckResponse = typeof ACK_RESPONSES[number];
export const IMPACT_TYPES = ["Cost", "Time", "Both", "No Impact"] as const;
export type ImpactType = typeof IMPACT_TYPES[number];

export interface CMInstruction {
  id: string;
  project_id: string;
  contract_id: string;
  owner_id: string;
  doc_number: string | null;
  source_type: InstructionSourceType;
  source_company_id: string | null;
  recipient_company_id: string | null;
  recipient_note: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: InstructionPriority;
  status: InstructionStatus;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  ack_response: AckResponse | null;
  ack_comments: string | null;
  impact_type: ImpactType | null;
  impact_notes: string | null;
  photos: string[];
  photo_thumbs: string[];
  files: CMFileAttachment[];
  created_at: string;
  updated_at: string;
}

export function useCMInstructions(projectId: string | undefined) {
  return useQuery<CMInstruction[]>({
    queryKey: ["cm_instructions", projectId],
    enabled: !!projectId && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db().from("cm_instructions").select("*").eq("project_id", projectId).order("created_at", { ascending: false });
      if (error) throw error;
      return data as CMInstruction[];
    },
    staleTime: STALE_TIME,
  });
}

export interface CMInstructionWithProject extends CMInstruction {
  projectName: string;
}

/** Instructions' "All Projects" filter — same cross-project pattern as
 *  useAllCMDailyLogs, joined with the project name for display. */
export function useAllCMInstructions(userId: string | undefined) {
  return useQuery<CMInstructionWithProject[]>({
    queryKey: ["cm_all_instructions", userId],
    enabled: !!userId && !!supabaseCM,
    queryFn: async () => {
      const { data, error } = await db().from("cm_instructions").select("*, cm_projects(name)").order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as (CMInstruction & { cm_projects: { name: string } | null })[]).map((r) => {
        const { cm_projects, ...rec } = r;
        return { ...rec, projectName: cm_projects?.name ?? "Untitled project" };
      });
    },
    staleTime: STALE_TIME,
  });
}

export async function createCMInstruction(
  ownerId: string, projectId: string,
  input: Pick<CMInstruction, "title" | "contract_id"> & Partial<Pick<CMInstruction, "source_type" | "source_company_id" | "recipient_company_id" | "recipient_note" | "description" | "due_date" | "priority">>,
) {
  const docNumber = await generateCMDocNumber(projectId, "instruction", "INS");
  const { data, error } = await db().from("cm_instructions").insert({ owner_id: ownerId, project_id: projectId, doc_number: docNumber, ...input }).select().single();
  if (error) throw error;
  logCMActivity(projectId, ownerId, "created", "instruction", data.id, { title: data.title });
  const { data: proj } = await db().from("cm_projects").select("owner_id").eq("id", projectId).maybeSingle();
  if (proj?.owner_id) notifyCMUser(projectId, proj.owner_id, "new_assignment", data.title, data.doc_number, "instruction", data.id);
  return data as CMInstruction;
}

export async function updateCMInstruction(id: string, patch: Partial<CMInstruction>) {
  const { error } = await db().from("cm_instructions").update(patch).eq("id", id);
  if (error) throw error;
}

/** Records the receiving party's response (Acknowledge / Request
 *  Clarification / Reject) and advances the workflow to "Acknowledged" —
 *  the instruction still needs a separate Impact Assessment step before
 *  execution, matching the spec's stage sequence. */
export async function acknowledgeCMInstruction(
  id: string, projectId: string, actorId: string, response: AckResponse, comments: string,
) {
  const { error } = await db().from("cm_instructions").update({
    status: "Acknowledged", acknowledged_by: actorId, acknowledged_at: new Date().toISOString(),
    ack_response: response, ack_comments: comments || null,
  }).eq("id", id);
  if (error) throw error;
  logCMActivity(projectId, actorId, "acknowledged", "instruction", id, { response });
}

export async function deleteCMInstruction(id: string) {
  const { error } = await db().from("cm_instructions").delete().eq("id", id);
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
  const { data: boqItems } = useActiveCMBOQItems(projectId);
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
  /** Resolved brand accent, hex. In "auto" mode this is ignored in favor of
   *  live extraction from company_logo_url (see extractDominantColor) — it
   *  only takes effect in "manual" mode. Kept as a stored column (not just
   *  derived) so a manual choice survives a logo change. */
  brand_color: string | null;
  brand_color_mode: "auto" | "manual";
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

/** Samples an uploaded logo for its most vivid color, for the "auto" brand
 *  color mode — buckets pixels by hue (skipping near-white/near-black/
 *  near-gray ones, which are almost always background or line art rather
 *  than the brand mark itself) and returns the hue bucket with the most
 *  saturation-weighted coverage. Returns null on load/CORS failure or a
 *  fully grayscale logo, so the caller can fall back to the default accent
 *  instead of a wrong color. */
export async function extractDominantColor(logoUrl: string): Promise<string | null> {
  const img = await loadExternalImage(logoUrl);
  if (!img) return null;
  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, size, size);
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, size, size).data;
  } catch {
    return null;
  }
  const buckets = new Map<number, { r: number; g: number; b: number; weight: number }>();
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < 128) continue;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const lightness = (max + min) / 2 / 255;
    const sat = max === min ? 0 : (max - min) / (255 - Math.abs(max + min - 255));
    if (sat < 0.25 || lightness < 0.12 || lightness > 0.9) continue;
    let hue = 0;
    const d = max - min;
    if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0));
    else if (max === g) hue = (b - r) / d + 2;
    else hue = (r - g) / d + 4;
    hue *= 60;
    const bucket = Math.round(hue / 15) * 15;
    const entry = buckets.get(bucket) ?? { r: 0, g: 0, b: 0, weight: 0 };
    entry.r += r * sat;
    entry.g += g * sat;
    entry.b += b * sat;
    entry.weight += sat;
    buckets.set(bucket, entry);
  }
  let best: { r: number; g: number; b: number; weight: number } | null = null;
  for (const entry of buckets.values()) {
    if (!best || entry.weight > best.weight) best = entry;
  }
  if (!best || best.weight === 0) return null;
  const toHex = (v: number) => Math.round(v / best!.weight).toString(16).padStart(2, "0");
  return `#${toHex(best.r)}${toHex(best.g)}${toHex(best.b)}`;
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
