/**
 * Document Classification Agent (docs/ai-agent-architecture.md) — runs
 * inline per uploaded file. Downloads the file from Storage, extracts text
 * (docs/ai-agent-architecture.md's extraction pipeline), stores searchable
 * chunks with citation anchors, then classifies the document with one
 * Claude call. Triggered by the client right after each upload; the
 * documents UI polls `tender_documents.status` until it flips to
 * 'processed' or 'failed' (see useTenderDocuments's refetchInterval).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { extractByFileType, chunkSections, unzipEntries, unrarEntries } from "./lib/extract.js";
import { callClaude, type ClaudeToolSchema } from "./lib/ai.js";
import {
  getTenderEnv, getAuthedUserId, authorizeTenderAccess, sbGet, sbPatch, sbPost,
  downloadStorageObject, uploadStorageObject, type TenderEnv,
} from "./lib/auth.js";

/** Rewrite known share-link hosts (Google Drive, OneDrive/SharePoint) to their
 *  direct-download URL. Anything else is used as-is. Folded into this endpoint
 *  (rather than its own api/tender/import-from-link.ts) to stay under Vercel's
 *  Hobby-plan 12-serverless-functions-per-deployment cap. */
function toDirectDownloadUrl(rawUrl: string): string {
  let url: URL;
  try { url = new URL(rawUrl); } catch { return rawUrl; }

  if (url.hostname === "drive.google.com") {
    const match = url.pathname.match(/\/file\/d\/([^/]+)/);
    const id = match?.[1] ?? url.searchParams.get("id");
    if (id) return `https://drive.google.com/uc?export=download&id=${id}`;
  }
  if (url.hostname === "onedrive.live.com" || url.hostname === "1drv.ms") {
    if (!url.searchParams.has("download")) url.searchParams.set("download", "1");
    return url.toString();
  }
  if (url.hostname.endsWith(".sharepoint.com")) {
    if (!url.searchParams.has("download")) url.searchParams.set("download", "1");
    return url.toString();
  }
  return rawUrl;
}

function fileNameFromResponse(res: Response, fallbackUrl: string, providedName?: string): string {
  if (providedName?.trim()) return providedName.trim();
  const disposition = res.headers.get("content-disposition");
  const match = disposition?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  if (match?.[1]) {
    try { return decodeURIComponent(match[1]); } catch { return match[1]; }
  }
  try {
    const last = new URL(fallbackUrl).pathname.split("/").filter(Boolean).pop();
    if (last) return decodeURIComponent(last);
  } catch { /* fall through */ }
  return "document";
}

/** Fetches a share link server-side (avoids the CORS block a browser fetch
 *  would hit on Drive/OneDrive), stores it in the same "tender-documents"
 *  bucket a normal upload uses, and inserts the same tender_documents row
 *  shape — so it feeds into the same processing code below either way. */
async function importFromLink(env: TenderEnv, orgId: string, tenderId: string, userId: string, linkUrl: string, relativePath: string | undefined): Promise<TenderDocumentRow> {
  const fetched = await fetch(toDirectDownloadUrl(linkUrl), { redirect: "follow" });
  if (!fetched.ok) {
    throw new Error(`The link returned an error (${fetched.status}). Make sure it's set to "Anyone with the link can view".`);
  }
  const contentType = fetched.headers.get("content-type") ?? "application/octet-stream";
  const fileName = fileNameFromResponse(fetched, linkUrl, relativePath?.split("/").pop());
  const bytes = Buffer.from(await fetched.arrayBuffer());

  if (contentType.includes("text/html") && !fileName.toLowerCase().endsWith(".html")) {
    throw new Error("That link didn't return a downloadable file — it may require sign-in, be a folder link, or be a large Google Drive file needing a virus-scan confirmation. Share a direct single-file link with \"Anyone with the link can view\" access.");
  }

  const storagePath = `${orgId}/${tenderId}/${crypto.randomUUID()}-${fileName}`;
  await uploadStorageObject(env, "tender-documents", storagePath, bytes, contentType);

  const [doc] = await sbPost<TenderDocumentRow[]>(env, "tender_documents", {
    tender_id: tenderId,
    storage_path: storagePath,
    relative_path: relativePath ?? fileName,
    file_name: fileName,
    file_type: (fileName.split(".").pop() ?? "other").toLowerCase(),
    file_size_bytes: bytes.length,
    uploaded_by: userId,
  });
  return doc;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const MAX_CHUNKS = 800;
const CLASSIFY_INPUT_CHARS = 8000;

const TENDER_DOC_CATEGORIES = [
  "instructions_to_tenderers", "tender_conditions", "general_conditions", "particular_conditions",
  "employer_requirements", "technical_specifications", "architectural_drawings", "structural_drawings",
  "mep_drawings", "infrastructure_drawings", "boq", "pricing_schedule", "tender_form", "contract_form",
  "addendum", "clarification", "scope_of_work", "project_schedule", "qaqc_requirements", "hse_requirements",
  "environmental_requirements", "insurance_requirements", "bonds_guarantees", "financial_requirements",
  "company_qualification_requirements", "key_personnel_requirements", "equipment_requirements",
  "material_requirements", "subcontractor_requirements", "testing_commissioning", "warranty",
  "handover_requirements", "other",
];

const CLASSIFY_TOOL: ClaudeToolSchema = {
  name: "classify_document",
  description: "Classify a tender document and extract its identifying metadata from its text.",
  input_schema: {
    type: "object",
    properties: {
      doc_category: { type: "string", enum: TENDER_DOC_CATEGORIES, description: "Best-fit category for this document." },
      doc_number: { type: ["string", "null"], description: "Document/drawing/spec number if stated, else null." },
      revision: { type: ["string", "null"], description: "Revision code if stated, else null." },
      doc_date: { type: ["string", "null"], description: "ISO date (YYYY-MM-DD) if a document date is stated, else null." },
      discipline: { type: ["string", "null"], description: "Engineering discipline if applicable (e.g. Structural, MEP, Civil), else null." },
    },
    required: ["doc_category", "doc_number", "revision", "doc_date", "discipline"],
  },
};

const CLASSIFY_SYSTEM = `You classify construction tender documents by their content. Choose the single best-fit category from the given enum — never invent a category outside it. Extract doc_number/revision/doc_date/discipline only when the text explicitly states them; use null rather than guessing.`;

interface TenderDocumentRow {
  id: string; tender_id: string; storage_path: string; file_name: string; file_type: string; doc_category_source: string;
}

interface ProcessResult {
  status: "processed" | "failed";
  chunks: number;
  error?: string;
  note?: string;
  classifyUpdate?: Record<string, unknown>;
}

/** Extract + chunk + classify one already-uploaded document. Patches its own
 *  status/processing_error and logs ai_jobs — pulled out of the HTTP handler
 *  so the zip-expansion path below can run it once per extracted file
 *  without going through a separate request per file. */
async function processOneDocument(env: TenderEnv, apiKey: string, doc: TenderDocumentRow): Promise<ProcessResult> {
  const startedAt = new Date().toISOString();
  const fail = async (message: string): Promise<ProcessResult> => {
    await sbPatch(env, `tender_documents?id=eq.${doc.id}`, { status: "failed", processing_error: message }).catch(() => {});
    await sbPost(env, "ai_jobs", {
      tender_id: doc.tender_id, agent: "document_classifier", status: "failed",
      input_summary: { file_name: doc.file_name }, error: message, started_at: startedAt, finished_at: new Date().toISOString(),
    }).catch(() => {});
    return { status: "failed", chunks: 0, error: message };
  };

  try {
    await sbPatch(env, `tender_documents?id=eq.${doc.id}`, { status: "processing", processing_error: null });

    const fileBytes = await downloadStorageObject(env, "tender-documents", doc.storage_path);
    const sections = await extractByFileType(doc.file_type, fileBytes);

    if (!sections) {
      // Unsupported type (image, CAD, etc.) — stored, not OCR'd, in Phase 1.
      await sbPatch(env, `tender_documents?id=eq.${doc.id}`, { status: "processed", processing_error: null });
      await sbPost(env, "ai_jobs", {
        tender_id: doc.tender_id, agent: "document_classifier", status: "succeeded",
        input_summary: { file_name: doc.file_name }, output_summary: { chunks: 0, note: "unsupported file type — no text extraction in Phase 1" },
        started_at: startedAt, finished_at: new Date().toISOString(),
      }).catch(() => {});
      return { status: "processed", chunks: 0, note: "unsupported file type" };
    }

    let chunks = chunkSections(sections);
    const truncated = chunks.length > MAX_CHUNKS;
    if (truncated) chunks = chunks.slice(0, MAX_CHUNKS);

    if (chunks.length > 0) {
      await sbPost(env, "tender_document_chunks", chunks.map((c) => ({
        document_id: doc.id,
        tender_id: doc.tender_id,
        chunk_index: c.chunkIndex,
        content: c.content,
        page_number: c.pageNumber,
        section_label: c.sectionLabel,
      })));
    }

    const fullText = sections.map((s) => s.text).join("\n\n").slice(0, CLASSIFY_INPUT_CHARS);
    let classifyUpdate: Record<string, unknown> = {};
    if (fullText.trim()) {
      const { input } = await callClaude({
        apiKey, system: CLASSIFY_SYSTEM,
        userMessage: `Document filename: "${doc.file_name}"\n\nExtracted text (may be truncated):\n\n${fullText}`,
        tool: CLASSIFY_TOOL, maxTokens: 512,
      });
      classifyUpdate = {
        doc_number: input.doc_number ?? null,
        revision: input.revision ?? null,
        doc_date: input.doc_date ?? null,
        discipline: input.discipline ?? null,
      };
      // Never overwrite a category a human already corrected.
      if (doc.doc_category_source !== "user") classifyUpdate.doc_category = input.doc_category;
    }

    await sbPatch(env, `tender_documents?id=eq.${doc.id}`, {
      status: "processed", processing_error: truncated ? `Only the first ${MAX_CHUNKS} chunks were indexed (document is unusually large).` : null,
      ...classifyUpdate,
    });

    await sbPost(env, "ai_jobs", {
      tender_id: doc.tender_id, agent: "document_classifier", status: "succeeded",
      input_summary: { file_name: doc.file_name }, output_summary: { chunks: chunks.length, ...classifyUpdate },
      started_at: startedAt, finished_at: new Date().toISOString(),
    }).catch(() => {});

    return { status: "processed", chunks: chunks.length, classifyUpdate };
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err));
  }
}

const ARCHIVE_EXTRACTORS: Record<string, (buf: Buffer) => Promise<Awaited<ReturnType<typeof unzipEntries>>>> = {
  zip: unzipEntries,
  rar: unrarEntries,
};

/** Unpacks a zip/rar document into its individual files, uploads each to
 *  Storage under a folder named after the archive (so the Documents UI
 *  groups them the same way "Upload Folder" does), inserts a
 *  tender_documents row per file, then runs processOneDocument on each — so
 *  a single archive upload ends up fully extracted and processed without
 *  the user re-uploading via Upload Folder by hand. */
async function expandAndProcessArchive(env: TenderEnv, apiKey: string, orgId: string, userId: string, archiveDoc: TenderDocumentRow): Promise<ProcessResult & { childCount: number }> {
  const startedAt = new Date().toISOString();
  const archiveType = archiveDoc.file_type.toLowerCase();
  const archiveBaseName = archiveDoc.file_name.replace(/\.(zip|rar)$/i, "");
  const extractEntries = ARCHIVE_EXTRACTORS[archiveType];

  let entries: Awaited<ReturnType<typeof unzipEntries>>;
  try {
    const archiveBytes = await downloadStorageObject(env, "tender-documents", archiveDoc.storage_path);
    entries = await extractEntries(archiveBytes);
  } catch (err) {
    const message = `Failed to unpack ${archiveType}: ${err instanceof Error ? err.message : String(err)}`;
    await sbPatch(env, `tender_documents?id=eq.${archiveDoc.id}`, { status: "failed", processing_error: message }).catch(() => {});
    return { status: "failed", chunks: 0, error: message, childCount: 0 };
  }

  if (entries.length === 0) {
    await sbPatch(env, `tender_documents?id=eq.${archiveDoc.id}`, { status: "processed", processing_error: `Archive was empty (or contained only unsupported junk files).` });
    return { status: "processed", chunks: 0, note: "empty archive", childCount: 0 };
  }

  let totalChunks = 0;
  let failedCount = 0;
  for (const entry of entries) {
    const fileName = entry.path.split("/").pop() ?? entry.path;
    const fileType = (fileName.split(".").pop() ?? "other").toLowerCase();
    const storagePath = `${orgId}/${archiveDoc.tender_id}/${crypto.randomUUID()}-${fileName}`;
    try {
      await uploadStorageObject(env, "tender-documents", storagePath, entry.buf, "application/octet-stream");
      const [childDoc] = await sbPost<TenderDocumentRow[]>(env, "tender_documents", {
        tender_id: archiveDoc.tender_id,
        storage_path: storagePath,
        relative_path: `${archiveBaseName}/${entry.path}`,
        file_name: fileName,
        file_type: fileType,
        file_size_bytes: entry.buf.length,
        uploaded_by: userId,
      });
      // Nested archives inside the archive are left as-is (one level of unpacking only).
      if (!(fileType in ARCHIVE_EXTRACTORS)) {
        const result = await processOneDocument(env, apiKey, childDoc);
        totalChunks += result.chunks;
        if (result.status === "failed") failedCount += 1;
      }
    } catch {
      failedCount += 1;
    }
  }

  const note = `Expanded into ${entries.length} file${entries.length !== 1 ? "s" : ""}${failedCount > 0 ? ` (${failedCount} failed)` : ""}.`;
  await sbPatch(env, `tender_documents?id=eq.${archiveDoc.id}`, { status: "processed", processing_error: note });
  await sbPost(env, "ai_jobs", {
    tender_id: archiveDoc.tender_id, agent: "document_classifier", status: "succeeded",
    input_summary: { file_name: archiveDoc.file_name }, output_summary: { childCount: entries.length, chunks: totalChunks, failedCount },
    started_at: startedAt, finished_at: new Date().toISOString(),
  }).catch(() => {});

  return { status: "processed", chunks: totalChunks, note, childCount: entries.length };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const env = getTenderEnv();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!env || !apiKey) return res.status(500).json({ error: "TenderAI backend not configured" });

  const userId = await getAuthedUserId(env, req.headers.authorization);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const documentId = typeof req.body?.documentId === "string" ? req.body.documentId : "";
  const linkUrl = typeof req.body?.url === "string" ? req.body.url.trim() : "";
  const linkTenderId = typeof req.body?.tenderId === "string" ? req.body.tenderId : "";
  const linkRelativePath = typeof req.body?.relativePath === "string" && req.body.relativePath.trim()
    ? req.body.relativePath.trim() : undefined;
  if (!documentId && !(linkUrl && linkTenderId)) {
    return res.status(400).json({ error: "Missing documentId, or tenderId + url" });
  }

  let doc: TenderDocumentRow;
  let orgId: string | null;
  if (documentId) {
    try {
      const rows = await sbGet<TenderDocumentRow>(
        env,
        `tender_documents?id=eq.${documentId}&select=id,tender_id,storage_path,file_name,file_type,doc_category_source`,
      );
      if (!rows[0]) return res.status(404).json({ error: "Document not found" });
      doc = rows[0];
    } catch (err) {
      return res.status(500).json({ error: "Failed to load document", detail: err instanceof Error ? err.message : String(err) });
    }
    orgId = await authorizeTenderAccess(env, doc.tender_id, userId).catch(() => null);
    if (!orgId) return res.status(403).json({ error: "Not authorized for this tender" });
  } else {
    orgId = await authorizeTenderAccess(env, linkTenderId, userId).catch(() => null);
    if (!orgId) return res.status(403).json({ error: "Not authorized for this tender" });
    try {
      doc = await importFromLink(env, orgId, linkTenderId, userId, linkUrl, linkRelativePath);
    } catch (err) {
      return res.status(400).json({ error: err instanceof Error ? err.message : "Failed to import from link" });
    }
  }

  if (["zip", "rar"].includes(doc.file_type.toLowerCase())) {
    const result = await expandAndProcessArchive(env, apiKey, orgId, userId, doc);
    if (result.status === "failed") return res.status(500).json({ error: result.error });
    return res.status(200).json({ ok: true, document: doc, ...result });
  }

  const result = await processOneDocument(env, apiKey, doc);
  if (result.status === "failed") return res.status(500).json({ error: result.error });

  await sbPost(env, "tender_activity_log", {
    tender_id: doc.tender_id, user_id: userId, action: "ai_generate",
    entity_type: "tender_documents", entity_id: doc.id,
    detail: { stage: "process_document", chunks: result.chunks, ...result.classifyUpdate },
  }).catch(() => {});

  return res.status(200).json({ ok: true, document: { ...doc, ...result.classifyUpdate }, ...result });
}

export const config = { maxDuration: 60 };
