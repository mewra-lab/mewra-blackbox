import { access } from 'node:fs/promises';
import type { Browser, BrowserContext, Locator, Page } from 'playwright-core';
import { assertUrl } from '../config/policy';
import {
  type Config,
  type Scenario,
  type Selector,
  type Viewport,
} from '../config/schema';
import type { ArtifactStore } from '../results/artifacts';
import type { ScenarioResult } from '../../shared/results';
import { baselineKey, compare, readBaseline } from '../visual/compare';
import { policyProxy } from './proxy';

export function locate(page: Page, selector: Selector): Locator {
  if (selector.by === 'role')
    return page.getByRole(selector.role, { name: selector.name, exact: true });
  if (selector.by === 'label')
    return page.getByLabel(selector.value, { exact: true });
  return page.getByTestId(selector.value);
}
export async function toolingAvailable() {
  try {
    const { chromium } = await import('playwright-core');
    await access(chromium.executablePath());
    return true;
  } catch {
    return false;
  }
}
export type RunOptions = {
  config: Config;
  scenario: Scenario;
  viewport: Viewport;
  store: ArtifactStore;
  getSecret: (id: string) => Promise<string | undefined>;
  signal?: AbortSignal;
  progress?: (action: string) => void;
};
async function eventually(
  check: () => Promise<boolean>,
  ms: number,
  signal?: AbortSignal,
) {
  const end = Date.now() + ms;
  do {
    if (signal?.aborted) throw new Error('Cancelled');
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 40));
  } while (Date.now() < end);
  throw new Error('Assertion failed');
}
export async function runScenario(o: RunOptions): Promise<ScenarioResult> {
  const { config, scenario: s, viewport, store, signal } = o,
    target = config.targets.find((t) => t.id === s.target)!;
  const start = Date.now(),
    events: Array<{ step: number; action: string; status: string }> = [];
  const result: ScenarioResult = {
    scenarioId: s.id,
    label: s.label,
    targetLabel: target.label,
    routeLabel: s.routes[0],
    viewport: viewport.name,
    width: viewport.width,
    height: viewport.height,
    status: 'fail',
    message: 'Run did not complete.',
    durationMs: 0,
    evidence: {},
  };
  if (!(await toolingAvailable()))
    return {
      ...result,
      status: 'not-configured',
      message:
        'Install the bundled Chromium through Blackbox: Install Chromium.',
    };
  let browser: Browser | undefined,
    context: BrowserContext | undefined,
    page: Page | undefined,
    proxy: Awaited<ReturnType<typeof policyProxy>> | undefined;
  let denied = false,
    cancelled = false,
    timedOut = false,
    step = 0;
  const stop = () => {
    cancelled = true;
    void context?.close().catch(() => {});
    void browser?.close().catch(() => {});
  };
  const timer = setTimeout(() => {
    timedOut = true;
    stop();
  }, config.timeouts.runMs);
  signal?.addEventListener('abort', stop, { once: true });
  const guard = () => {
    if (signal?.aborted || cancelled) throw new Error('Run stopped');
    if (denied) throw new Error('Policy violation');
  };
  const secretRun = s.steps.some((a) => a.action === 'fillSecret');
  try {
    guard();
    proxy = await policyProxy(
      target,
      () => {
        denied = true;
      },
      undefined,
      Math.min(5000, config.timeouts.runMs),
    );
    guard();
    const { chromium } = await import('playwright-core');
    browser = await chromium.launch({
      headless: true,
      timeout: Math.max(
        1,
        Math.min(config.timeouts.runMs - (Date.now() - start), 30000),
      ),
      chromiumSandbox: process.platform === 'linux',
      proxy: { server: proxy.url, bypass: '<-loopback>' },
      args: [
        '--disable-quic',
        '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
        '--disable-background-networking',
      ],
    });
    guard();
    context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      isMobile: viewport.mobile,
      hasTouch: viewport.mobile,
      deviceScaleFactor: 1,
      locale: 'en-US',
      timezoneId: 'UTC',
      colorScheme: 'light',
      reducedMotion: 'reduce',
      serviceWorkers: 'block',
      acceptDownloads: false,
      ignoreHTTPSErrors: false,
    });
    guard();
    context.setDefaultTimeout(config.timeouts.actionMs);
    context.setDefaultNavigationTimeout(config.timeouts.navigationMs);
    await context.route('**/*', async (route) => {
      try {
        guard();
        const req = route.request();
        if (
          page &&
          req.isNavigationRequest() &&
          (req.frame().page() !== page || req.frame() !== page.mainFrame())
        )
          throw new Error('Popup or frame navigation denied.');
        assertUrl(
          req.url(),
          target,
          req.isNavigationRequest() ? s.routes : undefined,
        );
        await route.continue();
      } catch {
        if (!cancelled && !signal?.aborted) denied = true;
        await route.abort().catch(() => {});
      }
    });
    await context.routeWebSocket('**/*', (socket) => {
      denied = true;
      socket.close();
    });
    page = await context.newPage();
    // Playwright routing is not repeated for redirect hops. Intercept redirect
    // responses before Chromium follows Location, including same-origin paths.
    const cdp = await context.newCDPSession(page);
    cdp.on('Fetch.requestPaused', async (event) => {
      try {
        const location = event.responseHeaders?.find(
          (h) => h.name.toLowerCase() === 'location',
        )?.value;
        if (
          event.responseStatusCode &&
          event.responseStatusCode >= 300 &&
          event.responseStatusCode < 400 &&
          location
        ) {
          assertUrl(
            new URL(location, event.request.url).href,
            target,
            event.resourceType === 'Document' ? s.routes : undefined,
          );
        }
        await cdp.send('Fetch.continueResponse', {
          requestId: event.requestId,
        });
      } catch {
        if (!cancelled) denied = true;
        await cdp
          .send('Fetch.failRequest', {
            requestId: event.requestId,
            errorReason: 'BlockedByClient',
          })
          .catch(() => {});
      }
    });
    await cdp.send('Fetch.enable', {
      patterns: [{ urlPattern: '*', requestStage: 'Response' }],
    });
    const mainPage = page;
    context.on('page', (p) => {
      if (p !== mainPage) {
        denied = true;
        void p.close().catch(() => {});
      }
    });
    page.on('download', (d) => {
      denied = true;
      void d.cancel().catch(() => {});
    });
    page.on('dialog', (d) => void d.dismiss().catch(() => {}));
    page.on('framenavigated', (frame) => {
      if (frame.url() === 'about:blank') return;
      try {
        assertUrl(frame.url(), target, s.routes);
      } catch {
        denied = true;
      }
    });
    // No console text, DOM, request headers/bodies, cookies, or raw browser errors are retained.
    for (const action of s.steps) {
      guard();
      o.progress?.(`${step + 1}/${s.steps.length} ${action.action}`);
      const locator =
        'selector' in action ? locate(page, action.selector) : undefined;
      switch (action.action) {
        case 'navigate':
          await page.goto(target.origin + action.route, {
            waitUntil: 'domcontentloaded',
          });
          break;
        case 'click':
          await locator!.click();
          break;
        case 'fill':
          await locator!.fill(action.value);
          break;
        case 'fillSecret': {
          const secret = await o.getSecret(action.secret);
          if (!secret) throw new Error('Secret unavailable');
          await locator!.fill(secret);
          break;
        }
        case 'select':
          await locator!.selectOption(action.value);
          break;
        case 'url':
          await eventually(
            async () => {
              const u = new URL(page!.url());
              return (
                u.origin === target.origin &&
                u.pathname === action.route &&
                !u.search
              );
            },
            config.timeouts.actionMs,
            signal,
          );
          break;
        case 'visible':
          await locator!.waitFor({ state: 'visible' });
          break;
        case 'text':
          await eventually(
            async () =>
              (await locator!.textContent({
                timeout: config.timeouts.actionMs,
              })) === action.text,
            config.timeouts.actionMs,
            signal,
          );
          break;
        case 'count':
          await eventually(
            async () => (await locator!.count()) === action.count,
            config.timeouts.actionMs,
            signal,
          );
          break;
      }
      guard();
      events.push({ step: ++step, action: action.action, status: 'pass' });
    }
    guard();
    result.status = 'pass';
    result.message = 'All declared assertions passed.';
  } catch (cause) {
    result.status = signal?.aborted && !timedOut ? 'warning' : 'fail';
    result.message = timedOut
      ? 'Total run timeout exceeded.'
      : signal?.aborted
        ? 'Run cancelled.'
        : denied
          ? 'Target policy denied a browser request.'
          : `Step ${step + 1} did not complete (${s.steps[step]?.action ?? 'setup'}).`;
    events.push({
      step: step + 1,
      action: s.steps[step]?.action ?? 'setup',
      status: result.status,
    });
    if (
      !browser &&
      cause instanceof Error &&
      cause.message.includes("Executable doesn't exist")
    ) {
      result.status = 'not-configured';
      result.message = 'Install Chromium through Blackbox: Install Chromium.';
    }
  }
  try {
    if (
      page &&
      !page.isClosed() &&
      !cancelled &&
      !denied &&
      !secretRun &&
      s.evidence.screenshot !== 'off' &&
      (s.evidence.screenshot === 'always' || result.status === 'fail')
    ) {
      const masks = s.evidence.masks.map((m) => locate(page!, m));
      let area = 0;
      for (const mask of masks) {
        if ((await mask.count()) !== 1)
          throw new Error('Mask must identify one visible region.');
        const box = await mask.boundingBox();
        if (!box) throw new Error('Mask missing.');
        area += box.width * box.height;
        for (const action of s.steps) {
          if (
            'selector' in action &&
            ['visible', 'text', 'count'].includes(action.action)
          ) {
            const asserted = await locate(page, action.selector).boundingBox();
            if (
              asserted &&
              box.x <= asserted.x &&
              box.y <= asserted.y &&
              box.x + box.width >= asserted.x + asserted.width &&
              box.y + box.height >= asserted.y + asserted.height
            )
              throw new Error('Mask conceals assertion.');
          }
        }
      }
      if (area > viewport.width * viewport.height * 0.25)
        throw new Error('Masks cover more than 25% of viewport.');
      const actual = await page.screenshot({
        type: 'png',
        fullPage: false,
        animations: 'disabled',
        caret: 'hide',
        timeout: config.timeouts.screenshotMs,
        mask: [page.locator('input, textarea, [contenteditable]'), ...masks],
      });
      guard();
      result.evidence.actual = await store.write(actual, 'png');
      if (s.visual) {
        const key = baselineKey(s, viewport, target.origin);
        result.baselineKey = key;
        const baseline = await readBaseline(store, key);
        if (!baseline) {
          if (result.status === 'pass') {
            result.status = 'warning';
            result.message =
              'No approved baseline. Review the actual image to create one.';
          }
        } else {
          const diff = compare(actual, baseline.bytes, s.visual.pixelThreshold);
          result.evidence.baseline = baseline.image;
          result.evidence.diff = await store.write(diff.diff, 'png');
          result.visual = {
            ratio: diff.ratio,
            threshold: s.visual.maxDiffRatio,
            masks: s.evidence.masks.length,
          };
          if (diff.ratio > s.visual.maxDiffRatio) {
            result.status = 'fail';
            result.message =
              'Visual difference exceeds the approved threshold.';
          }
        }
      }
    }
    if (secretRun && s.evidence.screenshot !== 'off')
      result.message += ' Screenshots suppressed for secret-bearing scenarios.';
    if (result.status !== 'pass' && s.evidence.traceOnFailure)
      result.evidence.trace = await store.write(
        Buffer.from(
          JSON.stringify({ version: 1, kind: 'redacted-action-trace', events }),
        ),
        'json',
      );
  } catch {
    result.status = 'fail';
    result.message =
      'Evidence capture or mask validation failed. Review evidence policy.';
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', stop);
    await context?.close().catch(() => {});
    await browser?.close().catch(() => {});
    await proxy?.close();
  }
  if (denied) {
    result.status = 'fail';
    result.message = 'Target policy denied a browser request.';
  }
  if (timedOut) {
    result.status = 'fail';
    result.message = 'Total run timeout exceeded.';
  }
  result.durationMs = Date.now() - start;
  return result;
}
