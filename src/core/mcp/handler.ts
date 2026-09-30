import { z } from 'zod';
import {
  id,
  scenarioSchema,
  type Config,
  type Scenario,
} from '../config/schema';
import type { SuiteResult } from '../../shared/results';
const empty = z.object({}).strict(),
  one = z.object({ scenarioId: id }).strict();
export const toolDefinitions = [
  {
    name: 'list_scenarios',
    description: 'List owner-approved scenario metadata.',
    inputSchema: { type: 'object', additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'read_results',
    description: 'Read the last redacted summary. No raw artifacts.',
    inputSchema: { type: 'object', additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'run_scenario',
    description: 'Run exactly one existing approved scenario.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['scenarioId'],
      properties: {
        scenarioId: {
          type: 'string',
          pattern: '^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$',
        },
      },
    },
  },
  {
    name: 'propose_scenario',
    description:
      'Submit a non-executable declarative proposal for human review. Use the documented scenario schema.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['scenario'],
      properties: { scenario: { type: 'object' } },
    },
  },
];
export class McpHandler {
  constructor(
    private readonly deps: {
      config: () => Promise<Config | undefined>;
      results: () => SuiteResult;
      run: (id: string) => Promise<SuiteResult>;
      propose: (s: Scenario) => Promise<void>;
      audit: (message: string) => void;
    },
  ) {}
  async call(name: unknown, args: unknown) {
    const config = await this.deps.config();
    if (!config?.mcp.enabled) throw new Error('MCP is not approved.');
    if (
      typeof name !== 'string' ||
      !toolDefinitions.some((t) => t.name === name)
    )
      throw new Error('Unknown tool.');
    this.deps.audit(`MCP ${name}`);
    if (name === 'list_scenarios') {
      empty.parse(args);
      return {
        scenarios: config.scenarios.map((s) => ({
          id: s.id,
          label: s.label,
          viewports: s.viewports.map((v) => v.name),
        })),
      };
    }
    if (name === 'read_results') {
      empty.parse(args);
      return summary(this.deps.results());
    }
    if (name === 'run_scenario') {
      const { scenarioId } = one.parse(args);
      if (
        !config.mcp.allowRuns ||
        !config.scenarios.some((s) => s.id === scenarioId)
      )
        throw new Error('Scenario run not approved.');
      return summary(await this.deps.run(scenarioId));
    }
    if (!config.mcp.allowProposals) throw new Error('Proposals not approved.');
    const { scenario } = z
      .object({ scenario: scenarioSchema })
      .strict()
      .parse(args);
    if (!config.targets.some((t) => t.id === scenario.target))
      throw new Error('Proposal must reference an existing target.');
    await this.deps.propose(scenario);
    return { status: 'pending-human-review', scenarioId: scenario.id };
  }
}
function summary(s: SuiteResult) {
  return {
    status: s.status,
    message: s.message,
    results: s.results.map((r) => ({
      scenarioId: r.scenarioId,
      viewport: r.viewport,
      status: r.status,
      message: r.message,
      durationMs: r.durationMs,
    })),
  };
}
