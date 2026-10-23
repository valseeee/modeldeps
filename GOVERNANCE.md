# Governance

ModelDeps is currently a maintainer-led open-source project. The maintainer is responsible for release decisions, security responses, roadmap priorities, and final technical direction.

## Decision process

- Small, backward-compatible changes may be reviewed in pull requests.
- Registry schema, canonical identity, lifecycle semantics, and evaluation-gate changes should include an Architecture Decision Record (ADR).
- Maintainers should prefer reproducible evidence and explicit limitations over unsupported provider compatibility claims.
- Community input is welcome; there is no formal voting committee or contributor agreement requirement in v0.1.

## Releases

Releases should include a changelog entry, passing test suite, and review of registry/source changes. Published action tags should be immutable where possible; production users should pin a full commit SHA.
