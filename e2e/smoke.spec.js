// @ts-check
const { test, expect } = require('@playwright/test');

const LOGIN = 'Panko';
const PASSWORD = '06121992';

test.describe('Страница входа', () => {
  test('открывается и показывает форму входа', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Учёт коров/);
    await expect(page.getByRole('heading', { name: 'Вход' })).toBeVisible();
    const auth = page.locator('#auth-screen');
    await expect(auth.getByRole('textbox', { name: 'Логин' }).first()).toBeVisible();
    await expect(auth.getByLabel(/Пароль/).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Войти' })).toBeVisible();
  });

  test('кнопка «Продолжить без входа» присутствует', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Продолжить без входа' })).toBeVisible();
  });
});

test.describe('Сценарий 1: Вход — логин, регистрация, вход без пароля', () => {
  test('попытка входа по логину/паролю; при неудаче — регистрация; иначе вход без пароля', async ({ page }) => {
    await page.goto('/');
    const auth = page.locator('#auth-screen');

    // 1. Ввод логина и пароля (Panko; 06121992), попытка войти
    await auth.getByRole('textbox', { name: 'Логин' }).first().fill(LOGIN);
    await auth.getByLabel(/Пароль/).first().fill(PASSWORD);
    await page.getByRole('button', { name: 'Войти' }).click();

    // Ждём: либо переход на меню (успешный вход), либо остаёмся на экране входа / тост с ошибкой
    await page.waitForTimeout(1500);
    const menuVisible = await page.locator('#menu-screen.active').isVisible();

    if (menuVisible) {
      await expect(page.locator('#menu-screen.active')).toBeVisible();
      return;
    }

    // 2. Не получилось войти — пробуем зарегистрироваться
    await page.getByRole('button', { name: 'Регистрация' }).click();
    await page.locator('#regUsername').fill(LOGIN);
    await page.locator('#regPassword').fill(PASSWORD);
    await page.getByRole('button', { name: 'Зарегистрироваться' }).click();

    await page.waitForTimeout(1500);
    const menuAfterReg = await page.locator('#menu-screen.active').isVisible();
    if (menuAfterReg) {
      await expect(page.locator('#menu-screen.active')).toBeVisible();
      return;
    }

    // После регистрации показывается форма входа — можно попробовать войти ещё раз
    const loginFormAgain = await page.locator('#authLoginForm').isVisible();
    if (loginFormAgain) {
      await auth.getByRole('textbox', { name: 'Логин' }).first().fill(LOGIN);
      await auth.getByLabel(/Пароль/).first().fill(PASSWORD);
      await page.getByRole('button', { name: 'Войти' }).click();
      await page.waitForTimeout(1500);
      if (await page.locator('#menu-screen.active').isVisible()) {
        await expect(page.locator('#menu-screen.active')).toBeVisible();
        return;
      }
    }

    // 3. Вход без авторизации (Продолжить без входа)
    await expect(page.getByRole('button', { name: 'Продолжить без входа' })).toBeVisible();
    await page.getByRole('button', { name: 'Продолжить без входа' }).click();
    await expect(page.locator('#menu-screen.active')).toBeVisible();
  });
});

test.describe('Сценарий 2: Настройки сервера и вход без пароля', () => {
  test('открыть настройки сервера, подключиться/отключиться, оставить отключённым, войти без пароля', async ({ page }) => {
    // Чистое состояние: без сохранённого сервера, чтобы была кнопка «Продолжить без входа»
    await page.goto('/');
    await page.evaluate(() => {
      try {
        localStorage.removeItem('cattleTracker_apiBase');
      } catch (e) {}
    });
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Вход' })).toBeVisible();

    // 1. Войти в окно настройки сервера (кнопка в шапке)
    await page.locator('#app-header-connection-btn').click();
    await expect(page.getByRole('heading', { name: /Настройки сервера/ })).toBeVisible();
    await expect(page.locator('#sync-screen.active')).toBeVisible();

    // 2. Подключиться к серверу (ввод адреса и «Сохранить и подключиться» → перезагрузка)
    await page.locator('#serverApiBaseInput').fill('http://localhost:3000');
    await page.getByRole('button', { name: 'Сохранить и подключиться' }).click();

    // Ждём перезагрузки и появления экрана входа
    await expect(page.getByRole('heading', { name: 'Вход' })).toBeVisible({ timeout: 10000 });

    // 3. Снова открыть настройки сервера и отключиться
    await page.locator('#app-header-connection-btn').click();
    await expect(page.getByRole('heading', { name: /Настройки сервера/ })).toBeVisible();

    const disconnectBtn = page.getByRole('button', { name: 'Отключиться от сервера' });
    await expect(disconnectBtn).toBeVisible({ timeout: 3000 });
    await disconnectBtn.click();

    // Подтверждение отключения (модальное окно)
    await expect(page.locator('.confirm-overlay .confirm-ok')).toBeVisible({ timeout: 3000 });
    await page.locator('.confirm-overlay .confirm-ok').click();
    await expect(page.getByRole('heading', { name: 'Вход' })).toBeVisible({ timeout: 10000 });

    // 4. Войти без пароля
    await expect(page.getByRole('button', { name: 'Продолжить без входа' })).toBeVisible();
    await page.getByRole('button', { name: 'Продолжить без входа' }).click();
    await expect(page.locator('#menu-screen.active')).toBeVisible();
  });
});
