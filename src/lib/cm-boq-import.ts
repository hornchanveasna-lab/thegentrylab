/**
 * Parsing helpers for the BOQ import flow (Excel/CSV/PDF → draft BOQ items).
 * Pure/parsing logic only — no Supabase IO — so it can be exercised and
 * reasoned about independently of the review UI that consumes it.
 *
 * BOQs vary a lot between companies (confirmed against a real reference
 * file), so this deliberately does NOT try to be a fully-automatic importer:
 * it detects a likely header row and column mapping, then hands both to the
 * caller for the user to confirm or correct before anything is imported.
 */
import * as XLSX from "xlsx";
import * as pdfjsLib from "pdfjs-dist";
// eslint-disable-next-line import/no-unresolved
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export type BoqCell = string | number;
export type BoqRow = BoqCell[];

export interface BoqSheet {
  sheetName: string;
  rows: BoqRow[];
}

export type BoqField = "description" | "unit" | "quantity" | "unitCost" | "category";

export type BoqColumnMapping = Record<BoqField, number | null>;

export interface BoqDraftItem {
  description: string;
  unit: string | null;
  quantity: number;
  unit_cost: number;
  category: string | null;
}

/** Parses an Excel/CSV file into one row array per sheet (raw cell values,
 *  no header detection yet). Also handles single-sheet CSVs. */
export async function parseWorkbookRows(file: File): Promise<BoqSheet[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  return wb.SheetNames.map((sheetName) => ({
    sheetName,
    rows: XLSX.utils.sheet_to_json<BoqRow>(wb.Sheets[sheetName], { header: 1, raw: true, defval: "" }),
  }));
}

/** Best-effort PDF table extraction: groups text runs into rows by
 *  y-position and orders each row's runs by x-position. This is a much
 *  rougher heuristic than reading a real spreadsheet — PDFs have no actual
 *  column/row structure — so PDF-sourced sheets typically need more manual
 *  correction in the review step than Excel-sourced ones. */
export async function parsePdfRows(file: File): Promise<BoqSheet[]> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const rows: BoqRow[] = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const rowsByY = new Map<number, { x: number; str: string }[]>();
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const x = item.transform[4];
      const y = item.transform[5];
      const bucket = Math.round(y / 3) * 3; // merge text runs on the same visual line
      if (!rowsByY.has(bucket)) rowsByY.set(bucket, []);
      rowsByY.get(bucket)!.push({ x, str: item.str });
    }
    const orderedYs = [...rowsByY.keys()].sort((a, b) => b - a); // PDF y grows upward; top of page first
    for (const y of orderedYs) {
      rows.push(rowsByY.get(y)!.sort((a, b) => a.x - b.x).map((cell) => cell.str));
    }
  }
  return [{ sheetName: file.name.replace(/\.pdf$/i, ""), rows }];
}

const HEADER_KEYWORDS: Record<BoqField, RegExp> = {
  // "Item(s)"/"Work Item" is checked before "Description" below since many
  // BOQs (confirmed against a real reference file) put the actual line-item
  // name in an "Items" column and use a separate, often-blank "Description"
  // column for extra specs — scanning left-to-right and matching "Items"
  // first here means it wins when both columns exist on the same sheet.
  description: /^items?$|work item|item name|descr/i,
  unit: /^unit$|uom/i,
  quantity: /qty|quantity/i,
  unitCost: /price|rate|cost/i,
  category: /categ|section|group/i,
};

/** Scans the first `maxScanRows` rows for the row that looks most like a
 *  BOQ header (matching the most distinct field keywords), and derives a
 *  starting column mapping from it. Returns null if nothing plausible is
 *  found (e.g. an empty or non-tabular sheet). */
export function detectHeaderRow(rows: BoqRow[], maxScanRows = 30): { rowIndex: number; mapping: BoqColumnMapping } | null {
  let best: { rowIndex: number; score: number; mapping: BoqColumnMapping } | null = null;
  for (let r = 0; r < Math.min(rows.length, maxScanRows); r++) {
    const row = rows[r];
    const mapping: BoqColumnMapping = { description: null, unit: null, quantity: null, unitCost: null, category: null };
    let score = 0;
    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] ?? "").trim();
      if (!cell) continue;
      for (const field of Object.keys(HEADER_KEYWORDS) as BoqField[]) {
        if (mapping[field] == null && HEADER_KEYWORDS[field].test(cell)) {
          mapping[field] = c;
          score++;
          break;
        }
      }
    }
    const looksLikeHeader = mapping.description != null && (mapping.quantity != null || mapping.unitCost != null);
    if (looksLikeHeader && (!best || score > best.score)) best = { rowIndex: r, score, mapping };
  }
  return best ? { rowIndex: best.rowIndex, mapping: best.mapping } : null;
}

/** Converts the rows after the header into draft BOQ items using a
 *  (possibly user-corrected) column mapping. A row with no quantity/unit/
 *  cost at all is treated as a section/sub-section label rather than a line
 *  item — its description is folded into the following items' `category`
 *  instead of being imported as its own row, so the sheet's hierarchy isn't
 *  silently dropped. */
export function rowsToBoqDraftItems(rows: BoqRow[], headerRowIndex: number, mapping: BoqColumnMapping, categoryFallback: string): BoqDraftItem[] {
  const items: BoqDraftItem[] = [];
  let currentSection = "";
  const cellAt = (row: BoqRow, col: number | null) => (col == null ? "" : String(row[col] ?? "").trim());

  for (let r = headerRowIndex + 1; r < rows.length; r++) {
    const row = rows[r];
    const description = cellAt(row, mapping.description);
    if (!description) continue;
    const quantityStr = cellAt(row, mapping.quantity);
    const unitStr = cellAt(row, mapping.unit);
    const unitCostStr = cellAt(row, mapping.unitCost);

    if (!quantityStr && !unitStr && !unitCostStr) {
      currentSection = description;
      continue;
    }

    const categoryFromColumn = cellAt(row, mapping.category);
    items.push({
      description,
      unit: unitStr || null,
      quantity: Number(quantityStr.replace(/,/g, "")) || 0,
      unit_cost: Number(unitCostStr.replace(/,/g, "")) || 0,
      category: [categoryFallback, categoryFromColumn || currentSection].filter(Boolean).join(" — ") || null,
    });
  }
  return items;
}
