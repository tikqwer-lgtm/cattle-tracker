/**
 * core.js — Основной класс приложения CattleTracker
 * Инкапсулирует доступ к данным и координацию модулей
 */
(function (global) {
  'use strict';

  /**
   * @param {Array} entriesRef - Ссылка на массив записей (глобальный entries из storage.js)
   */
  function CattleTracker(entriesRef) {
    this._entriesRef = entriesRef;
  }

  CattleTracker.prototype.getEntries = function () {
    return this._entriesRef || [];
  };

  CattleTracker.prototype.getEntry = function (cattleId) {
    const list = this.getEntries();
    return list.find(function (e) { return e.cattleId === cattleId; }) || null;
  };

  CattleTracker.prototype.emitEntriesUpdated = function () {
    if (typeof global.CattleTrackerEvents !== 'undefined') {
      global.CattleTrackerEvents.emit('entries:updated', this.getEntries());
    }
  };

  CattleTracker.prototype.load = function () {
    if (typeof global.loadLocally === 'function') {
      global.loadLocally();
    }
    this.emitEntriesUpdated();
  };

  CattleTracker.prototype.save = function () {
    if (typeof global.saveLocally === 'function') {
      global.saveLocally();
    }
    this.emitEntriesUpdated();
  };

  // Глобальный экземпляр будет инициализирован после загрузки storage.js
  function getInstance() {
    if (!global.CattleTrackerInstance && typeof global.entries !== 'undefined') {
      global.CattleTrackerInstance = new CattleTracker(global.entries);
    }
    return global.CattleTrackerInstance;
  }

  global.CattleTracker = CattleTracker;
  global.getCattleTracker = getInstance;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CattleTracker, getCattleTracker: getInstance };
  }
})(typeof window !== 'undefined' ? window : this);
export {};
