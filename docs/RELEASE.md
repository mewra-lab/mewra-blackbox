# Release Policy

## Versioning

Use semantic versioning. The initial documentation-only foundation is unreleased; implementation starts at `0.1.0`.

| Version | Scope |
| --- | --- |
| `0.1.0` | Controlled local E2E runner and PreFlight summary. |
| `0.2.0` | Human-approved visual regression workflow. |
| `0.3.0` | Narrow provider-neutral agent assistance. |
| `1.0.0` | Stable public configuration and companion contract. |

## Release gates

Before a release:

- Verify unit, integration, extension, visual-fixture, and security regression tests.
- Verify the packaged extension contains no secrets, test artifacts, browser profiles, or unintended binaries.
- Test a clean install with PreFlight both present and absent.
- Verify target-policy denial, browser cleanup, artifact redaction, and baseline approval rules.
- Publish a changelog that identifies target-policy, privacy, and agent-capability changes.

## Artifact policy

Release artifacts may include the VSIX and checksum. They must never contain run screenshots, traces, browser cache, Playwright browser downloads, fixtures with private data, or credentials.
