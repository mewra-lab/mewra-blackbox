import { it, expect, vi } from 'vitest';
vi.mock('playwright-core', () => ({
  chromium: { executablePath: () => '/missing-blackbox-browser/binary' },
}));
import { runScenario } from '../../src/core/browser/runner';
import { ArtifactStore } from '../../src/core/results/artifacts';
import { configuration } from '../helpers';
it('reports missing browser binaries as not-configured without requesting secrets', async () => {
  const c = configuration(),
    secret = vi.fn();
  const result = await runScenario({
    config: c,
    scenario: c.scenarios[0],
    viewport: c.scenarios[0].viewports[0],
    store: new ArtifactStore('/unused', '/workspace', c.retention),
    getSecret: secret,
  });
  expect(result.status).toBe('not-configured');
  expect(secret).not.toHaveBeenCalled();
});
