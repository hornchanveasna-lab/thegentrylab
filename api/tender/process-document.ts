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
import { extractByFileType, chunkSections } from "./lib/extract.js";
import { callClaude, type ClaudeToolSchema } from "./lib/ai.js";
import { getTenderEnv, getAuthedUserId, authorizeTenderAccess, sbGet, sbPatch, sbPost, downloadStorageObject } from "./lib/auth.js";

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
  if (!documentId) return res.status(400).json({ error: "Missing documentId" });

  let doc: TenderDocumentRow;
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

  const orgId = await authorizeTenderAccess(env, doc.tender_id, userId).catch(() => null);
  if (!orgId) return res.status(403).json({ error: "Not authorized for this tender" });

  const startedAt = new Date().toISOString();
  const fail = async (message: string) => {
    await sbPatch(env, `tender_documents?id=eq.${documentId}`, { status: "failed", processing_error: message }).catch(() => {});
    await sbPost(env, "ai_jobs", {
      tender_id: doc.tender_id, agent: "document_classifier", status: "failed",
      input_summary: { file_name: doc.file_name }, error: message, started_at: startedAt, finished_at: new Date().toISOString(),
    }).catch(() => {});
    return res.status(500).json({ error: message });
  };

  try {
    await sbPatch(env, `tender_documents?id=eq.${documentId}`, { status: "processing", processing_error: null });

    const fileBytes = await downloadStorageObject(env, "tender-documents", doc.storage_path);
    const sections = await extractByFileType(doc.file_type, fileBytes);

    if (!sections) {
      // Unsupported type (image, CAD, zip, etc.) — stored, not OCR'd, in Phase 1.
      await sbPatch(env, `tender_documents?id=eq.${documentId}`, { status: "processed", processing_error: null });
      await sbPost(env, "ai_jobs", {
        tender_id: doc.tender_id, agent: "document_classifier", status: "succeeded",
        input_summary: { file_name: doc.file_name }, output_summary: { chunks: 0, note: "unsupported file type — no text extraction in Phase 1" },
        started_at: startedAt, finished_at: new Date().toISOString(),
      }).catch(() => {});
      return res.status(200).json({ ok: true, chunks: 0, note: "unsupported file type" });
    }

    let chunks = chunkSections(sections);
    const truncated = chunks.length > MAX_CHUNKS;
    if (truncated) chunks = chunks.slice(0, MAX_CHUNKS);

    if (chunks.length > 0) {
      await sbPost(env, "tender_document_chunks", chunks.map((c) => ({
        document_id: documentId,
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

    await sbPatch(env, `tender_documents?id=eq.${documentId}`, {
      status: "processed", processing_error: truncated ? `Only the first ${MAX_CHUNKS} chunks were indexed (document is unusually large).` : null,
      ...classifyUpdate,
    });

    await sbPost(env, "ai_jobs", {
      tender_id: doc.tender_id, agent: "document_classifier", status: "succeeded",
      input_summary: { file_name: doc.file_name }, output_summary: { chunks: chunks.length, ...classifyUpdate },
      started_at: startedAt, finished_at: new Date().toISOString(),
    }).catch(() => {});

    await sbPost(env, "tender_activity_log", {
      tender_id: doc.tender_id, user_id: userId, action: "ai_generate",
      entity_type: "tender_documents", entity_id: documentId,
      detail: { stage: "process_document", chunks: chunks.length, ...classifyUpdate },
    }).catch(() => {});

    return res.status(200).json({ ok: true, chunks: chunks.length, ...classifyUpdate });
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err));
  }
}

export const config = { maxDuration: 60 };
