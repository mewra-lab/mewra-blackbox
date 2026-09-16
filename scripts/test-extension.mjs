import { runTests } from '@vscode/test-electron';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
await build({
  entryPoints: ['tests/extension/smoke.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['vscode'],
  outfile: 'dist/extension-smoke.cjs',
});
const workspace = await mkdtemp(join(tmpdir(), 'blackbox-extension-'));
try {
  await runTests({
    version: '1.102.0',
    extensionDevelopmentPath: resolve('.'),
    extensionTestsPath: resolve('dist/extension-smoke.cjs'),
    launchArgs: [
      workspace,
      '--disable-extensions',
      '--skip-welcome',
      '--skip-release-notes',
      '--disable-workspace-trust',
      ...(process.platform === 'linux' ? ['--no-sandbox'] : []),
    ],
  });
} finally {
  await rm(workspace, { recursive: true, force: true });
}
