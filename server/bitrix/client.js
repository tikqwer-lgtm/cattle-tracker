/**
 * Bitrix24 REST client (incoming webhook).
 */
const https = require('https');
const http = require('http');
const { URL } = require('url');

function callMethod(webhookBase, method, params) {
  const base = String(webhookBase || '').trim().replace(/\/?$/, '/');
  if (!base) return Promise.reject(new Error('Webhook Битрикс не настроен'));
  const methodName = String(method || '').trim().replace(/^\//, '');
  if (!methodName) return Promise.reject(new Error('Не указан метод Битрикс'));

  const url = new URL(base + methodName + '.json');
  const body = JSON.stringify(params && typeof params === 'object' ? params : {});
  const isHttps = url.protocol === 'https:';
  const lib = isHttps ? https : http;

  return new Promise(function (resolve, reject) {
    const req = lib.request(
      {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          Accept: 'application/json'
        },
        timeout: 25000
      },
      function (res) {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
          raw += chunk;
        });
        res.on('end', function () {
          let data = null;
          try {
            data = raw ? JSON.parse(raw) : {};
          } catch (e) {
            return reject(new Error('Некорректный ответ Битрикс'));
          }
          if (data && data.error) {
            const msg =
              (data.error_description || data.error || 'Ошибка Битрикс') + '';
            return reject(new Error(msg));
          }
          resolve(data && data.result !== undefined ? data.result : data);
        });
      }
    );
    req.on('timeout', function () {
      req.destroy();
      reject(new Error('Таймаут запроса к Битрикс'));
    });
    req.on('error', function (err) {
      reject(err || new Error('Сеть Битрикс'));
    });
    req.write(body);
    req.end();
  });
}

function testConnection(webhookBase) {
  return callMethod(webhookBase, 'profile', {}).then(function (profile) {
    return {
      ok: true,
      name:
        profile && (profile.NAME || profile.LAST_NAME)
          ? [profile.NAME, profile.LAST_NAME].filter(Boolean).join(' ')
          : profile && profile.EMAIL
            ? String(profile.EMAIL)
            : 'OK'
    };
  });
}

module.exports = {
  callMethod,
  testConnection
};
