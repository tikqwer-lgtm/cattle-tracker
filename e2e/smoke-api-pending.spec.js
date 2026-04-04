// @ts-check
/**
 * Smoke: режим API (localStorage) + текущая база «не выбрана» (__pending_select__).
 * Минимальный HTTP-мок на 127.0.0.1 (случайный порт) + CORS для fetch с serve (9323).
 */
const http = require('http');
const { test, expect } = require('@playwright/test');

/** @type {import('http').Server | null} */
let mockServer = null;
/** @type {number} */
let mockPort = 0;

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.end(JSON.stringify(body));
}

test.beforeAll(async () => {
  mockServer = http.createServer((req, res) => {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.end();
      return;
    }
    const host = req.headers.host || '127.0.0.1';
    const u = new URL(req.url || '/', `http://${host}`);
    const path = u.pathname;

    if (path === '/api/health' && req.method === 'GET') {
      sendJson(res, 200, { ok: true });
      return;
    }
    if (path === '/api/auth/me' && req.method === 'GET') {
      sendJson(res, 200, { user: { id: 'e2e-u1', username: 'e2e', role: 'operator' } });
      return;
    }
    if (path === '/api/objects' && req.method === 'GET') {
      sendJson(res, 200, [{ id: 'obj-e2e', name: 'E2E база', entries_count: 0 }]);
      return;
    }
    if (req.method === 'GET' && /^\/api\/objects\/[^/]+\/protocols$/.test(path)) {
      sendJson(res, 200, []);
      return;
    }

    sendJson(res, 404, { error: 'e2e mock: not found', path });
  });

  await new Promise((resolve, reject) => {
    mockServer.listen(0, '127.0.0.1', () => resolve(undefined));
    mockServer.on('error', reject);
  });
  const addr = mockServer.address();
  mockPort = typeof addr === 'object' && addr ? addr.port : 0;
  if (!mockPort) throw new Error('mock API: no port');
});

test.afterAll(async () => {
  if (!mockServer) return;
  await new Promise((resolve) => {
    mockServer.close(() => resolve(undefined));
  });
  mockServer = null;
});

test.describe('API + база не выбрана (pending)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(({ port }) => {
      try {
        sessionStorage.removeItem('cattleTracker_currentObject');
      } catch (e) {}
      localStorage.setItem('cattleTracker_useApiMode', '1');
      localStorage.setItem('cattleTracker_apiBase', 'http://127.0.0.1:' + port);
      localStorage.setItem('cattleTracker_apiToken', 'e2e-token');
      localStorage.setItem('cattleTracker_currentObject', '__pending_select__');
    }, { port: mockPort });
  });

  test('меню открывается, протоколы — подсказка про выбор базы', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#menu-screen.active')).toBeVisible({ timeout: 25000 });

    const protocolsReq = page.waitForResponse(
      (r) =>
        r.request().method() === 'GET' &&
        r.url().includes('/api/objects/') &&
        r.url().includes('/protocols'),
      { timeout: 15000 }
    );
    await page.evaluate(() => {
      if (typeof window.navigate === 'function') window.navigate('protocols');
    });
    await protocolsReq;
    const protocolsActive = page.locator('#protocols-screen.active');
    await expect(protocolsActive).toBeVisible({ timeout: 10000 });
    await expect(protocolsActive.locator('.admin-message')).toContainText(
      'Сначала выберите базу на экране «Синхронизация»',
      { timeout: 15000 }
    );
  });
});
