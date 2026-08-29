/**
 * Help / DevTools diagnostics adapters.
 */
export function refreshHelpDevtoolsDiagnostics(): void | Promise<void> {
  if (typeof window.refreshHelpDevtoolsDiagnostics === 'function') {
    return window.refreshHelpDevtoolsDiagnostics();
  }
}

export function getHelpDevtoolsDiagnosticsText(): string {
  if (typeof window.getHelpDevtoolsDiagnosticsText === 'function') {
    return window.getHelpDevtoolsDiagnosticsText() || '';
  }
  const el = document.getElementById('help-diagnostics-log') as HTMLTextAreaElement | null;
  return el?.value || '';
}

export function clearHelpDevtoolsDiagnostics(): void {
  if (typeof window.clearHelpDevtoolsDiagnostics === 'function') {
    window.clearHelpDevtoolsDiagnostics();
  }
}

export async function copyText(text: string): Promise<void> {
  const api = window.electronAPI;
  if (api && typeof api.copyText === 'function') {
    await api.copyText(text);
    return;
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
  }
}
