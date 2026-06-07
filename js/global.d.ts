/**
 * Global type extensions for window (legacy API used by HTML and modules).
 */
declare interface Window {
  entries?: unknown[];
  navigate?: (screenId: string, options?: { group?: string }) => void;
  showAuthRegister?: () => void;
  showAuthLogin?: () => void;
  handleLogin?: (e: Event) => void;
  handleRegister?: (e: Event) => void;
  skipAuth?: () => void;
  handleLogout?: () => void;
  navigateToSubmenu?: (groupId: string) => void;
  getCurrentUser?: () => { id: string; username: string; role: string } | null;
  CATTLE_TRACKER_USE_API?: boolean;
  CATTLE_TRACKER_API_BASE?: string;
  CATTLE_TRACKER_DEFAULT_SERVER_URL?: string;
  CattleTrackerApi?: unknown;
  CattleTrackerEvents?: { on: (a: string, b: () => void) => void; emit: (a: string, b: unknown) => void };
  initFarmSettingsScreen?: () => void;
  getFarmTechnicians?: () => string[];
  setFarmTechnicians?: (arr: string[]) => void;
  getFarmBullsManual?: () => string[];
  setFarmBullsManual?: (arr: string[]) => void;
  getFarmDrugs?: () => string[];
  setFarmDrugs?: (arr: string[]) => void;
  getFarmVwpDays?: () => number;
  setFarmVwpDays?: (days: number) => number;
  persistFarmSettingsToServer?: () => Promise<void>;
  initStallMapScreen?: () => void;
  getDaysInLactation?: (entry: Record<string, unknown>) => number | null;
  getDaysSinceLastInsemination?: (entry: Record<string, unknown>) => number | null;
  getDaysPregnant?: (entry: Record<string, unknown>) => number | null;
  refreshFarmDatalists?: () => void;
  fillAllInseminationCodeSelects?: () => void;
}
