/**
 * Session / navigation adapters over legacy window API.
 */
export type AppUser = {
  id: string;
  username: string;
  role: string;
};

export function getCurrentUser(): AppUser | null {
  if (typeof window.getCurrentUser === 'function') {
    return window.getCurrentUser() as AppUser | null;
  }
  return null;
}

export function hasCapability(capability: string, user?: AppUser | null): boolean {
  if (typeof window.hasCapability === 'function') {
    return window.hasCapability(capability, user ?? undefined);
  }
  const u = user ?? getCurrentUser();
  return !!(u && u.role === 'admin');
}

export function navigate(screenId: string, options?: { group?: string; force?: boolean }): void {
  if (typeof window.navigate === 'function') {
    window.navigate(screenId, options);
  }
}

export function navigateToParent(): void {
  if (typeof window.navigateToParent === 'function') {
    window.navigateToParent();
  }
}

export function showToast(message: string, type: string = 'info'): void {
  if (typeof window.showToast === 'function') {
    window.showToast(message, type);
  }
}
