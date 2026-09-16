import { build } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
const require = createRequire(import.meta.url);
// Fixed generated output only; never a workspace/config-provided path.
await rm('dist/vendor/playwright-core', { recursive: true, force: true });
await rm('dist/extension-smoke.cjs', { force: true });
await mkdir('dist', { recursive: true });
await build({
  entryPoints: ['src/extension/extension.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  external: ['vscode', 'playwright-core'],
  outfile: 'dist/extension.cjs',
  plugins: [
    {
      name: 'bundled-browser-library',
      setup(b) {
        b.onResolve({ filter: /^playwright-core$/ }, () => ({
          path: './vendor/playwright-core/index.mjs',
          external: true,
        }));
      },
    },
  ],
});
await cp(
  dirname(require.resolve('playwright-core/package.json')),
  'dist/vendor/playwright-core',
  {
    recursive: true,
    filter: (p) =>
      !p.endsWith('.map') &&
      !p.endsWith('/node_modules') &&
      !p.endsWith('.png'),
  },
);
await build({
  entryPoints: ['src/webview/main.ts'],
  bundle: true,
  platform: 'browser',
  outfile: 'dist/viewer.js',
});
await cp('src/webview/style.css', 'dist/viewer.css');
const browserModule = await import('../dist/vendor/playwright-core/index.mjs');
if (typeof browserModule.chromium?.executablePath !== 'function')
  throw new Error('Packaged Playwright ESM entry is invalid.');
