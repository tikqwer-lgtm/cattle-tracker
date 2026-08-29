/**
 * Entries adapters.
 */
export function getEntries(): unknown[] {
  if (Array.isArray(window.entries)) return window.entries as unknown[];
  return [];
}

export function getCurrentObjectId(): string {
  if (typeof window.getCurrentObjectId === 'function') {
    return window.getCurrentObjectId() || 'default';
  }
  return 'default';
}

export function loadLocally(opts?: { forceFromServer?: boolean }): void | Promise<void> {
  if (typeof window.loadLocally === 'function') {
    return window.loadLocally(opts);
  }
}

export function saveLocally(): void {
  if (typeof window.saveLocally === 'function') {
    window.saveLocally();
  }
}
