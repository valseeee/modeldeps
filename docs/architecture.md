# Architecture

## Data flow

```text
Repository files
      |
      v
Scanner --------------------- Versioned Registry Snapshot
      |                                    |
      v                                    v
Canonical findings ----------------> Lifecycle resolver
                                           |
                                           v
                                      Policy engine
                                           |
                         +-----------------+----------------+
                         |                                  |
                         v                                  v
                   JSON / SARIF                      Migration planner
                                                            |
                                                            v
                                                    User-owned eval gate
                                                            |
                                               pass --------+-------- fail
                                                |                     |
                                                v                     v
                                        Evidence of this       Migration blocked
                                        command passing
```

## Canonical identity

A model is identified by `(provider, surface, model_id)`. Provider means the company/API family; surface means the exact deployment API/platform; model ID is the literal identifier. This avoids incorrectly treating first-party API lifecycle dates as interchangeable with a partner-hosted deployment lifecycle.

## Trust boundaries

Untrusted: repository source/configuration, PR content, model strings, imported snapshots until validated, and eval scripts from repositories that are not trusted.

Trusted for a specific claim only: validated registry records with source provenance, deterministic policy logic, and the exit status of a user-configured evaluation command. An official source URL and digest provide traceability; they do not make a model behaviorally compatible.

## Deterministic core

The scanner produces locations and candidate identities. The registry resolver matches exact identities. The policy engine compares explicit lifecycle status and dates. The planner only treats `authority: provider` as provider-declared. The eval gate records whether the configured command exited successfully. No LLM participates in these decisions.

## Current implementation boundaries

- Single TypeScript package, Node.js 22+, no runtime dependencies.
- JSON registry; YAML subset for user configuration.
- OpenAI authenticated Models API ingestion only when `shutdown_date` is present.
- Anthropic/Gemini experimental fail-closed HTML adapters and reviewed-snapshot fallback.
- No hosted database or auto-merge. Scheduled fetch proposes a human-reviewed PR.
- Plans bind workspace/config/registry state; eval rechecks state after execution.
- Exact low-risk edits use staged writes and process-level rollback, not crash-atomic transactions.
- Benchmark uses sampled resource watchdogs, checkpoints, pinned commits and explicit human gold labels.
