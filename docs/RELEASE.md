# Release Policy

## Versioning

Use semantic versioning. The combined initial implementation is versioned `0.3.0` and remains unreleased until human review and the tag workflow. No implementation PR creates a release automatically.

| Version | Scope                                               |
| ------- | --------------------------------------------------- |
| `0.1.0` | Controlled local E2E runner and PreFlight summary.  |
| `0.2.0` | Human-approved visual regression workflow.          |
| `0.3.0` | Narrow provider-neutral agent assistance.           |
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

## Release procedure

After reviewed changes merge to `main`, set the intended package version and changelog, pass all checks, and create an annotated matching SemVer tag (`vX.Y.Z`). The tag-triggered workflow verifies version equality, annotation, and ancestry on `origin/main`; runs frozen installation, skill verification, validation, Chromium security fixtures and VS Code host tests; then audits the packaged VSIX and publishes it with `SHA256SUMS` to GitHub Releases. All Actions are pinned to commit SHAs. Marketplace publication is a separate human-owned operation.
