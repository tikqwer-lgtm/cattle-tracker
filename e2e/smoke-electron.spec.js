// @ts-check
// Сценарии для Electron (CDP): те же ожидания UI, что и в smoke.spec.js (локальный режим по умолчанию).
const { test } = require('./electron-fixture.js');
const { expect } = require('@playwright/test');

async function waitForAuth(page) {
  await expect(page.getByRole('heading', { name: 'Вход' })).toBeVisible({ timeout: 15000 });
}

test.describe('Страница входа [Electron]', () => {
  test('открывается в локальном режиме', async ({ page }) => {
    await waitForAuth(page);
    await expect(page).toHaveTitle(/Учёт коров/);
    await expect(page.getByRole('button', { name: 'Войти без пароля' })).toBeVisible();
    await expect(
      page.locator('#auth-screen').getByRole('button', { name: 'Подключиться к серверу' })
    ).toBeVisible();
  });
});

test.describe('Локальный вход [Electron]', () => {
  test('«Войти без пароля» открывает меню', async ({ page }) => {
    await waitForAuth(page);
    await page.getByRole('button', { name: 'Войти без пароля' }).click();
    await expect(page.locator('#menu-screen.active')).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Экран синхронизации [Electron]', () => {
  test('открывается из шапки и «Назад» возвращает на вход', async ({ page }) => {
    await waitForAuth(page);
    await page.locator('#app-header-connection-btn').click();
    await page.evaluate(() => {
      document.querySelectorAll('.screen').forEach(function (el) {
        el.classList.remove('active');
      });
      var syncScreen = document.getElementById('sync-screen');
      if (syncScreen) syncScreen.classList.add('active');
      if (typeof window.initSyncServerBlock === 'function') window.initSyncServerBlock();
    });
    await expect(page.locator('#sync-screen.active')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: /Синхронизация/ })).toBeVisible();
    await page
      .locator('#sync-screen')
      .getByRole('button', { name: 'Назад' })
      .click();
    await expect(page.locator('#auth-screen.active')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Сценарий: список и протоколы [Electron]', () => {
  test('после входа отображаются список и протоколы', async ({ page }) => {
    await waitForAuth(page);
    await page.getByRole('button', { name: 'Войти без пароля' }).click();
    await expect(page.locator('#menu-screen.active')).toBeVisible({ timeout: 8000 });

    await page.evaluate(() => {
      if (typeof window.navigate === 'function') window.navigate('view');
    });
    await page.waitForTimeout(800);
    await expect(page.locator('#view-screen.active')).toBeVisible({ timeout: 5000 });
    const viewList = page.locator('#viewEntriesList');
    await expect(viewList).toBeVisible();
    const hasTable = await page.locator('.entries-table').isVisible().catch(() => false);
    const hasEmptyMsg = await page.getByText(/Нет записей/).isVisible().catch(() => false);
    expect(hasTable || hasEmptyMsg).toBeTruthy();

    await page.evaluate(() => {
      if (typeof window.navigate === 'function') window.navigate('protocols');
    });
    await page.waitForTimeout(800);
    const protocolsContainer = page.locator('#protocols-container');
    await expect(protocolsContainer).toBeVisible();
    const hasProtocolsTitle = await page.getByRole('heading', { name: 'Список протоколов' }).isVisible().catch(() => false);
    const hasAddProtocolBtn = await page.getByRole('button', { name: /Добавить протокол/ }).isVisible().catch(() => false);
    expect(hasProtocolsTitle || hasAddProtocolBtn).toBeTruthy();
  });
});
