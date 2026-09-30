import { configSchema } from '../src/core/config/schema';
export function configuration(origin = 'https://example.test') {
  return configSchema.parse({
    version: 1,
    targets: [
      {
        id: 'app',
        label: 'Test application',
        environment: 'staging',
        origin,
        ...(origin.startsWith('http://127.')
          ? { allowLoopback: true, allowCustomPort: true }
          : {}),
      },
    ],
    scenarios: [
      {
        id: 'home',
        label: 'Home journey',
        target: 'app',
        routes: ['/'],
        viewports: [{ name: 'desktop', width: 800, height: 600 }],
        changedFiles: ['src/**'],
        steps: [
          { action: 'navigate', route: '/' },
          {
            action: 'visible',
            selector: { by: 'role', role: 'heading', name: 'Hello' },
          },
        ],
        evidence: { screenshot: 'off', traceOnFailure: true },
      },
    ],
  });
}
