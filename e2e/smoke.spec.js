// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Страница входа', () => {
  test('открывается в локальном режиме', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Учёт коров/);
    await expect(page.getByRole('heading', { name: 'Вход' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Войти без пароля' })).toBeVisible();
    await expect(
      page.locator('#auth-screen').getByRole('button', { name: 'Подключиться к серверу' })
    ).toBeVisible();
  });
});

test.describe('Локальный вход', () => {
  test('«Войти без пароля» открывает меню', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Войти без пароля' }).click();
    await expect(page.locator('#menu-screen.active')).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Экран синхронизации', () => {
  test('открывается из шапки с экрана входа и закрывается «Назад»', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Вход' })).toBeVisible();
    await page.locator('#app-header-connection-btn').click();
    await expect(page.locator('#sync-screen.active')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: /Синхронизация/ })).toBeVisible();
    await page
      .locator('#sync-screen')
      .getByRole('button', { name: 'Назад' })
      .click();
    await expect(page.locator('#auth-screen.active')).toBeVisible({ timeout: 10000 });
  });
});
