/**
 * Requirements-extraction eval — Phase 0 of the TenderAI rebuild plan.
 *
 * Runs the production extractor (api/tender/lib/requirements.ts — the same
 * prompt, schema and input assembly, not a copy) over hand-marked fixtures
 * and scores it. The number that matters is recall: a missed requirement is
 * a mispriced bid, while a spurious one is a row a QS deletes in seconds.
 *
 * The headline output is the within-cap / beyond-cap split. If the
 * truncation hypothesis is right, recall past the 40,000-character cap is
 * near zero — and that number is what Phase 2 has to move.
 *
 *   npm run eval:tender                 # dry run, free, no API calls
 *   npm run eval:tender -- --live       # spends money — asks nothing, so mean it
 *   npm run eval:tender -- --live --model=claude-sonnet-5
 *   npm run eval:tender -- --cap=2000   # demo truncation on a short fixture
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildRequirementsInput, extractRequirementsFromChunks,
  MAX_REQUIREMENTS_INPUT_CHARS,
  type RequirementChunk, type ExtractedRequirement,
} from "../../api/tender/lib/requirements.js";
import { assign } from "./match.js";
import type { Fixture, CaseScore, EvalRun, GroundTruthRequirement } from "./types.js";

const HERE = dirname(fileURLToPath(import.meta.url));

/* ── Args ────────────────────────────────────────────────────────────── */
const argv = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
};
const LIVE = argv.includes("--live");
const MODEL = flag("model") ?? "claude-sonnet-4-6";
const THRESHOLD = Number(flag("threshold") ?? 0.45);
const CAP = Number(flag("cap") ?? MAX_REQUIREMENTS_INPUT_CHARS);
const FIXTURE_DIR = flag("fixtures") ?? join(HERE, "fixtures");
const OUT_DIR = flag("out") ?? join(HERE, "results");

/** Approximate list prices, USD per million tokens. Only used to show what a
 *  run costs before you authorise it — not billing. */
const PRICES: Record<string, { in: number; out: number }> = {
  "claude-opus-5": { in: 5, out: 25 },
  "claude-sonnet-5": { in: 2, out: 10 },
  "claude-sonnet-4-6": { in: 3, out: 15 },
  "claude-haiku-4-5": { in: 1, out: 5 },
};
const price = PRICES[MODEL] ?? PRICES["claude-sonnet-4-6"];

/** Rough English chars-per-token. Only for the dry-run estimate; live runs
 *  report the API's own counts. */
const CHARS_PER_TOKEN = 3.6;

const pct = (n: number, d: number) => (d === 0 ? "  n/a" : `${((n / d) * 100).toFixed(1)}%`);
const pad = (s: string, n: number) => s.padEnd(n);

/* ── Fixture loading ─────────────────────────────────────────────────── */
interface Case { id: string; fixture: Fixture; chunks: RequirementChunk[] }

function loadCases(dir: string): Case[] {
  if (!existsSync(dir)) {
    console.error(`No fixture directory at ${dir}`);
    return [];
  }
  const cases: Case[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const base = join(dir, entry.name);
    const expectedPath = join(base, "expected.json");
    const chunksPath = join(base, "chunks.json");
    if (!existsSync(expectedPath) || !existsSync(chunksPath)) {
      console.error(`  skipping ${entry.name} — needs both expected.json and chunks.json`);
      continue;
    }
    cases.push({
      id: entry.name,
      fixture: JSON.parse(readFileSync(expectedPath, "utf8")) as Fixture,
      chunks: JSON.parse(readFileSync(chunksPath, "utf8")) as RequirementChunk[],
    });
  }
  return cases.sort((a, b) => a.id.localeCompare(b.id));
}

/* ── Scoring ─────────────────────────────────────────────────────────── */

/** A ground-truth requirement is reachable only if its page's content starts
 *  inside the cap. Items with no page number can be placed in neither bucket
 *  and are counted separately rather than silently assumed reachable. */
function bucket(truth: GroundTruthRequirement, cutoffPage: number | null, truncated: boolean):
  "within" | "beyond" | "unplaceable" {
  if (!truncated) return "within";
  if (truth.page == null) return "unplaceable";
  return cutoffPage != null && truth.page <= cutoffPage ? "within" : "beyond";
}

function scoreCase(c: Case, extracted: ExtractedRequirement[], input: ReturnType<typeof buildRequirementsInput>,
                   tokens: { input: number; output: number }, error?: string): CaseScore {
  const truths = c.fixture.requirements;
  const { matches, missedTruthIndexes, spuriousExtractedIndexes } = assign(truths, extracted, THRESHOLD);
  const matchedTruth = new Set(matches.map((m) => m.truthIndex));

  const buckets = truths.map((t) => bucket(t, input.cutoffPage, input.truncated));
  const count = (want: string, onlyMatched: boolean) =>
    truths.filter((_, i) => buckets[i] === want && (!onlyMatched || matchedTruth.has(i))).length;

  return {
    caseId: c.id,
    tender: c.fixture.tender,
    document: c.fixture.document,
    chunkCount: c.chunks.length,
    assembledChars: input.fullLength,
    truncated: input.truncated,
    droppedChars: Math.max(0, input.fullLength - input.text.length),
    cutoffPage: input.cutoffPage,
    truthTotal: truths.length,
    truthMandatory: truths.filter((t) => t.mandatory).length,
    truthWithinCap: count("within", false),
    truthBeyondCap: count("beyond", false),
    truthUnplaceable: count("unplaceable", false),
    extractedTotal: extracted.length,
    matched: matches.length,
    matchedMandatory: truths.filter((t, i) => t.mandatory && matchedTruth.has(i)).length,
    matchedWithinCap: count("within", true),
    matchedBeyondCap: count("beyond", true),
    missed: missedTruthIndexes.map((i) => truths[i]),
    spurious: spuriousExtractedIndexes.map((i) => ({
      description: extracted[i].description,
      requirement_code: extracted[i].requirement_code,
    })),
    inputTokens: tokens.input,
    outputTokens: tokens.output,
    costUsd: (tokens.input / 1e6) * price.in + (tokens.output / 1e6) * price.out,
    error,
  };
}

/* ── Reporting ───────────────────────────────────────────────────────── */
function reportCase(s: CaseScore) {
  console.log(`\n\x1b[1m${s.caseId}\x1b[0m — ${s.document}  (${s.tender})`);
  const trunc = s.truncated
    ? `\x1b[31mTRUNCATED\x1b[0m at ${CAP.toLocaleString()} — ${s.droppedChars.toLocaleString()} chars dropped, last page read: ${s.cutoffPage ?? "?"}`
    : "\x1b[32mcomplete\x1b[0m — nothing dropped";
  console.log(`  ${s.chunkCount} chunks · ${s.assembledChars.toLocaleString()} chars assembled · ${trunc}`);

  if (s.error) { console.log(`  \x1b[31merror: ${s.error}\x1b[0m`); return; }

  console.log(`  ground truth ${s.truthTotal} (${s.truthMandatory} mandatory)   extracted ${s.extractedTotal}   matched ${s.matched}`);
  if (s.truthUnplaceable > 0) {
    console.log(`  \x1b[33m${s.truthUnplaceable} ground-truth items have no page number — excluded from the cap split\x1b[0m`);
  }
  console.log("");
  console.log(`    ${pad("recall", 22)} ${pct(s.matched, s.truthTotal)}  (${s.matched}/${s.truthTotal})`);
  console.log(`    ${pad("recall (mandatory)", 22)} ${pct(s.matchedMandatory, s.truthMandatory)}  (${s.matchedMandatory}/${s.truthMandatory})`);
  if (s.truncated) {
    console.log(`    ${pad("recall within cap", 22)} ${pct(s.matchedWithinCap, s.truthWithinCap)}  (${s.matchedWithinCap}/${s.truthWithinCap})`);
    console.log(`    \x1b[31m${pad("recall beyond cap", 22)} ${pct(s.matchedBeyondCap, s.truthBeyondCap)}  (${s.matchedBeyondCap}/${s.truthBeyondCap})   <- the truncation cost\x1b[0m`);
  }
  console.log(`    ${pad("precision", 22)} ${pct(s.matched, s.extractedTotal)}  (${s.matched}/${s.extractedTotal})`);

  if (s.missed.length) {
    console.log(`\n  \x1b[31mMISSED (${s.missed.length}):\x1b[0m`);
    for (const m of s.missed) {
      const where = [m.clause && `cl. ${m.clause}`, m.page != null && `p.${m.page}`].filter(Boolean).join(" ");
      console.log(`    ${m.mandatory ? "!" : " "} ${pad(m.id, 9)} ${pad(where, 14)} ${m.text.slice(0, 78)}`);
    }
  }
  if (s.spurious.length) {
    console.log(`\n  \x1b[33mNOT IN GROUND TRUTH (${s.spurious.length}):\x1b[0m`);
    for (const sp of s.spurious.slice(0, 8)) {
      console.log(`      ${pad(sp.requirement_code, 14)} ${sp.description.slice(0, 78)}`);
    }
    if (s.spurious.length > 8) console.log(`      … and ${s.spurious.length - 8} more`);
  }
}

function reportTotals(cases: CaseScore[]) {
  const sum = (f: (c: CaseScore) => number) => cases.reduce((a, c) => a + f(c), 0);
  const t = {
    truth: sum((c) => c.truthTotal), matched: sum((c) => c.matched),
    mand: sum((c) => c.truthMandatory), mandM: sum((c) => c.matchedMandatory),
    within: sum((c) => c.truthWithinCap), withinM: sum((c) => c.matchedWithinCap),
    beyond: sum((c) => c.truthBeyondCap), beyondM: sum((c) => c.matchedBeyondCap),
    extracted: sum((c) => c.extractedTotal), cost: sum((c) => c.costUsd),
  };
  console.log(`\n${"─".repeat(72)}`);
  console.log("\x1b[1mTOTALS\x1b[0m");
  console.log(`    ${pad("recall", 22)} ${pct(t.matched, t.truth)}  (${t.matched}/${t.truth})`);
  console.log(`    ${pad("recall (mandatory)", 22)} ${pct(t.mandM, t.mand)}  (${t.mandM}/${t.mand})`);
  if (t.beyond > 0) {
    console.log(`    ${pad("recall within cap", 22)} ${pct(t.withinM, t.within)}  (${t.withinM}/${t.within})`);
    console.log(`    \x1b[31m${pad("recall beyond cap", 22)} ${pct(t.beyondM, t.beyond)}  (${t.beyondM}/${t.beyond})\x1b[0m`);
  }
  console.log(`    ${pad("precision", 22)} ${pct(t.matched, t.extracted)}  (${t.matched}/${t.extracted})`);
  if (LIVE) console.log(`    ${pad("cost this run", 22)} $${t.cost.toFixed(4)}  (${MODEL})`);
}

/* ── Main ────────────────────────────────────────────────────────────── */
async function main() {
  const cases = loadCases(FIXTURE_DIR);
  if (cases.length === 0) {
    console.error(`\nNo fixtures found in ${FIXTURE_DIR}. See evals/tender/README.md.`);
    process.exit(1);
  }

  console.log(`\nTenderAI · requirements extraction eval`);
  console.log(`  ${cases.length} case(s) · model ${MODEL} · match threshold ${THRESHOLD} · cap ${CAP.toLocaleString()} chars`);

  if (!LIVE) {
    // Dry run: assemble the input (free) and report exactly what a live run
    // would cost and how much of each document it would never read.
    let estIn = 0, truncatedCases = 0, unreachable = 0;
    console.log(`\n\x1b[1mDRY RUN\x1b[0m — no API calls. Add --live to actually score.\n`);
    for (const c of cases) {
      const input = buildRequirementsInput(c.chunks, CAP);
      const buckets = c.fixture.requirements.map((t) => bucket(t, input.cutoffPage, input.truncated));
      const beyond = buckets.filter((b) => b === "beyond").length;
      estIn += input.text.length / CHARS_PER_TOKEN;
      if (input.truncated) truncatedCases += 1;
      unreachable += beyond;
      const state = input.truncated
        ? `\x1b[31mtruncated\x1b[0m (${(input.fullLength - input.text.length).toLocaleString()} chars dropped, ${beyond} known requirements unreachable)`
        : `\x1b[32mcomplete\x1b[0m`;
      console.log(`  ${pad(c.id, 22)} ${pad(`${c.chunks.length} chunks`, 12)} ${pad(`${input.fullLength.toLocaleString()} chars`, 16)} ${state}`);
    }
    const estOut = cases.length * 2000;
    const cost = (estIn / 1e6) * price.in + (estOut / 1e6) * price.out;
    console.log(`\n  ~${Math.round(estIn).toLocaleString()} input tokens, ~${estOut.toLocaleString()} output tokens`);
    console.log(`  estimated cost of a live run: \x1b[1m$${cost.toFixed(4)}\x1b[0m (${MODEL}, list price)`);
    if (truncatedCases > 0) {
      console.log(`\n  \x1b[31m${truncatedCases} of ${cases.length} case(s) truncate. ${unreachable} hand-marked requirements sit past the cap`);
      console.log(`  and cannot be found at any model quality — that is the Phase 2 target.\x1b[0m`);
    }
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("\nANTHROPIC_API_KEY is not set — a live run needs it. See evals/tender/README.md.");
    process.exit(1);
  }

  const scores: CaseScore[] = [];
  for (const c of cases) {
    process.stdout.write(`  running ${c.id}…`);
    try {
      const r = await extractRequirementsFromChunks({
        apiKey, fileName: c.fixture.document, chunks: c.chunks, model: MODEL, maxChars: CAP,
      });
      process.stdout.write(` ${r.requirements.length} extracted\n`);
      scores.push(scoreCase(c, r.requirements, r.input, { input: r.inputTokens, output: r.outputTokens }));
    } catch (err) {
      process.stdout.write(` failed\n`);
      scores.push(scoreCase(c, [], buildRequirementsInput(c.chunks, CAP), { input: 0, output: 0 },
        err instanceof Error ? err.message : String(err)));
    }
  }

  for (const s of scores) reportCase(s);
  reportTotals(scores);

  const run: EvalRun = {
    startedAt: new Date().toISOString(), model: MODEL, threshold: THRESHOLD, capChars: CAP, live: LIVE, cases: scores,
  };
  mkdirSync(OUT_DIR, { recursive: true });
  const out = join(OUT_DIR, `${run.startedAt.replace(/[:.]/g, "-")}_${MODEL}.json`);
  writeFileSync(out, JSON.stringify(run, null, 2));
  console.log(`\n  saved → ${out}`);
  console.log(`  keep this file: Phase 2 is judged by comparing against it.\n`);
}

main().catch((err) => { console.error(err); process.exit(1); });
