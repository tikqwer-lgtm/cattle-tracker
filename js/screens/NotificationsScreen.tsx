/**
 * Уведомления — React-оболочка + legacy renderNotificationCenter.
 */
import React, { useEffect, useRef } from 'react';
import { ScreenFrame } from './AppShell';

export default function NotificationsScreen(): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.id = 'notification-center-container';
    const render = (window as Window & { renderNotificationCenter?: (id: string) => void })
      .renderNotificationCenter;
    if (typeof render === 'function') render('notification-center-container');
  }, []);

  return (
    <ScreenFrame title="Уведомления">
      <div ref={ref} id="notification-center-container" />
    </ScreenFrame>
  );
}
