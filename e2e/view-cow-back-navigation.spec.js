// @ts-check
const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('cattleTracker_hasSeenHints', '1');
  });
});

test('карточка коровы: назад из «Все осеменения» возвращает в журнал', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Войти без пароля' }).click();
  await expect(page.locator('#menu-screen.active')).toBeVisible({ timeout: 15000 });

  await page.evaluate(() => {
    if (typeof window.navigate === 'function') window.navigate('all-inseminations');
  });
  await expect(page.locator('#all-inseminations-screen.active')).toBeVisible({ timeout: 10000 });

  await page.evaluate(() => {
    window.entries.length = 0;
    window.entries.push({
      cattleId: '101',
      nickname: 'Зорька',
      lactation: 2,
      inseminationHistory: [
        { date: '2025-01-10', attemptNumber: 1, bull: 'Б-1', inseminator: 'Иванов', code: 'C1' }
      ],
      actionHistory: [],
      status: 'Холостая'
    });
    if (typeof window.viewCow === 'function') window.viewCow('101');
  });

  await expect(page.locator('#view-cow-screen.active')).toBeVisible({ timeout: 10000 });

  await page.evaluate(() => {
    if (typeof window.viewCowBack === 'function') window.viewCowBack();
  });

  await expect(page.locator('#all-inseminations-screen.active')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('#view-screen.active')).toHaveCount(0);
});

test('карточка коровы: аппаратная «Назад» (_handleBackButton) из «Все осеменения»', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Войти без пароля' }).click();
  await expect(page.locator('#menu-screen.active')).toBeVisible({ timeout: 15000 });

  await page.evaluate(() => {
    if (typeof window.navigate === 'function') window.navigate('all-inseminations');
  });
  await expect(page.locator('#all-inseminations-screen.active')).toBeVisible({ timeout: 10000 });

  await page.evaluate(() => {
    window.entries.length = 0;
    window.entries.push({
      cattleId: '202',
      nickname: 'Русалка',
      lactation: 1,
      inseminationHistory: [
        { date: '2025-03-01', attemptNumber: 1, bull: 'Б-3', inseminator: 'Сидоров', code: '' }
      ],
      actionHistory: [],
      status: 'Осеменена'
    });
    if (typeof window.viewCow === 'function') window.viewCow('202');
  });

  await expect(page.locator('#view-cow-screen.active')).toBeVisible({ timeout: 10000 });

  await page.evaluate(() => {
    if (typeof window._handleBackButton === 'function') window._handleBackButton();
  });

  await expect(page.locator('#all-inseminations-screen.active')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('#view-screen.active')).toHaveCount(0);
});
