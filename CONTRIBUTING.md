# Contributing to Mewra Blackbox

Thank you for contributing. The project is documentation-first until the initial implementation plan is approved.

## Before proposing a change

- Read [SPEC.md](SPEC.md), especially the non-goals and AI-assisted execution model.
- Read the [security model](docs/SECURITY-MODEL.md) before changing target, authentication, evidence, browser, or agent behavior.
- Keep browser automation and rich evidence ownership inside this companion; do not add Blackbox-specific logic to PreFlight.
- Never include credentials, tokens, cookies, production data, screenshots with personal data, or browser traces containing secrets in an issue or pull request.

## Pull requests

Follow [the Git workflow](docs/GIT-WORKFLOW.md). Use focused conventional commits and include the relevant security and test impact in the PR description.

## Reporting vulnerabilities

Use [SECURITY.md](SECURITY.md), not a public issue.
