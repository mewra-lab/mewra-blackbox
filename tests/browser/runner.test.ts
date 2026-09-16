import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fixtures } from './fixtures';
import { configuration } from '../helpers';
import { ArtifactStore } from '../../src/core/results/artifacts';
import { runScenario } from '../../src/core/browser/runner';
import { saveBaseline } from '../../src/core/visual/compare';
import type { Config } from '../../src/core/config/schema';
import { chromium } from 'playwright-core';
describe.skipIf(process.env.BLACKBOX_BROWSER_TESTS !== '1')(
  'real Chromium controlled fixtures',
  () => {
    let fixture: Awaited<ReturnType<typeof fixtures>>,
      root: string,
      store: ArtifactStore;
    beforeAll(async () => {
      // A setup failure must fail the suite, not accidentally satisfy denial tests.
      const probe = await chromium.launch({
        headless: true,
        chromiumSandbox: process.platform === 'linux',
      });
      await probe.close();
      fixture = await fixtures();
      root = await mkdtemp(join(tmpdir(), 'blackbox-browser-'));
      await mkdir(join(root, 'workspace'));
      store = new ArtifactStore(
        join(root, 'evidence'),
        join(root, 'workspace'),
        configuration().retention,
      );
      await store.init();
    });
    afterAll(async () => {
      await fixture?.close();
      if (root) await rm(root, { recursive: true, force: true });
    });
    function run(config: Config, signal?: AbortSignal) {
      return runScenario({
        config,
        scenario: config.scenarios[0],
        viewport: config.scenarios[0].viewports[0],
        store,
        getSecret: async () => 'synthetic-secret-value',
        signal,
      });
    }
    it('executes navigation, fill, select, click, text, count, URL and visibility assertions', async () => {
      const c = configuration(fixture.origin);
      c.scenarios[0].steps.push(
        {
          action: 'fill',
          selector: { by: 'label', value: 'Name' },
          value: 'Fixture user',
        },
        {
          action: 'select',
          selector: { by: 'label', value: 'Plan' },
          value: 'pro',
        },
        {
          action: 'click',
          selector: { by: 'role', role: 'button', name: 'Save' },
        },
        {
          action: 'text',
          selector: { by: 'testId', value: 'result' },
          text: 'Saved',
        },
        {
          action: 'count',
          selector: { by: 'role', role: 'heading', name: 'Hello' },
          count: 1,
        },
        { action: 'url', route: '/' },
      );
      const result = await run(c);
      expect(result.status, result.message).toBe('pass');
    });
    it('supports mobile viewports and reproducible approved baseline comparison', async () => {
      const c = configuration(fixture.origin);
      c.scenarios[0].viewports[0] = {
        name: 'mobile',
        width: 390,
        height: 844,
        mobile: true,
      };
      c.scenarios[0].visual = { maxDiffRatio: 0, pixelThreshold: 0.1 };
      c.scenarios[0].evidence.screenshot = 'always';
      const first = await run(c);
      expect(first.status).toBe('warning');
      expect(first.baselineKey).toBeTruthy();
      await saveBaseline(store, first.baselineKey!, first.evidence.actual!);
      const second = await run(c);
      expect(second.status).toBe('pass');
      expect(second.visual?.ratio).toBe(0);
      fixture.variant(true);
      try {
        const changed = await run(c);
        expect(changed.status).toBe('fail');
        expect(changed.visual!.ratio).toBeGreaterThan(0);
      } finally {
        fixture.variant(false);
      }
    });
    it('blocks redirects before an unapproved server receives traffic', async () => {
      const c = configuration(fixture.origin);
      c.scenarios[0].routes.push('/redirect');
      c.scenarios[0].steps = [
        { action: 'navigate', route: '/redirect' },
        {
          action: 'visible',
          selector: { by: 'role', role: 'heading', name: 'Hello' },
        },
      ];
      const result = await run(c);
      expect(result.status).toBe('fail');
      expect(result.message).toContain('policy');
      expect(fixture.forbiddenHits()).toBe(0);
    });
    it('blocks same-origin redirects before an unapproved route receives traffic', async () => {
      const c = configuration(fixture.origin);
      c.scenarios[0].routes = ['/same-redirect'];
      c.scenarios[0].steps[0] = { action: 'navigate', route: '/same-redirect' };
      const result = await run(c);
      expect(result.status).toBe('fail');
      expect(fixture.unapprovedRouteHits()).toBe(0);
    });
    it('bounds timeout and supports cancellation', async () => {
      const c = configuration(fixture.origin);
      c.scenarios[0].routes.push('/slow');
      c.scenarios[0].steps[0] = { action: 'navigate', route: '/slow' };
      c.timeouts.navigationMs = 500;
      expect((await run(c)).status).toBe('fail');
      const abort = new AbortController();
      abort.abort();
      expect((await run(c, abort.signal)).status).toBe('warning');
    });
    it('denies popup and frame navigation even to the approved origin', async () => {
      const popup = configuration(fixture.origin);
      popup.scenarios[0].steps.push({
        action: 'click',
        selector: { by: 'role', role: 'button', name: 'Popup' },
      });
      expect((await run(popup)).status).toBe('fail');
      const frame = configuration(fixture.origin);
      frame.scenarios[0].routes = ['/frame', '/same-redirect'];
      frame.scenarios[0].steps[0] = { action: 'navigate', route: '/frame' };
      expect((await run(frame)).status).toBe('fail');
      expect(fixture.unapprovedRouteHits()).toBe(0);
    });
    it('suppresses secret screenshots and raw console/trace content', async () => {
      const c = configuration(fixture.origin);
      c.scenarios[0].evidence.screenshot = 'always';
      c.scenarios[0].steps.push(
        {
          action: 'fillSecret',
          secret: 'password',
          selector: { by: 'label', value: 'Password' },
        },
        {
          action: 'text',
          selector: { by: 'testId', value: 'result' },
          text: 'Missing',
        },
      );
      c.timeouts.actionMs = 200;
      const r = await run(c);
      expect(r.status).toBe('fail');
      expect(r.evidence.actual).toBeUndefined();
      const trace = (await store.read(r.evidence.trace!)).toString();
      expect(trace).not.toContain('synthetic-secret');
      expect(trace).not.toContain('Password');
    });
    it('refuses masks covering assertions', async () => {
      const c = configuration(fixture.origin);
      c.scenarios[0].evidence = {
        screenshot: 'always',
        traceOnFailure: true,
        masks: [{ by: 'role', role: 'heading', name: 'Hello' }],
      };
      const r = await run(c);
      expect(r.status).toBe('fail');
      expect(r.evidence.actual).toBeUndefined();
    });
    it('rejects loopback without explicit policy before browser launch', async () => {
      const c = configuration(fixture.origin);
      c.targets[0].allowLoopback = false;
      expect((await run(c)).status).toBe('fail');
    });
    it('isolates cookies and local storage between contexts', async () => {
      const c = configuration(fixture.origin);
      c.scenarios[0].routes = ['/state'];
      c.scenarios[0].steps = [
        { action: 'navigate', route: '/state' },
        {
          action: 'text',
          selector: { by: 'testId', value: 'result' },
          text: 'Fresh',
        },
      ];
      expect((await run(c)).status).toBe('pass');
      expect((await run(c)).status).toBe('pass');
    });
    it('blocks external subresources and frames before upstream traffic', async () => {
      const c = configuration(fixture.origin);
      c.scenarios[0].routes = ['/external'];
      c.scenarios[0].steps[0] = { action: 'navigate', route: '/external' };
      expect((await run(c)).status).toBe('fail');
      expect(fixture.forbiddenHits()).toBe(0);
    });
    it('cancels an active navigation and cleans up before a subsequent run', async () => {
      const c = configuration(fixture.origin);
      c.scenarios[0].routes = ['/slow'];
      c.scenarios[0].steps[0] = { action: 'navigate', route: '/slow' };
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), 1500);
      try {
        expect((await run(c, abort.signal)).status).toBe('warning');
      } finally {
        clearTimeout(timer);
      }
      expect((await run(configuration(fixture.origin))).status).toBe('pass');
    });
    it('bounds total runtime independently of a long navigation timeout', async () => {
      const c = configuration(fixture.origin);
      c.scenarios[0].routes = ['/slow'];
      c.scenarios[0].steps[0] = { action: 'navigate', route: '/slow' };
      c.timeouts.runMs = 1000;
      const result = await run(c);
      expect(result.status).toBe('fail');
      expect(result.durationMs).toBeLessThan(5000);
    });
  },
);
