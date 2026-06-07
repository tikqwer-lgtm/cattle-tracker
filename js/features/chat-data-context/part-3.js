/** __chatCtx part 3 */
(function () {
  'use strict';
  var root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this);
  var NS = root['__chatCtx'] = root['__chatCtx'] || {};
  var global = typeof window !== 'undefined' ? window : this;

function defaultDeps() {
  var g = typeof window !== 'undefined' ? window : {};
  return {
    getProtocols: function () { return typeof g.getProtocols === 'function' ? g.getProtocols() : []; },
    getFarmVwpDays: function () { return typeof g.getFarmVwpDays === 'function' ? g.getFarmVwpDays() : 60; },
    getDaysPregnant: function (e) { return typeof g.getDaysPregnant === 'function' ? g.getDaysPregnant(e) : null; },
    getDaysInLactation: function (e) { return typeof g.getDaysInLactation === 'function' ? g.getDaysInLactation(e) : null; },
    scanAllDataErrors: function (entries, refDate) {
      return typeof g.scanAllDataErrors === 'function' ? g.scanAllDataErrors(entries, refDate) : [];
    },
    useApi: !!(g.CATTLE_TRACKER_USE_API),
    getAnalyticsPdo: function () {
      try {
        if (typeof localStorage !== 'undefined') {
          var raw = localStorage.getItem(globalThis['__chatCtx'].state.ANALYTICS_SETTINGS_KEY);
          if (raw) {
            var o = JSON.parse(raw);
            if (o && o.pdo !== undefined) return parseInt(o.pdo, 10) || 50;
          }
        }
      } catch (e) {}
      return 50;
    },
    getStallLayout: function () {
      try {
        if (typeof localStorage !== 'undefined') {
          var oid = localStorage.getItem(globalThis['__chatCtx'].state.CURRENT_OBJECT_KEY) || '';
          var raw = localStorage.getItem(globalThis['__chatCtx'].state.STALL_LAYOUT_PREFIX + oid);
          if (raw) return JSON.parse(raw);
        }
      } catch (e) {}
      return { yards: {} };
    }
  };
}

/**
 * @param {string} questionText
 * @param {Array} entries
 * @param {Date} [refDate]
 * @param {object} [deps]
 * @returns {string|null}
 */
function buildChatDataContext(questionText, entries, refDate, deps) {
  refDate = refDate || new Date();
  entries = entries || [];
  deps = deps || defaultDeps();
  var topics = globalThis['__chatCtx'].detectChatDataTopics(questionText);
  var warnings = globalThis['__chatCtx'].detectQuestionWarnings(questionText, topics, refDate);

  if (!topics.length) {
    if (!warnings.length) return null;
    return 'Сводка по данным не сформирована.\n\n[Замечания к вопросу]\n' + warnings.join('\n');
  }

  if (!entries.length) {
    var emptyMsg = 'Сводка данных стада: в программе нет загруженных записей о животных. ' +
      'Подскажи пользователю выбрать объект в настройках и при необходимости синхронизировать данные с сервером.';
    if (warnings.length) emptyMsg += '\n\n[Замечания к вопросу]\n' + warnings.join('\n');
    return emptyMsg;
  }

  var sections = [];
  topics.forEach(function (topicId) {
    var builder = globalThis['__chatCtx'].state.SECTION_BUILDERS[topicId];
    if (builder) {
      var section = builder(questionText, entries, refDate, deps);
      if (section) sections.push(section);
    }
  });

  if (!sections.length) return null;

  if (warnings.length) {
    sections.unshift('[Замечания к вопросу]\n' + warnings.join('\n'));
  }

  return 'Сводка данных стада (посчитано программой — используй эти числа без изменений).\n\n' +
    sections.join('\n\n');
}


  // register functions
  NS.defaultDeps = defaultDeps;
  NS.buildChatDataContext = buildChatDataContext;
})();
export {};
