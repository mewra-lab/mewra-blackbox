import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
const lock = JSON.parse(await readFile('skills-lock.json', 'utf8'));
for (const [name, entry] of Object.entries(lock.skills)) {
  const files = [];
  async function walk(dir) {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) await walk(p);
      else files.push(p);
    }
  }
  await walk(`.agents/skills/${name}`);
  const hash = createHash('sha256');
  for (const file of files.sort()) {
    hash.update(file.replace(`.agents/skills/${name}/`, ''));
    hash.update(await readFile(file));
  }
  if (hash.digest('hex') !== entry.computedHash)
    throw new Error(`Skill integrity mismatch: ${name}`);
}
console.log('All seven contributor skills match the pinned source snapshot.');
