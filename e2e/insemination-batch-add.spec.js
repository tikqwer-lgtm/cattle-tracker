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
  await expect(page.locator('#inseminationBatchSaveBtn')).toHaveText('Сохранить');

  await page.locator('#inseminationBatchAddInput').fill('101');
  await expect(page.locator('#inseminationAttemptInput')).toHaveValue('2');

  await page.locator('#inseminationBatchAddInput').fill('999');
  await expect(page.locator('#inseminationAttemptInput')).toHaveValue('');
  await expect(page.locator('.autocomplete-create')).toHaveCount(0);

  await page.locator('#inseminationBatchAddBtn').click();
  await expect(page.locator('#inseminationBatchDraftTable')).toContainText('999');
  await expect(page.locator('#inseminationBatchDraftTable')).toContainText('—');

  const actions = page.locator('#insemination-screen .screen-actions--insem-batch');
  await expect(actions.locator('#inseminationBatchAddBtn')).toBeVisible();
  await expect(actions.getByRole('button', { name: 'Назад' })).toBeVisible();
  await expect(actions.locator('#inseminationBatchSaveBtn')).toBeVisible();
});

test('Групп ввод: счётчик последнего номера, Сохранить все закрывает и сохраняет', async ({ page }) => {
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
  await expect(page.locator('#inseminationGroupAddBtn')).toHaveText('Групп ввод');
  await page.locator('#inseminationGroupAddBtn').click();
  await expect(page.locator('#insemGroupNum')).toBeVisible();
  await expect(page.locator('#insemGroupOk')).toHaveText('Добавить');
  await expect(page.locator('#insemGroupCancel')).toHaveText('Сохранить все');
  await expect(page.locator('.action-batch-modal-hint')).toHaveCount(0);
  await page.locator('#insemGroupNum').fill('101');
  await page.locator('#insemGroupOk').click();
  await expect(page.locator('#inseminationBatchDraftTable')).toContainText('101');
  await expect(page.locator('#inseminationBatchDraftTable')).toContainText('2');
  await expect(page.locator('#insemGroupLastNum')).toHaveText('1. 101');
  await page.locator('#insemGroupNum').fill('888');
  await page.locator('#insemGroupOk').click();
  await expect(page.locator('#inseminationBatchDraftTable')).toContainText('888');
  await expect(page.locator('#inseminationBatchDraftTable')).toContainText('1');
  await expect(page.locator('#insemGroupLastNum')).toHaveText('2. 888');
  await page.locator('#insemGroupLastDel').click();
  await expect(page.locator('#inseminationBatchDraftTable')).not.toContainText('888');
  await expect(page.locator('#insemGroupLastNum')).toHaveText('1. 101');
  await page.locator('#insemGroupCancel').click();
  await expect(page.locator('#insemGroupNum')).toHaveCount(0);
});
