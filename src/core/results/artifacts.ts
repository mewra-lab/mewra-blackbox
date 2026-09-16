import { constants } from 'node:fs';
import {
  chmod,
  lstat,
  mkdir,
  open,
  readdir,
  realpath,
  unlink,
} from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Config } from '../config/schema';
export function redact(text: string, secrets: string[]): string {
  let result = text;
  for (const secret of secrets
    .filter(Boolean)
    .sort((a, b) => b.length - a.length))
    for (const variant of [
      secret,
      encodeURIComponent(secret),
      Buffer.from(secret).toString('base64'),
    ])
      result = result.split(variant).join('[REDACTED]');
  return result
    .replace(
      /\b(authorization|cookie|set-cookie|password|token)\s*[:=]\s*[^\r\n]*/gi,
      '$1: [REDACTED]',
    )
    .slice(0, 4096);
}
export function inside(root: string, path: string) {
  const rel = relative(root, path);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}
export class ArtifactStore {
  constructor(
    readonly root: string,
    private readonly workspace: string,
    private readonly limits: Config['retention'],
  ) {}
  async init() {
    const root = resolve(this.root),
      workspace = await realpath(this.workspace);
    if (root === workspace || inside(workspace, root))
      throw new Error('Evidence root must be outside the source tree.');
    await mkdir(root, { recursive: true, mode: 0o700 });
    // Reject symlinks in the managed leaf, and ensure resolved root remains outside workspace.
    if ((await lstat(root)).isSymbolicLink())
      throw new Error('Symlink artifact root denied.');
    const canonical = await realpath(root);
    if (canonical === workspace || inside(workspace, canonical))
      throw new Error('Evidence root resolves into workspace.');
    await chmod(root, 0o700);
  }
  private valid(name: string) {
    if (!/^(?:[a-f0-9-]{36}|baseline-[a-f0-9]{64})\.(?:png|json)$/.test(name))
      throw new Error('Invalid evidence reference.');
    return join(this.root, name);
  }
  private byteLimit(name: string) {
    return Math.min(
      this.limits.maxBytes,
      name.endsWith('.png') ? 16_000_000 : 256_000,
    );
  }
  async read(name: string): Promise<Buffer> {
    await this.init();
    const path = this.valid(name);
    const before = await lstat(path);
    if (before.isSymbolicLink() || !before.isFile())
      throw new Error('Invalid artifact.');
    const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const stat = await file.stat();
      if (
        !stat.isFile() ||
        stat.nlink !== 1 ||
        stat.ino !== before.ino ||
        stat.dev !== before.dev ||
        stat.size > this.byteLimit(name)
      )
        throw new Error('Invalid artifact.');
      return await file.readFile();
    } finally {
      await file.close();
    }
  }
  async exists(name: string) {
    try {
      await this.read(name);
      return true;
    } catch {
      return false;
    }
  }
  async write(
    bytes: Buffer,
    extension: 'png' | 'json',
    name = `${randomUUID()}.${extension}`,
  ) {
    await this.init();
    if (bytes.length > this.byteLimit(name))
      throw new Error('Evidence exceeds byte limit.');
    await this.prune(bytes.length);
    const file = await open(
      this.valid(name),
      constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_EXCL |
        constants.O_NOFOLLOW,
      0o600,
    );
    try {
      await file.writeFile(bytes);
    } finally {
      await file.close();
    }
    return name;
  }
  async remove(name: string) {
    await this.init();
    const path = this.valid(name);
    await unlink(path).catch((e) => {
      if (e.code !== 'ENOENT') throw e;
    });
  }
  async prune(incoming = 0) {
    const entries = [];
    for (const name of await readdir(this.root)) {
      let path: string;
      try {
        path = this.valid(name);
      } catch {
        continue;
      }
      const stat = await lstat(path);
      if (stat.isSymbolicLink() || !stat.isFile()) continue;
      entries.push({ name, size: stat.size, time: stat.mtimeMs });
    }
    entries.sort((a, b) => a.time - b.time);
    let bytes = entries.reduce((n, e) => n + e.size, 0),
      count = entries.length;
    for (const entry of entries) {
      if (
        Date.now() - entry.time > this.limits.maxAgeDays * 86400000 ||
        bytes + incoming > this.limits.maxBytes ||
        count >= (incoming ? this.limits.maxFiles : this.limits.maxFiles + 1)
      ) {
        await this.remove(entry.name);
        bytes -= entry.size;
        count--;
      }
    }
  }
}
