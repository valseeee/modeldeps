# Release checklist

The owner authorized uploading this source to a new public `valseeee/modeldeps` repository on 2026-10-24. Tags, GitHub Releases and npm publication require separate authorization.

- [ ] Review `docs/VALIDATION.md`, the local `reports/round5/DELIVERY.md` and every outstanding external/manual verification item.
- [x] Run `npm run verify:delivery` on clean Node 22+; retain commands and exit codes. Linux/Windows/macOS CI passed 85/85 tests and all verification commands.
- [x] Check compiled dist matches source; all three CI platforms passed `git diff --exit-code -- dist`.
- [ ] Review all inherited lifecycle snapshots against current official pages. Snapshot JSON hashes are not webpage authentication.
- [x] Anthropic/Gemini live adapters passed hosted Ubuntu acceptance (23/81 records); retain source hashes and separate review candidates. Mainland-China local checks remain owner-exempted.
- [ ] Configure OpenAI credentials privately and verify authenticated sync; official schema and offline fixtures are already checked.
- [ ] Review benchmark pinned commits, licenses, negative examples, candidates and missed references. Obtain human gold labels before making accuracy claims.
- [x] Run Linux/Windows/macOS CI, including the separate composite-action consumer job and expected failure cases. Actual run: https://github.com/valseeee/modeldeps/actions/runs/40049977914 .
- [x] Recheck Actions full commit pins against upstream; minimize permissions and isolate secrets/write jobs. Recheck again when upgrading Actions.
- [x] Review npm tarball: no tests, logs, .env, cache, personal paths, secrets or oversized files. Verify CLI and Registry from the installed tarball.
- [ ] Review LICENSE, SECURITY, contribution policy, owner/name placeholders and npm name availability.
- [x] Keep reports/, release products, .env files, temp files and cloned repositories out of Git/public source. `.gitignore` excludes local audits; public files were audited before upload.
- [x] Regression-test exact tag/package matching and reject mismatches/branch pushes. Manual Release preparation actually succeeded and skipped publication; both archive checksums matched.
- [ ] Reconfirm the selected tag/package version when publication is authorized. Release prepare must succeed before the separate publish job can run.
- [x] Obtain explicit user authorization for the new public repository and source upload.
- [ ] Obtain separate explicit authorization before pushing a tag, publishing a Release or publishing npm.

No npm publish workflow is included. Do not treat a configured eval pass as universal safety. Hash-based evidence cannot prevent a trusted local administrator from editing the tool or trusted Registry.
