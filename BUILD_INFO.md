# Local build record — 2026-10-24

Version remains 0.4.0. Work is performed in the user-selected local project. The owner has authorized uploading the verified source to a new public `valseeee/modeldeps` repository; no release tag, GitHub Release or npm publication is authorized.

Current local evidence is in reports/round4/DELIVERY.md and reports/verification/final-commands.json; docs/VALIDATION.md supplies the public summary. The latest local run passed 77 of 77 tests. Actual Linux/Windows Node 22 CI also passed all 77 tests and both composite-action consumer jobs: https://github.com/valseeee/modeldeps/actions/runs/40045422601 . Earlier reports describe earlier runs and must not be treated as current totals. Tests are executed from source via TypeScript build. Fixture tests do not prove live scraping works; inventories do not prove accuracy.

Implemented hardening includes bounded network/parser inputs, atomic additive Registry updates, explicit source failures, migration/config/workspace hashes and checks before/after eval, staged patch rollback, budgeted/checkpointed real repository scans with exact commit-aware human labeling, pinned Actions and separate release prepare/publish permissions.

The release checklist retains manual/external checks. No API key was supplied, no provider live sync succeeded locally, and no human gold set is available. Public-source distribution should exclude local audit reports and personal paths. Final ZIP intentionally retains local audit evidence for this user.
