# Mewra Blackbox

Mewra Blackbox is an open-source VS Code companion extension for approved, repeatable browser-based testing. It runs declarative Chromium scenarios, captures local screenshot evidence and redacted action traces, compares human-approved visual baselines, and contributes a compact check to Mewra PreFlight API v1.

It is not a vulnerability scanner, autonomous browser bot, production load tester, or a replacement for server-side CI.

## Intended workflow

1. A workspace owner defines approved targets, routes, viewports, assertions, and evidence-retention rules.
2. An AI coding agent may propose or update a test plan, but the human reviews it before it becomes executable.
3. Blackbox runs deterministic browser scenarios using the approved plan.
4. The companion result viewer shows baseline, actual, visual diff, trace, and bounded failure detail.
5. Mewra PreFlight receives the aggregate `pass`, `warning`, `fail`, or `not-configured` result before PR/MR creation.

## Product principles

- **Human-approved targets** — no arbitrary URL submitted by an agent, chat message, or webview can start a browser run.
- **Deterministic execution** — Playwright scenarios and assertion rules are versioned; AI is not the unbounded runtime executor.
- **Evidence with privacy** — screenshot, trace, and console evidence is redacted, retention-bounded, and never uploaded without explicit configuration.
- **Companion boundary** — Blackbox owns browser automation and rich results; PreFlight owns only the contributed check summary and PR/MR gate.
- **Local-first by default** — runs locally against developer-approved environments. Cloud orchestration is out of scope for v1.

## Status

The initial implementation covers controlled E2E, local visual baselines, a result viewer, and bounded MCP assistance. It is pre-release software; no Marketplace publication or release approval is implied by a passing check.

## Get started

1. Install the VSIX and open one trusted, local workspace.
2. Copy `.mewra-blackbox.json.example` to `.mewra-blackbox.json` and edit the target, routes, selectors, and changed-file patterns for your application. Keep literal test values synthetic; use `fillSecret` for credentials.
3. Run **Blackbox: Review and Approve Configuration**. Review the complete normalized configuration in the editor before confirming. Any semantic change invalidates the approval stored in SecretStorage.
4. Run **Blackbox: Install Chromium** to download the browser pinned to this extension. Missing tooling returns `not-configured`.
5. Run **Blackbox: Run Approved Scenario** or explicitly request the full suite. Open **Blackbox: Open Results** for screenshots and redacted failure details.
6. For visual checks, inspect the actual image and choose **Review baseline…**. Confirm in VS Code; subsequent runs compare against that baseline. Baselines never update automatically.

For named secrets, add a `fillSecret` step referencing a handle, approve the configuration, then use **Blackbox: Set Named Secret**. Secret-bearing scenarios do not capture screenshots or support visual comparisons.

## Development

Use Node 20.19+ or Node 22.12+ and pnpm 10.17.1 (the version in `packageManager`).

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm validate
pnpm exec playwright-core install chromium
pnpm test:browser
pnpm test:extension
pnpm package
```

Press F5 to launch the extension development host. CI additionally checks skill integrity, browser security regressions, extension activation, and packaged contents. See [testing](docs/TESTING.md) and [configuration](docs/CONFIGURATION.md).

## Current limits

- Chromium only; one trusted filesystem workspace. Exact navigation paths have no query strings; resources stay on the selected target origin. Cross-origin CDNs, frame navigations, popups, downloads, service workers, and WebSockets are blocked.
- Trace evidence is a redacted action log, not a native Playwright trace archive. Raw DOM, request bodies/headers, cookies, and console text are not recorded.
- Screenshots require approved test data and masks. All inputs are masked; secret-bearing scenarios suppress images altogether. Blackbox does not claim to detect arbitrary personal data in rendered pixels.
- Baselines live outside Git and share the configured retention quota. Expired or changed-config baselines require new human review.
- PreFlight API v1 receives normalized results. Hosts advertising `capabilities.resultActions` show **Open results** on completed check rows; older hosts use the Blackbox Command Palette entry. Install the companion PreFlight result-action update for the row button (see [integration](docs/INTEGRATION.md)).
- MCP is disabled by default. Enable its individual capabilities in approved configuration. Agent proposals remain in a bounded in-memory review queue and do not modify executable configuration.

## Documentation

- [Product specification](SPEC.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Security model](docs/SECURITY-MODEL.md)
- [PreFlight integration](docs/INTEGRATION.md)
- [UX](docs/UX.md)
- [Testing strategy](docs/TESTING.md)
- [Roadmap](docs/ROADMAP.md)
- [Contributing](CONTRIBUTING.md)

## License

MIT. See [LICENSE](LICENSE).
