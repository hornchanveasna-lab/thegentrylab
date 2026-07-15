/**
 * Parsing helpers for the schedule Excel/CSV import (Schedule spec §4) —
 * the same detect-then-confirm approach as the BOQ and manpower importers.
 * Primavera XER / MS Project XML are NOT handled here: exporting those to
 * Excel first is the supported path, and the UI says so rather than
 * pretending to parse proprietary formats.
 */
import type { BoqRow } from "./cm-boq-import";

export type ScheduleField = "code" | "name" | "group" | "start" | "finish" | "progress" | "weight";

export const SCHEDULE_IMPORT_FIELDS: ScheduleField[] = [
  "code", "name", "group", "start", "finish", "progress", "weight",
];

export type ScheduleColumnMapping = Record<ScheduleField, number | null>;

export interface ScheduleDraftActivity {
  activity_code: string | null;
  title: string;
  group_label: string;
  plan_start: string;
  plan_finish: string;
  actual_percent: number;
  weight: number;
}

const HEADER_KEYWORDS: Record<ScheduleField, RegExp> = {
  code: /^(activity\s*)?(id|code)$|task\s*id/i,
  name: /name|activity|task|descr/i,
  group: /wbs|group|phase|section|stage/i,
  start: /start/i,
  finish: /finish|end/i,
  progress: /progress|%\s*compl|complete|pct/i,
  weight: /weight/i,
};

// "code" before "name" so an "Activity ID" column isn't claimed by the
// name pattern's "activity"; "finish" before generic matches for safety.
const MATCH_ORDER: ScheduleField[] = ["code", "finish", "start", "progress", "weight", "group", "name"];

/** Excel stores dates as serial day numbers (epoch 1899-12-30). Strings are
 *  handed to Date.parse. Returns null when the cell can't be read as a date. */
export function cellToIsoDate(value: string | number): string | null {
  if (typeof value === "number" && value > 20000 && value < 80000) {
    const ms = Math.round((value - 25569) * 86400 * 1000); // 25569 = days from 1899-12-30 to Unix epoch
    return new Date(ms).toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // Common d/m/y or d-m-y site-schedule format (day-first, not US order).
  const dmy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

/** Finds the row that looks most like a schedule header — an activity-name
 *  column plus start or finish dates are required. */
export function detectScheduleHeaderRow(rows: BoqRow[], maxScanRows = 30): { rowIndex: number; mapping: ScheduleColumnMapping } | null {
  let best: { rowIndex: number; score: number; mapping: ScheduleColumnMapping } | null = null;
  for (let r = 0; r < Math.min(rows.length, maxScanRows); r++) {
    const row = rows[r];
    const mapping: ScheduleColumnMapping = { code: null, name: null, group: null, start: null, finish: null, progress: null, weight: null };
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
    const looksLikeHeader = mapping.name != null && (mapping.start != null || mapping.finish != null);
    if (looksLikeHeader && (!best || score > best.score)) best = { rowIndex: r, score, mapping };
  }
  return best ? { rowIndex: best.rowIndex, mapping: best.mapping } : null;
}

/** Converts sheet rows into draft activities. Rows with a name but no dates
 *  at all become the running group label (WBS band rows in real exports
 *  look exactly like that) unless a dedicated group column is mapped. */
export function rowsToScheduleDraftActivities(rows: BoqRow[], headerRowIndex: number, mapping: ScheduleColumnMapping, groupFallback: string): ScheduleDraftActivity[] {
  const cellAt = (row: BoqRow, col: number | null) => (col == null ? "" : String(row[col] ?? "").trim());
  const rawAt = (row: BoqRow, col: number | null): string | number => (col == null ? "" : row[col] ?? "");

  const items: ScheduleDraftActivity[] = [];
  let currentGroup = "";
  for (let r = headerRowIndex + 1; r < rows.length; r++) {
    const row = rows[r];
    const name = cellAt(row, mapping.name);
    if (!name) continue;
    const start = cellToIsoDate(rawAt(row, mapping.start));
    const finish = cellToIsoDate(rawAt(row, mapping.finish));
    if (!start && !finish) {
      currentGroup = name;
      continue;
    }
    const progressStr = cellAt(row, mapping.progress).replace(/%/g, "");
    let progress = Number(progressStr) || 0;
    if (progress > 0 && progress <= 1 && progressStr.includes(".")) progress *= 100; // 0.45 → 45%
    items.push({
      activity_code: cellAt(row, mapping.code) || null,
      title: name,
      group_label: cellAt(row, mapping.group) || currentGroup || groupFallback,
      plan_start: start ?? finish!,
      plan_finish: finish ?? start!,
      actual_percent: Math.max(0, Math.min(100, Math.round(progress))),
      weight: Math.max(0, Number(cellAt(row, mapping.weight)) || 1),
    });
  }
  return items;
}
