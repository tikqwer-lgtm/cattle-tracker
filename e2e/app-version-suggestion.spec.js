// @ts-check
const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('cattleTracker_hasSeenHints', '1');
  });
});

test('модалка версии: «Обновить» ставит APK, а не открывает предложение', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Войти без пароля' }).click();
  await expect(page.locator('#menu-screen.active')).toBeVisible({ timeout: 15000 });

  await page.evaluate(() => {
    window.__apkUpdateCalled = false;
    if (typeof window.showAppVersionActionsModal === 'function') {
      window.showAppVersionActionsModal(
        { localVer: '0.7.9', hasUpdate: true },
        {
          canUpdate: true,
          onUpdate: function () {
            window.__apkUpdateCalled = true;
          }
        }
      );
    }
  });

  await expect(page.locator('.app-version-action-update')).toBeEnabled();
  await page.locator('.app-version-action-update').click();
  await expect(page.locator('#appVersionSuggestionText')).toHaveCount(0);
  expect(await page.evaluate(() => window.__apkUpdateCalled)).toBe(true);
});

test('шапка «Обновить» копит сообщения и отправляет их пачкой', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Войти без пароля' }).click();
  await expect(page.locator('#menu-screen.active')).toBeVisible({ timeout: 15000 });

  await page.evaluate(() => {
    window.getCurrentUser = function () {
      return { id: 'admin', username: 'admin', role: 'admin' };
    };
    window.__sentImprovements = [];
    window.CattleTrackerApi = window.CattleTrackerApi || {};
    window.CattleTrackerApi.getBaseUrl = function () {
      return 'http://127.0.0.1:9';
    };
    window.CattleTrackerApi.submitReport = function (message, payload) {
      window.__sentImprovements.push({ message: message, payload: payload });
      return Promise.resolve({ ok: true });
    };
    window.CattleTrackerApi.getReports = function () {
      return Promise.resolve(
        window.__sentImprovements.map(function (x, i) {
          return {
            id: 'r' + i,
            status: 'new',
            payload: x.payload,
            message: x.message,
            createdAt: '2026-08-21 10:00'
          };
        })
      );
    };
    localStorage.removeItem('cattleTracker_improvementDrafts');
    if (typeof window.syncHeaderReloadButton === 'function') window.syncHeaderReloadButton();
  });

  await page.locator('#app-header-reload-btn').click();
  await expect(page.locator('#appVersionSuggestionText')).toBeVisible();
  await page.locator('#appVersionSuggestionText').fill('Первое');
  await page.locator('.app-version-suggestion-add').click();
  await page.locator('#appVersionSuggestionText').fill('Второе');
  await page.locator('.app-version-suggestion-add').click();
  await expect(page.locator('.app-version-suggestion-queue-item')).toHaveCount(2);
  await page.locator('.app-version-suggestion-send').click();
  await expect(page.locator('.app-version-suggestion-queue-item')).toHaveCount(0);
  await expect(page.locator('.app-version-suggestion-sent-item')).toHaveCount(2);
  await expect(page.locator('#appVersionSuggestionText')).toBeVisible();
  const sent = await page.evaluate(() => window.__sentImprovements);
  expect(sent.map((x) => x.message)).toEqual(['Первое', 'Второе']);
  expect(sent.every((x) => x.payload && x.payload.kind === 'improvement')).toBe(true);
});

test('у админа в шапке лампы А и С', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Войти без пароля' }).click();
  await expect(page.locator('#menu-screen.active')).toBeVisible({ timeout: 15000 });

  await page.evaluate(() => {
    window.getCurrentUser = function () {
      return { id: 'admin', username: 'admin', role: 'admin' };
    };
    if (typeof window.syncHeaderReloadButton === 'function') window.syncHeaderReloadButton();
    if (typeof window.syncAgentStatusLamp === 'function') window.syncAgentStatusLamp();
  });

  await expect(page.locator('#app-header-agent-btn')).toBeVisible();
  await expect(page.locator('#app-header-agent-btn .app-header-lamp-label')).toHaveText('А');
  await expect(page.locator('#app-header-connection-btn .app-header-lamp-label')).toHaveText('С');
  await expect(page.locator('#app-header-agent-next')).toBeVisible();
});

test('модалка версии: без новой версии кнопка «Обновить» неактивна', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Войти без пароля' }).click();
  await expect(page.locator('#menu-screen.active')).toBeVisible({ timeout: 15000 });

  await page.evaluate(() => {
    if (typeof window.showAppVersionActionsModal === 'function') {
      window.showAppVersionActionsModal({ localVer: '0.7.9', hasUpdate: false });
    }
  });

  await expect(page.getByRole('button', { name: 'Посмотреть список изменений' })).toBeVisible();
  await expect(page.locator('.app-version-action-update')).toBeDisabled();
});
