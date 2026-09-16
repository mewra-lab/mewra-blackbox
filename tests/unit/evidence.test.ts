import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import {
  mkdtemp,
  mkdir,
  rm,
  symlink,
  writeFile,
  utimes,
  readdir,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { ArtifactStore, redact } from '../../src/core/results/artifacts';
import {
  baselineKey,
  compare,
  readBaseline,
  saveBaseline,
} from '../../src/core/visual/compare';
import { configuration } from '../helpers';
let root: string, workspace: string, store: ArtifactStore;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'blackbox-test-'));
  workspace = join(root, 'workspace');
  await mkdir(workspace);
  store = new ArtifactStore(
    join(root, 'evidence'),
    workspace,
    configuration().retention,
  );
  await store.init();
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});
function png(color: number) {
  const p = new PNG({ width: 10, height: 10 });
  p.data.fill(color);
  return PNG.sync.write(p);
}
describe('managed evidence', () => {
  it('stores only managed file references and rejects traversal', async () => {
    const name = await store.write(Buffer.from('{}'), 'json');
    expect((await store.read(name)).toString()).toBe('{}');
    for (const path of [
      '../secret',
      '/etc/passwd',
      'file:///tmp/x',
      'https://evil.test',
    ])
      await expect(store.read(path)).rejects.toThrow();
  });
  it('refuses workspace roots and symlinks', async () => {
    await expect(
      new ArtifactStore(
        join(workspace, 'evidence'),
        workspace,
        configuration().retention,
      ).init(),
    ).rejects.toThrow();
    const name = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.json';
    await writeFile(join(root, 'secret'), 'sensitive');
    await symlink(join(root, 'secret'), join(store.root, name));
    await expect(store.read(name)).rejects.toThrow();
  });
  it('prunes old artifacts and enforces per-file byte limits', async () => {
    const name = await store.write(Buffer.from('{}'), 'json');
    await utimes(join(store.root, name), new Date(0), new Date(0));
    await store.prune();
    expect(await store.exists(name)).toBe(false);
    await expect(
      new ArtifactStore(store.root, workspace, {
        maxFiles: 10,
        maxBytes: 1024,
        maxAgeDays: 1,
      }).write(Buffer.alloc(1025), 'png'),
    ).rejects.toThrow();
  });
  it('redacts synthetic secrets, encodings and sensitive headers', () => {
    const secret = 'synthetic secret';
    const value = redact(
      `${secret} ${encodeURIComponent(secret)} ${Buffer.from(secret).toString('base64')}\nAuthorization: Bearer abc\nCookie: id=abc`,
      [secret],
    );
    expect(value).not.toContain(secret);
    expect(value).not.toContain('abc');
  });
});
describe('visual decisions', () => {
  it('is deterministic and never auto-creates baseline metadata', async () => {
    expect(compare(png(255), png(255), 0.1).ratio).toBe(0);
    expect(compare(png(0), png(255), 0.1).ratio).toBeGreaterThan(0);
    expect(await readdir(store.root)).toEqual([]);
  });
  it('requires explicit baseline save and binds to scenario, viewport and target', async () => {
    const c = configuration(),
      s = c.scenarios[0],
      v = s.viewports[0],
      key = baselineKey(s, v, c.targets[0].origin);
    expect(await readBaseline(store, key)).toBeUndefined();
    const actual = await store.write(png(255), 'png');
    await saveBaseline(store, key, actual);
    expect((await readBaseline(store, key))?.bytes).toEqual(png(255));
    expect(baselineKey(s, { ...v, width: 900 }, c.targets[0].origin)).not.toBe(
      key,
    );
  });
  it('rejects corrupt/oversized PNG headers', () => {
    expect(() => compare(Buffer.alloc(30), png(255), 0.1)).toThrow();
  });
});
