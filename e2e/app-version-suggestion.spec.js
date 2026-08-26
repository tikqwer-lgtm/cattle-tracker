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

test('шапка «Обновить» отправляет одно предложение сразу', async ({ page }) => {
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
    localStorage.removeItem('cattleTracker_improvementDrafts');
    if (typeof window.syncHeaderReloadButton === 'function') window.syncHeaderReloadButton();
  });

  await page.locator('#app-header-reload-btn').click();
  await expect(page.locator('#appVersionSuggestionText')).toBeVisible();
  await expect(page.locator('.app-version-suggestion-add')).toHaveCount(0);
  await expect(page.locator('.app-version-suggestion-queue-item')).toHaveCount(0);
  await page.locator('#appVersionSuggestionText').fill('Сделать поле цены');
  await page.locator('.app-version-suggestion-send').click();
  await expect(page.locator('#appVersionSuggestionText')).toHaveCount(0);
  const sent = await page.evaluate(() => window.__sentImprovements);
  expect(sent.map((x) => x.message)).toEqual(['Сделать поле цены']);
  expect(sent.every((x) => x.payload && x.payload.kind === 'improvement')).toBe(true);
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
