# AGENTS.md — Mewra Blackbox

## Product boundary

Mewra Blackbox is a companion extension for browser-based E2E and visual regression checks. It integrates with Mewra PreFlight through the versioned contributed-check API and must not couple PreFlight to Playwright, browser automation, screenshot storage, or agent providers.

## Required reading

Before implementation, read `SPEC.md` plus `docs/ARCHITECTURE.md`, `docs/SECURITY-MODEL.md`, `docs/INTEGRATION.md`, `docs/TESTING.md`, `docs/UX.md`, and `docs/GIT-WORKFLOW.md`.

## Security invariants

- Execute only workspace-owner-approved target origins, routes, viewports, and scenarios.
- Never treat agent, webview, clipboard, terminal, or remote text as executable browser configuration without validation and human approval.
- Do not place credentials, cookies, headers, screenshots containing sensitive data, browser profiles, or traces in Git.
- Store secrets only in VS Code SecretStorage or an explicitly configured OS secret provider.
- Isolate every browser context, clear it after a run, and disable persistent profiles by default.
- Deny private-network and loopback targets unless a workspace configuration explicitly permits them.
- Bound navigation, action, network-idle, screenshot, trace, and total-run timeouts.
- Never run shell fragments. Process invocations must use fixed executable paths and argument arrays.
- Do not make autonomous baseline approval or release decisions from AI output.

## Architecture rules

- Keep VS Code APIs in `src/extension/` only once code exists.
- Keep browser-runner, visual-diff, scenario-validation, and result-normalization code independent of VS Code.
- The companion owns rich evidence UI; PreFlight receives normalized check results only.
- Missing Playwright or browser binaries must be `not-configured`, never a failed test.

## Quality gate

The exact commands will be defined with the initial implementation. Every feature must add tests proportionate to browser, configuration, privacy, and integration risk.
