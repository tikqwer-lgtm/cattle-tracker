// @ts-check
const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('cattleTracker_hasSeenHints', '1');
  });
});

test('модалка версии: у админа «Обновить» открывает предложение, не качает APK', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Войти без пароля' }).click();
  await expect(page.locator('#menu-screen.active')).toBeVisible({ timeout: 15000 });

  await page.evaluate(() => {
    window.getCurrentUser = function () {
      return { id: 'admin', username: 'admin', role: 'admin' };
    };
    if (typeof window.showAppVersionActionsModal === 'function') {
      window.showAppVersionActionsModal({ localVer: '0.7.8', hasUpdate: true });
    }
  });

  await expect(page.locator('.app-version-action-update')).toBeVisible();
  await page.locator('.app-version-action-update').click();
  await expect(page.locator('#appVersionSuggestionText')).toBeVisible();
  await expect(page.locator('.app-version-suggestion-send')).toBeVisible();
});

test('шапка «Обновить» у админа открывает форму предложения, а не перезагружает страницу', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Войти без пароля' }).click();
  await expect(page.locator('#menu-screen.active')).toBeVisible({ timeout: 15000 });

  await page.evaluate(() => {
    window.getCurrentUser = function () {
      return { id: 'admin', username: 'admin', role: 'admin' };
    };
    window.CattleTrackerApi = window.CattleTrackerApi || {};
    window.CattleTrackerApi.getBaseUrl = function () {
      return 'http://127.0.0.1:9';
    };
    if (typeof window.syncHeaderReloadButton === 'function') window.syncHeaderReloadButton();
  });

  await page.locator('#app-header-reload-btn').click();
  await expect(page.locator('#appVersionSuggestionText')).toBeVisible();
});

test('модалка версии: у не-админа кнопки «Обновить» нет', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Войти без пароля' }).click();
  await expect(page.locator('#menu-screen.active')).toBeVisible({ timeout: 15000 });

  await page.evaluate(() => {
    window.getCurrentUser = function () {
      return { id: 'u2', username: 'tech', role: 'inseminator' };
    };
    if (typeof window.showAppVersionActionsModal === 'function') {
      window.showAppVersionActionsModal({ localVer: '0.7.8', hasUpdate: true });
    }
  });

  await expect(page.getByRole('button', { name: 'Посмотреть список изменений' })).toBeVisible();
  await expect(page.locator('.app-version-action-update')).toHaveCount(0);
});
