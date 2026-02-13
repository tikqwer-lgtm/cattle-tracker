/**
 * events.js — Система событий (паттерн Observer)
 * Централизованная шина событий для приложения учёта коров
 */
(function (global) {
  'use strict';

  const listeners = {};

  /**
   * Подписка на событие
   * @param {string} eventName - Имя события
   * @param {Function} callback - Обработчик (payload)
   */
  function on(eventName, callback) {
    if (!eventName || typeof callback !== 'function') return;
    if (!listeners[eventName]) listeners[eventName] = [];
    listeners[eventName].push(callback);
  }

  /**
   * Отписка от события
   * @param {string} eventName - Имя события
   * @param {Function} [callback] - Если не указан — снимаются все подписчики события
   */
  function off(eventName, callback) {
    if (!listeners[eventName]) return;
    if (!callback) {
      listeners[eventName] = [];
      return;
    }
    listeners[eventName] = listeners[eventName].filter(cb => cb !== callback);
  }

  /**
   * Публикация события
   * @param {string} eventName - Имя события
   * @param {*} [payload] - Данные события
   */
  function emit(eventName, payload) {
    if (!listeners[eventName]) return;
    listeners[eventName].forEach(cb => {
      try {
        cb(payload);
      } catch (err) {
        console.error('[CattleTrackerEvents]', eventName, err);
      }
    });
  }

  const CattleTrackerEvents = { on, off, emit };
  global.CattleTrackerEvents = CattleTrackerEvents;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CattleTrackerEvents;
  }
})(typeof window !== 'undefined' ? window : this);
