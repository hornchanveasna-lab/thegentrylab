/**
 * Text extraction for the document-processing pipeline (docs/ai-agent-
 * architecture.md's "Document extraction pipeline"). Each extractor returns
 * one or more pages/sections of plain text with citation anchors (page
 * number for PDF, sheet name for spreadsheets) so chunks stay traceable back
 * to a specific location in the source file.
 */
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import JSZip from "jszip";

export interface ExtractedSection {
  pageNumber: number | null;
  sectionLabel: string | null;
  text: string;
}

export interface DocChunk {
  chunkIndex: number;
  content: string;
  pageNumber: number | null;
  sectionLabel: string | null;
}

const standardFontDataUrl = new URL("../../../node_modules/pdfjs-dist/standard_fonts/", import.meta.url).toString();

/** pdfjs-dist (even its "legacy" Node build) touches DOMMatrix for glyph/text
 *  transform math while walking a PDF's structure — confirmed live via
 *  "DOMMatrix is not defined" on the Vercel Node runtime, which has no DOM.
 *  A minimal polyfill is enough since we only ever call getTextContent(),
 *  never render to canvas.
 *
 *  Separately, in Node pdfjs-dist always runs its "fake worker" (main-thread)
 *  path, which loads the worker's WorkerMessageHandler via a *dynamic*
 *  `import(this.workerSrc)` — a runtime string, not a static specifier, so
 *  Vercel's serverless bundler can't trace it and leaves it out of the
 *  deployed function. Confirmed live: "Setting up fake worker failed:
 *  Cannot find module '/var/task/node_modules/pdfjs-dist/legacy...'".
 *  pdfjs checks `globalThis.pdfjsWorker.WorkerMessageHandler` first and
 *  skips the dynamic import entirely if it's already set — so importing the
 *  worker module ourselves (a static import Vercel *does* trace and bundle)
 *  and stashing it there avoids the dynamic import ever running. */
async function ensurePdfjsPolyfills() {
  const g = globalThis as unknown as { DOMMatrix?: unknown; pdfjsWorker?: unknown };
  if (typeof g.DOMMatrix === "undefined") {
    const { default: DOMMatrix } = await import("dommatrix");
    g.DOMMatrix = DOMMatrix;
  }
  if (typeof g.pdfjsWorker === "undefined") {
    g.pdfjsWorker = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  }
}

export async function extractPdf(buf: Buffer): Promise<ExtractedSection[]> {
  await ensurePdfjsPolyfills();
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await getDocument({
    data: new Uint8Array(buf),
    useWorkerFetch: false,
    standardFontDataUrl,
    verbosity: 0,
  }).promise;

  const sections: ExtractedSection[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((it) => ("str" in it ? it.str : "")).join(" ");
    sections.push({ pageNumber: i, sectionLabel: null, text });
  }
  return sections;
}

export async function extractDocx(buf: Buffer): Promise<ExtractedSection[]> {
  const result = await mammoth.extractRawText({ buffer: buf });
  return [{ pageNumber: null, sectionLabel: null, text: result.value }];
}

export function extractSpreadsheet(buf: Buffer): ExtractedSection[] {
  const wb = XLSX.read(buf, { type: "buffer" });
  const sections: ExtractedSection[] = [];
  for (const sheetName of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], { header: 1, blankrows: false });
    const text = rows.map((r) => r.map((c) => (c ?? "").toString()).join(" | ")).join("\n");
    if (text.trim()) sections.push({ pageNumber: null, sectionLabel: sheetName, text });
  }
  return sections;
}

export function extractPlainText(buf: Buffer): ExtractedSection[] {
  return [{ pageNumber: null, sectionLabel: null, text: buf.toString("utf8") }];
}

export interface ZipEntry {
  /** Path inside the zip, e.g. "01 Instructions to Tenderers/ITT.pdf" — used
   *  as the child document's relative_path (prefixed with the zip's own name)
   *  so the Documents UI groups extracted files under a folder matching the
   *  original archive, the same way "Upload Folder" preserves structure. */
  path: string;
  buf: Buffer;
}

const ZIP_JUNK_RE = /(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db)(\/|$)/i;

/** Unpacks a zip into its individual file entries (skips directories, macOS/
 *  Windows junk files, and dotfiles). Nested zips inside a zip are kept as
 *  opaque entries, not recursively expanded — one level of unpacking is
 *  enough for the "tender package emailed as a single zip" case this exists
 *  for. */
export async function unzipEntries(buf: Buffer): Promise<ZipEntry[]> {
  const zip = await JSZip.loadAsync(buf);
  const entries: ZipEntry[] = [];
  for (const [path, file] of Object.entries(zip.files)) {
    if (file.dir) continue;
    if (ZIP_JUNK_RE.test(path)) continue;
    const basename = path.split("/").pop() ?? path;
    if (basename.startsWith(".")) continue;
    const content = await file.async("nodebuffer");
    entries.push({ path, buf: content });
  }
  return entries;
}

/** Types with no text-extraction path yet (images, drawings-as-image, CAD, unknown binaries).
 *  Stored as-is per docs/ai-agent-architecture.md — classified from filename only, not OCR'd, in Phase 1. */
export const UNSUPPORTED_TYPES = new Set(["image", "zip", "dwg", "jpg", "jpeg", "png", "other"]);

export async function extractByFileType(fileType: string, buf: Buffer): Promise<ExtractedSection[] | null> {
  switch (fileType.toLowerCase()) {
    case "pdf": return extractPdf(buf);
    case "docx": return extractDocx(buf);
    case "xlsx": case "xls": case "csv": return extractSpreadsheet(buf);
    case "txt": return extractPlainText(buf);
    default: return null;
  }
}

/** Splits extracted sections into ~maxChars chunks, one citation anchor (page/section) per source section. */
export function chunkSections(sections: ExtractedSection[], maxChars = 1500): DocChunk[] {
  const chunks: DocChunk[] = [];
  let chunkIndex = 0;
  for (const section of sections) {
    const text = section.text.trim().replace(/\s+/g, " ");
    if (!text) continue;
    for (let i = 0; i < text.length; i += maxChars) {
      chunks.push({
        chunkIndex: chunkIndex++,
        content: text.slice(i, i + maxChars),
        pageNumber: section.pageNumber,
        sectionLabel: section.sectionLabel,
      });
    }
  }
  return chunks;
}
