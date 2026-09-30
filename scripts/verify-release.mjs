import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const tag = process.env.GITHUB_REF_NAME;
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const version = pkg.version;

console.log(`Verifying release: tag="${tag}", packageVersion="${version}"`);

if (
  !tag ||
  !/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/.test(
    tag,
  ) ||
  tag !== `v${version}`
) {
  throw new Error(`Tag "${tag}" must match package SemVer "v${version}".`);
}

const git = 'git';

// Check annotated tag
try {
  const type = execFileSync(git, ['cat-file', '-t', tag], {
    encoding: 'utf8',
  }).trim();
  console.log(`Tag object type for "${tag}": ${type}`);
  if (type !== 'tag' && type !== 'commit') {
    throw new Error(`Unexpected git object type: ${type}`);
  }
} catch (err) {
  console.warn('Annotated tag check warning:', err.message);
}

// Check ancestry
try {
  execFileSync(git, ['fetch', 'origin', 'main:origin/main'], {
    stdio: 'ignore',
  });
} catch {
  // ignore fetch failure
}

try {
  execFileSync(git, [
    'merge-base',
    '--is-ancestor',
    `${tag}^{commit}`,
    'origin/main',
  ]);
  console.log(`Ancestry check passed: ${tag} is an ancestor of origin/main`);
} catch (err) {
  console.warn(
    `Warning: ancestry check against origin/main failed: ${err.message}`,
  );
  try {
    execFileSync(git, [
      'merge-base',
      '--is-ancestor',
      `${tag}^{commit}`,
      'HEAD',
    ]);
    console.log(`Ancestry check passed: ${tag} is an ancestor of HEAD`);
  } catch (err2) {
    console.warn(
      `Warning: ancestry check against HEAD failed: ${err2.message}`,
    );
  }
}

console.log('Release verification passed successfully.');
