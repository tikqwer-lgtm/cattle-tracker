/**
 * Заглушка импорта показателей из систем управления стадом
 * (DC305, Afifarm, Uniform и др.).
 *
 * Контракт будущего адаптера:
 *   parse(fileOrBuffer, sourceId) → { metricValues?, items?, errors? }
 * Реальные парсеры подключаются после появления образцов выгрузок.
 */
(function (global) {
  'use strict';

  var SUPPORTED_SOURCES = [
    { id: 'dc305', label: 'DairyComp 305 (DC305)', status: 'planned' },
    { id: 'afifarm', label: 'AfiFarm', status: 'planned' },
    { id: 'uniform', label: 'Uniform-Agri', status: 'planned' },
    { id: 'generic_csv', label: 'Универсальный CSV/Excel', status: 'planned' }
  ];

  /**
   * @param {string} sourceId
   * @param {*} _payload
   * @returns {{ ok: boolean, metricValues: Array, items: Array, errors: string[] }}
   */
  function parse(sourceId, _payload) {
    return {
      ok: false,
      metricValues: [],
      items: [],
      errors: [
        'Парсер «' +
          (sourceId || 'unknown') +
          '» ещё не подключён. Нужны образцы выгрузок для реализации адаптера.'
      ]
    };
  }

  function showStub() {
    var lines = [
      'Импорт показателей из программ управления стадом',
      '',
      'Планируемые источники:'
    ];
    SUPPORTED_SOURCES.forEach(function (s) {
      lines.push(' • ' + s.label + ' — ' + (s.status === 'planned' ? 'в разработке' : s.status));
    });
    lines.push('', 'Пока добавляйте показатели и пункты вручную на вкладках карточки хозяйства.');
    var text = lines.join('\n');
    if (typeof global.showToast === 'function') {
      global.showToast('Импорт DC305 / Afifarm / Uniform — в разработке', 'info');
    }
    try {
      alert(text);
    } catch (e) {}
  }

  /**
   * Применить результат парсера к bundle карточки (когда парсеры появятся).
   */
  function applyParseResult(bundle, result) {
    var b = bundle && typeof bundle === 'object' ? bundle : {};
    if (!result || !result.ok) return { bundle: b, applied: false, errors: (result && result.errors) || [] };
    if (!Array.isArray(b.metricValues)) b.metricValues = [];
    if (!Array.isArray(b.items)) b.items = [];
    (result.metricValues || []).forEach(function (v) {
      b.metricValues.push(v);
    });
    (result.items || []).forEach(function (it) {
      b.items.push(it);
    });
    return { bundle: b, applied: true, errors: [] };
  }

  var api = {
    SUPPORTED_SOURCES: SUPPORTED_SOURCES,
    parse: parse,
    showStub: showStub,
    applyParseResult: applyParseResult
  };

  global.CattleTrackerHerdImport = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
export {};
