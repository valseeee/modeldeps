# Lifecycle snapshot provenance

The three JSON files in this directory are maintainer-reviewed snapshots based on the official lifecycle pages linked inside each file. The current bundled set contains 98 OpenAI records, 21 Anthropic records, and 50 Gemini records. The snapshot `observed_at` timestamps are recorded in UTC (current review: 2026-10-22T23:09:45Z). They are **not** live feeds and will become stale unless re-reviewed.

- OpenAI: <https://developers.openai.com/api/docs/deprecations>
- Anthropic: <https://platform.claude.com/docs/en/about-claude/model-deprecations>
- Google Gemini: <https://ai.google.dev/gemini-api/docs/deprecations>

The Google page states that its listed shutdown dates are earliest-possible dates, and the page itself was last updated on 2026-10-22 UTC. Its `Release date` column is not a deprecation announcement date, so those dates are intentionally not copied into `announced_at`. The Anthropic snapshot applies to the Anthropic-operated API surface only; do not reuse these dates for partner-operated Bedrock or Google Cloud surfaces.

## Date semantics

OpenAI snapshot dates use `shutdown_date_kind: "confirmed"` because the Models API field is named `shutdown_date`. Anthropic lifecycle docs label the column “Tentative retirement date”, so the snapshot uses `shutdown_date_kind: "tentative"`. Google's deprecations page explicitly describes table dates as the earliest possible date on which a model might be retired, so its snapshot uses `shutdown_date_kind: "earliest-possible"`. ModelDeps warns when such a date has passed and asks for a current-source check; it does not turn the date alone into a claim that the endpoint is already shut down.

## Hash semantics

`source.snapshot_sha256` is the SHA-256 of the exact local reviewed JSON snapshot imported by ModelDeps. It does **not** hash the HTML page at `source.url`. When the OpenAI Models API adapter fetches live JSON, `source.sha256` instead hashes the exact API response bytes. These fields are intentionally separate so the tool does not imply that it downloaded and hashed a webpage when it did not.

## Updating a snapshot

1. Open the official provider page and verify the exact model ID, lifecycle state, date, deployment surface, and any explicitly recommended replacement.
2. Do not turn phrases such as “the most capable model available to your account” into a guessed model ID.
3. Update `observed_at` to the time the page was reviewed, not the model announcement date.
4. Run `node dist/cli.js registry sync --provider <openai|anthropic|google> --input data/snapshots/<provider>.json --registry data/registry.json --output data/registry.json` after rebuilding.
5. Run `node dist/cli.js registry validate --registry data/registry.json`, `npm test`, and `npm run benchmark`.
6. Include the official URL and a regression test in the pull request.

The OpenAI adapter also supports a live API import when `--input` is omitted and `OPENAI_API_KEY` is set. It imports only records with a valid `shutdown_date` returned by the official Models API; it does not invent active states or replacement IDs. Since v0.4.0, Anthropic and Gemini can be fetched from their official HTML lifecycle pages with `registry sync --provider anthropic --live` and `registry sync --provider google --live`. The parser validates official hosts, source-byte hashes, required table columns, and minimum row counts, and fails closed if the page structure changes. These parsers are still HTML-layout-dependent; inspect the generated diff and review PR before merging. The bundled snapshots remain deterministic offline fallback data.
