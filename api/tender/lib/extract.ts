/**
 * Text extraction for the document-processing pipeline (docs/ai-agent-
 * architecture.md's "Document extraction pipeline"). Each extractor returns
 * one or more pages/sections of plain text with citation anchors (page
 * number for PDF, sheet name for spreadsheets) so chunks stay traceable back
 * to a specific location in the source file.
 */
import mammoth from "mammoth";
import * as XLSX from "xlsx";

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

export async function extractPdf(buf: Buffer): Promise<ExtractedSection[]> {
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
