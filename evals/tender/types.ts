/** Fixture and result types for the requirements-extraction eval. */

/** One requirement a QS has confirmed really is in the document. This is the
 *  ground truth the extractor is scored against — hand-marked, never
 *  generated, or the eval is just the model grading itself. */
export interface GroundTruthRequirement {
  /** Stable id within this fixture, e.g. "ITT-004". Used in diffs. */
  id: string;
  /** The requirement in your own words. Matching is fuzzy, so this does not
   *  have to reproduce the model's phrasing — see `keywords` when it must. */
  text: string;
  /** Clause reference as printed in the document, e.g. "4.2". */
  clause?: string;
  /** Page it appears on. Required for the within-cap / beyond-cap split —
   *  without it, this requirement cannot be attributed to either bucket. */
  page?: number;
  /** True when the document uses mandatory language (must / shall / required).
   *  Mandatory recall is reported separately because a missed mandatory
   *  requirement is what actually loses a bid. */
  mandatory: boolean;
  category?: string;
  /** Escape hatch for requirements whose wording differs so much from the
   *  model's that token overlap fails. If every keyword appears in the
   *  extracted description or quote, it counts as a match outright. Keep
   *  these short and distinctive: ["bid bond", "2%"]. */
  keywords?: string[];
}

export interface Fixture {
  /** Which tender this document belongs to — groups cases in the report. */
  tender: string;
  /** The document's filename, passed to the model exactly as production does. */
  document: string;
  notes?: string;
  requirements: GroundTruthRequirement[];
}

export interface CaseScore {
  caseId: string;
  tender: string;
  document: string;

  chunkCount: number;
  assembledChars: number;
  truncated: boolean;
  /** Characters the cap dropped — material the model never saw. */
  droppedChars: number;
  cutoffPage: number | null;

  truthTotal: number;
  truthMandatory: number;
  truthWithinCap: number;
  truthBeyondCap: number;
  /** Ground-truth items with no page number, so they can be placed in
   *  neither bucket. Reported so the split is never quietly wrong. */
  truthUnplaceable: number;

  extractedTotal: number;
  matched: number;
  matchedMandatory: number;
  matchedWithinCap: number;
  matchedBeyondCap: number;

  missed: GroundTruthRequirement[];
  spurious: { description: string; requirement_code: string }[];

  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  error?: string;
}

export interface EvalRun {
  startedAt: string;
  model: string;
  threshold: number;
  capChars: number;
  live: boolean;
  cases: CaseScore[];
}
