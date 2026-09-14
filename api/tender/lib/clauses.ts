/**
 * Clause-tree parser — Phase 1 of the rebuild plan.
 *
 * Tender documents are the most rigidly structured prose in commercial life:
 * `4.3.1`, `Clause 12`, `SECTION B`, `Appendix C`. This turns extracted pages
 * into that hierarchy so extraction can run per clause instead of over one
 * re-joined blob that has to be truncated at 40,000 characters.
 *
 * Deliberately regex and a stack, never a model. A model that re-numbers or
 * paraphrases a clause reference destroys the audit trail the whole product
 * rests on — and this has to produce byte-identical output on every run for
 * the Phase 4 content-hash comparison to mean anything.
 */
import { createHash } from "node:crypto";
import type { ExtractedSection } from "./extract.js";

export interface ClauseNode {
  /** Reference as printed: "4.3.1", "APPENDIX C", "PREAMBLE". */
  clauseRef: string;
  /** Parent's clauseRef, or null at the top level. */
  parentRef: string | null;
  /** Heading text on the same line as the reference, when there was one. */
  title: string | null;
  /** Body text belonging to this clause, excluding its descendants' bodies. */
  text: string;
  pageFrom: number | null;
  pageTo: number | null;
  /** 0 for parts/sections/appendices and top-level numbers, +1 per level. */
  depth: number;
  /** Position in document order, from 0. Stable across re-parses. */
  ordinal: number;
  /** sha256 of the normalised body. Phase 4 skips re-extraction when this is
   *  unchanged, which is what makes re-running after an addendum cheap. */
  contentHash: string;
}

/* ── Header detection ─────────────────────────────────────────────────── */

/** "SECTION 3", "PART B", "APPENDIX C", "ANNEX 2", "SCHEDULE 1" — container
 *  headings that sit above the numbering and reset it. */
const CONTAINER_RE = /^\s*(SECTION|PART|APPENDIX|ANNEX|ANNEXURE|SCHEDULE|EXHIBIT|VOLUME)\s+([A-Z0-9]{1,4})\b\.?\s*(.*)$/i;

/** Digits, or one/two capitals — "3", "B", "IV" style ids. Applied
 *  case-sensitively even though CONTAINER_RE is not. */
const VALID_CONTAINER_ID = /^(\d{1,3}|[A-Z]{1,2})$/;

/** Two-letter English words that would otherwise pass VALID_CONTAINER_ID in
 *  an all-caps heading or an all-caps run of prose. */
const CONTAINER_ID_STOPWORDS = new Set([
  "TO", "OF", "IN", "ON", "AT", "BY", "IS", "AS", "IT", "OR", "AN", "BE",
  "DO", "GO", "NO", "SO", "UP", "WE", "HE", "IF", "MY", "ME",
]);

/** "4.3.1 Title text" or "4.3.1" alone, optionally prefixed by
 *  "Clause"/"Sub-Clause" as FIDIC-derived documents write it. */
const NUMBERED_RE = /^\s*(?:(?:sub-)?clause\s+)?(\d{1,3}(?:\.\d{1,3}){0,5})\.?\s*(.*)$/i;

/** Lines that match NUMBERED_RE but are not clause headings. Without this the
 *  parser splits mid-sentence on dimensions, money and dates — "2.5 m", "15%
 *  of the Accepted Contract Amount", "28 days" all start a line looking
 *  exactly like a clause reference. */
const FALSE_POSITIVE_TAIL = /^(m|mm|cm|km|m2|m3|kg|t|%|days?|hours?|years?|months?|USD|KHR|EUR|no\.?|nr\.?|off)\b/i;

interface Header {
  clauseRef: string;
  title: string | null;
  depth: number;
  isContainer: boolean;
}

/** Decides whether a line opens a new clause. Conservative on purpose: a
 *  missed heading merges two clauses (recoverable — the text is still there
 *  and still extracted), while a false heading splits one clause in half and
 *  can cut a sentence, which corrupts a citation. */
export function parseHeader(line: string): Header | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 200) return null;

  const container = CONTAINER_RE.exec(trimmed);
  if (container) {
    const [, kind, id, rest] = container;
    // The id is validated case-sensitively and against a stop-list, because
    // CONTAINER_RE is case-insensitive and prose says things like "Appendix
    // to Tender" and "Part of the Works" mid-sentence. Matching those splits
    // a clause in half and cuts the sentence a citation depends on.
    if (VALID_CONTAINER_ID.test(id) && !CONTAINER_ID_STOPWORDS.has(id.toUpperCase())) {
      return {
        clauseRef: `${kind.toUpperCase()} ${id.toUpperCase()}`,
        title: rest.trim() || null,
        depth: 0,
        isContainer: true,
      };
    }
    // Not a real container heading — fall through to the numbered check.
  }

  const numbered = NUMBERED_RE.exec(trimmed);
  if (!numbered) return null;
  const [, ref, rest] = numbered;
  const tail = rest.trim();

  // "1." alone on a line is a heading whose title is on the next line.
  // "1. 2.5 m clear height" is not a heading at all.
  if (tail && FALSE_POSITIVE_TAIL.test(tail)) return null;
  // A heading's text starts with a word, not more digits or punctuation.
  if (tail && !/^[A-Za-z("'“]/.test(tail)) return null;
  // A bare top-level integer with no title is far more often a list bullet or
  // a stray page artefact than a real clause.
  if (!tail && !ref.includes(".")) return null;

  return {
    clauseRef: ref.replace(/\.$/, ""),
    title: tail || null,
    depth: ref.split(".").length - 1,
    isContainer: false,
  };
}

/* ── Parsing ──────────────────────────────────────────────────────────── */

const normalise = (s: string) => s.replace(/\s+/g, " ").trim();
export const hashText = (s: string) => createHash("sha256").update(normalise(s)).digest("hex");

/** Turns extracted pages into a flat, document-ordered list of clauses.
 *  Flat rather than nested because it maps straight onto a database table and
 *  `parentRef` already carries the hierarchy. */
export function parseClauses(sections: ExtractedSection[]): ClauseNode[] {
  interface Open { header: Header; lines: string[]; pageFrom: number | null; pageTo: number | null }

  const out: ClauseNode[] = [];
  /** Innermost open clause at each depth, for parent lookup. */
  const stack: Header[] = [];
  let open: Open | null = null;
  let ordinal = 0;

  const close = () => {
    if (!open) return;
    const text = open.lines.join("\n").trim();
    // A heading with no body is a container for the clauses beneath it; keep
    // it so the hierarchy is navigable, but it carries no extractable text.
    out.push({
      clauseRef: open.header.clauseRef,
      parentRef: findParent(open.header),
      title: open.header.title,
      text,
      pageFrom: open.pageFrom,
      pageTo: open.pageTo,
      depth: open.header.depth,
      ordinal: ordinal++,
      contentHash: hashText(`${open.header.clauseRef}|${open.header.title ?? ""}|${text}`),
    });
    open = null;
  };

  const findParent = (h: Header): string | null => {
    for (let i = stack.length - 1; i >= 0; i--) {
      if (stack[i].clauseRef === h.clauseRef) continue;
      if (stack[i].depth < h.depth || (h.isContainer === false && stack[i].isContainer)) {
        return stack[i].clauseRef;
      }
    }
    return null;
  };

  const pushToStack = (h: Header) => {
    // A container resets numbering beneath it; a numbered heading pops
    // everything at or below its own depth.
    if (h.isContainer) stack.length = 0;
    else while (stack.length && !stack[stack.length - 1].isContainer && stack[stack.length - 1].depth >= h.depth) stack.pop();
    stack.push(h);
  };

  for (const section of sections) {
    for (const rawLine of section.text.split(/\r?\n/)) {
      const header = parseHeader(rawLine);
      if (header) {
        close();
        pushToStack(header);
        open = { header, lines: [], pageFrom: section.pageNumber, pageTo: section.pageNumber };
        continue;
      }
      if (!rawLine.trim()) {
        if (open) open.lines.push("");
        continue;
      }
      if (!open) {
        // Front matter before the first heading — cover page, title block.
        // Kept rather than dropped: tender references and dates live here.
        open = {
          header: { clauseRef: "PREAMBLE", title: null, depth: 0, isContainer: true },
          lines: [], pageFrom: section.pageNumber, pageTo: section.pageNumber,
        };
        stack.length = 0;
        stack.push(open.header);
      }
      open.lines.push(rawLine.trim());
      open.pageTo = section.pageNumber ?? open.pageTo;
    }
  }
  close();

  return out.filter((c) => c.text.length > 0 || c.title !== null);
}

/* ── Grouping for extraction ──────────────────────────────────────────── */

export interface ClauseGroup {
  clauses: ClauseNode[];
  text: string;
  chars: number;
}

/** Packs clauses into work units small enough to finish inside Vercel Hobby's
 *  60-second function limit, while keeping neighbouring clauses together so
 *  the model sees a clause in the context of the ones around it.
 *
 *  A single clause larger than the target is never split — a split clause is
 *  a truncated clause, which is the bug this whole phase exists to remove. It
 *  goes out as its own oversized group instead. */
export function groupClauses(clauses: ClauseNode[], targetChars = 45_000): ClauseGroup[] {
  const groups: ClauseGroup[] = [];
  let current: ClauseNode[] = [];
  let size = 0;

  const render = (c: ClauseNode) =>
    `[Page ${c.pageFrom ?? "?"} — Clause ${c.clauseRef}${c.title ? `: ${c.title}` : ""}]\n${c.text}`;

  const flush = () => {
    if (!current.length) return;
    const text = current.map(render).join("\n\n");
    groups.push({ clauses: current, text, chars: text.length });
    current = [];
    size = 0;
  };

  for (const c of clauses) {
    const len = render(c).length + 2;
    if (size > 0 && size + len > targetChars) flush();
    current.push(c);
    size += len;
    if (size >= targetChars) flush();
  }
  flush();
  return groups;
}
