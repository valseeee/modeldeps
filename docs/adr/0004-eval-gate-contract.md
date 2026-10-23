# ADR 0004: User-owned evaluation gate

- Status: accepted
- Date: 2026-10-23

## Decision

R2 and higher migrations require an explicitly configured evaluation command. A non-zero exit code, command error, or timeout blocks the migration.

## Context

A provider-declared replacement can change tool use, structured output, request parameters, or application behavior.

## Consequences

- The command must be owned and reviewed by the repository maintainer.
- A passing command is evidence only for that test suite and run; it is not a universal proof of semantic equivalence.
- Eval execution is explicit and must not receive secrets in untrusted PR contexts.
