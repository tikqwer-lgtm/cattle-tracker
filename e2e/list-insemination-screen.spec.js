// @ts-check
const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('cattleTracker_hasSeenHints', '1');
  });
});

test('экран журнала осеменений: таблица без фильтров', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Войти без пароля' }).click();
  await expect(page.locator('#menu-screen.active')).toBeVisible({ timeout: 15000 });

  await page.evaluate(() => {
    if (typeof window.navigate === 'function') window.navigate('list-insemination');
  });
  await expect(page.locator('#list-insemination-screen.active')).toBeVisible({ timeout: 10000 });

  await expect(page.locator('#list-insem-table')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('#allInsemSearchInput')).toHaveCount(0);
});

test('журнал осеменений: строки из inseminationHistory', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Войти без пароля' }).click();
  await expect(page.locator('#menu-screen.active')).toBeVisible({ timeout: 15000 });

  await page.evaluate(() => {
    window.entries.length = 0;
    window.entries.push({
      cattleId: '101',
      nickname: 'Зорька',
      lactation: 2,
      inseminationHistory: [
        { date: '2025-01-10', attemptNumber: 1, bull: 'Б-1', inseminator: 'Иванов', code: 'C1' },
        { date: '2025-02-15', attemptNumber: 2, bull: 'Б-2', inseminator: 'Петров', code: 'C2' }
      ],
      actionHistory: [],
      status: 'Холостая'
    });
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
    if (typeof window.CattleTrackerEvents !== 'undefined') {
      window.CattleTrackerEvents.emit('entries:updated', window.entries);
    }
    if (typeof window.navigate === 'function') window.navigate('list-insemination');
  });

  await expect(page.locator('#list-insemination-screen.active')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#list-insem-table .all-inseminations-table tbody tr')).toHaveCount(3, { timeout: 5000 });
  await expect(page.locator('#list-insem-table')).toContainText('101');
  await expect(page.locator('#list-insem-table')).toContainText('202');
  await expect(page.locator('#list-insem-table')).toContainText('Зорька');
});
