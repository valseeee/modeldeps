# Real-repository benchmark and annotation protocol

The manifest is a diverse public starting corpus, not a claim that all entries have been acquired or labeled. Real outcomes live in the timestamped audit report. Never infer success from manifest length.

## Inventory and resume

From the project root, after `npm ci` / `npm run build`:

```sh
node scripts/benchmark-real-repos.mjs --clone --max-repos 20 --timeout-seconds 20 --max-mb 250 --max-files 50000 --output reports/run-2026-10-23.json --write-template reports/candidates-2026-10-23.json
```

Choose a new report name for a new corpus version. Existing reports are not overwritten unless `--resume` is explicit. Resume reuses findings only for an unchanged clean checkout commit, registry hash, implementation hash and limits; labels are rescored. The report is checkpointed after each repository. Each failed acquisition has its own error. New clones use staging directories; interrupted directories are retained for inspection, never considered complete. Use a new clone root if an incomplete checkout occupies the final path.

Network/process limits: per-Git-command timeout, Git output cap, 200 ms sampled disk/file-count watchdog, and static scanner time/byte/file budgets. The watchdog is not an OS-enforced disk quota; disk use can overshoot between samples. Failed staging directories remain on disk and should be inspected/removed manually. No repository dependencies, LFS smudge, hooks or target code are executed. Public GitHub HTTPS URLs only; commit arguments must be full SHA. Dirty checkouts are rejected. License excerpts/hash and default branch are collected when available, but license appropriateness requires human review before redistribution. Only benchmark reports/candidates are delivered, not cloned source.

Successful entries are emitted in `<report>.pins.json`. Use this pinned manifest to reproduce the corpus. Each report records date, exact commit, tool/config/implementation and Registry hashes, scan scope, command and runtime. Original starter entries do not silently become pinned history.

## Human gold set

Generated candidates have `reviewed:false`. A reviewer must inspect the exact pinned commit, remove false positives, add false negatives, and set `reviewed:true` only after reviewing the entire declared scan scope. Gold labels require `file`, positive `line`/`column`, provider, surface and model_id; commit must match the checkout. A generated candidate file is never automatically scored.

Annotation rules:

- Positive: concrete model identifier in an executable API request, actual application configuration or an explicitly selected default model.
- Negative: documentation prose/examples, comments, test fixtures/mocks, arbitrary unrelated strings, placeholders, dynamic variables/templates without a concrete resolved identifier. Remove such candidates from expected_findings.
- Examples intended to be runnable applications may be labeled positive; record that scope choice consistently in the review note. Unit tests and mocks remain negative.
- Unknown provider/surface must stay unknown; do not guess a deployment surface from a model name when ambiguous.
- Search files independently of candidates to find missed dependencies; otherwise recall is invalid. Preserve negative repositories and multiple languages/frameworks. Do not cherry-pick only easy repositories.

```sh
node scripts/benchmark-real-repos.mjs --manifest reports/reviewed-gold.json --require-labels --output reports/scored-version1.json
```

Use local `path` or `--clone` and an accessible pinned URL. Scoring matches exact file/line/column/provider/surface/model identity. JSON null means N/A when a denominator is zero. Reports include TP/FP/FN, precision/recall/F1, reproducible FP/FN entries and grouped metrics by language, file type, provider and manifest framework (unknown if unprovided). No human gold was available in the local automated run, so real accuracy remains N/A. Local fixture tests validate the harness only.

## Explicit scope

An entry may set `ignore: ["exact/path/to/fixture.json"]` and `scope_note`. Scope is exported in reports/candidate/pinned manifests and participates in resume validity. Changing ignore patterns forces a rescan. Declare and review exclusions before scoring; excluded files cannot be counted as verified or used to inflate recall. Local large-repository runs explicitly excluded three oversized test fixtures; full-scope attempts remain recorded as failures.
