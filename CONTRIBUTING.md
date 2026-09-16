# Contributing to Mewra Blackbox

Use Node 20.19+ or 22.12+, pnpm 10.17.1, and a focused branch. Run `pnpm install --frozen-lockfile`, `pnpm validate`, browser tests, extension-host tests, and `pnpm package` before requesting review. Browser fixtures must contain synthetic data only.

Repository-local contributor skills under `.agents/skills/` are vendored from the pinned PreFlight revision in `skills-lock.json`. They become discoverable on the next agent turn. Run `pnpm skills:verify` after changes; preserve upstream attribution and licenses. Updating skills is a deliberate dependency update, not an unpinned install during CI.

## Before proposing a change

- Read [SPEC.md](SPEC.md), especially the non-goals and AI-assisted execution model.
- Read the [security model](docs/SECURITY-MODEL.md) before changing target, authentication, evidence, browser, or agent behavior.
- Keep browser automation and rich evidence ownership inside this companion; do not add Blackbox-specific logic to PreFlight.
- Never include credentials, tokens, cookies, production data, screenshots with personal data, or browser traces containing secrets in an issue or pull request.

## Pull requests

Follow [the Git workflow](docs/GIT-WORKFLOW.md). Use focused conventional commits and include the relevant security and test impact in the PR description.

## Reporting vulnerabilities

Use [SECURITY.md](SECURITY.md), not a public issue.
