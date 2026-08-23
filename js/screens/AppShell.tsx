/**
 * React screen registry + AppShell.
 * Migrated screens render in React; others activate legacy HTML #id-screen.
 */
import React, { useEffect } from 'react';
import { useNavigateScreen } from './useNavigateScreen';

export type ScreenComponent = React.ComponentType;

/** Fully migrated React screens (no reliance on #id-screen markup for body). */
export const REACT_SCREENS: Record<string, ScreenComponent> = {};

export function registerScreen(id: string, component: ScreenComponent): void {
  REACT_SCREENS[id] = component;
}

export function isReactScreen(screenId: string | null): boolean {
  return !!(screenId && REACT_SCREENS[screenId]);
}

/**
 * When a React screen is active, hide all legacy .screen nodes so only #root content shows.
 * When a legacy screen is active, leave navigate()'s classList.active alone.
 */
function syncLegacyVisibility(screenId: string | null, reactActive: boolean): void {
  if (typeof document === 'undefined') return;
  const nodes = document.querySelectorAll('.screen');
  if (reactActive) {
    nodes.forEach((el) => el.classList.remove('active'));
    return;
  }
  /* Legacy: navigate() already toggled .active; ensure React overlay is not stuck. */
  void screenId;
}

export function ScreenBackButton(): React.ReactElement {
  return (
    <div className="screen-actions">
      <button
        type="button"
        className="back-button"
        onClick={() => {
          if (typeof window.navigateToParent === 'function') window.navigateToParent();
        }}
      >
        Назад
      </button>
    </div>
  );
}

export function ScreenFrame({
  title,
  children,
  showBack = true,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
  showBack?: boolean;
}): React.ReactElement {
  return (
    <div className="screen screen--react active" data-react-screen="1">
      <h1>{title}</h1>
      {children}
      {showBack ? <ScreenBackButton /> : null}
    </div>
  );
}

/**
 * AppShell: renders the current React screen inside #root.
 * Legacy screens stay in HTML; navigate() continues to drive them.
 */
export default function AppShell(): React.ReactElement | null {
  const screenId = useNavigateScreen();
  const Comp = screenId ? REACT_SCREENS[screenId] : null;
  const reactActive = !!Comp;

  useEffect(() => {
    syncLegacyVisibility(screenId, reactActive);
  }, [screenId, reactActive]);

  if (!Comp) return null;

  return <Comp />;
}
