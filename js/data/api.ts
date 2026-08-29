/**
 * API client adapter.
 */
export function useApiMode(): boolean {
  return !!(typeof window !== 'undefined' && window.CATTLE_TRACKER_USE_API && window.CattleTrackerApi);
}

export function getApiBase(): string {
  return (typeof window !== 'undefined' && window.CATTLE_TRACKER_API_BASE) || '';
}

export function getApi(): unknown {
  return typeof window !== 'undefined' ? window.CattleTrackerApi : null;
}
