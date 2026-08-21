// @ts-check
const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('cattleTracker_hasSeenHints', '1');
  });
});

test('Все осеменения: кнопка «Добавить осеменение» открывает ввод и возвращает назад', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Войти без пароля' }).click();
  await expect(page.locator('#menu-screen.active')).toBeVisible({ timeout: 15000 });

  await page.evaluate(() => {
    if (typeof window.navigate === 'function') window.navigate('all-inseminations');
  });
  await expect(page.locator('#all-inseminations-screen.active')).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('button', { name: 'Добавить осеменение' })).toBeVisible();

  await page.getByRole('button', { name: 'Добавить осеменение' }).click();
  await expect(page.locator('#insemination-screen.active')).toBeVisible({ timeout: 10000 });

  await page.locator('#insemination-screen .back-button').click();
  await expect(page.locator('#all-inseminations-screen.active')).toBeVisible({ timeout: 10000 });
});
