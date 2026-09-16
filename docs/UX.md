# UX

## Primary surfaces

### 1. Scenario runner

The runner lets a developer select from approved scenarios and view the target label, environment classification, viewport, required secret handles, and evidence policy before a run begins. It does not offer a free-form URL box in the default flow.

### 2. Live run state

Show the current scenario, deterministic action name, elapsed time, and a clear cancel control. Do not show sensitive request headers, cookies, secret values, or unredacted page content in transient notifications.

### 3. Result viewer

The viewer follows the visual hierarchy shown in the supplied reference: compact run context at the top, followed by scenario cards. Each card shows status, viewport, route label, elapsed time, short assertion message, and evidence controls.

For a visual failure, the detail view presents:

- baseline screenshot;
- actual screenshot;
- visual diff overlay or split view;
- threshold and approved masks;
- redacted assertion and trace summary;
- an owner-only baseline review action.

### 4. PreFlight row

PreFlight shows only the aggregate state, scenario count, concise failure count, and an **Open Blackbox results** action. The rich gallery remains in the companion, preserving PreFlight's compact dashboard.

## States

| State | Meaning | User action |
| --- | --- | --- |
| `pass` | Every selected scenario passed. | Open evidence if desired. |
| `warning` | Non-blocking configured condition, unavailable optional evidence, or bounded execution issue. | Review the scenario result. |
| `fail` | An assertion, visual threshold, policy, or required scenario failed. | Open result details and fix or obtain human baseline approval. |
| `not-configured` | Required browser tooling or approved configuration is unavailable. | Install/setup through documented user-visible flow. |
| `skipped` | No scenario maps to the current diff. | Run an explicit full suite if needed. |

## Accessibility

- All scenario states use text and icons, not color alone.
- Screenshot comparisons include textual assertions and a keyboard-navigable comparison control.
- Result cards expose concise labels for screen readers.
- Long routes and messages wrap without hiding the failing scenario identity.
