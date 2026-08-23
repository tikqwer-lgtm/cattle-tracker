/**
 * React hooks over ESM data layer.
 */
import { useCallback, useEffect, useState } from 'react';
import { getCurrentObjectId, getCurrentUser, hasCapability, type AppUser } from './session';
import { getEntries } from './entries';

export function useCurrentUser(): AppUser | null {
  const [user, setUser] = useState<AppUser | null>(() => getCurrentUser());

  useEffect(() => {
    const refresh = () => setUser(getCurrentUser());
    refresh();
    window.addEventListener('cattle-tracker:navigate', refresh);
    window.addEventListener('cattle-tracker-auth-menu', refresh);
    return () => {
      window.removeEventListener('cattle-tracker:navigate', refresh);
      window.removeEventListener('cattle-tracker-auth-menu', refresh);
    };
  }, []);

  return user;
}

export function useCapability(cap: string): boolean {
  const user = useCurrentUser();
  return hasCapability(cap, user);
}

export function useCurrentObjectId(): string {
  const [id, setId] = useState(() => getCurrentObjectId());
  useEffect(() => {
    const refresh = () => setId(getCurrentObjectId());
    window.addEventListener('cattle-tracker:navigate', refresh);
    return () => window.removeEventListener('cattle-tracker:navigate', refresh);
  }, []);
  return id;
}

export function useEntries(): unknown[] {
  const [list, setList] = useState<unknown[]>(() => getEntries());
  const refresh = useCallback(() => setList(getEntries().slice()), []);
  useEffect(() => {
    refresh();
    window.addEventListener('cattle-tracker:navigate', refresh);
    return () => window.removeEventListener('cattle-tracker:navigate', refresh);
  }, [refresh]);
  return list;
}
