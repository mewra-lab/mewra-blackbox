# Security Model

## Assets to protect

- Developer, test, and production credentials.
- Session cookies, headers, storage, and browser profiles.
- Target availability and integrity.
- Page content rendered in screenshots, traces, console logs, and network metadata.
- The integrity of Mewra PreFlight's pass/fail gate.

## Trust boundaries

| Input or boundary | Treatment |
| --- | --- |
| Workspace configuration | Owner-controlled but schema-validated before any browser launch. |
| Agent proposal or MCP request | Untrusted until constrained to an existing approved scenario or a reviewable proposal. |
| Webview message | Untrusted; validate runtime messages and never turn it into an arbitrary browser action. |
| Target page | Untrusted remote content. It must not control host commands, configuration, or VS Code APIs. |
| Browser artifact | Potentially sensitive; keep local, path-validate, redact, and retention-bound. |

## Target policy

Every executable scenario must resolve to an origin explicitly allowed by workspace configuration. The policy is exact-origin based: scheme, hostname, and port are considered together.

- HTTPS is the default requirement for non-local targets.
- Loopback, RFC1918/private-network, link-local, and custom-scheme targets are denied unless the workspace owner separately opts in.
- Redirects, frames, popup windows, downloads, and network requests must remain within the effective policy or fail safely.
- The runner must not disable TLS verification or browser web security.

## Browser isolation

- Launch a fresh non-persistent browser context for every run.
- Never reuse the user's default browser profile.
- Clear cookies, storage, permissions, downloads, and temporary files when the run completes.
- Use fixed browser launch options; no scenario or agent may provide arbitrary launch flags.
- Bound every action, navigation, assertion, screenshot, trace, and total-run duration.

## Secrets and authentication

- Secret values live in VS Code SecretStorage or an OS secret provider, not scenario files, result objects, logs, screenshots, traces, or Git.
- Authentication actions may refer to named secret handles only.
- Result serialization must redact configured secret values and sensitive headers before rendering or exposing agent-readable data.
- The initial release should prefer test accounts and staging environments over production credentials.

## Evidence policy

- Artifacts are local by default and stored outside the source tree.
- Define maximum artifact count, byte size, and retention duration.
- Capture screenshot and trace evidence only when a scenario's policy permits it.
- Support deterministic masks for approved dynamic regions; masking must not conceal an entire asserted area.
- Baseline changes require explicit human confirmation and show the before/after evidence.

## Agent capabilities

| Capability | Agent access |
| --- | --- |
| Read redacted result summary | Allowed. |
| List approved scenarios | Allowed. |
| Request an existing approved scenario run | Allowed with bounded arguments. |
| Propose a declarative scenario | Allowed; owner approval required. |
| Set target origin, headers, credentials, or launch flags | Denied. |
| Inject page JavaScript or shell commands | Denied. |
| Read raw artifacts or SecretStorage | Denied. |
| Approve visual baseline or waive a failing result | Denied. |

## Failure behavior

Missing Playwright or browser binaries report `not-configured`. Configuration violations, target-policy violations, malformed evidence, browser crashes, and timeouts produce bounded `warning` or `fail` results with no sensitive raw data. A result can never report `pass` when the runner has not completed its declared assertions.
