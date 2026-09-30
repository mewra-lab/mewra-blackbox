import { lookup } from 'node:dns/promises';
import ipaddr from 'ipaddr.js';
import type { Target } from './schema';
export type Resolver = (
  hostname: string,
) => Promise<Array<{ address: string; family: number }>>;
export const resolveAddresses: Resolver = (h) =>
  lookup(h, { all: true, verbatim: true });
export function addressAllowed(address: string, target: Target): boolean {
  try {
    const ip = ipaddr.process(address);
    const range = ip.range();
    if (range === 'loopback') return target.allowLoopback;
    if (['private', 'uniqueLocal'].includes(range))
      return target.allowPrivateNetwork;
    // Link-local / multicast / unspecified / reserved / transition addresses never allowed.
    return range === 'unicast';
  } catch {
    return false;
  }
}
export function assertUrl(raw: string, target: Target, routes?: string[]): URL {
  const u = new URL(raw);
  if (
    u.origin !== target.origin ||
    u.username ||
    u.password ||
    !['https:', 'http:'].includes(u.protocol)
  )
    throw new Error('Target policy denied a request.');
  if (routes && (!routes.includes(u.pathname) || u.search))
    throw new Error('Navigation route is not approved.');
  return u;
}
export async function pinnedAddress(
  target: Target,
  resolver: Resolver = resolveAddresses,
  timeoutMs = 5000,
) {
  const u = new URL(target.origin);
  const hostname = u.hostname.replace(/^\[|\]$/g, '');
  let timer: ReturnType<typeof setTimeout> | undefined;
  const addresses = await Promise.race([
    resolver(hostname),
    new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error('DNS lookup timed out.')),
        timeoutMs,
      );
    }),
  ]).finally(() => clearTimeout(timer));
  if (
    !addresses.length ||
    addresses.some((a) => !addressAllowed(a.address, target))
  )
    throw new Error('Network address denied by target policy.');
  if (
    u.protocol === 'http:' &&
    addresses.some((a) => ipaddr.process(a.address).range() === 'unicast')
  )
    throw new Error('HTTPS required for public targets.');
  return addresses[0];
}
