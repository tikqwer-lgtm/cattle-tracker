import { useEffect, useState } from 'react';

export const NAVIGATE_EVENT = 'cattle-tracker:navigate';

export function useNavigateScreen(): string | null {
  const [screenId, setScreenId] = useState<string | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ screenId?: string }>).detail;
      setScreenId(detail?.screenId ?? null);
    };
    window.addEventListener(NAVIGATE_EVENT, handler);
    return () => window.removeEventListener(NAVIGATE_EVENT, handler);
  }, []);

  return screenId;
}
