// @ts-check
const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('cattleTracker_hasSeenHints', '1');
  });
});

test('экран списка отёлов: навигация месяца и таблица', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Войти без пароля' }).click();
  await expect(page.locator('#menu-screen.active')).toBeVisible({ timeout: 15000 });

  await page.evaluate(() => {
    if (typeof window.navigate === 'function') window.navigate('list-calving');
  });
  await expect(page.locator('#list-calving-screen.active')).toBeVisible({ timeout: 10000 });

  await expect(page.locator('#calvingListPrev')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('#calvingListMonthLabel')).not.toHaveText('—');
  await expect(page.locator('#calving-list-table-wrap')).toBeVisible();
});
