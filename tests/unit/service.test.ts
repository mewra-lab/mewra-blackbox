import { afterEach, beforeEach, it, expect, vi } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { configuration } from '../helpers';
import { digest } from '../../src/core/config/schema';
const mock = vi.hoisted(() => ({
  workspace: { isTrusted: true, workspaceFolders: [] as any[] },
  confirm: vi.fn(),
  runner: vi.fn(),
}));
vi.mock('vscode', () => ({
  workspace: {
    get isTrusted() {
      return mock.workspace.isTrusted;
    },
    get workspaceFolders() {
      return mock.workspace.workspaceFolders;
    },
    openTextDocument: async (v: unknown) => v,
  },
  window: {
    showTextDocument: async () => {},
    showWarningMessage: mock.confirm,
    withProgress: async (_opts: unknown, fn: any) =>
      fn(
        { report: () => {} },
        { onCancellationRequested: () => ({ dispose() {} }) },
      ),
  },
  ProgressLocation: { Notification: 1 },
}));
vi.mock('../../src/core/browser/runner', () => ({ runScenario: mock.runner }));
import { BlackboxService } from '../../src/extension/service';
let root: string,
  app: BlackboxService,
  secrets: Map<string, string>,
  context: any;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'blackbox-service-'));
  mock.workspace.isTrusted = true;
  mock.workspace.workspaceFolders = [{ uri: { fsPath: root } }];
  secrets = new Map();
  context = {
    globalStorageUri: { fsPath: root + '-storage' },
    secrets: {
      get: async (k: string) => secrets.get(k),
      store: async (k: string, v: string) => {
        secrets.set(k, v);
      },
    },
  };
  app = new BlackboxService(context, { appendLine: vi.fn() } as any);
  await writeFile(
    join(root, '.mewra-blackbox.json'),
    JSON.stringify(configuration()),
  );
  mock.confirm.mockReset();
  mock.runner.mockReset();
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
  await rm(root + '-storage', { recursive: true, force: true });
});
it('does not approve a file without explicit native confirmation', async () => {
  await app.approve();
  expect(await app.refresh()).toBeUndefined();
  expect(secrets.size).toBe(0);
});
it('rejects approval if content changes while the owner reviews it', async () => {
  mock.confirm.mockImplementation(async () => {
    const c = configuration();
    c.scenarios[0].label = 'Changed';
    await writeFile(join(root, '.mewra-blackbox.json'), JSON.stringify(c));
    return 'Approve reviewed configuration';
  });
  await expect(app.approve()).rejects.toThrow('changed');
  expect(secrets.size).toBe(0);
});
it('requires exact approval and rejects stale/untrusted configuration', async () => {
  mock.confirm.mockResolvedValue('Approve reviewed configuration');
  await app.approve();
  expect(await app.refresh()).toBeDefined();
  const c = configuration();
  c.targets[0].origin = 'https://changed.test';
  await writeFile(join(root, '.mewra-blackbox.json'), JSON.stringify(c));
  expect((await app.run(['home'])).status).toBe('not-configured');
  expect(mock.runner).not.toHaveBeenCalled();
  mock.workspace.isTrusted = false;
  expect(await app.refresh()).toBeUndefined();
});
it('serializes runs before the first asynchronous approval read', async () => {
  secrets.set(`approval:${digest(root)}`, digest(configuration()));
  let finish: () => void = () => {};
  mock.runner.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = () =>
          resolve({
            scenarioId: 'home',
            label: 'Home',
            targetLabel: 'App',
            routeLabel: '/',
            viewport: 'desktop',
            width: 800,
            height: 600,
            status: 'pass',
            message: 'Passed',
            durationMs: 1,
            evidence: {},
          });
      }),
  );
  const first = app.run(['home']);
  const second = await app.run(['home']);
  expect(second.message).toContain('already active');
  await vi.waitFor(() => expect(mock.runner).toHaveBeenCalledOnce());
  finish();
  expect((await first).status).toBe('pass');
});
