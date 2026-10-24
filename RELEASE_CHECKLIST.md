# Release checklist

The owner authorized uploading this source to a new public `valseeee/modeldeps` repository on 2026-10-24. Tags, GitHub Releases and npm publication require separate authorization.

- [ ] Review `docs/VALIDATION.md`, the local `reports/round3/DELIVERY.md` and every outstanding external/manual verification item.
- [x] Run `npm run verify:delivery` on clean Node 22+; retain commands and exit codes. Linux/Windows CI passed 77/77 tests and all verification commands.
- [x] Check compiled dist matches source; Linux/Windows CI passed `git diff --exit-code -- dist`.
- [ ] Review all inherited lifecycle snapshots against current official pages. Snapshot JSON hashes are not webpage authentication.
- [ ] Local mainland-China live checks are owner-exempted. Before claiming provider live availability, exercise adapters in a provider-supported environment; configure OpenAI credentials privately. Keep parsers experimental until verified.
- [ ] Review benchmark pinned commits, licenses, negative examples, candidates and missed references. Obtain human gold labels before making accuracy claims.
- [x] Run Linux/Windows CI, including the separate composite-action consumer job and its expected failure case. Actual run: https://github.com/valseeee/modeldeps/actions/runs/40045422601 .
- [x] Recheck Actions full commit pins against upstream; minimize permissions and isolate secrets/write jobs. Recheck again when upgrading Actions.
- [x] Review npm tarball: no tests, logs, .env, cache, personal paths, secrets or oversized files. Verify CLI and Registry from the installed tarball.
- [ ] Review LICENSE, SECURITY, contribution policy, owner/name placeholders and npm name availability.
- [x] Keep reports/, release products, .env files, temp files and cloned repositories out of Git/public source. `.gitignore` excludes local audits; public files were audited before upload.
- [ ] Confirm tag exactly equals `v` + package version. Release prepare job must succeed before separate publish job can run.
- [x] Obtain explicit user authorization for the new public repository and source upload.
- [ ] Obtain separate explicit authorization before pushing a tag, publishing a Release or publishing npm.

No npm publish workflow is included. Do not treat a configured eval pass as universal safety. Hash-based evidence cannot prevent a trusted local administrator from editing the tool or trusted Registry.
