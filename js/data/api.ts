/**
 * API client adapter — re-exports CattleTrackerApi from window when in API mode.
 */
export function isApiMode(): boolean {
  return !!(typeof window !== 'undefined' && window.CATTLE_TRACKER_USE_API && window.CattleTrackerApi);
}

export function getApiBase(): string {
  return String(window.CATTLE_TRACKER_API_BASE || '').trim().replace(/\/$/, '');
}

export function getApi(): unknown {
  return window.CattleTrackerApi ?? null;
}
