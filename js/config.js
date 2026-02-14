/**
 * Конфигурация приложения (адрес сервера по умолчанию и др.).
 * Используется кнопкой «Подключиться к серверу» на экране Синхронизация,
 * если пользователь ещё не вводил адрес вручную.
 */
(function (global) {
  'use strict';
  var DEFAULT_SERVER_URL = 'http://31.130.155.149:3000';
  global.CATTLE_TRACKER_DEFAULT_SERVER_URL = DEFAULT_SERVER_URL;
})(typeof window !== 'undefined' ? window : this);
export {};
