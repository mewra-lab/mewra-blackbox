import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { zodToJsonSchema } from 'zod-to-json-schema';
const bundled = await build({
  entryPoints: ['src/core/config/schema.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  write: false,
});
const module = { exports: {} };
new Function('module', 'exports', 'require', bundled.outputFiles[0].text)(
  module,
  module.exports,
  createRequire(import.meta.url),
);
await mkdir('schemas', { recursive: true });
await writeFile(
  'schemas/blackbox.schema.json',
  JSON.stringify(
    zodToJsonSchema(module.exports.configSchema, { name: 'BlackboxConfig' }),
    null,
    2,
  ) + '\n',
);
