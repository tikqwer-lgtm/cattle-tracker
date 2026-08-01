/**
 * Конфигурация приложения: каталог серверов по имени и URL по умолчанию.
 */
(function (global) {
  'use strict';
  var SERVERS = [
    { id: 'genetika-nn', name: 'Генетика-НН', url: 'http://31.130.155.149:3000' }
  ];
  global.CATTLE_TRACKER_SERVERS = SERVERS;
  global.CATTLE_TRACKER_DEFAULT_SERVER_URL = SERVERS[0] ? SERVERS[0].url : '';

  global.getCattleTrackerServerById = function (id) {
    var sid = String(id || '').trim();
    if (!sid) return null;
    for (var i = 0; i < SERVERS.length; i++) {
      if (SERVERS[i].id === sid) return SERVERS[i];
    }
    return null;
  };

  global.getCattleTrackerServerByUrl = function (url) {
    var u = String(url || '').trim().replace(/\/$/, '');
    if (!u) return null;
    for (var i = 0; i < SERVERS.length; i++) {
      var su = String(SERVERS[i].url || '').replace(/\/$/, '');
      if (su === u) return SERVERS[i];
    }
    return null;
  };
})(typeof window !== 'undefined' ? window : this);
export {};
