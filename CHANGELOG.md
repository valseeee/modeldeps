# Local hardening update (2026-10-24)

Current 0.4.0 hardening supersedes earlier prune/live-sync claims. Prune is disabled; live adapters remain experimental. See README and docs/VALIDATION.md for executed evidence. Added workspace/config-bound eval, patch rollback, resource-bounded benchmark with reviewed commit-aware gold labels, grouped metrics, full Actions pins, separated release permissions and package smoke validation. Preserve snapshot bytes across Git checkouts to prevent Windows line-ending conversion from invalidating provenance hashes; regression tests exercise an actual automatic-line-ending checkout. Disk monitoring tolerates disappearing Git lock files while retaining other I/O and resource errors. CI retains executed verification logs and tests composite-action consumers on Linux, Windows and macOS.

- Verify 85 tests on all three CI platforms. Add manual Release preparation with version checks and publication disabled for manual runs.
- Validate official Anthropic and Gemini pages on a hosted runner (23 and 81 records). Handle Google's preview sections and identical cross-table references while rejecting conflicting facts. Keep fresh data as review candidates; authenticated OpenAI sync still needs credentials.
- Add bounded sparse acquisition for six previously over-budget repositories, with declared scope recorded and enforced during resume. The 20-repository inventory comprises 14 full checkouts and six sparse checkouts.
- Generate review materials for 35,192 unreviewed candidates with pinned source links and license review sheets. Real accuracy metrics remain N/A until independent human annotation is available.

# Changelog

## 0.4.1 — pinned benchmark working-tree integrity

- Reject untracked and ignored files as well as tracked modifications before scanning or reusing pinned findings; local generated model configs can no longer silently contaminate commit attribution.
- Add a real Git regression covering both added-file cases and successful reuse after restoring the clean checkout.
- Keep CLI, SARIF, report and package versions aligned; release tag tests follow the current package version.

## 0.4.0 — live lifecycle sync and real-repository benchmark harness

- Add live HTML sync for Anthropic and Gemini official lifecycle pages with host allowlisting, redirect validation, request timeout/size limits, source-byte SHA-256, and fail-closed minimum-row checks.
- Preserve provider-specific semantics: Anthropic retirement dates are tentative; Gemini dates remain earliest-possible and never imply a model is retired merely because a date passed.
- Add optional `--prune-missing` only for live Anthropic/Gemini sync; default sync remains additive.
- Add a 20-repository public OSS benchmark manifest and a benchmark harness that records exact Git commits, emits candidate labels, and computes precision/recall only after human-reviewed labels exist.
- Add weekly lifecycle-refresh PR workflow and tag-driven GitHub Release automation. Lifecycle changes are not auto-merged and npm is not automatically published.
- Add live-parser fixtures and a real-repository benchmark harness test.

## 0.3.0 — plan integrity and safer local edits

- Recompute the migration plan from the current repository and registry before `verify` or `apply`; hand-edited risk levels, required gates, source provenance, or occurrences are blocked.
- Reject unsafe repository paths and symlinked parent components before hashing or editing files.
- Preserve CRLF line endings when applying exact edits.
- Apply configured provider filters consistently to both `scan` and `check`.
- Ignore `.modeldeps/` generated plans/evidence by default so generated artifacts do not become scanner input.
- Treat an empty registry as stale when strict stale-evidence enforcement is enabled.
- Validate day thresholds and evaluation timeouts as integers with valid ranges; enforce configured `require_eval_on` change types in migration planning.
- Bundle the compiled CLI in the GitHub Action so consuming repositories do not need a runtime `npm ci`/build step.
- Add regression tests for plan-tampering attempts, provider filters, symlink traversal, CRLF preservation, empty registries, and configuration bounds.

## 0.2.0 — reviewed lifecycle data and migration evidence

- Bundle 169 reviewed official lifecycle records (98 OpenAI, 21 Anthropic, 50 Gemini), each linked to a versioned snapshot artifact.
- Preserve shutdown-date semantics: confirmed dates are distinct from Google's earliest-possible dates; a passed earliest-possible date warns rather than falsely asserting retirement.
- Add strict stale-evidence policy enforcement via `--strict-stale`.
- Improve scanner precision by avoiding model-like snippets embedded in JavaScript/TypeScript string literals; expand the curated scanner regression corpus to 36 cases.
- Add registry-to-snapshot digest consistency tests and tests for earliest-possible shutdown dates.
- Document that the benchmark is a small curated regression corpus, not a real-world accuracy guarantee.
- Add reproducible install/release workflow guidance; no GitHub or npm publishing is performed by this build.

## 0.1.0 — initial implementation

- Add local-first model reference scanning for common source and configuration files.
- Add canonical provider/surface/model registry schema and source provenance validation.
- Add lifecycle policy checks, shutdown thresholds, JSON/SARIF output, and GitHub step summary.
- Add migration planning with risk labels, exact-edit safeguards, and explicit user-owned eval gates.
- Add OpenAI Models API shutdown-date import and reviewed-snapshot ingestion for Anthropic/Gemini.
- Add deterministic synthetic demo fixtures, tests, GitHub composite action, and architecture/maintenance docs.

The 0.1.0 release did not ship a real provider lifecycle dataset; see the 0.2.0 entry above for the reviewed snapshot added later.
