# Security Policy

## Supported versions

No executable version has been released yet.

## Reporting a vulnerability

Do not open a public issue for a vulnerability involving target policy bypass, credential exposure, browser isolation, screenshot or trace leakage, unsafe agent actions, or PreFlight gate bypass.

Contact the Mewra maintainers privately with a minimal reproduction, impact, affected version or commit, and any safe mitigation. Do not include real credentials, production data, session cookies, or sensitive screenshots.

## Security commitments

The future implementation will prioritize explicit target authorization, isolated browser contexts, secret-safe authentication, bounded artifact retention, deterministic scenario execution, and restrictive agent capabilities. Details are maintained in [docs/SECURITY-MODEL.md](docs/SECURITY-MODEL.md).
