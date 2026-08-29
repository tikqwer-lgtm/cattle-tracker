/**
 * Справка — журнал диагностики DevTools (Electron).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ScreenFrame } from './AppShell';
import {
  clearHelpDevtoolsDiagnostics,
  copyText,
  getHelpDevtoolsDiagnosticsText,
  refreshHelpDevtoolsDiagnostics,
} from '../data/help';
import { showToast } from '../data/session';

export default function HelpScreen(): React.ReactElement {
  const [log, setLog] = useState('');

  const refresh = useCallback(() => {
    const apply = () => setLog(getHelpDevtoolsDiagnosticsText());
    const p = refreshHelpDevtoolsDiagnostics();
    if (p && typeof (p as Promise<void>).then === 'function') {
      (p as Promise<void>).then(apply).catch(apply);
    } else {
      apply();
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onCopy = async () => {
    try {
      await copyText(log || '');
      showToast('Журнал скопирован в буфер', 'info');
    } catch {
      showToast('Не удалось скопировать', 'error');
    }
  };

  const onClear = () => {
    clearHelpDevtoolsDiagnostics();
    setLog('');
    showToast('Журнал очищен', 'info');
  };

  return (
    <ScreenFrame title="Справка">
      <p className="help-diagnostics-intro">
        Журнал событий основного процесса и страницы при открытии и закрытии консоли разработчика. Нужен для
        поиска остаточных эффектов после закрытия DevTools. При зависании ввода в десктопе используйте кнопку
        «Обновить» в шапке.
      </p>
      <div className="help-diagnostics-toolbar">
        <button type="button" className="action-btn" onClick={() => void onCopy()}>
          Копировать журнал
        </button>
        <button type="button" className="small-btn" onClick={refresh}>
          Обновить из приложения
        </button>
        <button type="button" className="small-btn" onClick={onClear}>
          Очистить
        </button>
      </div>
      <label className="help-diagnostics-label" htmlFor="help-diagnostics-log">
        Текст журнала
      </label>
      <textarea
        id="help-diagnostics-log"
        className="help-diagnostics-log"
        readOnly
        rows={18}
        spellCheck={false}
        aria-label="Журнал диагностики консоли"
        value={log}
      />
    </ScreenFrame>
  );
}
