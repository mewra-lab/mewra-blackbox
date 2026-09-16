import * as vscode from 'vscode';
import { readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  approved,
  digest,
  parseConfig,
  type Config,
  type Scenario,
} from '../core/config/schema';
import { ArtifactStore, redact } from '../core/results/artifacts';
import { runScenario } from '../core/browser/runner';
import {
  aggregate,
  type SuiteResult,
  type ScenarioResult,
} from '../shared/results';

export class BlackboxService {
  config: Config | undefined;
  latest: SuiteResult = aggregate([]);
  store: ArtifactStore | undefined;
  busy = false;
  abort: AbortController | undefined;
  onChange = () => {};
  proposals: Scenario[] = [];
  readonly root: string | undefined;
  constructor(
    readonly context: vscode.ExtensionContext,
    private output: vscode.OutputChannel,
  ) {
    this.root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  }
  async read() {
    if (
      !vscode.workspace.isTrusted ||
      !this.root ||
      vscode.workspace.workspaceFolders?.length !== 1
    )
      throw new Error('Blackbox requires one trusted local workspace.');
    const path = join(this.root, '.mewra-blackbox.json');
    if ((await stat(path)).size > 256000)
      throw new Error('Configuration too large.');
    return parseConfig(await readFile(path, 'utf8'));
  }
  async refresh() {
    try {
      const config = await this.read();
      const approval = await this.context.secrets.get(this.approvalKey());
      if (!approved(config, approval)) {
        this.config = undefined;
        return undefined;
      }
      this.config = config;
      this.store = new ArtifactStore(
        join(
          this.context.globalStorageUri.fsPath,
          'evidence',
          digest(this.root),
        ),
        this.root!,
        config.retention,
      );
      await this.store.init();
      await this.store.prune();
      return config;
    } catch {
      this.config = undefined;
      return undefined;
    }
  }
  private approvalKey() {
    return `approval:${digest(this.root)}`;
  }
  async approve() {
    const config = await this.read(),
      hash = digest(config);
    const document = await vscode.workspace.openTextDocument({
      content: JSON.stringify(config, null, 2),
      language: 'json',
    });
    await vscode.window.showTextDocument(document, { preview: false });
    const answer = await vscode.window.showWarningMessage(
      `Approve ${config.scenarios.length} scenarios on ${config.targets.length} targets? Review the complete configuration, including network opt-ins, actions, screenshots, masks, retention, and MCP access. Browser actions can change data on these targets.`,
      { modal: true },
      'Approve reviewed configuration',
    );
    if (answer !== 'Approve reviewed configuration') return;
    if (digest(await this.read()) !== hash)
      throw new Error('Configuration changed during review. Review again.');
    await this.context.secrets.store(this.approvalKey(), hash);
    await this.refresh();
    this.onChange();
  }
  secretKey(id: string) {
    return `secret:${digest(this.root)}:${id}`;
  }
  async run(ids: string[], workspace = this.root): Promise<SuiteResult> {
    if (this.busy)
      return {
        status: 'warning',
        message: 'A Blackbox run is already active.',
        results: [],
      };
    // Set before the first await to prevent concurrent MCP/command/PreFlight runs.
    this.busy = true;
    this.abort = new AbortController();
    const suiteTimeout = setTimeout(() => this.abort?.abort(), 600000);
    this.onChange();
    try {
      const config = await this.refresh();
      if (
        !config ||
        !this.store ||
        !this.root ||
        !workspace ||
        resolve(workspace) !== resolve(this.root)
      )
        return {
          status: 'not-configured',
          message:
            'Configuration is missing, changed, or not approved for this workspace.',
          results: [],
        };
      if (
        ids.length > 100 ||
        new Set(ids).size !== ids.length ||
        ids.some((id) => !config.scenarios.some((s) => s.id === id))
      )
        return {
          status: 'fail',
          message: 'Only existing approved scenario IDs can run.',
          results: [],
        };
      const selected = config.scenarios.filter((s) => ids.includes(s.id)),
        results: ScenarioResult[] = [];
      const handles = [
        ...new Set(
          selected.flatMap((s) =>
            s.steps.flatMap((a) =>
              a.action === 'fillSecret' ? [a.secret] : [],
            ),
          ),
        ),
      ];
      const secrets = new Map<string, string>();
      for (const handle of handles) {
        const value = await this.context.secrets.get(this.secretKey(handle));
        if (value) secrets.set(handle, value);
      }
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Mewra Blackbox',
          cancellable: true,
        },
        async (progress, token) => {
          const cancellation = token.onCancellationRequested(() =>
            this.abort?.abort(),
          );
          try {
            for (const scenario of selected)
              for (const viewport of scenario.viewports) {
                if (this.abort!.signal.aborted) break;
                if (digest(await this.read()) !== digest(config))
                  throw new Error('Configuration changed during run.');
                const result = await runScenario({
                  config,
                  scenario,
                  viewport,
                  store: this.store!,
                  getSecret: async (id) => secrets.get(id),
                  signal: this.abort!.signal,
                  progress: (action) =>
                    progress.report({
                      message: `${scenario.id} / ${viewport.name}: ${action}`,
                    }),
                });
                // All free text crosses a final known-secret redaction boundary.
                for (const key of [
                  'label',
                  'targetLabel',
                  'routeLabel',
                  'message',
                ] as const)
                  result[key] = redact(result[key], [...secrets.values()]);
                results.push(result);
                this.latest = aggregate(results);
                this.onChange();
              }
          } finally {
            cancellation.dispose();
            secrets.clear();
          }
        },
      );
      this.latest = aggregate(results);
      if (this.abort.signal.aborted) {
        if (this.latest.status !== 'fail') this.latest.status = 'warning';
        this.latest.message =
          'Suite cancelled; remaining scenarios were not executed.';
      }
      return this.latest;
    } catch {
      this.latest = {
        status: 'fail',
        message:
          'Run stopped. Check configuration approval and local evidence storage.',
        results: [],
      };
      return this.latest;
    } finally {
      clearTimeout(suiteTimeout);
      this.busy = false;
      this.abort = undefined;
      this.onChange();
    }
  }
  async propose(s: Scenario) {
    if (this.proposals.length >= 20) throw new Error('Proposal queue full.');
    this.proposals.push(s);
    this.output.appendLine(`Proposal queued: ${s.id}. Human review required.`);
  }
}
