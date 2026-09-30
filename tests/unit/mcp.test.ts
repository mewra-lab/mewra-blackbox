import { afterEach, it, expect, vi } from 'vitest';
import { configuration } from '../helpers';
import { McpHandler } from '../../src/core/mcp/handler';
import { McpServer } from '../../src/core/mcp/server';
const servers: McpServer[] = [];
afterEach(() => {
  for (const s of servers) s.dispose();
  servers.length = 0;
});
function setup() {
  const config = configuration();
  config.mcp = { enabled: true, allowRuns: true, allowProposals: true };
  const run = vi.fn(async () => ({
      status: 'pass' as const,
      message: 'Passed',
      results: [],
    })),
    propose = vi.fn(async () => {});
  return {
    config,
    run,
    propose,
    handler: new McpHandler({
      config: async () => config,
      results: () => ({ status: 'skipped', message: 'None', results: [] }),
      run,
      propose,
      audit: vi.fn(),
    }),
  };
}
it('constrains runs and rejects arbitrary browser input', async () => {
  const { handler, run } = setup();
  for (const args of [
    { scenarioId: 'unknown' },
    { scenarioId: 'home', url: 'https://evil.test' },
    { scenarioId: 'home', headers: {} },
    { scenarioId: 'home', script: 'alert(1)' },
    { scenarioId: 'home', artifactPath: '/etc/passwd' },
  ])
    await expect(handler.call('run_scenario', args)).rejects.toThrow();
  expect(run).not.toHaveBeenCalled();
  await handler.call('run_scenario', { scenarioId: 'home' });
  expect(run).toHaveBeenCalledWith('home');
});
it('keeps proposals pending and denies baseline/secret/raw artifact capabilities', async () => {
  const { handler, propose, run, config } = setup();
  expect(
    await handler.call('propose_scenario', { scenario: config.scenarios[0] }),
  ).toMatchObject({ status: 'pending-human-review' });
  expect(propose).toHaveBeenCalledOnce();
  expect(run).not.toHaveBeenCalled();
  for (const tool of [
    'approve_baseline',
    'read_secret',
    'read_artifact',
    'set_target',
  ])
    await expect(handler.call(tool, {})).rejects.toThrow();
});
it('honors disabled capabilities and validates extra read arguments', async () => {
  const { handler, config } = setup();
  config.mcp.allowRuns = false;
  await expect(
    handler.call('run_scenario', { scenarioId: 'home' }),
  ).rejects.toThrow();
  await expect(
    handler.call('read_results', { path: '/secret' }),
  ).rejects.toThrow();
  config.mcp.enabled = false;
  await expect(handler.call('list_scenarios', {})).rejects.toThrow();
});
it('authenticates loopback transport, rejects origins and accepts MCP JSON-RPC', async () => {
  const { handler } = setup(),
    server = new McpServer(handler, async () => true);
  servers.push(server);
  await server.start();
  const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
  expect((await fetch(server.url, { method: 'POST', body })).status).toBe(403);
  const headers = {
    'content-type': 'application/json',
    authorization: `Bearer ${server.token}`,
  };
  expect(
    (
      await fetch(server.url, {
        method: 'POST',
        headers: { ...headers, origin: 'https://evil.test' },
        body,
      })
    ).status,
  ).toBe(403);
  const response = await fetch(server.url, { method: 'POST', headers, body });
  expect(((await response.json()) as any).result.tools).toHaveLength(4);
  const invalid = await fetch(server.url, {
    method: 'POST',
    headers,
    body: 'null',
  });
  expect(((await invalid.json()) as any).error.code).toBe(-32600);
});
