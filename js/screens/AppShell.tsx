/**
 * React screen shell: registry + frame (title, back, active screen).
 */
import React from 'react';
import { navigateToParent } from '../data/session';

export type ScreenComponent = React.ComponentType;

type RegistryWindow = Window & {
  __cattleTrackerScreenRegistry?: Map<string, ScreenComponent>;
  __cattleTrackerReactScreens?: Set<string>;
};

function getRegistry(): Map<string, ScreenComponent> {
  if (typeof window === 'undefined') return new Map();
  const w = window as RegistryWindow;
  if (!w.__cattleTrackerScreenRegistry) {
    w.__cattleTrackerScreenRegistry = new Map();
  }
  return w.__cattleTrackerScreenRegistry;
}

export function registerScreen(screenId: string, component: ScreenComponent): void {
  getRegistry().set(screenId, component);
  if (typeof window !== 'undefined') {
    const set = ((window as RegistryWindow).__cattleTrackerReactScreens =
      (window as RegistryWindow).__cattleTrackerReactScreens || new Set());
    set.add(screenId);
  }
}

export function getRegisteredScreen(screenId: string): ScreenComponent | undefined {
  return getRegistry().get(screenId);
}

export function isReactScreen(screenId: string): boolean {
  return getRegistry().has(screenId);
}

export function listReactScreenIds(): string[] {
  return Array.from(getRegistry().keys());
}

function ScreenBackButton(): React.ReactElement {
  return (
    <div className="screen-actions">
      <button
        type="button"
        className="back-button"
        onClick={() => navigateToParent()}
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

export function AppShell({
  screenId,
}: {
  screenId: string | null;
}): React.ReactElement | null {
  if (!screenId) return null;
  const Comp = getRegisteredScreen(screenId);
  if (!Comp) return null;
  return <Comp />;
}
