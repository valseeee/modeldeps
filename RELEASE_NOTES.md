# ModelDeps v0.4.1

Local-first AI model dependency inventory, lifecycle policy and evaluation-gated migration evidence. Requires Node.js 22 or later; no runtime npm dependencies.

This patch fixes commit attribution in the real-repository benchmark. Both initial scans and resume now reject untracked files and ignored local files, alongside tracked modifications. The scanner does not use `.gitignore` as its scan boundary: previously a new local model config could leave Git's tracked status clean and cause stale findings to be reused under the same commit. The harness now fails before scanning or reusing results and leaves local files intact.

The regression uses a real local Git repository: both added-file cases reproduced the original false success, then passed after the fix; restoring the clean checkout permits resume again. All six focused benchmark/release tests passed locally. Tag-triggered release verification runs the full suite, demos, package audit and isolated tarball installation before publication; the three-platform CI runs independently. Prior 0.4.0 validation included 85 passing tests per platform. OpenAI authenticated synchronization still needs credentials.

The real-repository inventory contains 20 fixed commits: 14 full checkouts (12 default scopes, two with explicit oversized-fixture exclusions) and six declared sparse scopes. These scans generate candidates, not accuracy claims. Human gold labels and real business eval inputs are unavailable; real precision, recall and F1 remain N/A.

Bundled Registry records retain inherited observation times. Fresh page candidates do not automatically replace them. A passing configured eval establishes only that the configured command passed for the recorded inputs; high-risk migrations remain manual. HTML adapters are sensitive to upstream changes and fail closed on unrecognized structure or conflicting facts.

## Assets

- `modeldeps-v0.4.1.zip`: public source, demos and bundled CLI; excludes private audit logs and cloned benchmark repositories.
- `modeldeps-cli-0.4.1.tgz`: installable npm-format package. It can be installed from this asset even if npm registry publication is still blocked by account authentication.
- `SHA256SUMS.txt`: checksums of the workflow's prepared assets.

See [README](https://github.com/valseeee/modeldeps#readme), [validation status](https://github.com/valseeee/modeldeps/blob/v0.4.1/docs/VALIDATION.md) and [business acceptance worksheet](https://github.com/valseeee/modeldeps/blob/v0.4.1/docs/BUSINESS_ACCEPTANCE.zh-CN.md).
