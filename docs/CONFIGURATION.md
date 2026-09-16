# Configuration v1

The runtime schema is `src/core/config/schema.ts`. VS Code completion uses the generated `schemas/blackbox.schema.json`; regenerate with `node scripts/schema.mjs` after schema changes, then format. Runtime validation additionally checks references, unique IDs, canonical origins/paths, assertions, and visual/secret compatibility.

There is no implicit migration: unknown versions and unknown fields are rejected. Approval covers the complete normalized configuration and is stored in workspace-scoped SecretStorage, outside Git. File changes cancel active work and require another review when their normalized digest changes. Multi-root and untrusted workspaces cannot run scenarios.

## Target policy

Each target declares `id`, `label`, `environment`, and a canonical `origin` containing scheme, hostname, and optional port, without a trailing slash. Public targets require HTTPS. `allowLoopback`, `allowPrivateNetwork`, and `allowCustomPort` are separate opt-ins. Link-local/metadata, multicast, unspecified, reserved, and transition addresses remain denied even with opt-ins. Every resolved address must be allowed; the proxy pins the validated IP, preventing DNS rebinding between policy validation and connection.

Only the scenario's target origin can receive requests. Navigation also requires an exact route from `routes`; queries, credentials, traversal, and ambiguous encodings are rejected. Redirects remain subject to policy. All browser contexts are nonpersistent; browser launch options cannot come from configuration.

## Actions and selectors

| Action       | Fields               | Behavior                                                  |
| ------------ | -------------------- | --------------------------------------------------------- |
| `navigate`   | `route`              | Navigate to an approved path; wait for DOM content loaded |
| `click`      | `selector`           | Click a matching element                                  |
| `fill`       | `selector`, `value`  | Fill synthetic, nonsecret test data                       |
| `fillSecret` | `selector`, `secret` | Resolve a named SecretStorage handle                      |
| `select`     | `selector`, `value`  | Select an option by value                                 |
| `url`        | `route`              | Assert exact origin and path without query                |
| `visible`    | `selector`           | Wait for visible element                                  |
| `text`       | `selector`, `text`   | Assert exact text content                                 |
| `count`      | `selector`, `count`  | Assert number of matching elements                        |

Selectors are `{ "by": "role", "role": "button", "name": "Save" }`, `{ "by": "label", "value": "Name" }`, or `{ "by": "testId", "value": "result" }`. Matching is exact. Arbitrary CSS/XPath, JavaScript, shell commands, launch flags, headers, and raw secret fields are not supported.

Scenarios must start with navigation and include at least one assertion. Viewports have unique names and bounded dimensions; all approved viewports run for a selected scenario. `changedFiles` globs select relevant journeys from current and old paths in a PreFlight diff. No matches produce `skipped`. Only the explicit full-suite command runs every scenario.

## Evidence, visuals and bounds

`evidence.screenshot` is `off`, `failure`, or `always`. `traceOnFailure` records only action names, indices, and status, never raw browser traces. `masks` uses the same selector schema, must match one visible region each, may cover at most 25% of the viewport, and cannot wholly cover an asserted element. Inputs, textareas, and editable content are always masked. Any scenario using a secret suppresses all images, including after an assertion failure.

`visual` requires screenshots `always` and no secret actions. `maxDiffRatio` is bounded to 0–0.1 and `pixelThreshold` to 0–0.5. Baseline identity includes the target, complete scenario, viewport, masks, thresholds, and format version. A missing baseline gives `warning`, not an implicit visual pass. The human sees before/after evidence and confirms each update. An assertion failure remains a failure even if an image matches.

Timeout defaults: action 5 s, navigation 15 s, screenshot 5 s, total viewport run 60 s. Maxima are 30/60/15/180 s respectively. DNS resolution is bounded to 5 s (or the shorter run budget). Suites stop after 10 minutes. Cancellation closes the isolated context and browser. No unbounded network-idle wait is used.

Evidence is under VS Code global storage, separated by workspace identity. Default quotas are 100 files, 50 MB, seven days; old files including baselines are pruned on refresh/write. Evidence references are opaque generated filenames. Reads reject traversal, symlinks, hard links, oversized files, and paths outside the managed store.

## MCP

Enable `mcp.enabled` after reviewing capabilities. `mcp.allowRuns` allows only existing approved scenario IDs; `mcp.allowProposals` enables a bounded non-executable proposal queue. The native VS Code MCP provider discovers the authenticated loopback HTTP server. Other MCP clients must use an explicitly authorized connection to that server; no credentials or configuration are automatically written into provider-specific files.

Tools: `list_scenarios`, `read_results`, `run_scenario`, `propose_scenario`. Extra arguments are rejected. No tool exposes raw artifacts, origin mutation, secrets, browser evaluation, baseline approval, or release overrides. Proposals may reference an existing target but must still be copied into the configuration by the owner, validated, and explicitly approved. Audit output includes tool names and safe IDs only.
