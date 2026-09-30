declare function acquireVsCodeApi(): { postMessage(message: unknown): void };
const api = acquireVsCodeApi();
document.addEventListener('click', (e) => {
  const element = (e.target as HTMLElement).closest('button');
  if (!element) return;
  if (element.id === 'cancel') api.postMessage({ type: 'cancel' });
  else if (element.dataset.run)
    api.postMessage({ type: 'run', scenarioId: element.dataset.run });
  else if (element.dataset.baseline && element.dataset.viewport)
    api.postMessage({
      type: 'baseline',
      scenarioId: element.dataset.baseline,
      viewport: element.dataset.viewport,
    });
});
// No arbitrary commands, URLs, paths, or browser configuration enter the message surface.
export {};
