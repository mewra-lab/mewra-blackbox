import * as vscode from 'vscode';
import { randomBytes } from 'node:crypto';
import { viewerMessage } from '../shared/messages';
import type { BlackboxService } from './service';
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );
export class ResultViewer {
  private panel: vscode.WebviewPanel | undefined;
  private generation = 0;
  constructor(
    private service: BlackboxService,
    private extension: vscode.Uri,
    private baseline: (id: string, viewport: string) => Promise<void>,
  ) {}
  async show() {
    if (!this.panel) {
      this.panel = vscode.window.createWebviewPanel(
        'mewraBlackbox',
        'Mewra Blackbox',
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          localResourceRoots: [vscode.Uri.joinPath(this.extension, 'dist')],
        },
      );
      this.panel.onDidDispose(() => {
        this.panel = undefined;
      });
      this.panel.webview.onDidReceiveMessage(async (raw) => {
        const parsed = viewerMessage.safeParse(raw);
        if (!parsed.success) return;
        const m = parsed.data;
        try {
          if (m.type === 'cancel') this.service.abort?.abort();
          else if (m.type === 'run') await this.service.run([m.scenarioId]);
          else await this.baseline(m.scenarioId, m.viewport);
        } catch {
          void vscode.window.showWarningMessage(
            'Blackbox action could not complete.',
          );
        }
        await this.render();
      });
    }
    this.panel.reveal();
    await this.render();
  }
  async render() {
    const panel = this.panel;
    if (!panel) return;
    const generation = ++this.generation;
    let displayedBytes = 0;
    const nonce = randomBytes(24).toString('hex'),
      web = panel.webview;
    const script = web.asWebviewUri(
      vscode.Uri.joinPath(this.extension, 'dist', 'viewer.js'),
    );
    const style = web.asWebviewUri(
      vscode.Uri.joinPath(this.extension, 'dist', 'viewer.css'),
    );
    const cards = [];
    for (const r of this.service.latest.results) {
      if (generation !== this.generation) return;
      const figures = [];
      for (const [kind, id] of Object.entries(r.evidence)) {
        if (!id || !this.service.store) continue;
        try {
          if (displayedBytes >= 24_000_000) {
            figures.push(
              '<p>Preview limit reached. Run this scenario separately to review its evidence.</p>',
            );
            continue;
          }
          const bytes = await this.service.store.read(id);
          displayedBytes += bytes.length;
          if (kind === 'trace') {
            figures.push(
              `<details><summary>Redacted action trace</summary><pre>${escape(bytes.toString())}</pre></details>`,
            );
          } else if (
            bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a'
          ) {
            figures.push(
              `<figure><figcaption>${escape(kind)}</figcaption><img tabindex="0" alt="${escape(kind)} image for ${escape(r.label)} at ${r.width} by ${r.height}" src="data:image/png;base64,${bytes.toString('base64')}"></figure>`,
            );
          }
        } catch {
          figures.push('<p>Evidence expired or unavailable.</p>');
        }
      }
      cards.push(
        `<article aria-label="${escape(r.label)} ${escape(r.viewport)}"><div class="card-heading"><h2>${escape(r.label)}</h2><strong class="status ${r.status}">${escape(r.status.toUpperCase())}</strong></div><p class="context">${escape(r.targetLabel)} · ${escape(r.routeLabel)} · ${r.width} × ${r.height} · ${escape(r.viewport)} · ${(r.durationMs / 1000).toFixed(1)}s</p><p>${escape(r.message)}</p>${r.visual ? `<p>Changed pixels: ${(r.visual.ratio * 100).toFixed(2)}% · Limit: ${(r.visual.threshold * 100).toFixed(2)}% · Masks: ${r.visual.masks}</p>` : ''}<div class="actions"><button data-run="${escape(r.scenarioId)}" ${this.service.busy ? 'disabled' : ''}>Run again</button>${r.baselineKey && r.evidence.actual ? `<button data-baseline="${escape(r.scenarioId)}" data-viewport="${escape(r.viewport)}" ${this.service.busy ? 'disabled' : ''}>Review baseline…</button>` : ''}</div><div class="evidence">${figures.join('')}</div></article>`,
      );
    }
    if (this.panel !== panel || generation !== this.generation) return;
    web.html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src ${web.cspSource}; script-src 'nonce-${nonce}';"><link rel="stylesheet" href="${style}"><title>Mewra Blackbox results</title></head><body><header><div><p class="eyebrow">MEWRA / BLACKBOX</p><h1>Browser evidence</h1></div><span class="status">${escape(this.service.latest.status.toUpperCase())}</span></header><p role="status">${escape(this.service.latest.message)}</p>${this.service.busy ? '<button id="cancel">Cancel active run</button>' : ''}<main>${cards.join('') || '<section><h2>No run evidence yet</h2><p>Review and approve .mewra-blackbox.json, then use “Blackbox: Run Approved Scenario” from the Command Palette.</p><p>Images stay on this device. Baseline updates require your review.</p></section>'}</main><script nonce="${nonce}" src="${script}"></script></body></html>`;
  }
  dispose() {
    this.panel?.dispose();
  }
}
