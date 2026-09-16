import { selectScenarios } from '../scenarios/select';
import type { Config } from '../config/schema';
import type { SuiteResult } from '../../shared/results';
export type Diff = { changedFiles: Array<{ path: string; oldPath?: string }> };
export type CheckResult = {
  status: SuiteResult['status'];
  findings: Array<{
    file: string;
    line: number;
    message: string;
    rule?: string;
    metadata?: Record<string, string>;
  }>;
  message: string;
};
export type CheckRunner = {
  id: string;
  label: string;
  pack: string;
  severity: 'error' | 'warning';
  installable: boolean;
  setupCommand: string;
  appliesTo: (diff: Diff) => boolean;
  run: (diff: Diff, context: { workspaceRoot: string }) => Promise<CheckResult>;
};
export function normalize(suite: SuiteResult): CheckResult {
  return {
    status: suite.status,
    message: suite.message,
    findings: suite.results
      .filter((r) => r.status !== 'pass')
      .map((r) => ({
        file: '.mewra-blackbox.json',
        line: 0,
        rule: r.scenarioId,
        message: `${r.label} / ${r.viewport}: ${r.message}`,
        metadata: {
          scenarioId: r.scenarioId,
          route: r.routeLabel,
          command: 'mewra-blackbox.results',
          ...(r.evidence.actual ? { evidence: r.evidence.actual } : {}),
        },
      })),
  };
}
export function createCheck(
  getConfig: () => Config | undefined,
  run: (ids: string[], workspace: string) => Promise<SuiteResult>,
): CheckRunner {
  return {
    id: 'mewra-blackbox:e2e',
    label: 'Mewra Blackbox — Approved E2E',
    pack: 'mewra-blackbox',
    get severity() {
      return getConfig()?.severity ?? 'error';
    },
    installable: false,
    setupCommand: 'mewra-blackbox.results',
    // Always contribute a visible row; no-match is explicitly skipped by run().
    appliesTo: () => true,
    async run(diff, context) {
      const c = getConfig();
      if (!c)
        return {
          status: 'not-configured',
          message: 'Review and approve a Blackbox configuration.',
          findings: [],
        };
      const selected = selectScenarios(
        c.scenarios,
        diff.changedFiles.flatMap((f) => [
          f.path,
          ...(f.oldPath ? [f.oldPath] : []),
        ]),
      );
      if (!selected.length)
        return {
          status: 'skipped',
          message: 'No approved scenario matches this diff.',
          findings: [],
        };
      return normalize(
        await run(
          selected.map((s) => s.id),
          context.workspaceRoot,
        ),
      );
    },
  };
}
export async function registerWithHost(
  host: { activate: () => PromiseLike<unknown> } | undefined,
  check: CheckRunner,
) {
  if (!host)
    return {
      message: 'PreFlight is not installed. Blackbox remains available.',
    };
  try {
    const api = (await host.activate()) as {
      apiVersion?: unknown;
      registerCheck?: (c: CheckRunner) => { dispose(): void };
    };
    if (api?.apiVersion !== 1 || typeof api.registerCheck !== 'function')
      return { message: 'PreFlight API is incompatible; API v1 is required.' };
    return {
      message: 'Connected to PreFlight API v1.',
      registration: api.registerCheck(check),
    };
  } catch {
    return {
      message: 'PreFlight activation failed. Blackbox remains available.',
    };
  }
}
