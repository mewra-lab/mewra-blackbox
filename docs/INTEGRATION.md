# Mewra PreFlight Integration

## Companion contract

Mewra Blackbox will activate `mewra.mewra-preflight`, verify the published API version, and register contributed checks. PreFlight must remain unaware of Playwright, target configuration, screenshots, and visual-diff internals.

```text
mewra.mewra-blackbox
  └─ activate Mewra PreFlight API v1
       └─ registerCheck(blackbox scenario-suite check)
```

## Initial check

| Field | Proposed value |
| --- | --- |
| Check ID | `mewra-blackbox:e2e` |
| Label | `Mewra Blackbox — Approved E2E` |
| Severity | Workspace configurable: `error` or `warning` |
| Applies when | A configured scenario's changed-file selectors match PreFlight's diff. |
| Missing browser tooling | `not-configured` |
| Result detail | Scenario count, failed scenario count, redacted summary, and a command to open the Blackbox viewer. |

Later releases may register separate checks for visual regression and an explicitly requested full suite, but v0.1.0 should keep a single clear dashboard row.

## Diff-aware scenario selection

Each scenario can declare source path globs such as `src/checkout/**` or `apps/storefront/**`. Blackbox receives the PreFlight diff and selects only matching scenarios. If no configured scenario matches, it returns `skipped` with a clear reason.

The full suite is an explicit user action in Blackbox and must not be triggered merely because a diff exists.

## Result handoff

Blackbox maps each scenario result to PreFlight findings without embedding raw screenshots or traces. A finding includes the scenario ID, human label, affected route, safe message, and local evidence reference. The PreFlight dashboard opens the Blackbox viewer through a fixed registered command, not a user-provided command or URL.

## Versioning

Blackbox depends on the versioned public PreFlight extension API. If the host is absent or the API version is incompatible, Blackbox remains usable as a standalone result viewer but does not register a check. The status must clearly explain this state.
