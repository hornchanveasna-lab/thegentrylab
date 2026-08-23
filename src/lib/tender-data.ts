/**
 * Data layer for TenderAI (/tender/*), backed by its own Supabase project
 * (own auth.users, org-scoped RLS via organization_members — see
 * docs/database-schema.md). Mirrors cm-data.ts's conventions: useQuery hooks
 * for reads, plain async functions for writes, callers invalidate queries.
 */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabaseTender, TENDER_SUPABASE_URL, TENDER_SUPABASE_ANON_KEY } from "./supabase-tender";

const STALE_TIME = 30 * 1000;

function db() {
  if (!supabaseTender) throw new Error("TenderAI's Supabase client is not configured");
  return supabaseTender;
}

/* ── Constants ──────────────────────────────────────────── */
export const PROJECT_TYPES = [
  "industrial_factory", "warehouse", "logistics", "steel_structure", "peb_building",
  "multistorey", "infrastructure", "mep", "design_build", "epc",
  "residential", "commercial", "stadium", "other",
] as const;
export type ProjectType = typeof PROJECT_TYPES[number];

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  industrial_factory: "Industrial Factory", warehouse: "Warehouse", logistics: "Logistics Facility",
  steel_structure: "Steel Structure", peb_building: "PEB Building", multistorey: "Multi-Storey Building",
  infrastructure: "Infrastructure", mep: "MEP", design_build: "Design and Build", epc: "EPC",
  residential: "Residential", commercial: "Commercial", stadium: "Stadium", other: "Other",
};

export const TENDER_STATUSES = ["draft", "processing", "analysis", "submission", "submitted", "archived"] as const;
export type TenderStatus = typeof TENDER_STATUSES[number];

export const TENDER_DOC_CATEGORIES = [
  "instructions_to_tenderers", "tender_conditions", "general_conditions", "particular_conditions",
  "employer_requirements", "technical_specifications", "architectural_drawings", "structural_drawings",
  "mep_drawings", "infrastructure_drawings", "boq", "pricing_schedule", "tender_form", "contract_form",
  "addendum", "clarification", "scope_of_work", "project_schedule", "qaqc_requirements", "hse_requirements",
  "environmental_requirements", "insurance_requirements", "bonds_guarantees", "financial_requirements",
  "company_qualification_requirements", "key_personnel_requirements", "equipment_requirements",
  "material_requirements", "subcontractor_requirements", "testing_commissioning", "warranty",
  "handover_requirements", "other",
] as const;
export type TenderDocCategory = typeof TENDER_DOC_CATEGORIES[number];

export const REQUIREMENT_CATEGORIES = [
  "administrative", "legal", "commercial", "technical", "financial", "planning", "design",
  "construction", "qaqc", "hse", "environmental", "procurement", "personnel", "equipment",
  "experience", "insurance", "bond", "warranty", "subcontracting", "pricing", "tender_forms",
] as const;
export type RequirementCategory = typeof REQUIREMENT_CATEGORIES[number];

export const CHECKLIST_SECTIONS = [
  "administrative", "commercial", "technical", "planning", "qaqc", "hse",
  "company_qualification", "personnel", "equipment",
] as const;
export type ChecklistSection = typeof CHECKLIST_SECTIONS[number];

export const COMPLIANCE_VALUES = ["comply", "partially_comply", "deviation", "not_applicable", "need_clarification", "missing"] as const;
export type Compliance = typeof COMPLIANCE_VALUES[number];

export const RISK_CATEGORIES = [
  "contract", "commercial", "technical", "design", "construction", "schedule", "procurement",
  "client", "authority", "hse", "qaqc", "site", "financial", "currency", "supply_chain",
] as const;

export function riskBand(score: number): "Low" | "Medium" | "High" | "Critical" {
  if (score >= 17) return "Critical";
  if (score >= 10) return "High";
  if (score >= 5) return "Medium";
  return "Low";
}

/* ── Organizations ──────────────────────────────────────── */
export interface TenderOrg {
  id: string;
  name: string;
  short_name: string | null;
  logo_url: string | null;
  created_at: string;
}

export function useTenderOrgs(userId: string | undefined) {
  return useQuery<TenderOrg[]>({
    queryKey: ["tender_orgs", userId],
    enabled: !!userId && !!supabaseTender,
    queryFn: async () => {
      const { data, error } = await db()
        .from("organization_members")
        .select("organizations(*)")
        .eq("user_id", userId);
      if (error) throw error;
      return (data ?? []).map((r) => r.organizations).filter(Boolean) as unknown as TenderOrg[];
    },
    staleTime: STALE_TIME,
  });
}

export async function createTenderOrg(userId: string, name: string): Promise<TenderOrg> {
  // The org_select RLS policy only allows reading orgs you're already a
  // member of, and that membership row doesn't exist until the second
  // insert below. Asking Postgres to return a representation of either
  // insert (the default when you chain .select()) forces it to evaluate
  // that SELECT policy against the just-inserted row and fails with "new
  // row violates row-level security policy" even though the insert itself
  // succeeded. So: generate the id client-side, insert both rows with no
  // representation requested, then fetch the org once membership exists.
  const id = crypto.randomUUID();
  const { error } = await db().from("organizations").insert({ id, name });
  if (error) throw error;
  const { error: memberError } = await db()
    .from("organization_members")
    .insert({ org_id: id, user_id: userId, role: "owner" });
  if (memberError) throw memberError;
  const { data: org, error: fetchError } = await db().from("organizations").select().eq("id", id).single();
  if (fetchError) throw fetchError;
  return org as TenderOrg;
}

const CURRENT_ORG_KEY = "tender_current_org";

/** Which org the user is currently working in — persisted per-browser like
 *  the CM app's "last selected project", not a server-side preference (a
 *  user can belong to multiple orgs and switch freely). Defaults to the
 *  first org returned once orgs load, if nothing (or a since-removed org)
 *  is stored. */
export function useCurrentOrg(userId: string | undefined) {
  const { data: orgs, isLoading } = useTenderOrgs(userId);
  const [orgId, setOrgId] = useState<string | null>(() => {
    try { return localStorage.getItem(CURRENT_ORG_KEY); } catch { return null; }
  });

  useEffect(() => {
    if (!orgs) return;
    if (orgId && orgs.some((o) => o.id === orgId)) return;
    const fallback = orgs[0]?.id ?? null;
    setOrgId(fallback);
    try { if (fallback) localStorage.setItem(CURRENT_ORG_KEY, fallback); } catch { /* */ }
  }, [orgs, orgId]);

  const setCurrentOrg = (id: string) => {
    setOrgId(id);
    try { localStorage.setItem(CURRENT_ORG_KEY, id); } catch { /* */ }
  };

  return {
    orgId,
    org: orgs?.find((o) => o.id === orgId) ?? null,
    orgs: orgs ?? [],
    loading: isLoading,
    setCurrentOrg,
  };
}

/* ── Tenders ─────────────────────────────────────────────── */
export interface Tender {
  id: string;
  org_id: string;
  name: string;
  client: string | null;
  consultant: string | null;
  location: string | null;
  tender_reference: string | null;
  issue_date: string | null;
  submission_deadline: string | null;
  project_type: ProjectType | null;
  contract_type: string | null;
  currency: string;
  bidding_company: string | null;
  status: TenderStatus;
  tender_manager_id: string | null;
  is_demo: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useTenders(orgId: string | undefined) {
  return useQuery<Tender[]>({
    queryKey: ["tenders", orgId],
    enabled: !!orgId && !!supabaseTender,
    queryFn: async () => {
      const { data, error } = await db().from("tenders").select("*").eq("org_id", orgId).order("updated_at", { ascending: false });
      if (error) throw error;
      return data as Tender[];
    },
    staleTime: STALE_TIME,
  });
}

export function useTender(tenderId: string | undefined) {
  return useQuery<Tender | null>({
    queryKey: ["tender", tenderId],
    enabled: !!tenderId && !!supabaseTender,
    queryFn: async () => {
      const { data, error } = await db().from("tenders").select("*").eq("id", tenderId).maybeSingle();
      if (error) throw error;
      return data as Tender | null;
    },
    staleTime: STALE_TIME,
  });
}

export async function createTender(
  orgId: string, createdBy: string,
  input: Pick<Tender, "name"> & Partial<Pick<Tender,
    "client" | "consultant" | "location" | "tender_reference" | "issue_date" | "submission_deadline"
    | "project_type" | "contract_type" | "currency" | "bidding_company" | "tender_manager_id">>,
): Promise<Tender> {
  const { data, error } = await db().from("tenders").insert({ org_id: orgId, created_by: createdBy, ...input }).select().single();
  if (error) throw error;
  return data as Tender;
}

export async function updateTender(id: string, patch: Partial<Tender>) {
  const { error } = await db().from("tenders").update(patch).eq("id", id);
  if (error) throw error;
}

/* ── Documents ───────────────────────────────────────────── */
export interface TenderDocument {
  id: string;
  tender_id: string;
  storage_path: string;
  relative_path: string;
  file_name: string;
  file_type: string;
  file_size_bytes: number | null;
  doc_category: TenderDocCategory | null;
  doc_category_source: "ai" | "user";
  doc_number: string | null;
  revision: string | null;
  doc_date: string | null;
  discipline: string | null;
  status: "uploaded" | "processing" | "processed" | "failed";
  processing_error: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export function useTenderDocuments(tenderId: string | undefined) {
  return useQuery<TenderDocument[]>({
    queryKey: ["tender_documents", tenderId],
    enabled: !!tenderId && !!supabaseTender,
    queryFn: async () => {
      const { data, error } = await db().from("tender_documents").select("*").eq("tender_id", tenderId).order("relative_path");
      if (error) throw error;
      return data as TenderDocument[];
    },
    staleTime: STALE_TIME,
    refetchInterval: (q) => (q.state.data ?? []).some((d) => d.status === "processing" || d.status === "uploaded") ? 4000 : false,
  });
}

/** getSession() returns the locally cached session even if its "exp" claim
 *  has already passed (or is about to, e.g. a large upload started right
 *  before expiry) — the background auto-refresh timer doesn't always win
 *  that race. Explicitly refresh whenever the token isn't safely valid for
 *  at least another minute, so the Storage server's own JWT check doesn't
 *  reject it mid-request with "exp claim timestamp check failed". */
async function getFreshAccessToken(): Promise<string | undefined> {
  const { data } = await db().auth.getSession();
  const expiresAt = data.session?.expires_at; // unix seconds
  const safelyValid = expiresAt !== undefined && expiresAt * 1000 > Date.now() + 60_000;
  if (safelyValid) return data.session!.access_token;
  const { data: refreshed } = await db().auth.refreshSession();
  return refreshed.session?.access_token ?? data.session?.access_token ?? TENDER_SUPABASE_ANON_KEY;
}

/** Uploads a file straight to Supabase Storage's REST endpoint via XHR
 *  instead of supabase-js's storage.upload() (which wraps fetch and has no
 *  progress callback) — XHR's upload.onprogress gives real byte-level
 *  progress, which matters for large tender packages (single files can run
 *  into the hundreds of MB) rather than only updating once a whole file
 *  finishes. */
function uploadFileWithProgress(
  storagePath: string, file: File, onProgress?: (loaded: number) => void, signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!TENDER_SUPABASE_URL || !TENDER_SUPABASE_ANON_KEY) {
      reject(new Error("TenderAI's Supabase client is not configured"));
      return;
    }
    if (signal?.aborted) {
      reject(new DOMException("Upload cancelled", "AbortError"));
      return;
    }
    getFreshAccessToken().then((token) => {
      if (signal?.aborted) {
        reject(new DOMException("Upload cancelled", "AbortError"));
        return;
      }
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${TENDER_SUPABASE_URL}/storage/v1/object/tender-documents/${storagePath}`);
      xhr.setRequestHeader("apikey", TENDER_SUPABASE_ANON_KEY!);
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.setRequestHeader("x-upsert", "false");
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(e.loaded); };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Upload failed (${xhr.status}): ${xhr.responseText || xhr.statusText}`));
      };
      xhr.onerror = () => reject(new Error("Upload failed — network error"));
      xhr.onabort = () => reject(new DOMException("Upload cancelled", "AbortError"));
      signal?.addEventListener("abort", () => xhr.abort());
      xhr.send(file);
    }).catch(reject);
  });
}

export async function uploadTenderDocument(
  orgId: string, tenderId: string, file: File, relativePath: string,
  onProgress?: (loaded: number) => void, signal?: AbortSignal,
): Promise<TenderDocument> {
  const storagePath = `${orgId}/${tenderId}/${crypto.randomUUID()}-${file.name}`;
  await uploadFileWithProgress(storagePath, file, onProgress, signal);
  const { data, error } = await db().from("tender_documents").insert({
    tender_id: tenderId,
    storage_path: storagePath,
    relative_path: relativePath,
    file_name: file.name,
    file_type: (file.name.split(".").pop() ?? "other").toLowerCase(),
    file_size_bytes: file.size,
  }).select().single();
  if (error) throw error;
  const doc = data as TenderDocument;
  void processTenderDocument(doc.id); // fire-and-forget — UI polls tender_documents.status
  return doc;
}

/** Imports a document from a share link (Google Drive, OneDrive/SharePoint, or any
 *  direct-download URL) instead of a local file. Handled by the same endpoint as
 *  processTenderDocument (not its own function) to stay under Vercel's Hobby-plan
 *  serverless-function-count cap — passing {tenderId, url} instead of {documentId}
 *  tells it to fetch+store the file first, then run the same extraction/
 *  classification pipeline before returning. */
export async function importTenderDocumentFromLink(tenderId: string, url: string): Promise<TenderDocument> {
  const { data } = await db().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not signed in");
  const res = await fetch("/api/tender/process-document", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ tenderId, url }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error ?? "Failed to import from link");
  return body.document as TenderDocument;
}

/** Kicks off server-side extraction + classification for one document. Errors surface via the
 *  document's own `status`/`processing_error` fields (polled by useTenderDocuments), not a thrown exception. */
export async function processTenderDocument(documentId: string): Promise<void> {
  const { data } = await db().auth.getSession();
  const token = data.session?.access_token;
  if (!token) return;
  try {
    await fetch("/api/tender/process-document", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ documentId }),
    });
  } catch { /* non-fatal — document stays in 'uploaded' status, user can retry from the UI */ }
}

/** Signed URL so a document can be opened/previewed straight from the browser
 *  (the tender-documents bucket is private, RLS-gated by org membership). */
export async function getTenderDocumentUrl(doc: TenderDocument): Promise<string> {
  const { data, error } = await db().storage.from("tender-documents").createSignedUrl(doc.storage_path, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteTenderDocument(doc: TenderDocument) {
  await db().storage.from("tender-documents").remove([doc.storage_path]);
  const { error } = await db().from("tender_documents").delete().eq("id", doc.id);
  if (error) throw error;
}

export async function updateTenderDocumentCategory(id: string, category: TenderDocCategory) {
  const { error } = await db().from("tender_documents").update({ doc_category: category, doc_category_source: "user" }).eq("id", id);
  if (error) throw error;
}

/* ── Requirements ────────────────────────────────────────── */
export interface RequirementSource {
  id: string;
  requirement_id: string;
  document_id: string;
  chunk_id: string | null;
  page_number: number | null;
  section_label: string | null;
  quoted_text: string | null;
}

export interface TenderRequirement {
  id: string;
  tender_id: string;
  requirement_code: string;
  category: RequirementCategory;
  description: string;
  is_mandatory: boolean;
  submission_stage: string | null;
  responsible_department: string | null;
  required_format: string | null;
  required_template: string | null;
  requires_signature: boolean;
  requires_stamp: boolean;
  required_evidence: string | null;
  due_date: string | null;
  status: "open" | "in_progress" | "missing_info" | "ready" | "approved";
  assigned_to: string | null;
  ai_confidence: "high" | "medium" | "low" | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

async function tenderApiCall(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data } = await db().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not signed in");
  const res = await fetch("/api/tender/process-document", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const responseBody = await res.json();
  if (!res.ok) throw new Error(responseBody?.error ?? "Request failed");
  return responseBody;
}

/** Runs the Requirements Extraction Agent over any processed documents that
 *  haven't been extracted yet (server tracks this via
 *  tender_documents.requirements_extracted_at) — safe to call repeatedly,
 *  e.g. after uploading more documents to an already-extracted tender.
 *
 *  Calls one document at a time (list_pending_requirements, then a
 *  generate_requirements request per document) rather than one request
 *  for the whole tender — confirmed live that extracting several
 *  documents in a single request hit Vercel's 60s Hobby-plan function
 *  limit ("Task timed out after 60 seconds"), since each document needs
 *  its own sequential Claude call. onProgress reports after each
 *  document finishes so the UI can show "Extracting 2/5…". */
export async function generateRequirements(
  tenderId: string,
  onProgress?: (done: number, total: number) => void,
): Promise<{ documentsProcessed: number; requirementsExtracted: number; errors: string[] }> {
  const { documents } = await tenderApiCall({ action: "list_pending_requirements", tenderId }) as { documents: { id: string; fileName: string }[] };
  const total = documents.length;
  let requirementsExtracted = 0;
  const errors: string[] = [];
  for (let i = 0; i < documents.length; i++) {
    try {
      const result = await tenderApiCall({ action: "generate_requirements", tenderId, documentId: documents[i].id }) as { requirementsExtracted: number; errors?: string[] };
      requirementsExtracted += result.requirementsExtracted;
      errors.push(...(result.errors ?? []));
    } catch (err) {
      errors.push(`${documents[i].fileName}: ${err instanceof Error ? err.message : String(err)}`);
    }
    onProgress?.(i + 1, total);
  }
  return { documentsProcessed: total, requirementsExtracted, errors };
}

export function useTenderRequirements(tenderId: string | undefined) {
  return useQuery<TenderRequirement[]>({
    queryKey: ["tender_requirements", tenderId],
    enabled: !!tenderId && !!supabaseTender,
    queryFn: async () => {
      const { data, error } = await db().from("tender_requirements").select("*").eq("tender_id", tenderId).order("requirement_code");
      if (error) throw error;
      return data as TenderRequirement[];
    },
    staleTime: STALE_TIME,
  });
}

export function useRequirementSources(requirementId: string | undefined) {
  return useQuery<RequirementSource[]>({
    queryKey: ["requirement_sources", requirementId],
    enabled: !!requirementId && !!supabaseTender,
    queryFn: async () => {
      const { data, error } = await db().from("requirement_sources").select("*").eq("requirement_id", requirementId);
      if (error) throw error;
      return data as RequirementSource[];
    },
    staleTime: STALE_TIME,
  });
}

export async function updateTenderRequirement(id: string, patch: Partial<TenderRequirement>) {
  const { error } = await db().from("tender_requirements").update(patch).eq("id", id);
  if (error) throw error;
}

/* ── Checklist ───────────────────────────────────────────── */
export interface TenderChecklistItem {
  id: string;
  tender_id: string;
  requirement_id: string | null;
  section: ChecklistSection;
  item_label: string;
  is_required: boolean;
  document_available: boolean;
  ai_generated: boolean;
  needs_human_input: boolean;
  assigned_to: string | null;
  due_date: string | null;
  status: "not_started" | "ai_drafted" | "in_review" | "missing_information" | "ready" | "approved" | "submitted";
  compliance_status: Compliance | null;
  created_at: string;
  updated_at: string;
}

export function useTenderChecklist(tenderId: string | undefined) {
  return useQuery<TenderChecklistItem[]>({
    queryKey: ["tender_checklist", tenderId],
    enabled: !!tenderId && !!supabaseTender,
    queryFn: async () => {
      const { data, error } = await db().from("tender_checklist_items").select("*").eq("tender_id", tenderId).order("section");
      if (error) throw error;
      return data as TenderChecklistItem[];
    },
    staleTime: STALE_TIME,
  });
}

export async function updateChecklistItem(id: string, patch: Partial<TenderChecklistItem>) {
  const { error } = await db().from("tender_checklist_items").update(patch).eq("id", id);
  if (error) throw error;
}

/* ── Compliance Matrix ───────────────────────────────────── */
export interface ComplianceMatrixItem {
  id: string;
  tender_id: string;
  requirement_id: string | null;
  reference: string | null;
  contractor_response: string | null;
  compliance: Compliance;
  document_ref: string | null;
  comment: string | null;
  updated_by: string | null;
  updated_at: string;
}

export function useComplianceMatrix(tenderId: string | undefined) {
  return useQuery<ComplianceMatrixItem[]>({
    queryKey: ["compliance_matrix", tenderId],
    enabled: !!tenderId && !!supabaseTender,
    queryFn: async () => {
      const { data, error } = await db().from("compliance_matrix_items").select("*").eq("tender_id", tenderId);
      if (error) throw error;
      return data as ComplianceMatrixItem[];
    },
    staleTime: STALE_TIME,
  });
}

export async function updateComplianceItem(id: string, userId: string, patch: Partial<ComplianceMatrixItem>) {
  const { error } = await db().from("compliance_matrix_items").update({ ...patch, updated_by: userId, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

/* ── Gap Analysis ────────────────────────────────────────── */
export interface TenderGapItem {
  id: string;
  tender_id: string;
  category: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  related_requirement_id: string | null;
  resolved: boolean;
  created_at: string;
}

const SEVERITY_ORDER: Record<TenderGapItem["severity"], number> = { critical: 0, high: 1, medium: 2, low: 3 };

export function useTenderGaps(tenderId: string | undefined) {
  return useQuery<TenderGapItem[]>({
    queryKey: ["tender_gaps", tenderId],
    enabled: !!tenderId && !!supabaseTender,
    queryFn: async () => {
      const { data, error } = await db().from("tender_gap_items").select("*").eq("tender_id", tenderId);
      if (error) throw error;
      return (data as TenderGapItem[]).sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
    },
    staleTime: STALE_TIME,
  });
}

export async function resolveGapItem(id: string, resolved: boolean) {
  const { error } = await db().from("tender_gap_items").update({ resolved }).eq("id", id);
  if (error) throw error;
}

/* ── Risk Register ───────────────────────────────────────── */
export interface TenderRisk {
  id: string;
  tender_id: string;
  category: string;
  description: string;
  clause_ref: string | null;
  probability: number;
  impact: number;
  risk_score: number;
  financial_exposure: number | null;
  recommendation: string | null;
  status: "open" | "mitigated" | "accepted" | "closed";
  created_at: string;
}

export function useTenderRisks(tenderId: string | undefined) {
  return useQuery<TenderRisk[]>({
    queryKey: ["tender_risks", tenderId],
    enabled: !!tenderId && !!supabaseTender,
    queryFn: async () => {
      const { data, error } = await db().from("tender_risks").select("*").eq("tender_id", tenderId).order("risk_score", { ascending: false });
      if (error) throw error;
      return data as TenderRisk[];
    },
    staleTime: STALE_TIME,
  });
}

export async function updateTenderRisk(id: string, patch: Partial<TenderRisk>) {
  const { error } = await db().from("tender_risks").update(patch).eq("id", id);
  if (error) throw error;
}

/* ── Clarifications ──────────────────────────────────────── */
export interface TenderClarification {
  id: string;
  tender_id: string;
  rfi_number: string | null;
  category: string | null;
  reference: string | null;
  question: string;
  reason: string | null;
  potential_impact: string | null;
  selected_for_export: boolean;
  created_at: string;
}

export function useTenderClarifications(tenderId: string | undefined) {
  return useQuery<TenderClarification[]>({
    queryKey: ["tender_clarifications", tenderId],
    enabled: !!tenderId && !!supabaseTender,
    queryFn: async () => {
      const { data, error } = await db().from("tender_clarifications").select("*").eq("tender_id", tenderId).order("created_at");
      if (error) throw error;
      return data as TenderClarification[];
    },
    staleTime: STALE_TIME,
  });
}

export async function toggleClarificationSelected(id: string, selected: boolean) {
  const { error } = await db().from("tender_clarifications").update({ selected_for_export: selected }).eq("id", id);
  if (error) throw error;
}

/* ── Submission ──────────────────────────────────────────── */
export interface SubmissionSection {
  id: string;
  tender_id: string;
  volume: string;
  title: string;
  sort_order: number;
  applicable: boolean;
  created_at: string;
}

export interface SubmissionDocument {
  id: string;
  section_id: string;
  tender_id: string;
  title: string;
  content_md: string | null;
  ai_status: "not_started" | "ai_drafted" | "in_review" | "ready" | "approved";
  owner_id: string | null;
  revision: number;
  has_unresolved_placeholders: boolean;
  compliance_status: string | null;
  last_updated_by: string | null;
  updated_at: string;
  created_at: string;
}

export function useSubmissionSections(tenderId: string | undefined) {
  return useQuery<SubmissionSection[]>({
    queryKey: ["submission_sections", tenderId],
    enabled: !!tenderId && !!supabaseTender,
    queryFn: async () => {
      const { data, error } = await db().from("submission_sections").select("*").eq("tender_id", tenderId).order("sort_order");
      if (error) throw error;
      return data as SubmissionSection[];
    },
    staleTime: STALE_TIME,
  });
}

export function useSubmissionDocuments(tenderId: string | undefined) {
  return useQuery<SubmissionDocument[]>({
    queryKey: ["submission_documents", tenderId],
    enabled: !!tenderId && !!supabaseTender,
    queryFn: async () => {
      const { data, error } = await db().from("submission_documents").select("*").eq("tender_id", tenderId);
      if (error) throw error;
      return data as SubmissionDocument[];
    },
    staleTime: STALE_TIME,
  });
}

export async function updateSubmissionDocument(id: string, userId: string, patch: Partial<SubmissionDocument>) {
  const { data: current, error: readError } = await db().from("submission_documents").select("content_md, revision").eq("id", id).single();
  if (readError) throw readError;
  if (patch.content_md !== undefined && patch.content_md !== current.content_md) {
    await db().from("submission_document_revisions").insert({
      document_id: id, revision: current.revision, content_md: current.content_md ?? "", edited_by: userId,
    });
    patch.revision = (current.revision ?? 1) + 1;
  }
  const { error } = await db().from("submission_documents").update({ ...patch, last_updated_by: userId, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

/* ── Company Knowledge ───────────────────────────────────── */
export interface CompanyProfile {
  org_id: string;
  legal_name: string | null;
  registration_no: string | null;
  license_no: string | null;
  iso_certificates: { name: string; number: string; expiry: string; file_url?: string }[];
  hse_summary: string | null;
  qaqc_policy: string | null;
  financial_summary: string | null;
  capability_summary: string | null;
  updated_at: string;
}

export function useCompanyProfile(orgId: string | undefined) {
  return useQuery<CompanyProfile | null>({
    queryKey: ["company_profile", orgId],
    enabled: !!orgId && !!supabaseTender,
    queryFn: async () => {
      const { data, error } = await db().from("company_profiles").select("*").eq("org_id", orgId).maybeSingle();
      if (error) throw error;
      return data as CompanyProfile | null;
    },
    staleTime: STALE_TIME,
  });
}

export async function upsertCompanyProfile(orgId: string, patch: Partial<CompanyProfile>) {
  const { error } = await db().from("company_profiles").upsert({ org_id: orgId, ...patch, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export interface ProjectExperience {
  id: string;
  org_id: string;
  project_name: string;
  client: string | null;
  consultant: string | null;
  country: string | null;
  location: string | null;
  project_type: string | null;
  contract_value: number | null;
  currency: string | null;
  area_m2: number | null;
  duration_months: number | null;
  completion_date: string | null;
  scope_summary: string | null;
  steel_tonnage: number | null;
  key_features: string | null;
  reference_person: string | null;
  photos: string[];
  created_at: string;
}

export function useProjectExperience(orgId: string | undefined) {
  return useQuery<ProjectExperience[]>({
    queryKey: ["project_experience", orgId],
    enabled: !!orgId && !!supabaseTender,
    queryFn: async () => {
      const { data, error } = await db().from("project_experience").select("*").eq("org_id", orgId).order("completion_date", { ascending: false });
      if (error) throw error;
      return data as ProjectExperience[];
    },
    staleTime: STALE_TIME,
  });
}

export async function createProjectExperience(orgId: string, input: Partial<ProjectExperience> & Pick<ProjectExperience, "project_name">) {
  const { error } = await db().from("project_experience").insert({ org_id: orgId, ...input });
  if (error) throw error;
}

export interface Personnel {
  id: string;
  org_id: string;
  full_name: string;
  current_position: string | null;
  education: string | null;
  certifications: { name: string; issuer?: string; year?: string }[];
  years_experience: number | null;
  languages: string | null;
  cv_file_url: string | null;
  created_at: string;
}

export function usePersonnel(orgId: string | undefined) {
  return useQuery<Personnel[]>({
    queryKey: ["personnel", orgId],
    enabled: !!orgId && !!supabaseTender,
    queryFn: async () => {
      const { data, error } = await db().from("personnel").select("*").eq("org_id", orgId).order("full_name");
      if (error) throw error;
      return data as Personnel[];
    },
    staleTime: STALE_TIME,
  });
}

export async function createPersonnel(orgId: string, input: Partial<Personnel> & Pick<Personnel, "full_name">) {
  const { error } = await db().from("personnel").insert({ org_id: orgId, ...input });
  if (error) throw error;
}

export interface TenderEquipment {
  id: string;
  org_id: string;
  name: string;
  category: string | null;
  ownership: "owned" | "rented" | null;
  quantity: number;
  created_at: string;
}

export function useTenderEquipment(orgId: string | undefined) {
  return useQuery<TenderEquipment[]>({
    queryKey: ["tender_equipment", orgId],
    enabled: !!orgId && !!supabaseTender,
    queryFn: async () => {
      const { data, error } = await db().from("equipment").select("*").eq("org_id", orgId).order("name");
      if (error) throw error;
      return data as TenderEquipment[];
    },
    staleTime: STALE_TIME,
  });
}

export async function createEquipment(orgId: string, input: Partial<TenderEquipment> & Pick<TenderEquipment, "name">) {
  const { error } = await db().from("equipment").insert({ org_id: orgId, ...input });
  if (error) throw error;
}

/* ── Activity log ────────────────────────────────────────── */
export async function logTenderActivity(tenderId: string, userId: string, action: string, entityType?: string, entityId?: string, detail?: Record<string, unknown>) {
  await db().from("tender_activity_log").insert({
    tender_id: tenderId, user_id: userId, action, entity_type: entityType, entity_id: entityId, detail,
  });
}
