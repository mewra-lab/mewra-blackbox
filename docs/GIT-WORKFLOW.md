# Git Workflow

## Main branch policy

`main` remains buildable, documented, and releasable. New work uses a focused branch and a pull request. Merge with squash after CI and review pass.

## Branch names

| Prefix | Example |
| --- | --- |
| `docs/` | `docs/initial-threat-model` |
| `feat/` | `feat/playwright-runner` |
| `security/` | `security/target-origin-policy` |
| `test/` | `test/browser-isolation-fixtures` |
| `fix/` | `fix/artifact-path-validation` |
| `ci/` | `ci/add-extension-validation` |

## Commits

Use Conventional Commits, for example:

```text
docs: define black-box security model
feat(browser): add approved scenario runner
security(targets): deny private network redirects
```

## Pull request checklist

- State whether target policy, credentials, evidence, agent capability, browser isolation, or PreFlight behavior changed.
- Include tests for every security-sensitive path.
- Do not attach real customer data, credentials, cookies, unredacted traces, or sensitive screenshots.
- Keep implementation and documentation aligned.
