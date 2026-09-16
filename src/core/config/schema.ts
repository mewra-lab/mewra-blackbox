import { createHash } from 'node:crypto';
import { z } from 'zod';

export const id = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/);
const label = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[^\x00-\x1f\x7f]+$/);
export const route = z
  .string()
  .min(1)
  .max(512)
  .refine((s) => {
    if (!s.startsWith('/') || s.startsWith('//') || /[\\?#\s\x00-\x1f]/.test(s))
      return false;
    try {
      const u = new URL(s, 'https://route.invalid');
      return (
        u.origin === 'https://route.invalid' &&
        u.pathname === s &&
        !/%(?:2e|2f|5c|00)/i.test(s)
      );
    } catch {
      return false;
    }
  }, 'Use an exact absolute pathname without query, fragment, traversal, or escapes.');
export const selectorSchema = z.discriminatedUnion('by', [
  z
    .object({
      by: z.literal('role'),
      role: z.enum([
        'button',
        'link',
        'textbox',
        'heading',
        'checkbox',
        'combobox',
        'option',
        'alert',
        'status',
        'img',
      ]),
      name: label,
    })
    .strict(),
  z.object({ by: z.literal('label'), value: label }).strict(),
  z.object({ by: z.literal('testId'), value: id }).strict(),
]);
const selector = selectorSchema;
export const stepSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('navigate'), route }).strict(),
  z.object({ action: z.literal('click'), selector }).strict(),
  z
    .object({
      action: z.literal('fill'),
      selector,
      value: z.string().max(1024),
    })
    .strict(),
  z.object({ action: z.literal('fillSecret'), selector, secret: id }).strict(),
  z
    .object({
      action: z.literal('select'),
      selector,
      value: z.string().max(256),
    })
    .strict(),
  z.object({ action: z.literal('url'), route }).strict(),
  z.object({ action: z.literal('visible'), selector }).strict(),
  z
    .object({
      action: z.literal('text'),
      selector,
      text: z.string().min(1).max(1024),
    })
    .strict(),
  z
    .object({
      action: z.literal('count'),
      selector,
      count: z.number().int().min(0).max(1000),
    })
    .strict(),
]);
export const scenarioSchema = z
  .object({
    id,
    label,
    target: id,
    routes: z.array(route).min(1).max(30),
    viewports: z
      .array(
        z
          .object({
            name: id,
            width: z.number().int().min(240).max(2560),
            height: z.number().int().min(240).max(1440),
            mobile: z.boolean().default(false),
          })
          .strict(),
      )
      .min(1)
      .max(6),
    changedFiles: z
      .array(
        z
          .string()
          .min(1)
          .max(200)
          .regex(/^[a-zA-Z0-9_./*?{}@+-]+$/),
      )
      .min(1)
      .max(30),
    steps: z.array(stepSchema).min(1).max(100),
    evidence: z
      .object({
        screenshot: z.enum(['off', 'failure', 'always']).default('failure'),
        traceOnFailure: z.boolean().default(true),
        masks: z.array(selector).max(10).default([]),
      })
      .strict(),
    visual: z
      .object({
        maxDiffRatio: z.number().min(0).max(0.1),
        pixelThreshold: z.number().min(0).max(0.5).default(0.1),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((s, ctx) => {
    const names = s.viewports.map((v) => v.name);
    if (new Set(names).size !== names.length)
      ctx.addIssue({
        code: 'custom',
        message: 'Viewport names must be unique.',
      });
    if (
      !s.steps.some((a) =>
        ['url', 'visible', 'text', 'count'].includes(a.action),
      )
    )
      ctx.addIssue({
        code: 'custom',
        message: 'At least one assertion is required.',
      });
    if (s.steps[0].action !== 'navigate')
      ctx.addIssue({ code: 'custom', message: 'First step must navigate.' });
    if (s.steps.some((a) => 'route' in a && !s.routes.includes(a.route)))
      ctx.addIssue({ code: 'custom', message: 'Step route is not approved.' });
    if (
      s.visual &&
      (s.evidence.screenshot !== 'always' ||
        s.steps.some((a) => a.action === 'fillSecret'))
    )
      ctx.addIssue({
        code: 'custom',
        message:
          'Visual checks require always screenshots and cannot use secrets.',
      });
  });
export const targetSchema = z
  .object({
    id,
    label,
    environment: z.enum(['local', 'staging', 'production']),
    origin: z
      .string()
      .max(256)
      .refine((s) => {
        try {
          const u = new URL(s);
          return (
            ['http:', 'https:'].includes(u.protocol) &&
            u.origin === s &&
            !u.username &&
            !u.password
          );
        } catch {
          return false;
        }
      }, 'Use a canonical HTTP(S) origin without path.'),
    allowLoopback: z.boolean().default(false),
    allowPrivateNetwork: z.boolean().default(false),
    allowCustomPort: z.boolean().default(false),
  })
  .strict();
export const configSchema = z
  .object({
    version: z.literal(1),
    severity: z.enum(['error', 'warning']).default('error'),
    targets: z.array(targetSchema).min(1).max(20),
    scenarios: z.array(scenarioSchema).min(1).max(100),
    timeouts: z
      .object({
        actionMs: z.number().int().min(100).max(30000).default(5000),
        navigationMs: z.number().int().min(100).max(60000).default(15000),
        screenshotMs: z.number().int().min(100).max(15000).default(5000),
        runMs: z.number().int().min(500).max(180000).default(60000),
      })
      .strict()
      .default({}),
    retention: z
      .object({
        maxFiles: z.number().int().min(10).max(1000).default(100),
        maxBytes: z
          .number()
          .int()
          .min(1024)
          .max(500_000_000)
          .default(50_000_000),
        maxAgeDays: z.number().int().min(1).max(30).default(7),
      })
      .strict()
      .default({}),
    mcp: z
      .object({
        enabled: z.boolean().default(false),
        allowRuns: z.boolean().default(false),
        allowProposals: z.boolean().default(false),
      })
      .strict()
      .default({}),
  })
  .strict()
  .superRefine((c, ctx) => {
    for (const group of [c.targets, c.scenarios])
      if (new Set(group.map((x) => x.id)).size !== group.length)
        ctx.addIssue({ code: 'custom', message: 'IDs must be unique.' });
    for (const s of c.scenarios)
      if (!c.targets.some((t) => t.id === s.target))
        ctx.addIssue({ code: 'custom', message: 'Unknown target reference.' });
    for (const t of c.targets) {
      const u = new URL(t.origin);
      if (u.port && !t.allowCustomPort)
        ctx.addIssue({
          code: 'custom',
          message: 'Custom port requires opt-in.',
        });
      if (u.protocol === 'http:' && !t.allowLoopback && !t.allowPrivateNetwork)
        ctx.addIssue({
          code: 'custom',
          message: 'HTTPS required for public targets.',
        });
    }
  });
export type Config = z.infer<typeof configSchema>;
export type Scenario = z.infer<typeof scenarioSchema>;
export type Target = z.infer<typeof targetSchema>;
export type Selector = z.infer<typeof selectorSchema>;
export type Viewport = Scenario['viewports'][number];
export function parseConfig(raw: string): Config {
  if (Buffer.byteLength(raw) > 256_000)
    throw new Error('Configuration exceeds 256 KB.');
  // Error values deliberately omit untrusted configuration content.
  try {
    return configSchema.parse(JSON.parse(raw));
  } catch {
    throw new Error(
      'Invalid Blackbox v1 configuration. Check the schema; no automatic migration is performed.',
    );
  }
}
export function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
export function approved(config: Config, hash: unknown): boolean {
  return typeof hash === 'string' && digest(config) === hash;
}
