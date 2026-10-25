# Release checklist

The owner authorized uploading this source to a new public `valseeee/modeldeps` repository on 2026-10-24. On 2026-10-25 the owner additionally authorized the v0.4.0 tag, GitHub Release and npm publication. npm account authentication remains a separate technical requirement.

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
- [x] Review project LICENSE, SECURITY, contribution policy and owner/name placeholders. Apache-2.0 appendix examples are standard license text; repository links point to valseeee/modeldeps. Security reporting now has a concrete route and a fallback; private reporting availability remains owner-controlled and unverified.
- [x] Check the official npm registry for modeldeps-cli: HTTP 404 on 2026-10-24. This is a point-in-time lookup, not a name reservation, account ownership check or publication authorization. Recheck when publication is authorized.
- [x] Read the root license at all 20 benchmark commits; retain the text and note mixed scopes (local reports/round6/LICENSE_REVIEW.zh-CN.md). Autogen has a separate code license; Langfuse, LiteLLM and Mastra have separate directory terms. Human redistribution approval remains pending.
- [x] Prepare the [business acceptance worksheet](docs/BUSINESS_ACCEPTANCE.zh-CN.md); actual business inputs and eval execution remain pending.
- [x] Keep reports/, release products, .env files, temp files and cloned repositories out of Git/public source. `.gitignore` excludes local audits; public files were audited before upload.
- [x] Regression-test exact tag/package matching and reject mismatches/branch pushes. Manual Release preparation actually succeeded and skipped publication; both archive checksums matched.
- [x] Select v0.4.0 for package version 0.4.0 under the 2026-10-25 publication authorization. Release prepare must succeed before the separate publish job can run.
- [x] Obtain explicit user authorization for the new public repository and source upload.
- [x] Obtain explicit authorization for the v0.4.0 tag, GitHub Release and npm publication (2026-10-25). Execute publication only with valid service credentials; retain the actual results.

No npm publish workflow is included. Do not treat a configured eval pass as universal safety. Hash-based evidence cannot prevent a trusted local administrator from editing the tool or trusted Registry.
