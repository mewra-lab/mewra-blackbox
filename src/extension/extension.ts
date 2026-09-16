import * as vscode from 'vscode';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { BlackboxService } from './service';
import { ResultViewer } from './viewer';
import { createCheck, registerWithHost } from '../core/integration/preflight';
import { baselineKey, saveBaseline } from '../core/visual/compare';
import { McpHandler } from '../core/mcp/handler';
import { McpServer } from '../core/mcp/server';
let service: BlackboxService | undefined;
export async function activate(context: vscode.ExtensionContext) {
  const output = vscode.window.createOutputChannel('Mewra Blackbox');
  context.subscriptions.push(output);
  const app = new BlackboxService(context, output);
  service = app;
  await app.refresh();
  let reviewing = false;
  const baseline = async (id: string, viewport: string) => {
    if (app.busy || reviewing) throw new Error('Run or review active.');
    reviewing = true;
    try {
      const c = await app.refresh(),
        s = c?.scenarios.find((s) => s.id === id),
        v = s?.viewports.find((v) => v.name === viewport),
        r = app.latest.results.find(
          (r) => r.scenarioId === id && r.viewport === viewport,
        );
      if (
        !c ||
        !s ||
        !v ||
        !r?.evidence.actual ||
        !r.baselineKey ||
        !app.store ||
        r.baselineKey !==
          baselineKey(s, v, c.targets.find((t) => t.id === s.target)!.origin)
      )
        throw new Error('Baseline candidate unavailable or stale.');
      await viewer.show();
      const answer = await vscode.window.showWarningMessage(
        `Review the actual, baseline and diff images for ${s.label} / ${v.name}. Approving changes future visual decisions. Masks: ${s.evidence.masks.length}; maximum changed pixels: ${(s.visual!.maxDiffRatio * 100).toFixed(2)}%.`,
        { modal: true },
        'Approve displayed baseline',
      );
      if (answer !== 'Approve displayed baseline') return;
      const fresh = await app.refresh();
      if (
        app.busy ||
        app.latest.results.find(
          (x) => x.scenarioId === id && x.viewport === viewport,
        ) !== r ||
        !fresh ||
        !s ||
        baselineKey(
          fresh.scenarios.find((x) => x.id === id)!,
          v,
          fresh.targets.find((t) => t.id === s.target)!.origin,
        ) !== r.baselineKey
      )
        throw new Error('Candidate changed during review.');
      await saveBaseline(app.store!, r.baselineKey, r.evidence.actual);
      void vscode.window.showInformationMessage(
        'Baseline approved. Run the scenario again to evaluate it.',
      );
    } finally {
      reviewing = false;
    }
  };
  const viewer = new ResultViewer(app, context.extensionUri, baseline);
  context.subscriptions.push(viewer);
  const changed = new vscode.EventEmitter<void>();
  context.subscriptions.push(changed);
  app.onChange = () => {
    void viewer.render();
    changed.fire();
  };
  function command(name: string, fn: () => unknown) {
    context.subscriptions.push(
      vscode.commands.registerCommand(`mewra-blackbox.${name}`, async () => {
        try {
          return await fn();
        } catch {
          void vscode.window.showWarningMessage(
            'Blackbox could not complete this action. Check the approved configuration and evidence availability.',
          );
        }
      }),
    );
  }
  command('approve', () => app.approve());
  command('results', () => viewer.show());
  command('cancel', () => app.abort?.abort());
  command('run', async () => {
    const c = await app.refresh();
    if (!c) {
      void vscode.window.showWarningMessage(
        'Review and approve a Blackbox configuration first.',
      );
      return;
    }
    const chosen = await vscode.window.showQuickPick(
      c.scenarios.map((s) => ({
        label: s.label,
        description: `${s.id} · ${s.viewports.map((v) => v.name).join(', ')}`,
        id: s.id,
      })),
      { title: 'Run an approved Blackbox scenario' },
    );
    if (chosen) {
      await app.run([chosen.id]);
      await viewer.show();
    }
  });
  command('runAll', async () => {
    const c = await app.refresh();
    if (!c) return;
    const answer = await vscode.window.showWarningMessage(
      `Run all ${c.scenarios.length} approved scenarios?`,
      { modal: true },
      'Run full suite',
    );
    if (answer === 'Run full suite') {
      await app.run(c.scenarios.map((s) => s.id));
      await viewer.show();
    }
  });
  command('secret', async () => {
    const c = await app.refresh();
    if (!c) return;
    const handles = [
      ...new Set(
        c.scenarios.flatMap((s) =>
          s.steps.flatMap((a) => (a.action === 'fillSecret' ? [a.secret] : [])),
        ),
      ),
    ];
    const handle = await vscode.window.showQuickPick(handles, {
      title: 'Select approved secret handle',
    });
    if (!handle) return;
    const value = await vscode.window.showInputBox({
      title: `Secret: ${handle}`,
      password: true,
      ignoreFocusOut: true,
    });
    if (value !== undefined)
      await context.secrets.store(app.secretKey(handle), value);
  });
  command('baseline', async () => {
    const items = app.latest.results
      .filter((r) => r.baselineKey && r.evidence.actual)
      .map((r) => ({
        label: r.label,
        description: r.viewport,
        id: r.scenarioId,
        viewport: r.viewport,
      }));
    const chosen = await vscode.window.showQuickPick(items, {
      title: 'Review a visual baseline',
    });
    if (chosen) await baseline(chosen.id, chosen.viewport);
  });
  command('proposals', async () => {
    const proposal = await vscode.window.showQuickPick(
      app.proposals.map((p, i) => ({
        label: p.label,
        description: p.id,
        index: i,
      })),
      {
        title:
          'Non-executable agent proposals — review and copy to configuration',
      },
    );
    if (!proposal) return;
    const doc = await vscode.workspace.openTextDocument({
      content: JSON.stringify(app.proposals[proposal.index], null, 2),
      language: 'json',
    });
    await vscode.window.showTextDocument(doc);
  });
  command('install', async () => {
    if (!vscode.workspace.isTrusted) return;
    if (
      (await vscode.window.showWarningMessage(
        'Download the Chromium version pinned to this extension using Playwright’s official installer?',
        { modal: true },
        'Install Chromium',
      )) !== 'Install Chromium'
    )
      return;
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Installing Blackbox Chromium',
      },
      () =>
        new Promise<void>((ok, fail) => {
          const child = spawn(
            process.execPath,
            [
              join(
                context.extensionPath,
                'dist',
                'vendor',
                'playwright-core',
                'cli.js',
              ),
              'install',
              'chromium',
            ],
            {
              cwd: context.extensionPath,
              env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
              shell: false,
              stdio: 'ignore',
            },
          );
          const timer = setTimeout(() => {
            child.kill();
            fail(new Error('Installer timed out'));
          }, 180000);
          child.on('error', () => {
            clearTimeout(timer);
            fail(new Error('Installer failed'));
          });
          child.on('exit', (code) => {
            clearTimeout(timer);
            code === 0 ? ok() : fail(new Error('Installer failed'));
          });
        }),
    );
    void vscode.window.showInformationMessage('Chromium installed.');
  });
  const watcher = vscode.workspace.createFileSystemWatcher(
    '**/.mewra-blackbox.json',
  );
  const refresh = () => {
    app.abort?.abort();
    void app.refresh().then(() => changed.fire());
  };
  context.subscriptions.push(
    watcher,
    watcher.onDidChange(refresh),
    watcher.onDidCreate(refresh),
    watcher.onDidDelete(refresh),
  );
  const registration = await registerWithHost(
    vscode.extensions.getExtension('mewra.mewra-preflight'),
    createCheck(
      () => app.config,
      (ids, workspace) => app.run(ids, workspace),
    ),
  );
  output.appendLine(registration.message);
  if (registration.registration)
    context.subscriptions.push(registration.registration);
  const mcp = new McpServer(
    new McpHandler({
      config: () => app.refresh(),
      results: () => app.latest,
      run: (id) => app.run([id]),
      propose: (s) => app.propose(s),
      audit: (m) => output.appendLine(m),
    }),
    async () => Boolean((await app.refresh())?.mcp.enabled),
  );
  context.subscriptions.push(mcp);
  context.subscriptions.push(
    vscode.lm.registerMcpServerDefinitionProvider('mewra-blackbox', {
      onDidChangeMcpServerDefinitions: changed.event,
      provideMcpServerDefinitions: async () => {
        if (!(await app.refresh())?.mcp.enabled) return [];
        await mcp.start();
        return [
          new vscode.McpHttpServerDefinition(
            'Mewra Blackbox',
            vscode.Uri.parse(mcp.url),
            { Authorization: `Bearer ${mcp.token}` },
            '0.3.0',
          ),
        ];
      },
    }),
  );
  return {
    apiVersion: 1,
    status: () => ({ configured: Boolean(app.config), busy: app.busy }),
  };
}
export function deactivate() {
  service?.abort?.abort();
  service = undefined;
}
