# Contributing

Thanks for helping improve ModelDeps. The project prioritizes correctness and evidence over the number of supported providers.

## Local setup

- Node.js 22+
- `npm ci`
- `npm test`

Before opening a pull request, include focused tests and update documentation for any user-visible behavior change.

## Registry data rules

Every official lifecycle fact must include:

1. a provider-owned HTTPS source URL;
2. the time the source was observed;
3. a regression fixture/test;
4. an exact provider + surface + model ID;
5. no inferred replacement presented as provider-declared.

Community recommendations may be recorded as `authority: community`, but must never be used for automatic edits. Do not commit API keys or other credentials. Demo fixture records are synthetic and must not be copied into a production registry.

## Scanner rules

Every new detection rule should include:

- a positive fixture;
- a negative fixture that should not match;
- a boundary/false-positive case;
- an explanation of what dynamic patterns remain unsupported.

Do not claim full language parsing when a rule is based on regular expressions.

## Migration and eval rules

- The verifier and lifecycle policy must remain deterministic.
- An LLM must not be used to decide lifecycle truth or whether an eval passed.
- R2+ migrations require a user-owned evaluation gate by default.
- Do not automatically merge migration pull requests.
- Changes to canonical identity, registry schema, or gate semantics should include an ADR under `docs/adr/`.

## Security

Treat repository files, PR content, model IDs, config files, and optional snapshot inputs as untrusted. Eval commands execute repository-owned code with the current user's permissions. Do not run untrusted repository evals with production secrets.
