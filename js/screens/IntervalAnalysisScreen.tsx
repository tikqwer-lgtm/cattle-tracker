/**
 * Интервальный анализ — React + legacy renderIntervalAnalysisScreen.
 */
import React, { useEffect } from 'react';
import { ScreenFrame } from './AppShell';

export default function IntervalAnalysisScreen(): React.ReactElement {
  useEffect(() => {
    const render = (window as Window & { renderIntervalAnalysisScreen?: () => void }).renderIntervalAnalysisScreen;
    if (typeof render === 'function') render();
  }, []);

  return (
    <ScreenFrame title="Интервальный анализ">
      <p className="analytics-interval-intro">
        Распределение интервалов между осеменениями (внутри одной лактации). Телки — лактация 0.
      </p>
      <div id="intervalAnalysisFilter" className="analytics-interval-filter" />
      <div id="intervalAnalysisTable" className="analytics-interval-table-wrapper" />
    </ScreenFrame>
  );
}
