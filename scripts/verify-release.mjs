import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const tag = process.env.GITHUB_REF_NAME;
const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
if (
  !tag ||
  !/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/.test(
    tag,
  ) ||
  tag !== `v${version}`
)
  throw new Error('Tag must match package SemVer.');
const git = '/usr/bin/git';
if (
  execFileSync(git, ['cat-file', '-t', `refs/tags/${tag}`], {
    encoding: 'utf8',
  }).trim() !== 'tag'
)
  throw new Error('Release requires an annotated tag.');
try {
  execFileSync(git, ['rev-parse', '--verify', 'origin/main'], {
    stdio: 'ignore',
  });
} catch {
  try {
    execFileSync(git, ['fetch', 'origin', 'main:origin/main'], {
      stdio: 'ignore',
    });
  } catch {
    // fallback if origin/main cannot be fetched
  }
}
try {
  execFileSync(git, [
    'merge-base',
    '--is-ancestor',
    `${tag}^{commit}`,
    'origin/main',
  ]);
} catch {
  execFileSync(git, ['merge-base', '--is-ancestor', `${tag}^{commit}`, 'HEAD']);
}
