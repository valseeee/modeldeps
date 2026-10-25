# Security Policy

## Reporting a vulnerability

Please do not publish credentials, exploitable details, or an unpatched vulnerability in a public issue. Use [GitHub's private vulnerability reporting form](https://github.com/valseeee/modeldeps/security/advisories/new) if it is available to your account. Availability has not been verified and is controlled by the repository owner. If the form is unavailable, open an issue requesting a private reporting channel, with no vulnerability details or proof of concept, and wait for the maintainer to provide one.

In the private report, include the affected commit/version, operating system and Node.js version, a minimal reproduction without secrets, the expected and actual behavior, and the likely impact. No response-time guarantee is currently offered.

## Security boundaries

- Normal scan/check/plan commands operate locally and do not upload repository contents.
- `registry sync --provider openai` sends an authenticated request to the official OpenAI API. Keep `OPENAI_API_KEY` out of logs, source control, and public CI contexts.
- `verify` executes the configured shell command with the current user's permissions. Run it only for code you trust.
- Never expose secrets to workflows triggered by untrusted fork pull requests.
- Registry snapshots are data, not instructions. Source URLs and hashes support review; they do not by themselves prove a source is truthful.
- ModelDeps does not call an LLM in its verifier and does not auto-merge changes.

## Supported versions

Security fixes currently target the 0.4.x development line. Identify the version and source commit in reports; GitHub Release and npm registry publication have independent availability and authentication requirements. Older source snapshots are not separately maintained.
