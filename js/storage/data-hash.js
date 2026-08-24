/**
 * Стабильный хеш JSON для сверки карточек и записей (локально vs сервер).
 */
(function (global) {
  'use strict';

  function skipMetaKey(key) {
    return key === '_savedAt' || key === '_contentHash' || (typeof key === 'string' && key.charAt(0) === '_');
  }

  function stableStringify(value) {
    if (value === undefined) return 'null';
    if (value === null) return 'null';
    if (typeof value === 'number') {
      if (!isFinite(value)) return 'null';
      return JSON.stringify(value);
    }
    if (typeof value === 'boolean' || typeof value === 'string') {
      return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
      return '[' + value.map(stableStringify).join(',') + ']';
    }
    if (typeof value === 'object') {
      var keys = Object.keys(value)
        .filter(function (k) {
          return !skipMetaKey(k);
        })
        .sort();
      return (
        '{' +
        keys
          .map(function (k) {
            return JSON.stringify(k) + ':' + stableStringify(value[k]);
          })
          .join(',') +
        '}'
      );
    }
    return JSON.stringify(String(value));
  }

  function djb2(str) {
    var h = 5381;
    var s = String(str || '');
    for (var i = 0; i < s.length; i++) {
      h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    }
    return ('00000000' + h.toString(16)).slice(-8);
  }

  function contentHash(value) {
    return djb2(stableStringify(value));
  }

  function maxUpdatedAtMs(value) {
    var max = 0;
    function walk(x) {
      if (!x || typeof x !== 'object') return;
      if (typeof x.updatedAt === 'string' && x.updatedAt) {
        var t = Date.parse(x.updatedAt);
        if (!isNaN(t) && t > max) max = t;
      }
      if (typeof x._savedAt === 'number' && x._savedAt > max) max = x._savedAt;
      if (Array.isArray(x)) {
        x.forEach(walk);
        return;
      }
      Object.keys(x).forEach(function (k) {
        if (skipMetaKey(k) && k !== '_savedAt') return;
        walk(x[k]);
      });
    }
    walk(value);
    return max;
  }

  /**
   * При несовпадении хеша берём более свежий источник.
   * @returns {{ value: *, source: 'local'|'remote'|'equal' }}
   */
  function pickNewerSource(localValue, localAt, remoteValue, remoteAt) {
    var localHash = contentHash(localValue);
    var remoteHash = contentHash(remoteValue);
    if (localHash === remoteHash) {
      return { value: remoteValue != null ? remoteValue : localValue, source: 'equal', hash: remoteHash };
    }
    var l = Number(localAt) || 0;
    var r = Number(remoteAt) || 0;
    if (l > r) {
      return { value: localValue, source: 'local', hash: localHash };
    }
    return { value: remoteValue, source: 'remote', hash: remoteHash };
  }

  var api = {
    stableStringify: stableStringify,
    contentHash: contentHash,
    maxUpdatedAtMs: maxUpdatedAtMs,
    pickNewerSource: pickNewerSource
  };

  global.CattleTrackerDataHash = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);

export {};
