export type Status = 'pass' | 'warning' | 'fail' | 'not-configured' | 'skipped';
export type Evidence = {
  actual?: string;
  baseline?: string;
  diff?: string;
  trace?: string;
};
export type ScenarioResult = {
  scenarioId: string;
  label: string;
  targetLabel: string;
  routeLabel: string;
  viewport: string;
  width: number;
  height: number;
  status: Status;
  message: string;
  durationMs: number;
  evidence: Evidence;
  visual?: { ratio: number; threshold: number; masks: number };
  baselineKey?: string;
};
export type SuiteResult = {
  status: Status;
  message: string;
  results: ScenarioResult[];
};
export function aggregate(results: ScenarioResult[]): SuiteResult {
  const status: Status =
    (['fail', 'not-configured', 'warning', 'pass', 'skipped'] as const).find(
      (s) => results.some((r) => r.status === s),
    ) ?? 'skipped';
  return {
    status,
    message: results.length
      ? `${results.length} viewport runs; ${results.filter((r) => r.status === 'fail').length} failed.`
      : 'No approved scenario matches this diff.',
    results,
  };
}
