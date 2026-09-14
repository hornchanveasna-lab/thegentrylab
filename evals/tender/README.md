# TenderAI — requirements extraction eval

Phase 0 of the rebuild plan. Scores the production Requirements Extraction
Agent against tenders a QS has marked up by hand, so every later phase can be
proven rather than believed.

It imports `api/tender/lib/requirements.ts` directly — the same prompt, the
same tool schema, the same input assembly and cap that production uses. There
is no second copy to drift.

## Run it

```bash
npm run eval:tender                      # dry run — free, no API calls
npm run eval:tender -- --live            # scores for real; spends money
npm run eval:tender -- --live --model=claude-sonnet-5
npm run eval:tender -- --cap=3000        # demo truncation on a short fixture
```

The dry run is the default on purpose. It assembles exactly what would be
sent, reports how much of each document the cap would discard, tells you how
many hand-marked requirements sit past that point, and prints the estimated
cost — all without calling the API. Read that before spending anything.

A live run needs a key:

```bash
# bash
ANTHROPIC_API_KEY=sk-ant-... npm run eval:tender -- --live
```
```powershell
# PowerShell
$env:ANTHROPIC_API_KEY="sk-ant-..."; npm run eval:tender -- --live
```

Every live run writes `evals/tender/results/<timestamp>_<model>.json`.
**Keep those.** Phase 2 is judged by comparing against the Phase 0 baseline.

## What it measures, and why recall leads

| Metric | Why it's here |
|---|---|
| **recall** | The headline. A requirement the extractor missed is a requirement nobody prices. |
| **recall (mandatory)** | The number that actually loses bids. Optional items missed are an inconvenience; a missed *shall* is a non-responsive tender. |
| **recall within cap** | How good extraction is on text the model actually received. Isolates model quality from the truncation bug. |
| **recall beyond cap** | How much the 40,000-character cap costs you. Expected to be at or near zero — nothing past the cap is reachable at any model quality. **This is the Phase 2 target.** |
| **precision** | Deliberately secondary. A spurious row is two seconds of a QS's time; weight it accordingly. |

That asymmetry is worth stating plainly, because it argues against the prompt
as currently written: `EXTRACT_REQUIREMENTS_SYSTEM` says *"merge near-duplicate
requirements"*, which optimises precision. If the eval shows recall suffering,
that instruction is a good first thing to change.

## Adding a real tender

One directory per **document** (not per tender — a tender with four documents
worth marking up is four directories):

```
evals/tender/fixtures/
  ppsez-warehouse-itt/
    chunks.json      # what the pipeline extracted
    expected.json    # what a QS says is actually in there
```

### `chunks.json`

An array of `{ content, page_number, section_label }` — exactly the rows
`tender_document_chunks` holds. Easiest way to produce it is to upload the
document to TenderAI, let it process, then export its chunks:

```sql
select content, page_number, section_label
from tender_document_chunks
where document_id = '<uuid>'
order by chunk_index;
```

Storing chunks rather than the source PDF keeps the eval fast, deterministic,
and free of confidential binaries — and it isolates *extraction* quality from
*PDF parsing* quality, which are different problems with different fixes.

### `expected.json`

See `fixtures/sample-itt/expected.json` for the shape and
`../types.ts` for every field. The important ones:

- **`page`** — required, or the requirement can't be placed inside or beyond
  the cap and gets excluded from that split (the run tells you when this
  happens rather than quietly assuming).
- **`mandatory`** — true only for *shall / must / required* language.
- **`keywords`** — the escape hatch. Matching is fuzzy token overlap, so when
  your wording and the model's diverge badly, add one or two short
  distinctive strings (`["2%"]`, `["power of attorney"]`). If every keyword
  appears in the model's description or quote, it counts as a match outright.

Mark up **whatever a QS would have to act on**, not what you think the model
can find. Grading against a softened answer key produces a comfortable number
and no information.

### Confidentiality

Real tender packages are client material. `.gitignore` excludes everything
under `fixtures/` except the synthetic sample, so a real tender has to be
force-added to be committed — don't. Keep them locally, or in private
storage the team already controls.

## Matching

Sørensen–Dice over token sets, stopwords removed, greedy one-to-one
assignment above a threshold (default `0.45`, tune with `--threshold=`).
Deliberately not an LLM judge: this needs to be free, instant, and identical
on every run, or it can't be a regression gate. Raise the threshold if you see
loose pairings in the diff; lower it if obviously-correct matches are being
reported as missed.
