# Architecture

## Boundary

Mewra Blackbox is a Mewra PreFlight companion extension. It owns browser automation, target policy enforcement, scenario validation, artifact production, visual comparison, and the rich evidence viewer. PreFlight owns diff calculation, orchestration, result aggregation, and the PR/MR gate.

```text
VS Code workspace
      │
      ▼
Blackbox extension layer
      │ validates approved configuration and user intent
      ▼
Core scenario planner
      │ validates target, route, viewport, steps, and evidence policy
      ▼
Browser runner
      │ isolated Playwright context; bounded run
      ├─────────► evidence normalizer ──► Blackbox result viewer
      │
      └─────────► contributed CheckRunner ──► Mewra PreFlight summary
```

## Future modules

| Layer | Responsibility |
| --- | --- |
| `src/extension/` | VS Code commands, SecretStorage, result viewer lifecycle, PreFlight activation and registration. |
| `src/core/config/` | Strict schema validation, target policy, scenario selection, and configuration migration. |
| `src/core/browser/` | Fixed Playwright launch settings, isolated contexts, navigation and action bounds, network controls. |
| `src/core/scenarios/` | Declarative action interpreter and assertion normalization. |
| `src/core/visual/` | Baseline lookup, masking, image comparison, threshold evaluation, and redaction policy. |
| `src/core/results/` | Stable normalized result and artifact metadata. No raw secrets or unrestricted DOM dumps. |
| `src/shared/` | Types and validated messages shared by extension and webview. |
| `src/webview/` | Result viewer only; it never runs browser commands directly. |

## Result model

The PreFlight-facing check result remains intentionally small:

```text
status: pass | warning | fail | not-configured | skipped
findings: scenario ID, route label, redacted assertion message, local evidence reference
```

The rich result viewer resolves local evidence only after validating that its path is within the Blackbox managed artifact directory. It presents a baseline, actual screenshot, pixel diff, trace reference, and redacted event summary.

## Scenario selection

Browser E2E cannot be purely line-scoped. A scenario may declare path globs that map changed files to the smallest relevant journey set. PreFlight's diff is used to select scenarios; Blackbox never silently expands that selection to every scenario unless the workspace owner explicitly invokes a full suite.

## Agent boundary

Future agent integration is provider-neutral. A narrow MCP layer may expose approved scenario metadata, redacted result summaries, and runs of existing scenarios. It cannot expose raw credentials, target-policy mutation, raw browser evaluation, arbitrary script injection, or baseline approval.
