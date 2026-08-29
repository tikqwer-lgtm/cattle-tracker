import { useEffect, useState } from 'react';

export const NAVIGATE_EVENT = 'cattle-tracker:navigate';

function readCurrentScreenId(): string | null {
  if (typeof window.getCurrentScreenId === 'function') {
    return window.getCurrentScreenId() || null;
  }
  return window._currentScreenId || null;
}

export function useNavigateScreen(): string | null {
  const [screenId, setScreenId] = useState<string | null>(() => readCurrentScreenId());

  useEffect(() => {
    setScreenId(readCurrentScreenId());
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ screenId?: string }>).detail;
      setScreenId(detail?.screenId ?? null);
    };
    window.addEventListener(NAVIGATE_EVENT, handler);
    return () => window.removeEventListener(NAVIGATE_EVENT, handler);
  }, []);

  return screenId;
}
