/**
 * ESM data layer — thin adapters over legacy window API.
 * React hooks import from here; IIFE modules still write to window until fully migrated.
 */
export type AppUser = {
  id: string;
  username: string;
  role: string;
  [key: string]: unknown;
};

export function getCurrentUser(): AppUser | null {
  if (typeof window.getCurrentUser === 'function') {
    return (window.getCurrentUser() as AppUser | null) ?? null;
  }
  return null;
}

export function hasCapability(cap: string, user?: AppUser | null): boolean {
  const u = user === undefined ? getCurrentUser() : user;
  if (typeof window.hasCapability === 'function') {
    return !!window.hasCapability(cap, u as { id: string; username: string; role: string } | null);
  }
  return !!(u && u.role === 'admin');
}

export function getCurrentObjectId(): string {
  if (typeof window.getCurrentObjectId === 'function') {
    return String(window.getCurrentObjectId() || 'default');
  }
  return 'default';
}

export function navigate(screenId: string, options?: { group?: string; force?: boolean }): void {
  if (typeof window.navigate === 'function') {
    window.navigate(screenId, options);
  }
}

export function showToast(message: string, type: string = 'info'): void {
  const w = window as Window & { showToast?: (m: string, t: string) => void };
  if (typeof w.showToast === 'function') w.showToast(message, type);
}
