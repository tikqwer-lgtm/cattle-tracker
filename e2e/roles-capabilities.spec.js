// @ts-check
/**
 * Role-based smoke/e2e: lite/medium/pro/admin в режиме API.
 * Проверяем:
 * - видимость групп меню по capability-модели;
 * - блокировку прямой навигации на запрещенные экраны.
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
    const pathname = u.pathname;

    if (pathname === '/api/health' && req.method === 'GET') {
      sendJson(res, 200, { ok: true });
      return;
    }
    if (pathname === '/api/auth/me' && req.method === 'GET') {
      const auth = String(req.headers.authorization || '');
      const m = auth.match(/Bearer\s+e2e-token-([a-z]+)/i);
      const role = m ? String(m[1]).toLowerCase() : 'lite';
      sendJson(res, 200, { user: { id: 'e2e-role', username: 'role-user', role } });
      return;
    }
    if (pathname === '/api/auth/register-status' && req.method === 'GET') {
      sendJson(res, 200, { allowed: false });
      return;
    }
    if (pathname === '/api/admin/users' && req.method === 'GET') {
      sendJson(res, 200, {
        ok: true,
        users: [{ id: 'u1', username: 'farmer', role: 'lite', created_at: '2026-01-01', password_plain: 'pass1' }],
      });
      return;
    }
    if (pathname === '/api/reports' && req.method === 'GET') {
      sendJson(res, 200, { ok: true, reports: [] });
      return;
    }
    if (pathname === '/api/objects' && req.method === 'GET') {
      sendJson(res, 200, [
        { id: 'obj-e2e', name: 'E2E база', entries_count: 0, created_by_username: 'farmer' },
        { id: 'obj-e2e-2', name: 'Вторая', entries_count: 1, created_by_username: 'farmer' },
      ]);
      return;
    }
    if (req.method === 'GET' && /^\/api\/objects\/[^/]+\/entries$/.test(pathname)) {
      sendJson(res, 200, []);
      return;
    }
    if (req.method === 'GET' && /^\/api\/objects\/[^/]+\/protocols$/.test(pathname)) {
      sendJson(res, 200, []);
      return;
    }
    if (req.method === 'GET' && /^\/api\/objects\/[^/]+\/farm-card$/.test(pathname)) {
      sendJson(res, 200, {});
      return;
    }
    if (req.method === 'GET' && /^\/api\/objects\/[^/]+\/farm-settings$/.test(pathname)) {
      sendJson(res, 200, { technicians: [], bulls: [], drugs: [], vwpDays: 60 });
      return;
    }

    sendJson(res, 404, { error: 'e2e mock: not found', path: pathname });
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
  await new Promise((resolve) => mockServer.close(() => resolve(undefined)));
  mockServer = null;
});

async function openMenuAsRole(page, role) {
  await page.addInitScript(({ port, roleName }) => {
    localStorage.setItem('cattleTracker_useApiMode', '1');
    localStorage.setItem('cattleTracker_apiBase', 'http://127.0.0.1:' + port);
    localStorage.setItem('cattleTracker_apiToken', 'e2e-token-' + roleName);
    localStorage.setItem('cattleTracker_currentObject', 'obj-e2e');
  }, { port: mockPort, roleName: role });
  await page.goto('/');
  await expect(page.locator('#menu-screen.active')).toBeVisible({ timeout: 25000 });
}

function menuGroup(page, title) {
  return page.locator('#menu-screen .menu-group-btn').filter({ hasText: title });
}

const CASES = [
  {
    role: 'lite',
    visible: ['Работа с данными', 'Действия'],
    hidden: ['Аналитика', 'Уведомления и планы'],
    blockedScreens: ['analytics', 'notifications', 'farm-settings'],
    allowedScreen: 'sync',
  },
  {
    role: 'medium',
    visible: ['Работа с данными', 'Действия', 'Аналитика', 'Уведомления и планы'],
    hidden: [],
    blockedScreens: ['farm-settings'],
    allowedScreen: 'sync',
  },
  {
    role: 'pro',
    visible: ['Работа с данными', 'Действия', 'Аналитика', 'Уведомления и планы', 'Настройки'],
    hidden: [],
    blockedScreens: ['admin'],
    allowedScreen: 'sync',
  },
  {
    role: 'admin',
    visible: ['Работа с данными', 'Действия', 'Аналитика', 'Уведомления и планы', 'Настройки', 'Администрирование'],
    hidden: [],
    blockedScreens: [],
    allowedScreen: 'sync',
  },
];

for (const tcase of CASES) {
  test.describe('role=' + tcase.role, () => {
    test.beforeEach(async ({ page }) => {
      await openMenuAsRole(page, tcase.role);
    });

    test('видимость групп меню соответствует роли', async ({ page }) => {
      for (const title of tcase.visible) {
        await expect(menuGroup(page, title)).toBeVisible();
      }
      for (const title of tcase.hidden) {
        await expect(menuGroup(page, title)).toBeHidden();
      }
    });

    test('route-guards блокируют запрещенные переходы', async ({ page }) => {
      for (const screenId of tcase.blockedScreens) {
        await page.evaluate((sid) => {
          if (typeof window.navigate === 'function') window.navigate(sid);
        }, screenId);
        await expect(page.locator('#menu-screen.active')).toBeVisible({ timeout: 5000 });
      }

      await page.evaluate((sid) => {
        if (typeof window.navigate === 'function') window.navigate(sid);
      }, tcase.allowedScreen);
      await expect(page.locator('#' + tcase.allowedScreen + '-screen.active')).toBeVisible({ timeout: 10000 });
    });

    if (tcase.role === 'admin') {
      test('экран администрирования: пользователи и базы по аккаунтам', async ({ page }) => {
        await page.evaluate(() => {
          if (typeof window.navigate === 'function') window.navigate('admin');
        });
        await expect(page.locator('#admin-screen.active')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('#admin-users-container .admin-table')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('#admin-users-container .admin-password-input')).toBeVisible();
        await expect(page.locator('#adminServerBasesList .admin-bases-user-group')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('#adminServerBasesList summary')).toContainText('farmer');
      });
    }
  });
}
