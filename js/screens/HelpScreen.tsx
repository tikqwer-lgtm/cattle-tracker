/**
 * Справка / диагностика DevTools — React-экран.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ScreenFrame } from './AppShell';

declare global {
  interface Window {
    refreshHelpDevtoolsDiagnostics?: () => void | Promise<void>;
    getHelpDevtoolsDiagnosticsText?: () => string;
    clearHelpDevtoolsDiagnostics?: () => void;
    electronAPI?: {
      copyText?: (text: string) => Promise<unknown>;
      getDevtoolsDiagnostics?: () => Promise<{ lines?: string[] } | string[] | string>;
    };
  }
}

export default function HelpScreen(): React.ReactElement {
  const [log, setLog] = useState('');

  const refresh = useCallback(() => {
    const apply = () => setLog(window.getHelpDevtoolsDiagnosticsText?.() || '');
    const p = window.refreshHelpDevtoolsDiagnostics?.();
    if (p && typeof (p as Promise<void>).then === 'function') {
      (p as Promise<void>).then(apply).catch(apply);
    } else {
      apply();
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const copy = async () => {
    const text = log || readLogFromDomOrApi();
    try {
      if (window.electronAPI?.copyText) {
        await window.electronAPI.copyText(text);
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      }
    } catch {
      /* ignore */
    }
  };

  const clear = () => {
    if (typeof window.clearHelpDevtoolsDiagnostics === 'function') {
      window.clearHelpDevtoolsDiagnostics();
    }
    setLog('');
  };

  return (
    <ScreenFrame title="Справка">
      <p className="help-diagnostics-intro">
        Журнал событий основного процесса и страницы при открытии и закрытии консоли разработчика. Нужен для
        поиска остаточных эффектов после закрытия DevTools. При зависании ввода в десктопе используйте кнопку
        «Обновить» в шапке.
      </p>
      <div className="help-diagnostics-toolbar">
        <button type="button" className="action-btn" onClick={() => void copy()}>
          Копировать журнал
        </button>
        <button type="button" className="small-btn" onClick={refresh}>
          Обновить из приложения
        </button>
        <button type="button" className="small-btn" onClick={clear}>
          Очистить
        </button>
      </div>
      <label className="help-diagnostics-label" htmlFor="help-diagnostics-log-react">
        Текст журнала
      </label>
      <textarea
        id="help-diagnostics-log-react"
        className="help-diagnostics-log"
        readOnly
        rows={18}
        spellCheck={false}
        aria-label="Журнал диагностики консоли"
        value={log}
        onChange={() => {}}
      />
    </ScreenFrame>
  );
}
