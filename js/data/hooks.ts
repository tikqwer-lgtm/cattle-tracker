import { useCallback, useEffect, useState } from 'react';
import { getEntries } from './entries';
import { getCurrentUser, hasCapability, type AppUser } from './session';

export function useCurrentUser(): AppUser | null {
  const [user, setUser] = useState<AppUser | null>(() => getCurrentUser());

  useEffect(() => {
    const refresh = () => setUser(getCurrentUser());
    window.addEventListener('cattle-tracker:navigate', refresh);
    if (window.CattleTrackerEvents && typeof window.CattleTrackerEvents.on === 'function') {
      window.CattleTrackerEvents.on('auth:changed', refresh);
    }
    return () => {
      window.removeEventListener('cattle-tracker:navigate', refresh);
    };
  }, []);

  return user;
}

export function useCapability(capability: string): boolean {
  const user = useCurrentUser();
  const [ok, setOk] = useState(() => hasCapability(capability, user));

  useEffect(() => {
    setOk(hasCapability(capability, user));
    const refresh = () => setOk(hasCapability(capability, getCurrentUser()));
    window.addEventListener('cattle-tracker:navigate', refresh);
    return () => window.removeEventListener('cattle-tracker:navigate', refresh);
  }, [capability, user]);

  return ok;
}

export function useEntries(): unknown[] {
  const [entries, setEntries] = useState<unknown[]>(() => getEntries());

  const refresh = useCallback(() => setEntries(getEntries()), []);

  useEffect(() => {
    refresh();
    window.addEventListener('cattle-tracker:navigate', refresh);
    if (window.CattleTrackerEvents && typeof window.CattleTrackerEvents.on === 'function') {
      window.CattleTrackerEvents.on('entries:updated', refresh);
    }
    return () => window.removeEventListener('cattle-tracker:navigate', refresh);
  }, [refresh]);

  return entries;
}
