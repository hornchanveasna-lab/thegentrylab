/**
 * Matching a model's extracted requirements against a QS's hand-marked list.
 *
 * Exact string matching is useless here — the model paraphrases — and an
 * LLM judge would be non-deterministic and cost money on every run. This uses
 * token overlap (Dice) with a keyword override, which is free, repeatable,
 * and good enough to detect the effects the rebuild plan is chasing.
 */
import type { ExtractedRequirement } from "../../api/tender/lib/requirements.js";
import type { GroundTruthRequirement } from "./types.js";

/** Words too common in tender prose to carry signal. "shall" and "must" are
 *  in here deliberately: they appear in nearly every requirement, so they
 *  inflate every pair's similarity equally and separate nothing. */
const STOPWORDS = new Set([
  "the", "a", "an", "of", "to", "for", "and", "or", "in", "on", "at", "by", "with",
  "shall", "must", "be", "is", "are", "as", "that", "this", "it", "its", "from",
  "any", "all", "such", "which", "their", "they", "not", "no", "may", "will",
  "bidder", "bidders", "tenderer", "tenderers", "contractor", "employer",
]);

export function tokenize(s: string): Set<string> {
  return new Set(
    s.toLowerCase()
      .replace(/[^a-z0-9%.\s-]/g, " ")
      .split(/\s+/)
      .map((t) => t.replace(/^[.-]+|[.-]+$/g, ""))
      .filter((t) => t.length > 1 && !STOPWORDS.has(t)),
  );
}

/** Sørensen–Dice over token sets: 2|A∩B| / (|A|+|B|). Chosen over Jaccard
 *  because it is more forgiving when one side is much longer than the other,
 *  which is the normal case — a QS writes one line, the model writes two
 *  sentences plus a quote. */
export function dice(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared += 1;
  return (2 * shared) / (a.size + b.size);
}

export function similarity(truth: GroundTruthRequirement, ex: ExtractedRequirement): number {
  const haystack = `${ex.description ?? ""} ${ex.quoted_text ?? ""}`;
  if (truth.keywords?.length) {
    const lower = haystack.toLowerCase();
    if (truth.keywords.every((k) => lower.includes(k.toLowerCase()))) return 1;
  }
  return dice(tokenize(truth.text), tokenize(haystack));
}

export interface Assignment {
  matches: { truthIndex: number; extractedIndex: number; score: number }[];
  missedTruthIndexes: number[];
  spuriousExtractedIndexes: number[];
}

/** Greedy one-to-one assignment, best scores first. Greedy rather than
 *  optimal (Hungarian) because at these sizes the two agree in practice and
 *  the greedy version stays readable — and a scoring harness nobody can read
 *  is a scoring harness nobody trusts. */
export function assign(
  truths: GroundTruthRequirement[],
  extracted: ExtractedRequirement[],
  threshold: number,
): Assignment {
  const pairs: { truthIndex: number; extractedIndex: number; score: number }[] = [];
  for (let t = 0; t < truths.length; t++) {
    for (let e = 0; e < extracted.length; e++) {
      const score = similarity(truths[t], extracted[e]);
      if (score >= threshold) pairs.push({ truthIndex: t, extractedIndex: e, score });
    }
  }
  pairs.sort((a, b) => b.score - a.score);

  const usedTruth = new Set<number>();
  const usedExtracted = new Set<number>();
  const matches: typeof pairs = [];
  for (const p of pairs) {
    if (usedTruth.has(p.truthIndex) || usedExtracted.has(p.extractedIndex)) continue;
    usedTruth.add(p.truthIndex);
    usedExtracted.add(p.extractedIndex);
    matches.push(p);
  }

  return {
    matches,
    missedTruthIndexes: truths.map((_, i) => i).filter((i) => !usedTruth.has(i)),
    spuriousExtractedIndexes: extracted.map((_, i) => i).filter((i) => !usedExtracted.has(i)),
  };
}
