# ADR 0001: Canonical model identity

- Status: accepted
- Date: 2026-10-23

## Decision

Use `(provider, surface, model_id)` as the canonical registry key.

## Context

The same model family may be exposed through multiple APIs or hosted platforms, and lifecycle dates may differ between those surfaces.

## Consequences

- Registry records are explicit and may be duplicated across surfaces when evidence supports it.
- The scanner must not merge records based on model ID alone when multiple canonical identities exist.
- Registry imports must name the surface.
