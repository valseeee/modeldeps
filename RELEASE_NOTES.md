# ModelDeps v0.4.0

Local-first AI model dependency inventory, lifecycle policy and evaluation-gated migration evidence. Requires Node.js 22 or later; no runtime npm dependencies.

This release adds bounded official-source adapters, atomic additive Registry updates, source provenance, workspace/config-bound migration plans, fail-closed eval gates, default dry-run patches and process-level rollback. The CLI supports JSON, SARIF and GitHub Actions summaries; the composite Action uses the bundled CLI.

Executed validation includes 85 passing tests on Windows, Linux and macOS, independent Action consumer jobs, package-content checks and isolated tarball installation. Official Anthropic and Gemini pages were fetched successfully on 2026-10-24, producing 23 and 81 separate review-candidate records. OpenAI authenticated synchronization needs credentials and has not been verified.

The real-repository inventory contains 20 fixed commits: 14 full checkouts (12 default scopes, two with explicit oversized-fixture exclusions) and six declared sparse scopes. These scans generate candidates, not accuracy claims. Human gold labels and real business eval inputs are unavailable; real precision, recall and F1 remain N/A.

Bundled Registry records retain inherited observation times. Fresh page candidates do not automatically replace them. A passing configured eval establishes only that the configured command passed for the recorded inputs; high-risk migrations remain manual. HTML adapters are sensitive to upstream changes and fail closed on unrecognized structure or conflicting facts.

## Assets

- `modeldeps-v0.4.0.zip`: public source, demos and bundled CLI; excludes private audit logs and cloned benchmark repositories.
- `modeldeps-cli-0.4.0.tgz`: installable npm-format package. It can be installed from this asset even if npm registry publication is still blocked by account authentication.
- `SHA256SUMS.txt`: checksums of the workflow's prepared assets.

See [README](https://github.com/valseeee/modeldeps#readme), [validation status](https://github.com/valseeee/modeldeps/blob/v0.4.0/docs/VALIDATION.md) and [business acceptance worksheet](https://github.com/valseeee/modeldeps/blob/v0.4.0/docs/BUSINESS_ACCEPTANCE.zh-CN.md).
