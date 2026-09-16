# Privacy

Mewra Blackbox is a local-first extension. Screenshots can contain rendered page content. Use synthetic test data and approved masks; automatic detection of arbitrary sensitive pixels is not provided. Secret-bearing scenarios suppress screenshots. Native Playwright traces and raw console/network contents are not retained; action traces contain only step indices, action names, and status.

Artifacts remain in VS Code global storage outside the source tree, subject to age/count/size quotas. There is no telemetry or artifact-upload implementation. Optional MCP exposes approved metadata and redacted summaries only; its clients may send those summaries to their configured AI providers. Enable MCP only after considering that provider's policy. Approval records and named secrets use VS Code SecretStorage; browser contexts are temporary and closed after every run.

Workspace owners are responsible for selecting targets and test data that are appropriate for automated browser testing. Production targets and real customer data require an explicit privacy review.
