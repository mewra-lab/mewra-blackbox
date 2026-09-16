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

## Host contract and result actions

The base contract is `mewra-lab/mewra-preflight` revision `6ee6c0821c7c0526f6cd4d032feb0802389caaae`: `apiVersion: 1`, `registerCheck(CheckRunner)`, and the published `CheckResult` fields. The companion registers both `setupCommand` and the additive `resultCommand` as the fixed command `mewra-blackbox.results`. It never treats target, agent, or finding metadata as executable commands.

The companion [PreFlight PR #13](https://github.com/mewra-lab/mewra-preflight/pull/13) adds generic result actions and advertises `capabilities.resultActions: true`. With that host, completed check rows show **Open results** across pass/warning/fail/not-configured/skipped states (expand the skipped section for skipped checks). The webview sends only the check ID; the host checks current enablement/registration against its snapshot and executes the fixed command without arguments. Browser automation and rich evidence remain wholly inside Blackbox.

Older API v1 hosts still register/run Blackbox checks, but only show their setup action for `not-configured`. The extension output explicitly identifies this compatibility fallback: use **Blackbox: Open Results** in the Command Palette. The companion host PR must be merged and installed to obtain the row button requested in #6.

## Versioning

Blackbox depends on the versioned public PreFlight extension API. If the host is absent or the API version is incompatible, Blackbox remains usable as a standalone result viewer but does not register a check. The status must clearly explain this state.
