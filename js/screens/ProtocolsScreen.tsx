/**
 * Протоколы синхронизации — React-оболочка; контент наполняет legacy renderProtocolsScreen.
 */
import React, { useEffect, useRef } from 'react';
import { ScreenFrame } from './AppShell';

export default function ProtocolsScreen(): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = 'protocols-container';
    const el = containerRef.current;
    if (!el) return;
    el.id = id;
    const render = (window as Window & { renderProtocolsScreen?: (cid: string) => void }).renderProtocolsScreen;
    if (typeof render === 'function') render(id);
  }, []);

  return (
    <ScreenFrame title="Протоколы синхронизации">
      <div ref={containerRef} id="protocols-container" />
    </ScreenFrame>
  );
}
