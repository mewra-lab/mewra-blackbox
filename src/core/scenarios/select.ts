import { minimatch } from 'minimatch';
import type { Scenario } from '../config/schema';
export function selectScenarios(
  scenarios: Scenario[],
  files: string[],
): Scenario[] {
  return scenarios.filter((s) =>
    s.changedFiles.some((pattern) =>
      files.some((file) =>
        minimatch(file, pattern, {
          dot: true,
          nocomment: true,
          nonegate: true,
        }),
      ),
    ),
  );
}
