/**
 * Clause-tree inspector — Phase 1's gate.
 *
 * The gate is "open the parsed tree and read it: clause numbering must match
 * the PDF exactly, and no clause may be split mid-sentence". That requires
 * being able to see the tree, so: this prints it.
 *
 *   npm run clauses -- --file=evals/tender/fixtures/sample-itt/document.txt
 *   npm run clauses -- --file=<extracted.txt> --text        # show bodies too
 *   npm run clauses -- --file=<extracted.txt> --groups      # show work units
 *
 * Input is plain extracted text with `[[page N]]` markers on their own line.
 * To check a real document, process it in TenderAI and export its chunks, or
 * run the extractor over the PDF and dump the result.
 */
import { readFileSync } from "node:fs";
import { parseClauses, groupClauses, type ClauseNode } from "../../api/tender/lib/clauses.js";
import type { ExtractedSection } from "../../api/tender/lib/extract.js";

const argv = process.argv.slice(2);
const flag = (n: string) => {
  const hit = argv.find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.slice(n.length + 3) : undefined;
};
const FILE = flag("file");
const SHOW_TEXT = argv.includes("--text");
const SHOW_GROUPS = argv.includes("--groups");
const TARGET = Number(flag("target") ?? 45_000);

if (!FILE) {
  console.error("usage: npm run clauses -- --file=<path.txt> [--text] [--groups]");
  process.exit(1);
}

/** Splits a plain-text dump into pages on `[[page N]]` markers. Text before
 *  the first marker becomes an unnumbered page rather than being dropped. */
function toSections(raw: string): ExtractedSection[] {
  const parts = raw.split(/^\[\[page\s+(\d+)\]\]\s*$/mi);
  const sections: ExtractedSection[] = [];
  if (parts[0]?.trim()) sections.push({ pageNumber: null, sectionLabel: null, text: parts[0] });
  for (let i = 1; i < parts.length; i += 2) {
    sections.push({ pageNumber: Number(parts[i]), sectionLabel: null, text: parts[i + 1] ?? "" });
  }
  return sections;
}

const sections = toSections(readFileSync(FILE, "utf8"));
const clauses = parseClauses(sections);

console.log(`\n${FILE}`);
console.log(`  ${sections.length} page(s) → ${clauses.length} clause(s)\n`);

const bar = (n: number) => "  ".repeat(n);
let splitSuspects = 0;

for (const c of clauses) {
  const pages = c.pageFrom === c.pageTo ? `p.${c.pageFrom ?? "?"}` : `p.${c.pageFrom}-${c.pageTo}`;
  const head = `${bar(c.depth)}${c.clauseRef}`;
  console.log(
    `  ${head.padEnd(30)} ${String(pages).padEnd(9)} ${String(c.text.length).padStart(5)}ch  ${c.title ?? "\x1b[2m(no title)\x1b[0m"}`,
  );

  // A clause body that begins lower-case or ends without terminal punctuation
  // is the signature of a heading detected in the middle of a sentence —
  // exactly the failure this gate exists to catch.
  const body = c.text.trim();
  if (body && c.clauseRef !== "PREAMBLE" && /^[a-z]/.test(body)) {
    splitSuspects += 1;
    console.log(`  ${bar(c.depth)}  \x1b[33m^ possible mid-sentence split — check this one\x1b[0m`);
  }
  if (SHOW_TEXT && body) {
    for (const line of body.split("\n")) console.log(`  ${bar(c.depth)}  \x1b[2m${line}\x1b[0m`);
  }
}

const orphans = clauses.filter((c) => c.parentRef && !clauses.some((p) => p.clauseRef === c.parentRef));
const roots = clauses.filter((c) => !c.parentRef);

console.log(`\n  roots ${roots.length} · max depth ${Math.max(...clauses.map((c) => c.depth))} · orphaned parents ${orphans.length}`);
console.log(`  ${splitSuspects === 0 ? "\x1b[32mno mid-sentence splits flagged\x1b[0m" : `\x1b[33m${splitSuspects} clause(s) flagged for review\x1b[0m`}`);

const dupes = new Map<string, number>();
for (const c of clauses) dupes.set(c.clauseRef, (dupes.get(c.clauseRef) ?? 0) + 1);
const repeated = [...dupes].filter(([, n]) => n > 1);
if (repeated.length) {
  console.log(`  \x1b[33mrepeated refs: ${repeated.map(([r, n]) => `${r}×${n}`).join(", ")}\x1b[0m  (expected across Parts/Appendices)`);
}

if (SHOW_GROUPS) {
  const groups = groupClauses(clauses, TARGET);
  console.log(`\n  ${groups.length} extraction group(s) at ${TARGET.toLocaleString()} chars each:`);
  groups.forEach((g: { clauses: ClauseNode[]; chars: number }, i: number) => {
    const over = g.chars > TARGET ? " \x1b[33m(single oversized clause — never split)\x1b[0m" : "";
    console.log(`    ${String(i + 1).padStart(2)}. ${String(g.clauses.length).padStart(3)} clauses  ${String(g.chars).padStart(7)} chars  ${g.clauses[0].clauseRef} … ${g.clauses[g.clauses.length - 1].clauseRef}${over}`);
  });
}
console.log("");
