import { useLayoutEffect, useState } from 'react';

export const NAVIGATE_EVENT = 'cattle-tracker:navigate';

function readCurrentScreenId(): string | null {
  if (typeof window === 'undefined') return null;
  if (typeof window.getCurrentScreenId === 'function') {
    return window.getCurrentScreenId() || null;
  }
  return window._currentScreenId || null;
}

let current: string | null = null;
const subscribers = new Set<() => void>();

function setCurrent(next: string | null): void {
  current = next;
  subscribers.forEach((fn) => fn());
}

if (typeof window !== 'undefined') {
  current = readCurrentScreenId();
  window.addEventListener(NAVIGATE_EVENT, (event: Event) => {
    const detail = (event as CustomEvent<{ screenId?: string }>).detail;
    setCurrent(detail?.screenId ?? readCurrentScreenId());
  });
}

export function useNavigateScreen(): string | null {
  const [screenId, setScreenId] = useState<string | null>(() => current ?? readCurrentScreenId());

  useLayoutEffect(() => {
    const sync = () => setScreenId(current ?? readCurrentScreenId());
    sync();
    subscribers.add(sync);
    return () => {
      subscribers.delete(sync);
    };
  }, []);

  return screenId;
}
