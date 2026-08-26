// @ts-check
/** Автоматическая часть RELEASE_CHECKLIST.md (локальный режим, без API). */
const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('cattleTracker_hasSeenHints', '1');
  });
});

async function enterLocalMenu(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Войти без пароля' }).click();
  await expect(page.locator('#menu-screen.active')).toBeVisible({ timeout: 15000 });
}

var SUBMENU_GROUP_IDS = {
  'Животные и списки': 'data',
  'Действия': 'actions',
  'Аналитика': 'analytics',
  'Настройки': 'settings',
};

async function openHerdHub(page) {
  await page.evaluate(function () {
    if (typeof window.navigate === 'function') window.navigate('herd-hub');
  });
  await expect(page.locator('#herd-hub-screen.active')).toBeVisible({ timeout: 10000 });
}

async function openSubmenu(page, groupButtonName) {
  var groupId = SUBMENU_GROUP_IDS[groupButtonName];
  if (groupId) {
    await page.evaluate(function (id) {
      if (typeof window.navigateToSubmenu === 'function') window.navigateToSubmenu(id);
    }, groupId);
  } else {
    await page.locator('#herd-hub-screen .menu-group-btn').filter({ hasText: groupButtonName }).click();
  }
  await expect(page.locator('#submenu-screen.active')).toBeVisible({ timeout: 10000 });
}

async function openViewList(page) {
  await page.evaluate(function () {
    if (typeof window.navigate === 'function') window.navigate('view');
  });
  await expect(page.locator('#view-screen.active')).toBeVisible({ timeout: 15000 });
}

async function backToMenuFromView(page) {
  await page.evaluate(function () {
    if (typeof window.navigate === 'function') window.navigate('menu');
  });
  await expect(page.locator('#menu-screen.active')).toBeVisible({ timeout: 10000 });
}

test.describe('Чек-лист: вход и выход', () => {
  test('экран входа: локальный режим и форма сервера', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Вход' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Войти без пароля' })).toBeVisible();
    await expect(
      page.locator('#auth-screen').getByRole('button', { name: 'Подключиться к серверу' })
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Запросить логин/пароль' })).toBeVisible();
    await expect(page.locator('#authServerSelect')).toBeVisible();
    await expect(page.locator('#authLoginForm')).toHaveCount(1);
    await expect(page.locator('#auth-server-block button', { hasText: 'Регистрация' })).toHaveCount(1);
    await expect(page.locator('#authForgotPasswordBtn')).toHaveCount(1);
  });

  test('вход без пароля открывает меню', async ({ page }) => {
    await enterLocalMenu(page);
    await expect(page.getByRole('button', { name: 'Работа со стадом' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Карточка хозяйства' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Настройки' })).toBeVisible();
    await expect(page.locator('#menuLogoutBtn')).toBeVisible();
  });

  test('выход возвращает на вход и фокус в пароль', async ({ page }) => {
    await enterLocalMenu(page);
    await page.locator('#menuLogoutBtn').click();
    await expect(page.locator('#auth-screen.active')).toBeVisible({ timeout: 10000 });
    const serverAuth = page.locator('#auth-server-block');
    if (await serverAuth.isVisible()) {
      await expect(page.locator('#authPassword')).toBeFocused({ timeout: 5000 });
    } else {
      await expect(page.locator('#auth-connect-server-btn')).toBeFocused({ timeout: 5000 });
    }
  });
});

test.describe('Чек-лист: меню и навигация', () => {
  test.beforeEach(async ({ page }) => {
    await enterLocalMenu(page);
    await openHerdHub(page);
  });

  const groups = [
    'Животные и списки',
    'Действия',
  ];

  for (const name of groups) {
    test('группа «' + name + '» открывает подменю', async ({ page }) => {
      await openSubmenu(page, name);
      await page.evaluate(function () {
        if (typeof window.navigate === 'function') window.navigate('menu');
      });
      await expect(page.locator('#menu-screen.active')).toBeVisible();
    });
  }

  test('переход: список животных', async ({ page }) => {
    await openSubmenu(page, 'Животные и списки');
    await openViewList(page);
    await backToMenuFromView(page);
  });
});

test.describe('Чек-лист: данные и XLSX', () => {
  test.beforeEach(async ({ page }) => {
    await enterLocalMenu(page);
    await openHerdHub(page);
  });

  test('список животных и табло на хабе стада', async ({ page }) => {
    const totalEl = page.locator('#totalCows');
    await expect(totalEl).toBeVisible();
    const totalText = await totalEl.textContent();

    await openSubmenu(page, 'Животные и списки');
    await openViewList(page);

    const emptyMsg = page.locator('#viewEntriesList').getByText(/Нет записей/i);
    const hasRows = await page.locator('#viewEntriesList tbody tr').count();
    if (hasRows === 0) {
      await expect(emptyMsg).toBeVisible({ timeout: 5000 });
      expect(totalText?.trim()).toBe('0');
    }
  });

  test('window.XLSX доступен из бандла', async ({ page }) => {
    await page.goto('/');
    const ok = await page.evaluate(() => typeof window.XLSX !== 'undefined' && typeof window.XLSX.utils !== 'undefined');
    expect(ok).toBe(true);
  });
});
