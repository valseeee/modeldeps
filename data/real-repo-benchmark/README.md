# Real-repository benchmark and annotation protocol

The manifest is a diverse public starting corpus, not a claim that all entries have been acquired or labeled. Real outcomes live in the timestamped audit report. Never infer success from manifest length.

## Inventory and resume

From the project root, after `npm ci` / `npm run build`:

```sh
node scripts/benchmark-real-repos.mjs --clone --max-repos 20 --timeout-seconds 20 --max-mb 250 --max-files 50000 --output reports/run-2026-10-23.json --write-template reports/candidates-2026-10-23.json
```

Choose a new report name for a new corpus version. Existing reports are not overwritten unless `--resume` is explicit. Resume reuses findings only for an unchanged clean checkout commit, registry hash, implementation hash and limits; labels are rescored. The report is checkpointed after each repository. Each failed acquisition has its own error. New clones use staging directories; interrupted directories are retained for inspection, never considered complete. Use a new clone root if an incomplete checkout occupies the final path.

Network/process limits: per-Git-command timeout, Git output cap, 200 ms sampled disk/file-count watchdog, and static scanner time/byte/file budgets. The watchdog is not an OS-enforced disk quota; disk use can overshoot between samples. Failed staging directories remain on disk and should be inspected/removed manually. No repository dependencies, LFS smudge, hooks or target code are executed. Public GitHub HTTPS URLs only; commit arguments must be full SHA. Dirty checkouts are rejected. License excerpts/hash and default branch are collected when available, but license appropriateness requires human review before redistribution. Only benchmark reports/candidates are delivered, not cloned source.

Pinned checkouts must have no tracked modifications, untracked files or ignored files before scanning or resuming. The scanner does not use `.gitignore` as its scan boundary, so an ignored local config could otherwise contaminate findings while the Git commit stayed unchanged. Use a clean dedicated checkout; the harness reports a failure rather than deleting local files or silently reusing stale findings.

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

Large repositories may additionally declare `sparse_paths: ["relative/code/directory"]`. With `--clone`, the harness uses Git's blob-filtered clone and cone-mode sparse checkout while retaining the same disk/file/time limits. Git cone mode also materializes root and ancestor files; these are part of the declared scope. Omitted directories are not scanned or validated. Safe paths, actual Git sparse settings and pinned commits are checked before scanning; an undeclared or mismatched sparse checkout fails. Sparse paths are retained in reports, candidate templates, pinned manifests and resume checks. Changing them cannot reuse old findings.

`scoped-budget-repos.json` is a pinned, explicitly limited alternative for the six previously resource-limited repositories. It does not convert their historical full-acquisition failures into full-repository successes. Use a fresh clone root to reproduce a different checkout scope. Human labels and recall apply only to the recorded scope.

## Review material

`scripts/prepare-benchmark-review.mjs --output NEW_DIRECTORY REPORT.json [...]` reads successful, versioned benchmark reports and creates a UTF-8/BOM CSV, fixed-commit source links, a license review CSV, an exact-scope JSON template and review progress. Later supplied reports choose the view of the same repository in this new pack; historical reports are untouched. The output directory must be new to avoid overwriting work in progress. CSV formula prefixes are escaped for display while JSON preserves exact identities.

Every generated entry remains `reviewed:false`, with blank human decisions and incomplete independent missed-reference search flags. The tool does not generate gold labels or accuracy scores. The delivered local pack covers 20 declared scopes and 35,192 candidates; the owner currently has no real business project/eval or gold annotations to supply. Obtain those inputs before claiming business compatibility or real accuracy.
