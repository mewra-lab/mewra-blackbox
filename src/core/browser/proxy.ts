import { createServer, request as httpRequest } from 'node:http';
import { connect, type Socket } from 'node:net';
import { assertUrl, pinnedAddress, type Resolver } from '../config/policy';
import type { Target } from '../config/schema';

// DNS is checked once and the validated address is used for every upstream socket.
// This avoids the check-then-resolve-again DNS rebinding gap in browser route handlers.
export async function policyProxy(
  target: Target,
  onDeny: () => void,
  resolver?: Resolver,
  timeoutMs = 5000,
) {
  const pinned = await pinnedAddress(target, resolver, timeoutMs),
    origin = new URL(target.origin);
  const sockets = new Set<Socket>();
  const track = (s: Socket) => {
    sockets.add(s);
    s.on('close', () => sockets.delete(s));
    s.on('error', () => {});
    s.setTimeout(30000, () => s.destroy());
    return s;
  };
  const server = createServer((req, res) => {
    try {
      const u = assertUrl(req.url ?? '', target);
      if (u.protocol !== 'http:') throw new Error();
      const headers: import('node:http').OutgoingHttpHeaders = {
        ...req.headers,
        host: origin.host,
      };
      delete headers['proxy-authorization'];
      delete headers['proxy-connection'];
      const upstream = httpRequest(
        {
          host: pinned.address,
          family: pinned.family,
          port: Number(origin.port || 80),
          method: req.method,
          path: u.pathname + u.search,
          headers,
          timeout: 15000,
        },
        (incoming) => {
          res.writeHead(incoming.statusCode ?? 502, incoming.headers);
          incoming.pipe(res);
        },
      );
      upstream.on('socket', track);
      upstream.on('timeout', () => upstream.destroy());
      upstream.on('error', () => res.destroy());
      req.on('aborted', () => upstream.destroy());
      req.pipe(upstream);
    } catch {
      onDeny();
      res.writeHead(403).end();
    }
  });
  server.on('connect', (req, client, head) => {
    if (
      origin.protocol !== 'https:' ||
      req.url !== `${origin.hostname}:${origin.port || 443}`
    ) {
      onDeny();
      client.end('HTTP/1.1 403 Forbidden\r\n\r\n');
      return;
    }
    const upstream = track(
      connect(
        {
          host: pinned.address,
          family: pinned.family,
          port: Number(origin.port || 443),
        },
        () => {
          client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
          if (head.length) upstream.write(head);
          client.pipe(upstream);
          upstream.pipe(client);
        },
      ),
    );
    upstream.on('error', () => client.destroy());
    client.on('close', () => upstream.destroy());
  });
  server.on('upgrade', (_req, socket) => {
    onDeny();
    socket.destroy();
  });
  server.on('connection', track);
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  await new Promise<void>((ok, fail) => {
    server.once('error', fail);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', fail);
      ok();
    });
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Proxy failed.');
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: async () => {
      for (const s of sockets) s.destroy();
      await new Promise<void>((ok) => server.close(() => ok()));
    },
  };
}
