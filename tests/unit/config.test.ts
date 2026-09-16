import { describe, it, expect } from 'vitest';
import { configuration } from '../helpers';
import {
  approved,
  configSchema,
  digest,
  parseConfig,
} from '../../src/core/config/schema';
import {
  addressAllowed,
  assertUrl,
  pinnedAddress,
} from '../../src/core/config/policy';
import { selectScenarios } from '../../src/core/scenarios/select';
describe('configuration trust boundary', () => {
  it('binds approval to the complete validated config', () => {
    const c = configuration(),
      hash = digest(c);
    expect(approved(c, hash)).toBe(true);
    c.scenarios[0].viewports[0].width = 900;
    expect(approved(c, hash)).toBe(false);
  });
  it.each([
    'headers',
    'launchFlags',
    'shell',
    'script',
    'credentials',
    'approved',
  ])('rejects extra executable field %s', (key) => {
    const c = configuration();
    expect(configSchema.safeParse({ ...c, [key]: 'danger' }).success).toBe(
      false,
    );
    expect(
      configSchema.safeParse({
        ...c,
        scenarios: [{ ...c.scenarios[0], [key]: 'danger' }],
      }).success,
    ).toBe(false);
  });
  it.each([
    '//evil.test',
    '/../admin',
    '/x?token=1',
    '/x#secret',
    '/x\\evil',
    '/%2e%2e/admin',
    '/%2fadmin',
  ])('rejects ambiguous route %s', (route) => {
    const c = configuration();
    c.scenarios[0].routes = [route];
    expect(configSchema.safeParse(c).success).toBe(false);
  });
  it('requires assertions, known targets, unique IDs, and valid viewports', () => {
    const c = configuration();
    const s = c.scenarios[0];
    for (const patch of [
      { steps: [s.steps[0]] },
      { target: 'unknown' },
      { viewports: [{ name: 'x', width: 100000, height: 500 }] },
      { steps: [{ action: 'evaluate', script: 'bad' }] },
    ])
      expect(
        configSchema.safeParse({ ...c, scenarios: [{ ...s, ...patch }] })
          .success,
      ).toBe(false);
    expect(configSchema.safeParse({ ...c, scenarios: [s, s] }).success).toBe(
      false,
    );
  });
  it('bounds payload and rejects unknown config versions without leaking values', () => {
    expect(() => parseConfig('x'.repeat(256001))).toThrow('256 KB');
    expect(() => parseConfig('{"version":99,"token":"SENSITIVE"}')).toThrow(
      'Invalid Blackbox',
    );
  });
  it('requires opt-in for custom ports and HTTPS for public origins', () => {
    expect(() => configuration('https://example.test:8443')).toThrow();
    expect(() => configuration('http://example.test')).toThrow();
  });
  it('selects only related paths and never implicitly expands suite', () => {
    const c = configuration();
    expect(selectScenarios(c.scenarios, ['README.md'])).toEqual([]);
    expect(selectScenarios(c.scenarios, ['src/checkout/a.ts'])).toHaveLength(1);
  });
});
describe('target policy', () => {
  it.each([
    '127.0.0.1',
    '127.1.2.3',
    '10.0.0.1',
    '172.16.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '0.0.0.0',
    '::1',
    '::ffff:127.0.0.1',
    'fc00::1',
    'fe80::1',
    '224.0.0.1',
  ])('denies private/special address %s', (ip) =>
    expect(addressAllowed(ip, configuration().targets[0])).toBe(false),
  );
  it('separates loopback and private opt-ins while denying metadata addresses', () => {
    const t = { ...configuration().targets[0], allowLoopback: true };
    expect(addressAllowed('::ffff:127.0.0.1', t)).toBe(true);
    expect(addressAllowed('10.0.0.1', t)).toBe(false);
    expect(
      addressAllowed('169.254.169.254', { ...t, allowPrivateNetwork: true }),
    ).toBe(false);
  });
  it('rejects mixed DNS results and pins a permitted address', async () => {
    const t = configuration().targets[0];
    await expect(
      pinnedAddress(t, async () => [
        { address: '1.1.1.1', family: 4 },
        { address: '127.0.0.1', family: 4 },
      ]),
    ).rejects.toThrow();
    expect(
      await pinnedAddress(t, async () => [{ address: '1.1.1.1', family: 4 }]),
    ).toEqual({ address: '1.1.1.1', family: 4 });
  });
  it('enforces exact scheme, host, port, credentials and navigation path', () => {
    const t = configuration().targets[0];
    for (const url of [
      'http://example.test/',
      'https://example.test:8443/',
      'https://evil.test/',
      'https://user:pass@example.test/',
      'https://example.test/admin',
      'https://example.test/?token=1',
    ])
      expect(() => assertUrl(url, t, ['/'])).toThrow();
    expect(assertUrl('https://example.test/', t, ['/']).pathname).toBe('/');
  });
});
