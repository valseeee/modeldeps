# ADR 0003: No LLM in lifecycle verification

- Status: accepted
- Date: 2026-10-23

## Decision

Lifecycle resolution, policy evaluation, migration eligibility, and eval-gate results are deterministic and do not call an LLM.

## Context

These decisions need to be reproducible and auditable. Sending repository context to an external model would also introduce privacy and prompt-injection risks.

## Consequences

- ModelDeps can report unknown or insufficient evidence instead of inventing an answer.
- Any future optional LLM patch generator must remain separate, opt-in, and unable to override the verifier.
