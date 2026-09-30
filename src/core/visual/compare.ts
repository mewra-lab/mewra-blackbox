import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { z } from 'zod';
import { digest, type Scenario, type Viewport } from '../config/schema';
import type { ArtifactStore } from '../results/artifacts';
export function baselineKey(
  scenario: Scenario,
  viewport: Viewport,
  origin: string,
) {
  return digest({ version: 1, scenario, viewport, origin });
}
function decode(bytes: Buffer) {
  if (
    bytes.length < 24 ||
    bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
    bytes.readUInt32BE(16) > 2560 ||
    bytes.readUInt32BE(20) > 1440
  )
    throw new Error('Image dimensions exceed limits.');
  return PNG.sync.read(bytes);
}
export function compare(
  actual: Buffer,
  baseline: Buffer,
  pixelThreshold: number,
) {
  const a = decode(actual),
    b = decode(baseline);
  if (a.width !== b.width || a.height !== b.height)
    throw new Error('Baseline dimensions differ; human review required.');
  const diff = new PNG({ width: a.width, height: a.height });
  const pixels = pixelmatch(a.data, b.data, diff.data, a.width, a.height, {
    threshold: pixelThreshold,
  });
  return { ratio: pixels / (a.width * a.height), diff: PNG.sync.write(diff) };
}
const metadata = z
  .object({
    version: z.literal(1),
    key: z.string().regex(/^[a-f0-9]{64}$/),
    image: z
      .string()
      .uuid()
      .transform((s) => s + '.png'),
    sha256: z.string(),
    approvedAt: z.string().datetime(),
  })
  .strict();
export async function readBaseline(store: ArtifactStore, key: string) {
  try {
    const meta = metadata.parse(
      JSON.parse((await store.read(`baseline-${key}.json`)).toString()),
    );
    if (meta.key !== key) throw new Error();
    const bytes = await store.read(meta.image);
    if (digest(bytes.toString('base64')) !== meta.sha256) throw new Error();
    return { image: meta.image, bytes };
  } catch {
    return undefined;
  }
}
// Called only by the extension's explicit review/confirmation flow, never by MCP or runner.
export async function saveBaseline(
  store: ArtifactStore,
  key: string,
  actual: string,
) {
  if (!/^[a-f0-9]{64}$/.test(key)) throw new Error('Invalid baseline key.');
  const bytes = await store.read(actual);
  decode(bytes);
  const image = await store.write(bytes, 'png');
  const data = {
    version: 1,
    key,
    image: image.replace(/\.png$/, ''),
    sha256: digest(bytes.toString('base64')),
    approvedAt: new Date().toISOString(),
  };
  await store.remove(`baseline-${key}.json`);
  await store.write(
    Buffer.from(JSON.stringify(data)),
    'json',
    `baseline-${key}.json`,
  );
}
