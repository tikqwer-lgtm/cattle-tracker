// @ts-check
const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('cattleTracker_hasSeenHints', '1');
  });
});

test('ввод осеменения: без подсказок, попытка из стада, новое животное кнопкой Добавить', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Войти без пароля' }).click();
  await expect(page.locator('#menu-screen.active')).toBeVisible({ timeout: 15000 });

  await page.evaluate(() => {
    window.entries.length = 0;
    window.entries.push({
      cattleId: '101',
      nickname: 'Зорька',
      lactation: 1,
      inseminationHistory: [{ date: '2025-01-10', attemptNumber: 1 }],
      actionHistory: [],
      status: 'Осеменена'
    });
  });

  await page.evaluate(() => {
    if (typeof window.navigate === 'function') window.navigate('insemination');
  });
  await expect(page.locator('#insemination-screen.active')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#inseminationBatchAddList')).toHaveCount(0);
  await expect(page.locator('#inseminationBatchAddBtn')).toBeVisible();
  await expect(page.locator('#inseminationAttemptInput')).toBeVisible();

  await page.locator('#inseminationBatchAddInput').fill('101');
  await expect(page.locator('#inseminationAttemptInput')).toHaveValue('2');

  await page.locator('#inseminationBatchAddInput').fill('999');
  await expect(page.locator('#inseminationAttemptInput')).toHaveValue('');
  await expect(page.locator('.autocomplete-create')).toHaveCount(0);

  await page.locator('#inseminationBatchAddBtn').click();
  await expect(page.locator('#inseminationBatchDraftTable')).toContainText('999');
  await expect(page.locator('#inseminationBatchDraftTable')).toContainText('—');
});
