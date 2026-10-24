# ModelDeps

Local-first model lifecycle inventory and evaluation-gated migration evidence. Node.js 22 or later; no runtime npm dependencies. Version 0.4.0.

## Status

Implemented: static source/config scanning, provider + surface identity, lifecycle/date/stale policy, JSON/SARIF/GitHub Summary, reviewed snapshot import, additive atomic registry updates, plan validation, workspace input hashes, eval execution and exact low-risk dry-run patches with process-level rollback.

Anthropic/Gemini HTML adapters are implemented, offline-tested and [live-verified on GitHub-hosted Ubuntu](https://github.com/valseeee/modeldeps/actions/runs/40049987206): 23 Anthropic and 81 Gemini records on 2026-10-24. They remain sensitive to upstream markup and reject unapproved redirects, unknown rows, conflicting facts and invalid dates. Mainland-China local acceptance remains owner-exempted; network/region/account requirements elsewhere still apply. OpenAI sync requires `OPENAI_API_KEY` and remains unverified without credentials. Scheduled fetching proposes changes for human review. Bundled snapshots remain inherited data; live review candidates do not automatically replace them. See [validation status](docs/VALIDATION.md).

Real-repository scanning runs only Git and static analysis. An inventory is not an accuracy evaluation. Human gold annotations are required for precision/recall; candidate output is never automatically ground truth.

## Quick start

Windows PowerShell, from the extracted project directory:

```powershell
node --version
npm ci
npm test
npm run benchmark
node dist/cli.js --version
node dist/cli.js check demo/repository/healthy --registry demo/registry.fixture.json
node dist/cli.js check demo/repository/retired --registry demo/registry.fixture.json
```

macOS/Linux use the same commands in a terminal. The retired example intentionally returns 1. Fixtures contain synthetic models, not provider announcements. Windows local tests and actual Linux/Windows/macOS Node 22 CI passed 85/85 tests; all three composite-action consumer jobs also passed. See the [executed CI run](https://github.com/valseeee/modeldeps/actions/runs/40049977914).

## Scan and migrate

```sh
node dist/cli.js scan demo/repository/healthy --format json
node dist/cli.js check demo/repository/retired --registry demo/registry.fixture.json --format sarif
node dist/cli.js plan demo/repository/migration-breaks-tool-use --registry demo/registry.fixture.json --output .modeldeps/plan.json
node dist/cli.js verify --plan .modeldeps/plan.json --registry demo/registry.fixture.json --command 'node -e "process.exit(1)"' --output .modeldeps/evidence.json
node dist/cli.js apply --plan .modeldeps/plan.json --registry demo/registry.fixture.json
```

The failing eval deliberately returns 1. Replace it with a repository-owned eval command for actual migration work; an arbitrary successful command is not evidence of adequate coverage. Commands are executed locally with your account permissions. Never run eval commands from untrusted repositories. A configured eval pass proves only that command passed for the recorded inputs, not universal compatibility.

Keep plans/evidence under `.modeldeps/`. Plans bind the resolved root, registry, normalized config, configured evaluation command/timeout, migration files, and regular workspace files. Execution outcomes remain in hash-linked evidence; unexecuted plans say pending. Input capture excludes `.git`, dependencies, build output, coverage, reports, virtual environments, symlinks and the plan artifact/sidecar. External services, OS state, ignored dependencies and files deliberately excluded by this scope are not authenticated. A local administrator able to modify the tool/registry can forge local artifacts; hashes do not create a signed trust chain.

`apply` defaults to dry-run. Only exact, unambiguous, same-surface, provider-declared R0/R1 candidates with valid current evidence can be written using `--write`. Higher-risk migrations remain manual even after eval. UTF-8/BOM and LF/CRLF/mixed newlines are preserved; UTF-16/binary and read-only files are rejected. Symlinks/traversal are rejected. All edits are staged; I/O failures attempt rollback, retaining backups if recovery fails. This is not crash-atomic across files, and concurrent hostile filesystem mutation is outside the guarantee.

## Registry and sources

```sh
node dist/cli.js registry validate
node dist/cli.js registry info
node dist/cli.js registry sync --provider google --live --output .modeldeps/google.json
node dist/cli.js registry sync --provider anthropic --input data/snapshots/anthropic.json --output .modeldeps/anthropic.json
```

Live commands require network access and may fail with exit 3. OpenAI uses `registry sync --provider openai --output <file>` with an API key supplied through the environment. Never put keys in committed files. This authenticated path remains unverified without credentials. Models API availability is not a complete historical inventory; no status or replacement is inferred when a shutdown date is absent/null. Source failures preserve the previous registry. `--prune-missing` is disabled. Successful imports preserve `observed_at`, parser version, source/snapshot hash and per-provider `last_successful_sync`. `generated_at` is not evidence that every source is fresh.

Reviewed snapshots are a manual trust boundary: importing a JSON file does not fetch or authenticate its cited webpage. Review each official source, date semantics and replacement before importing. `confirmed`, `tentative` and `earliest-possible` dates remain distinct; stale evidence is not proof of retirement. Verification/application blocks stale/empty registries.

## Configuration and exits

Auto-discovery: `.modeldeps.yml`, `.modeldeps.yaml`, `.modeldeps.json`; override with `--config`. YAML supports only mappings, scalar lists and scalar values; advanced YAML is rejected. Fields: `providers`, `ignore`, `policy` (`fail_on`, `warn_days_before_shutdown`, `fail_days_before_shutdown`, `fail_on_unknown`, `max_source_age_days`, `require_eval_on`) and `evaluations.default.command/timeout_seconds`. Defaults: retired fails, warning 90 days, failure 30 days, source age 30 days, unknown warning. `--strict-unknown` / `--strict-stale` tighten checks; tentative dates are not hard shutdown deadlines.

| Exit | Meaning |
| --- | --- |
| 0 | Command succeeded / configured gates passed |
| 1 | Policy/eval blocked or required benchmark labels missing |
| 2 | Usage, credentials/configuration or internal error |
| 3 | Provider network/source failure or real-repo acquisition/resource failure |

Scanner supported files: TS/JS/Python and JSON/YAML/TOML/env/INI/properties/config. It is heuristic, not full semantic analysis; dynamic/template references need human review. Limits default to 50,000 traversed entries, 250 MB scanned data, 10 MB/file and 120 seconds. Assignment keys are limited to 128 characters and lines to 1,000,000 characters. Exceeding a scan resource limit is an error, never a clean scan result.

## Reproducible benchmark and release preparation

See [annotation rules](data/real-repo-benchmark/README.md). `npm run verify:delivery` runs checks, expected-failure demos, package content validation and an isolated package install. It writes actual commands and exit codes to `reports/verification/final-commands.json` and exits nonzero on mismatches. It does not clone or execute external repository code or publish anything.

GitHub workflows use full commit-pinned Actions. CI uses read permissions, retains execution logs and tests composite-action consumers on Linux, Windows and macOS. Lifecycle fetching and PR write permissions are separated. The manual Release preparation has actually passed, including tests and archive creation; manual dispatch skips publication. Only an authorized version-tag push enables the separate publish job, after tag/version validation and successful preparation. See the [pinned consumer example](examples/modeldeps-workflow.yml) and [release checklist](RELEASE_CHECKLIST.md). Release tags, GitHub Releases and npm publication still require owner authorization.

Troubleshooting: missing dist → `npm run build`; missing dependencies → `npm ci`; source exit 3 → inspect official URL/network/region and retain current registry or use a reviewed snapshot; stale evidence → review/refresh sources and regenerate plan; changed inputs → regenerate plan and rerun eval; invalid gold labels → pin exact commit and label line/column before scoring.

Apache-2.0. See LICENSE and SECURITY.md.

Synthetic demo observation times are refreshed only in temporary test/verification copies so calendar aging does not break unrelated CI. Official source observations are never refreshed this way. Benchmark manifests may declare explicit per-repository ignore patterns; reports, pinned exports and resume checks retain this scope. See docs/HANDOFF_STATUS.zh-CN.md for acceptance status.
