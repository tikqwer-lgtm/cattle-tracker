/**
 * Entries / herd data adapters.
 */
export function getEntries(): unknown[] {
  if (Array.isArray(window.entries)) return window.entries;
  return [];
}

export function loadLocally(): void {
  if (typeof window.loadLocally === 'function') window.loadLocally();
}

export function saveLocally(): void {
  if (typeof window.saveLocally === 'function') window.saveLocally();
}
