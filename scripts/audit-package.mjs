import { execFileSync } from 'node:child_process';
const entries = execFileSync('/usr/bin/unzip', ['-Z1', 'mewra-blackbox.vsix'], {
  encoding: 'utf8',
})
  .trim()
  .split('\n');
const forbidden = entries.filter((p) =>
  /(?:extension-smoke|\.map$|\.png$|\.zip$|\.trace$|\/\.env|\/tests?\/|\/profiles\/|\/artifacts\/|\/node_modules\/|\/\.agents\/)/i.test(
    p,
  ),
);
if (forbidden.length)
  throw new Error(`Forbidden VSIX contents: ${forbidden.join(', ')}`);
if (
  !entries.includes('extension/dist/extension.cjs') ||
  !entries.includes('extension/dist/vendor/playwright-core/index.js')
)
  throw new Error('Missing executable bundle');
console.log(`VSIX audit passed (${entries.length} entries).`);
