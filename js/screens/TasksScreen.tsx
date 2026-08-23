/**
 * Список задач — React-оболочка + legacy renderTasksScreen.
 */
import React, { useEffect, useRef } from 'react';
import { ScreenFrame } from './AppShell';

export default function TasksScreen(): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.id = 'tasksScreenContainer';
    const render = (window as Window & { renderTasksScreen?: () => void }).renderTasksScreen;
    if (typeof render === 'function') render();
  }, []);

  return (
    <ScreenFrame title="Список задач">
      <div ref={ref} id="tasksScreenContainer" className="tasks-screen-container" />
    </ScreenFrame>
  );
}
