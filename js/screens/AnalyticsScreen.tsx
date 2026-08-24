/**
 * Аналитика — React-разметка + legacy renderAnalyticsScreen.
 */
import React, { useEffect } from 'react';
import { ScreenFrame } from './AppShell';

export default function AnalyticsScreen(): React.ReactElement {
  useEffect(() => {
    const render = (window as Window & { renderAnalyticsScreen?: () => void }).renderAnalyticsScreen;
    if (typeof render === 'function') render();
  }, []);

  return (
    <ScreenFrame title="Аналитика">
      <div className="analytics-controls">
        <label>
          Период:{' '}
          <select id="analyticsPeriod" defaultValue="month">
            <option value="month">Месяц</option>
            <option value="quarter">Квартал</option>
            <option value="year">Год</option>
            <option value="custom">Произвольный</option>
          </select>
        </label>
        <span id="analyticsCustomDates" className="analytics-custom-dates" style={{ display: 'none' }}>
          <label>
            С: <input type="date" id="analyticsDateFrom" />
          </label>
          <label>
            По: <input type="date" id="analyticsDateTo" />
          </label>
        </span>
        <label>
          ПДО (дн.):{' '}
          <input type="number" id="analyticsPdo" min={0} max={365} defaultValue={50} className="analytics-pdo-input" />
        </label>
        <label>
          Разбивка:{' '}
          <select id="analyticsBreakdown" defaultValue="">
            <option value="">Нет</option>
            <option value="group">По группам</option>
            <option value="lactation">По лактациям</option>
            <option value="inseminator">По осеменаторам</option>
            <option value="bull">По быкам</option>
          </select>
        </label>
        <button type="button" id="analyticsRefreshBtn" className="small-btn">
          Обновить
        </button>
      </div>
      <div id="analyticsIndicators" className="analytics-indicators" />
      <div id="analyticsBreakdownTable" className="analytics-breakdown-table-wrapper" style={{ display: 'none' }} />
      <div id="analyticsCharts" className="analytics-charts" />
      <div id="endometritisDmgBlock" className="analytics-breakdown-table-wrapper" style={{ marginTop: 16 }}>
        <h2 style={{ margin: '8px 0' }}>Эндометрит ДМГ</h2>
        <div className="analytics-controls" style={{ justifyContent: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
          <input type="file" id="endometritisDmgFile" accept=".xlsx" aria-label="Файл DC (.xlsx) для Эндометрит ДМГ" />
          <button type="button" id="endometritisDmgCalcBtn" className="small-btn">
            Посчитать
          </button>
          <span id="endometritisDmgStatus" style={{ color: '#666' }} />
        </div>
        <div id="endometritisDmgResults" style={{ marginTop: 10 }} />
      </div>
    </ScreenFrame>
  );
}
