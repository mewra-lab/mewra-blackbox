import { randomBytes, timingSafeEqual } from 'node:crypto';
import {
  createServer,
  type Server,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { McpHandler, toolDefinitions } from './handler';
export class McpServer {
  readonly token = randomBytes(32).toString('base64url');
  private server: Server | undefined;
  private port = 0;
  constructor(
    private handler: McpHandler,
    private enabled: () => Promise<boolean>,
  ) {}
  get url() {
    return `http://127.0.0.1:${this.port}/mcp`;
  }
  async start() {
    if (this.server) return;
    this.server = createServer((req, res) => void this.handle(req, res));
    this.server.requestTimeout = 10000;
    this.server.headersTimeout = 5000;
    await new Promise<void>((ok, fail) => {
      this.server!.once('error', fail);
      this.server!.listen(0, '127.0.0.1', () => {
        this.server!.off('error', fail);
        ok();
      });
    });
    const a = this.server.address();
    if (!a || typeof a === 'string') throw new Error('MCP start failed');
    this.port = a.port;
  }
  dispose() {
    this.server?.closeAllConnections();
    this.server?.close();
    this.server = undefined;
  }
  private async handle(req: IncomingMessage, res: ServerResponse) {
    const auth = Buffer.from(req.headers.authorization ?? ''),
      expected = Buffer.from(`Bearer ${this.token}`);
    if (
      req.headers.host !== `127.0.0.1:${this.port}` ||
      req.headers.origin !== undefined ||
      auth.length !== expected.length ||
      !timingSafeEqual(auth, expected)
    ) {
      res.writeHead(403).end();
      return;
    }
    if (req.url !== '/mcp') {
      res.writeHead(404).end();
      return;
    }
    if (req.method !== 'POST') {
      res.writeHead(405).end();
      return;
    }
    if (!req.headers['content-type']?.startsWith('application/json')) {
      res.writeHead(415).end();
      return;
    }
    let request: Record<string, unknown> | undefined;
    const respond = (payload: unknown) => {
      res
        .writeHead(200, {
          'content-type': 'application/json',
          'cache-control': 'no-store',
        })
        .end(JSON.stringify(payload));
    };
    try {
      let length = 0;
      const chunks: Buffer[] = [];
      for await (const c of req) {
        const b = Buffer.from(c);
        length += b.length;
        if (length > 256000) {
          res.writeHead(413).end();
          return;
        }
        chunks.push(b);
      }
      const raw: unknown = JSON.parse(Buffer.concat(chunks).toString());
      if (!raw || typeof raw !== 'object' || Array.isArray(raw))
        throw new Error();
      request = raw as Record<string, unknown>;
      if (
        request.jsonrpc !== '2.0' ||
        typeof request.method !== 'string' ||
        (request.id !== undefined &&
          typeof request.id !== 'string' &&
          typeof request.id !== 'number')
      )
        throw new Error();
      if (!(await this.enabled())) throw new Error();
      let result: unknown;
      switch (request.method) {
        case 'initialize':
          result = {
            protocolVersion: '2025-06-18',
            capabilities: { tools: {} },
            serverInfo: { name: 'mewra-blackbox', version: '0.3.0' },
          };
          break;
        case 'ping':
        case 'notifications/initialized':
          result = {};
          break;
        case 'tools/list':
          result = { tools: toolDefinitions };
          break;
        case 'tools/call': {
          // Requests without IDs cannot trigger side effects.
          if (request.id === undefined) throw new Error();
          const p = request.params as
            | { name?: unknown; arguments?: unknown }
            | undefined;
          try {
            const data = await this.handler.call(p?.name, p?.arguments ?? {});
            result = {
              content: [{ type: 'text', text: JSON.stringify(data) }],
              structuredContent: data,
            };
          } catch {
            result = {
              isError: true,
              content: [
                {
                  type: 'text',
                  text: 'Request rejected. Check approved capabilities and scenario schema.',
                },
              ],
            };
          }
          break;
        }
        default:
          respond({
            jsonrpc: '2.0',
            id: request.id ?? null,
            error: { code: -32601, message: 'Method not found.' },
          });
          return;
      }
      if (request.id === undefined) {
        res.writeHead(202).end();
        return;
      }
      respond({ jsonrpc: '2.0', id: request.id, result });
    } catch {
      respond({
        jsonrpc: '2.0',
        id: request?.id ?? null,
        error: { code: -32600, message: 'Invalid or unapproved request.' },
      });
    }
  }
}
