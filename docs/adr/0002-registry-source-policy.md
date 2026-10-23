# ADR 0002: Lifecycle facts require provenance

- Status: accepted
- Date: 2026-10-23

## Decision

Every registry record carries a source kind and observation timestamp. Official records require an HTTPS source URL. Provider replacements are distinct from community suggestions.

## Context

A false shutdown date or guessed replacement can cause a production outage or an unsafe migration.

## Consequences

- Missing information remains unknown.
- Demo records use `fixture://` sources and are never presented as official.
- HTML scraping is not enabled when the page is not a stable machine-readable source.
