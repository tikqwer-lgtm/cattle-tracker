/**
 * Воспроизводство — React + legacy renderReproductionScreen.
 */
import React, { useEffect } from 'react';
import { ScreenFrame } from './AppShell';

export default function ReproductionScreen(): React.ReactElement {
  useEffect(() => {
    const render = (window as Window & { renderReproductionScreen?: () => void }).renderReproductionScreen;
    if (typeof render === 'function') render();
  }, []);

  return (
    <ScreenFrame title="Воспроизводство">
      <p className="analytics-interval-intro">
        Показатели оплодотворяемости: количество стельных из осеменённых в выбранный период (по текущей базе).
        Животные с осеменением без проверки стельности не входят в расчёт; их количество показывается при наведении
        на звёздочку рядом с показателем оплодотворяемости.
      </p>
      <div id="reproductionFilters" className="analytics-interval-filter" />
      <div id="reproductionIndicators" className="analytics-indicators" />
      <div id="reproductionTable" className="analytics-interval-table-wrapper" />
    </ScreenFrame>
  );
}
