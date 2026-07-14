/**
 * Parsing helpers for the daily manpower Excel import (spec §7) — same
 * detect-then-confirm approach as the BOQ importer: find a likely header
 * row and column mapping, hand both to the review UI for the user to
 * correct before anything lands on the day's shared Site Diary record.
 * Reuses the workbook plumbing from cm-boq-import.
 */
import type { BoqRow } from "./cm-boq-import";

export type ManpowerField =
  | "company" | "trade" | "category" | "count"
  | "normalHours" | "otHours" | "location" | "activity";

export const MANPOWER_IMPORT_FIELDS: ManpowerField[] = [
  "company", "trade", "category", "count", "normalHours", "otHours", "location", "activity",
];

export type ManpowerColumnMapping = Record<ManpowerField, number | null>;

/** A parsed sheet row before location resolution — `location_text` is the
 *  raw cell; the UI resolves it against the project's location names. */
export interface ManpowerDraftRow {
  company: string | null;
  trade: string;
  category: string | null;
  count: number;
  normal_hours: number | null;
  ot_hours: number | null;
  location_text: string | null;
  activity: string | null;
}

const HEADER_KEYWORDS: Record<ManpowerField, RegExp> = {
  // "OT" must be tested before normalHours so a plain "Hours" column doesn't
  // swallow "OT Hours" — field order in MANPOWER_IMPORT_FIELDS is not the
  // match order; the loop below checks otHours first explicitly.
  company: /company|subcontract|firm/i,
  trade: /trade|work\s*type|discipline|craft/i,
  category: /categ|class|grade/i,
  count: /worker|head\s*count|no\.?\s*(of)?\s*(worker|pax|person|people)|manpower|qty|quantity/i,
  normalHours: /normal|working\s*hours?|^hours?$|^hrs?$/i,
  otHours: /\bot\b|overtime/i,
  location: /location|building|zone|area|block/i,
  activity: /activity|task|work\s*desc/i,
};

const MATCH_ORDER: ManpowerField[] = [
  "otHours", "normalHours", "company", "trade", "category", "count", "location", "activity",
];

/** Scans the first rows for the one that looks most like a manpower sheet
 *  header (trade or company column plus a worker-count column required). */
export function detectManpowerHeaderRow(rows: BoqRow[], maxScanRows = 30): { rowIndex: number; mapping: ManpowerColumnMapping } | null {
  let best: { rowIndex: number; score: number; mapping: ManpowerColumnMapping } | null = null;
  for (let r = 0; r < Math.min(rows.length, maxScanRows); r++) {
    const row = rows[r];
    const mapping: ManpowerColumnMapping = {
      company: null, trade: null, category: null, count: null,
      normalHours: null, otHours: null, location: null, activity: null,
    };
    let score = 0;
    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] ?? "").trim();
      if (!cell) continue;
      for (const field of MATCH_ORDER) {
        if (mapping[field] == null && HEADER_KEYWORDS[field].test(cell)) {
          mapping[field] = c;
          score++;
          break;
        }
      }
    }
    const looksLikeHeader = mapping.count != null && (mapping.trade != null || mapping.company != null);
    if (looksLikeHeader && (!best || score > best.score)) best = { rowIndex: r, score, mapping };
  }
  return best ? { rowIndex: best.rowIndex, mapping: best.mapping } : null;
}

/** A totals/summary row would otherwise import as a fake crew (it has a
 *  label and a big count) — nearly every real manpower sheet has one.
 *  Covers English plus the app's other UI languages (Khmer, Chinese). */
const TOTAL_ROW = /^((sub|grand)\s*)?total\b|^សរុប|^总计|^合计|^小计/i;

/** Converts the rows after the header into draft manpower rows using a
 *  (possibly user-corrected) mapping. Rows with no trade AND no company, a
 *  zero/blank worker count, or a totals label are skipped — section and
 *  summary rows in real sheets look exactly like that. */
export function rowsToManpowerDraftRows(rows: BoqRow[], headerRowIndex: number, mapping: ManpowerColumnMapping): ManpowerDraftRow[] {
  const cellAt = (row: BoqRow, col: number | null) => (col == null ? "" : String(row[col] ?? "").trim());
  const numAt = (row: BoqRow, col: number | null) => {
    const v = cellAt(row, col).replace(/,/g, "");
    return v === "" ? null : Number(v);
  };

  const items: ManpowerDraftRow[] = [];
  for (let r = headerRowIndex + 1; r < rows.length; r++) {
    const row = rows[r];
    const trade = cellAt(row, mapping.trade);
    const company = cellAt(row, mapping.company);
    if (!trade && !company) continue;
    if (TOTAL_ROW.test(trade) || TOTAL_ROW.test(company)) continue;
    const count = Math.max(0, Math.round(numAt(row, mapping.count) ?? 0));
    if (count === 0) continue;
    const normal = numAt(row, mapping.normalHours);
    const ot = numAt(row, mapping.otHours);
    items.push({
      company: company || null,
      trade: trade || company,
      category: cellAt(row, mapping.category) || null,
      count,
      normal_hours: normal != null && normal >= 0 ? normal : null,
      ot_hours: ot != null && ot >= 0 ? ot : null,
      location_text: cellAt(row, mapping.location) || null,
      activity: cellAt(row, mapping.activity) || null,
    });
  }
  return items;
}
