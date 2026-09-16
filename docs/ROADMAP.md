# Roadmap

## v0.1.0 — controlled local E2E

- VS Code companion scaffold and PreFlight API v1 registration.
- Strict workspace configuration for approved origins and declarative scenarios.
- Local Chromium Playwright runner with isolated browser contexts.
- Navigation, action, URL, selector, and text assertions.
- Desktop/mobile viewport matrix, screenshot-on-failure, trace-on-failure, redacted result viewer.
- Diff-aware scenario selection and one PreFlight check summary.

## v0.2.0 — visual regression

- Explicit baseline capture and owner confirmation.
- Baseline/actual/diff comparison UI.
- Pixel thresholds and narrow approved dynamic masks.
- Artifact retention controls and deterministic visual fixtures.

## v0.3.0 — agent-assisted workflow

- Provider-neutral MCP discovery of approved scenarios and redacted result summaries.
- Bounded tool to run an existing approved scenario.
- Reviewable agent-generated scenario proposals.

## Deferred

- Hosted runs, shared artifact cloud, cross-browser device farm, scheduled monitoring, broad crawling, performance/load testing, production test data, autonomous baseline updates, and unrestricted agent browser control.
