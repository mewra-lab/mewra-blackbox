import { it, expect, vi } from 'vitest';
import { configuration } from '../helpers';
import {
  createCheck,
  normalize,
  registerWithHost,
} from '../../src/core/integration/preflight';
import { viewerMessage } from '../../src/shared/messages';
it('handles missing and incompatible PreFlight hosts', async () => {
  const check = createCheck(() => undefined, vi.fn());
  expect(
    (await registerWithHost(undefined, check)).registration,
  ).toBeUndefined();
  expect(
    (
      await registerWithHost(
        { activate: async () => ({ apiVersion: 2 }) },
        check,
      )
    ).message,
  ).toContain('incompatible');
  const dispose = vi.fn(),
    registerCheck = vi.fn(() => ({ dispose }));
  const result = await registerWithHost(
    { activate: async () => ({ apiVersion: 1, registerCheck }) },
    check,
  );
  expect(registerCheck).toHaveBeenCalledWith(check);
  result.registration!.dispose();
  expect(dispose).toHaveBeenCalled();
});
it('returns not-configured/skipped and maps renamed source paths', async () => {
  const run = vi.fn(async () => ({
    status: 'pass' as const,
    message: 'Passed',
    results: [],
  }));
  const c = configuration(),
    check = createCheck(() => c, run);
  expect(
    (
      await check.run(
        { changedFiles: [{ path: 'README.md' }] },
        { workspaceRoot: '/workspace' },
      )
    ).status,
  ).toBe('skipped');
  expect(run).not.toHaveBeenCalled();
  await check.run(
    { changedFiles: [{ path: 'other/foo.ts', oldPath: 'src/foo.ts' }] },
    { workspaceRoot: '/workspace' },
  );
  expect(run).toHaveBeenCalledWith(['home'], '/workspace');
  expect(
    (
      await createCheck(() => undefined, run).run(
        { changedFiles: [] },
        { workspaceRoot: '/workspace' },
      )
    ).status,
  ).toBe('not-configured');
});
it('normalizes only compact findings', () => {
  expect(normalize({ status: 'fail', message: 'Failed', results: [] })).toEqual(
    { status: 'fail', message: 'Failed', findings: [] },
  );
});
it('denies webview arbitrary commands, paths and baseline changes without known IDs', () => {
  for (const m of [
    { type: 'open', path: '/etc/passwd' },
    { type: 'run', scenarioId: 'home', url: 'https://evil.test' },
    {
      type: 'baseline',
      scenarioId: 'home',
      viewport: 'desktop',
      approve: true,
    },
    { type: 'execute', script: 'bad' },
  ])
    expect(viewerMessage.safeParse(m).success).toBe(false);
  expect(
    viewerMessage.safeParse({ type: 'run', scenarioId: 'home' }).success,
  ).toBe(true);
});
