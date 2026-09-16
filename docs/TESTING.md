# Testing Strategy

## Test layers

| Layer | Focus |
| --- | --- |
| Unit | Target-policy matching, configuration schema validation, scenario selection, redaction, threshold evaluation, result normalization. |
| Integration | Isolated browser execution against local controlled fixtures, redirects, blocked origins, secret handles, timeouts, and artifact cleanup. |
| Visual fixtures | Stable local pages with deterministic fonts, clocks, network responses, and approved masks. |
| Extension integration | PreFlight API version negotiation, contributed check registration, result handoff, and viewer commands. |
| Security regression | Private-network denial, redirect policy, credential redaction, path traversal prevention, agent capability denial, and baseline approval checks. |

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
