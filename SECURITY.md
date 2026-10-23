# Security Policy

## Reporting a vulnerability

Please do not publish credentials, exploitable details, or an unpatched vulnerability in a public issue. Use GitHub's private vulnerability reporting feature for this repository if it is enabled. If private reporting is unavailable, contact the repository maintainer through a private channel listed on the repository profile.

## Security boundaries

- Normal scan/check/plan commands operate locally and do not upload repository contents.
- `registry sync --provider openai` sends an authenticated request to the official OpenAI API. Keep `OPENAI_API_KEY` out of logs, source control, and public CI contexts.
- `verify` executes the configured shell command with the current user's permissions. Run it only for code you trust.
- Never expose secrets to workflows triggered by untrusted fork pull requests.
- Registry snapshots are data, not instructions. Source URLs and hashes support review; they do not by themselves prove a source is truthful.
- ModelDeps does not call an LLM in its verifier and does not auto-merge changes.

## Supported versions

Security fixes target the latest release line. Please update to the latest available version before reporting a vulnerability.
