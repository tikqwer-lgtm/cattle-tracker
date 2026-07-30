/**
 * events.js — Система событий (паттерн Observer)
 * Централизованная шина событий для приложения учёта коров.
 * Зеркалирование через BroadcastChannel + storage — для других вкладок/окон.
 */
(function (global) {
  'use strict';

  const listeners = {};
  const CHANNEL_NAME = 'cattle-tracker';
  const STORAGE_KEY = 'cattleTracker_bus_event';
  let broadcast = null;
  let suppressMirror = false;

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      broadcast = new BroadcastChannel(CHANNEL_NAME);
      broadcast.onmessage = function (ev) {
        if (!ev || !ev.data || !ev.data.name) return;
        suppressMirror = true;
        try {
          emitLocal(ev.data.name, ev.data.payload);
        } finally {
          suppressMirror = false;
        }
      };
    }
  } catch (e) {
    broadcast = null;
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', function (ev) {
      if (!ev || ev.key !== STORAGE_KEY || !ev.newValue) return;
      try {
        var msg = JSON.parse(ev.newValue);
        if (!msg || !msg.name) return;
        suppressMirror = true;
        try {
          emitLocal(msg.name, msg.payload);
        } finally {
          suppressMirror = false;
        }
      } catch (err) {}
    });
  }

  function mirrorToOtherWindows(eventName, payload) {
    if (suppressMirror) return;
    var msg = { name: eventName, payload: payload, ts: Date.now() };
    try {
      if (broadcast) broadcast.postMessage(msg);
    } catch (e) {}
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(msg));
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e2) {}
  }

  function on(eventName, callback) {
    if (!eventName || typeof callback !== 'function') return;
    if (!listeners[eventName]) listeners[eventName] = [];
    listeners[eventName].push(callback);
  }

  function off(eventName, callback) {
    if (!listeners[eventName]) return;
    if (!callback) {
      listeners[eventName] = [];
      return;
    }
    listeners[eventName] = listeners[eventName].filter(function (cb) {
      return cb !== callback;
    });
  }

  function emitLocal(eventName, payload) {
    if (!listeners[eventName]) return;
    listeners[eventName].forEach(function (cb) {
      try {
        cb(payload);
      } catch (err) {
        console.error('[CattleTrackerEvents]', eventName, err);
      }
    });
  }

  function emit(eventName, payload) {
    emitLocal(eventName, payload);
    mirrorToOtherWindows(eventName, payload);
  }

  const CattleTrackerEvents = { on: on, off: off, emit: emit };
  global.CattleTrackerEvents = CattleTrackerEvents;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CattleTrackerEvents;
  }
})(typeof window !== 'undefined' ? window : this);
export {};
