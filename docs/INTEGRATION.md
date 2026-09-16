# Mewra PreFlight Integration

## Companion contract

Mewra Blackbox will activate `mewra.mewra-preflight`, verify the published API version, and register contributed checks. PreFlight must remain unaware of Playwright, target configuration, screenshots, and visual-diff internals.

```text
mewra.mewra-blackbox
  └─ activate Mewra PreFlight API v1
       └─ registerCheck(blackbox scenario-suite check)
```

## Initial check

| Field                   | Proposed value                                                                                      |
| ----------------------- | --------------------------------------------------------------------------------------------------- |
| Check ID                | `mewra-blackbox:e2e`                                                                                |
| Label                   | `Mewra Blackbox — Approved E2E`                                                                     |
| Severity                | Workspace configurable: `error` or `warning`                                                        |
| Applies when            | A configured scenario's changed-file selectors match PreFlight's diff.                              |
| Missing browser tooling | `not-configured`                                                                                    |
| Result detail           | Scenario count, failed scenario count, redacted summary, and a command to open the Blackbox viewer. |

Later releases may register separate checks for visual regression and an explicitly requested full suite, but v0.1.0 should keep a single clear dashboard row.

## Diff-aware scenario selection

Each scenario can declare source path globs such as `src/checkout/**` or `apps/storefront/**`. Blackbox receives the PreFlight diff and selects only matching scenarios. If no configured scenario matches, it returns `skipped` with a clear reason.

The full suite is an explicit user action in Blackbox and must not be triggered merely because a diff exists.

## Result handoff

Blackbox maps each scenario result to PreFlight findings without embedding raw screenshots or traces. A finding includes the scenario ID, human label, affected route, safe message, and local evidence reference. The fixed registered viewer command is `mewra-blackbox.results`.

## Verified host contract and remaining UI dependency

The implementation is based on `mewra-lab/mewra-preflight` revision `6ee6c0821c7c0526f6cd4d032feb0802389caaae`: `apiVersion: 1`, `registerCheck(CheckRunner)`, and the published `CheckResult` fields. The companion registers `setupCommand: mewra-blackbox.results` and emits the same fixed command in finding metadata. It never treats metadata supplied by a target or agent as a command.

At this revision, PreFlight renders `setupCommand` only when the result is `not-configured`; it does not render commands from finding metadata. Therefore the always-visible **Open Blackbox results** row action requested in issue #6 remains an upstream dependency. For pass/warning/fail results, use **Blackbox: Open Results** in the Command Palette. A future generic `resultCommand`/action contract in PreFlight can enable the row action without coupling the host to browser automation. This repository does not silently patch or fork PreFlight.

## Versioning

Blackbox depends on the versioned public PreFlight extension API. If the host is absent or the API version is incompatible, Blackbox remains usable as a standalone result viewer but does not register a check. The status must clearly explain this state.
