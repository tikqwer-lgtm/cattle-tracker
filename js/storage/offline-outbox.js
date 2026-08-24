/**
 * Очередь офлайн-правок: последовательная отправка на сервер при появлении сети.
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'cattleTracker_offlineOutbox';
  var flushing = false;

  function isNetworkError(err) {
    if (!err) return false;
    if (err.name === 'AbortError') return true;
    var msg = err.message ? String(err.message) : String(err);
    return (
      msg.indexOf('Failed to fetch') !== -1 ||
      msg.indexOf('Сервер недоступен') !== -1 ||
      msg.indexOf('Нет связи') !== -1 ||
      msg.indexOf('The user aborted') !== -1 ||
      msg.indexOf('aborted') !== -1 ||
      msg.indexOf('timeout') !== -1 ||
      msg.indexOf('Timeout') !== -1
    );
  }

  function readQueue() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function writeQueue(arr) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(arr || []));
    } catch (e) {
      console.warn('offline-outbox write', e && e.message);
    }
  }

  function enqueue(item) {
    var q = readQueue();
    var row = {
      id: 'ob_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      createdAt: Date.now(),
      op: item && item.op,
      objectId: item && item.objectId,
      cattleId: item && item.cattleId,
      entry: item && item.entry,
      bundle: item && item.bundle
    };
    q.push(row);
    writeQueue(q);
    return row;
  }

  function removeById(id) {
    writeQueue(
      readQueue().filter(function (x) {
        return !x || x.id !== id;
      })
    );
  }

  function count() {
    return readQueue().length;
  }

  function sendOne(item, api) {
    if (!item || !api) return Promise.reject(new Error('Нет задания'));
    var oid = item.objectId;
    if (item.op === 'create') {
      return api.createEntry(oid, item.entry || {});
    }
    if (item.op === 'update') {
      return api.updateEntry(oid, item.cattleId, item.entry || {});
    }
    if (item.op === 'delete') {
      return api.deleteEntry(oid, item.cattleId);
    }
    if (item.op === 'farm-card' && typeof api.putFarmCard === 'function') {
      var bundle = item.bundle || {};
      var clean = JSON.parse(JSON.stringify(bundle));
      delete clean._savedAt;
      delete clean._contentHash;
      return api.putFarmCard(oid, clean);
    }
    return Promise.reject(new Error('Неизвестная операция очереди'));
  }

  /**
   * Отправляет задания строго по одному (FIFO).
   */
  function flush(api) {
    if (flushing) return Promise.resolve({ flushed: 0, skipped: true });
    api = api || (global.CattleTrackerApi);
    if (!api) return Promise.resolve({ flushed: 0, skipped: true });
    flushing = true;
    var flushed = 0;

    function next() {
      var q = readQueue();
      if (!q.length) {
        flushing = false;
        return Promise.resolve({ flushed: flushed });
      }
      var item = q[0];
      return sendOne(item, api)
        .then(function () {
          removeById(item.id);
          flushed += 1;
          return next();
        })
        .catch(function (err) {
          if (isNetworkError(err)) {
            flushing = false;
            return { flushed: flushed, paused: true };
          }
          removeById(item.id);
          flushed += 1;
          console.warn('offline-outbox drop', item && item.op, err && err.message);
          return next();
        });
    }

    return next().catch(function (err) {
      flushing = false;
      return Promise.reject(err);
    });
  }

  var api = {
    STORAGE_KEY: STORAGE_KEY,
    isNetworkError: isNetworkError,
    enqueue: enqueue,
    flush: flush,
    count: count,
    readQueue: readQueue
  };

  global.CattleTrackerOutbox = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('online', function () {
      flush();
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);

export {};
