# Testing Strategy

## Executable checks

- `pnpm validate`: formatting, strict TypeScript, unit/security tests, extension/webview build.
- `pnpm test:browser`: opt-in real Chromium fixtures. Install with `pnpm exec playwright-core install chromium` first; CI uses `--with-deps` on Ubuntu.
- `pnpm test:extension`: isolated VS Code 1.102 extension host, activation without PreFlight, command registration, and viewer opening. Linux requires `xvfb-run -a`.
- `pnpm skills:verify`: hash-check the seven pinned repository-local contributor skills.
- `pnpm package`: build the VSIX and inspect its archive for forbidden files. Tests, maps, profiles, traces, screenshots, and secrets must not ship.

Unit tests run without Chromium and cover configuration/approval, origin and IP policy, artifact paths and retention, redaction, deterministic image comparison, PreFlight API negotiation, message validation, MCP argument/capability denial, and authenticated transport. Browser tests use synthetic pages served on explicitly permitted loopback ports. No test credentials or customer screenshots are needed. Fixtures fix document data, use local system fonts, avoid external dependencies, and use no changing clock content. Browser test runs clean their temporary directories and server sockets.

The VS Code host smoke test supplements mocked contract tests; it does not assert an always-visible PreFlight row action, which is unavailable in the current host API/UI. See INTEGRATION.md.

CI pins Ubuntu 22.04 so downloaded Chromium can use its Linux sandbox without changing the runner's security policy. Ubuntu 24.04+ may require an administrator-managed AppArmor profile for the downloaded browser's user namespaces; see [Chromium's guidance](https://chromium.googlesource.com/chromium/src/+/main/docs/security/apparmor-userns-restrictions.md). Blackbox does not automatically disable that sandbox. Browser fixtures perform a launch probe before any negative tests, so an unavailable sandbox cannot falsely satisfy a policy-denial test.

## Test layers

| Layer                 | Focus                                                                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unit                  | Target-policy matching, configuration schema validation, scenario selection, redaction, threshold evaluation, result normalization.              |
| Integration           | Isolated browser execution against local controlled fixtures, redirects, blocked origins, secret handles, timeouts, and artifact cleanup.        |
| Visual fixtures       | Stable local pages with deterministic fonts, clocks, network responses, and approved masks.                                                      |
| Extension integration | PreFlight API version negotiation, contributed check registration, result handoff, and viewer commands.                                          |
| Security regression   | Private-network denial, redirect policy, credential redaction, path traversal prevention, agent capability denial, and baseline approval checks. |

## Required fixtures

- A static happy-path page.
- A login-like page using synthetic test credentials only.
- A responsive page with desktop and mobile layouts.
- An intentional visual regression page.
- A redirect to an unapproved origin.
- A slow page that exercises timeout behavior.
- A page containing synthetic strings that verify screenshot, trace, console, and result redaction.

## Acceptance checks for the first implementation

- A scenario cannot navigate to an origin outside its approved policy.
- An agent cannot execute a target URL, browser evaluation, shell command, or baseline approval outside the declared tool contract.
- Each run gets a new browser context and cleanup is verified.
- A missing tool produces `not-configured` and does not mark PreFlight failed.
- A visual diff result exposes enough redacted evidence to reproduce the decision.
- A changed-file selector chooses only scenarios related to the PreFlight diff.
- All artifact paths are confined to the managed artifact root.
