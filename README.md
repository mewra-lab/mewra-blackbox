# Mewra Blackbox

Mewra Blackbox is an open-source VS Code companion extension for safe, repeatable browser-based black-box testing. It will run approved E2E scenarios against configured web targets, capture screenshots and browser traces, compare visual baselines, and contribute a concise release gate to Mewra PreFlight.

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

This repository currently contains the product, security, architecture, UX, testing, integration, release, and contribution documents. No implementation or executable test runner has been created yet.

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
