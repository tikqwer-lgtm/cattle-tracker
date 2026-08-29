/**
 * One-shot host: original screen markup + legacy init after DOM commit.
 * Avoids React wiping IIFE-filled nodes on re-render.
 */
import React, { useLayoutEffect, useRef } from 'react';
import { getLegacyScreenMarkup } from './legacy-markup';
import { activateLegacyScreen } from './activate-legacy';

export default function LegacyHost({ screenId }: { screenId: string }): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const markup = getLegacyScreenMarkup(screenId);
  const extra = markup.className
    .split(/\s+/)
    .filter((c) => c && c !== 'screen' && c !== 'active')
    .join(' ');

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = markup.inner;
    activateLegacyScreen(screenId);
  }, [screenId, markup.inner]);

  return (
    <div
      ref={ref}
      id={`${screenId}-screen`}
      className={`screen screen--react active${extra ? ` ${extra}` : ''}`}
      data-react-screen="1"
    />
  );
}

export function hostFor(screenId: string): React.FC {
  return function HostedScreen() {
    return <LegacyHost screenId={screenId} />;
  };
}
