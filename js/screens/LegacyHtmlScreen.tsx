/**
 * Host for screens still backed by legacy init* but owned by React tree.
 * Prefer full JSX (see FarmSettings); use this when markup is large and IDs are required by IIFE.
 */
import React, { useEffect, useRef } from 'react';
import { ScreenFrame } from './AppShell';

export function LegacyHtmlScreen({
  title,
  html,
  showBack = true,
  onActivate,
}: {
  title: React.ReactNode;
  html: string;
  showBack?: boolean;
  onActivate?: () => void;
}): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onActivate?.();
  }, [onActivate]);

  return (
    <ScreenFrame title={title} showBack={showBack}>
      <div ref={ref} className="legacy-html-screen-body" dangerouslySetInnerHTML={{ __html: html }} />
    </ScreenFrame>
  );
}
