/**
 * Farm settings adapters over legacy window API (object-scoped lists / VWP / chat hints).
 */
export type ChatAssistantSettings = {
  planHints: boolean;
  overdueHints: boolean;
  dailyPlanHints: boolean;
};

export function getFarmTechnicians(): string[] {
  return (window.getFarmTechnicians?.() ?? []).slice();
}

export function setFarmTechnicians(arr: string[]): void {
  window.setFarmTechnicians?.(arr);
}

export function getFarmBullsManual(): string[] {
  return (window.getFarmBullsManual?.() ?? []).slice();
}

export function setFarmBullsManual(arr: string[]): void {
  window.setFarmBullsManual?.(arr);
}

export function getFarmDrugs(): string[] {
  return (window.getFarmDrugs?.() ?? []).slice();
}

export function setFarmDrugs(arr: string[]): void {
  window.setFarmDrugs?.(arr);
}

export function getFarmVwpDays(): number {
  return window.getFarmVwpDays?.() ?? 60;
}

export function setFarmVwpDays(days: number): number {
  if (typeof window.setFarmVwpDays === 'function') {
    return window.setFarmVwpDays(days);
  }
  return days;
}

export function persistFarmSettingsToServer(): Promise<void> {
  const p = window.persistFarmSettingsToServer?.();
  if (p && typeof p.then === 'function') return p;
  return Promise.resolve();
}

export function refreshFarmDatalists(): void {
  window.refreshFarmDatalists?.();
}

export function fillAllInseminationCodeSelects(): void {
  window.fillAllInseminationCodeSelects?.();
}

export function getChatAssistantSettings(): ChatAssistantSettings {
  const s = window.getChatAssistantSettings?.();
  return {
    planHints: s?.planHints !== false,
    overdueHints: s?.overdueHints !== false,
    dailyPlanHints: s?.dailyPlanHints !== false,
  };
}

export function setChatAssistantSettings(settings: ChatAssistantSettings): void {
  window.setChatAssistantSettings?.(settings);
}
