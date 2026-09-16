# Specification — Mewra Blackbox

## 1. Identity

| Item                          | Value                                                                            |
| ----------------------------- | -------------------------------------------------------------------------------- |
| Product name                  | Mewra Blackbox                                                                   |
| Repository                    | `github.com/mewra-lab/mewra-blackbox`                                            |
| Intended extension identifier | `mewra.mewra-blackbox`                                                           |
| Role                          | Browser E2E and visual-regression companion for Mewra PreFlight                  |
| Initial delivery              | Documentation and threat model first; implementation follows approved milestones |

## 2. Problem

Code-level checks cannot establish whether a real browser can complete a critical journey or whether a changed page visibly regressed at a target viewport. Teams need a local, reviewable black-box check that can exercise an approved web target and retain actionable evidence.

## 3. Goals

- Execute approved browser scenarios against local, staging, or explicitly permitted external HTTPS targets.
- Support URL navigation, viewport matrices, accessibility-aware selectors, user actions, URL expectations, element assertions, screenshot evidence, and visual comparison.
- Use deterministic scenarios for execution; let Codex, Claude Code, and other agents assist with proposal, triage, and explanation through a provider-neutral interface.
- Report a compact contributed check to Mewra PreFlight.
- Provide a dedicated result viewer for screenshots, pixel diffs, traces, network summaries, and failure context.
- Make evidence privacy, retention, and baseline approval explicit.

## 4. Non-goals for v1

- Autonomous discovery or testing of arbitrary internet sites.
- Penetration testing, fuzzing, credential stuffing, crawling, load testing, or bypassing access controls.
- Automatic promotion of screenshot baselines.
- Uploading screenshots, traces, DOM, or credentials to a cloud service by default.
- Replacing CI or a hosted cross-browser device lab.
- Allowing an agent to execute free-form browser code or shell commands.

## 5. Personas and roles

| Role            | Authority                                                                                                                  |
| --------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Workspace owner | Approves target origins, auth mode, scenarios, evidence policy, and baseline changes.                                      |
| Developer       | Runs approved scenarios locally and investigates results.                                                                  |
| AI coding agent | Reads normalized results and may propose scenarios or fixes; cannot approve targets, secrets, baselines, or release gates. |
| PreFlight       | Receives one normalized contributed-check result and applies its normal gate policy.                                       |

## 6. Execution model

An executable scenario is declarative and workspace-versioned. It names an approved target, one or more routes, a viewport, deterministic actions, expected state, and evidence policy. The future runner validates the scenario before starting a browser.

```text
approved configuration
  → scenario validation
  → isolated browser context
  → deterministic actions and assertions
  → screenshot / trace evidence
  → normalized scenario result
  → Blackbox result viewer + PreFlight summary
```

## 7. AI-assisted E2E model

Blackbox supports AI agents as collaborators, not as unrestricted executors.

- Agents may inspect a normalized, redacted result and propose a test case in a reviewable declarative format.
- Agents may request runs of existing approved scenarios through a future narrow MCP tool surface.
- Agents may not set a target URL, inject scripts, read stored secrets, alter browser security policy, approve baseline images, or mark a failed scenario as passing.
- Every proposed scenario must pass schema validation and receive explicit workspace-owner approval before it is executable.

## 8. Initial capability milestones

### 0.1.0 — controlled E2E foundation

- Approved target and scenario configuration.
- Chromium-based local Playwright execution.
- Desktop and mobile viewports.
- Navigation, selector assertions, screenshot capture, trace-on-failure, and normalized results.
- PreFlight contributed check summary.

### 0.2.0 — visual-regression workflow

- Approved baseline creation/update workflow.
- Actual, baseline, and visual diff viewer.
- Configurable pixel thresholds and deterministic masking for approved dynamic regions.

### 0.3.0 — agent and test-plan assistance

- Provider-neutral MCP tools for discovering approved scenarios, reading redacted results, and requesting an existing scenario run.
- Agent-generated scenario proposals requiring review.

## 9. Success criteria

- A developer can run an approved mobile and desktop flow against a configured target and understand a failure without opening raw artifacts manually.
- PreFlight blocks or warns only according to the scenario severity chosen by the workspace owner.
- No browser request reaches an origin outside the approved target policy.
- Credentials and sensitive evidence remain outside Git and are redacted from normal result surfaces.
