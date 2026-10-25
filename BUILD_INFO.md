# Local build record — 2026-10-24

Version remains 0.4.0. Work is performed in the user-selected local project. The owner has authorized uploading the verified source to a new public `valseeee/modeldeps` repository; the owner additionally authorized the v0.4.0 tag, GitHub Release and npm publication on 2026-10-25. Publication status is recorded separately; authorization does not supply npm credentials.

Current evidence is in reports/round5/DELIVERY.md, reports/round5/tests-provider-fixed.log and reports/round5/code-ci-evidence/; reports/verification retains the earlier local delivery run; docs/VALIDATION.md supplies the public summary. The latest local run passed 85 of 85 tests. Actual Linux/Windows/macOS Node 22 CI also passed all 85 tests and all three composite-action consumer jobs: https://github.com/valseeee/modeldeps/actions/runs/40049977914 . Earlier reports describe earlier runs and must not be treated as current totals. Tests are executed from source via TypeScript build. Fixture tests do not prove live scraping works; inventories do not prove accuracy.

Implemented hardening includes bounded network/parser inputs, atomic additive Registry updates, explicit source failures, migration/config/workspace hashes and checks before/after eval, staged patch rollback, budgeted/checkpointed real repository scans with exact commit-aware human labeling, pinned Actions and separate release prepare/publish permissions.

The release checklist retains manual/external checks. No API key was supplied, Anthropic/Gemini were live-verified on the hosted runner, and no human gold set is available. Public-source distribution should exclude local audit reports and personal paths. Final ZIP intentionally retains local audit evidence for this user.
