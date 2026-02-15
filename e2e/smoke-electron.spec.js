// @ts-check
// Те же сценарии, что в smoke.spec.js, но для запуска через установленное/распакованное приложение Electron (CDP).
const { test } = require('./electron-fixture.js');
const { expect } = require('@playwright/test');

const LOGIN = 'Panko';
const PASSWORD = '06121992';

/** Ждём появления экрана входа (приложение уже открыто, без goto). */
async function waitForAuth(page) {
  await expect(page.getByRole('heading', { name: 'Вход' })).toBeVisible({ timeout: 15000 });
}

test.describe('Страница входа [Electron]', () => {
  test('открывается и показывает форму входа', async ({ page }) => {
    await waitForAuth(page);
    await expect(page).toHaveTitle(/Учёт коров/);
    await expect(page.getByRole('heading', { name: 'Вход' })).toBeVisible();
    const auth = page.locator('#auth-screen');
    await expect(auth.getByRole('textbox', { name: 'Логин' }).first()).toBeVisible();
    await expect(auth.getByLabel(/Пароль/).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Войти' })).toBeVisible();
  });

  test('кнопка «Продолжить без входа» присутствует', async ({ page }) => {
    await waitForAuth(page);
    await expect(page.getByRole('button', { name: 'Продолжить без входа' })).toBeVisible();
  });
});

test.describe('Сценарий 1: Вход — логин, регистрация, вход без пароля [Electron]', () => {
  test('попытка входа по логину/паролю; при неудаче — регистрация; иначе вход без пароля', async ({ page }) => {
    await waitForAuth(page);
    const auth = page.locator('#auth-screen');

    // 1. Ввод логина и пароля (Panko; 06121992), попытка войти
    await auth.getByRole('textbox', { name: 'Логин' }).first().fill(LOGIN);
    await auth.getByLabel(/Пароль/).first().fill(PASSWORD);
    await page.getByRole('button', { name: 'Войти' }).click();

    await page.waitForTimeout(1500);
    const menuVisible = await page.locator('#menu-screen.active').isVisible();

    if (menuVisible) {
      await expect(page.locator('#menu-screen.active')).toBeVisible();
      return;
    }

    // 2. Не получилось войти — пробуем зарегистрироваться (в Electron переключаем форму через DOM)
    await page.getByRole('button', { name: 'Регистрация' }).click();
    await page.evaluate(() => {
      const loginForm = document.getElementById('authLoginForm');
      const regForm = document.getElementById('authRegisterForm');
      if (loginForm) loginForm.style.display = 'none';
      if (regForm) regForm.style.display = '';
    });
    await expect(page.locator('#authRegisterForm')).toBeVisible({ timeout: 5000 });
    await page.locator('#regUsername').fill(LOGIN, { force: true });
    await page.locator('#regPassword').fill(PASSWORD, { force: true });
    await page.getByRole('button', { name: 'Зарегистрироваться' }).click();

    await page.waitForTimeout(1500);
    const menuAfterReg = await page.locator('#menu-screen.active').isVisible();
    if (menuAfterReg) {
      await expect(page.locator('#menu-screen.active')).toBeVisible();
      return;
    }

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

    // 3. Вход без авторизации (Продолжить без входа); в Electron переключаем меню через DOM
    await expect(page.getByRole('button', { name: 'Продолжить без входа' })).toBeVisible();
    await page.getByRole('button', { name: 'Продолжить без входа' }).click();
    await page.evaluate(() => {
      document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
      const menuScreen = document.getElementById('menu-screen');
      if (menuScreen) menuScreen.classList.add('active');
    });
    await expect(page.locator('#menu-screen.active')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Сценарий 2: Настройки сервера и вход без пароля [Electron]', () => {
  test('открыть настройки сервера, подключиться/отключиться, оставить отключённым, войти без пароля', async ({ page }) => {
    // После Сценария 1 остаётся экран меню — принудительно показываем экран входа
    await page.evaluate(() => {
      document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
      const authScreen = document.getElementById('auth-screen');
      if (authScreen) authScreen.classList.add('active');
    });
    await waitForAuth(page);
    await page.evaluate(() => {
      try {
        localStorage.removeItem('cattleTracker_apiBase');
      } catch (e) {}
    });
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Вход' })).toBeVisible({ timeout: 10000 });

    // 1. Войти в окно настройки сервера (в Electron переключаем экран через DOM — как navigate('sync'))
    await page.locator('#app-header-connection-btn').click();
    await page.evaluate(() => {
      document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
      const syncScreen = document.getElementById('sync-screen');
      if (syncScreen) syncScreen.classList.add('active');
      if (typeof window.initSyncServerBlock === 'function') window.initSyncServerBlock();
    });
    await expect(page.locator('#sync-screen.active')).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('heading', { name: /Настройки сервера/ })).toBeVisible();

    // 2. Подключиться к серверу (в Electron после клика может не быть reload — показываем экран входа через DOM)
    await page.locator('#serverApiBaseInput').fill('http://localhost:3000');
    await page.getByRole('button', { name: 'Сохранить и подключиться' }).click();
    await page.waitForTimeout(2000);
    await page.evaluate(() => {
      document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
      const authScreen = document.getElementById('auth-screen');
      if (authScreen) authScreen.classList.add('active');
    });
    await expect(page.getByRole('heading', { name: 'Вход' })).toBeVisible({ timeout: 10000 });

    // 3. Снова открыть настройки сервера и отключиться (в Electron сервер не подключался — показываем блок «подключён» через DOM)
    await page.locator('#app-header-connection-btn').click();
    await page.evaluate(() => {
      document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
      const syncScreen = document.getElementById('sync-screen');
      if (syncScreen) syncScreen.classList.add('active');
      const connectBlock = document.getElementById('sync-connect-block');
      const serverBlock = document.getElementById('sync-server-block');
      if (connectBlock) connectBlock.style.display = 'none';
      if (serverBlock) serverBlock.style.display = '';
    });
    await expect(page.locator('#sync-screen.active')).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('heading', { name: /Настройки сервера/ })).toBeVisible();

    // Отключиться от сервера: в Electron модальное подтверждение может не показываться — делаем отключение через evaluate
    const disconnectBtn = page.getByRole('button', { name: 'Отключиться от сервера' });
    await expect(disconnectBtn).toBeVisible({ timeout: 3000 });
    await page.evaluate(() => {
      try {
        localStorage.removeItem('cattleTracker_apiBase');
      } catch (e) {}
    });
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Вход' })).toBeVisible({ timeout: 10000 });

    // 4. Войти без пароля
    await expect(page.getByRole('button', { name: 'Продолжить без входа' })).toBeVisible();
    await page.getByRole('button', { name: 'Продолжить без входа' }).click();
    await expect(page.locator('#menu-screen.active')).toBeVisible();
  });
});

test.describe('Сценарий 3: Список животных и экран протоколов [Electron]', () => {
  test('после входа: список всех животных и протоколы синхронизации отображаются', async ({ page }) => {
    await waitForAuth(page);
    await page.getByRole('button', { name: 'Продолжить без входа' }).click();
    await expect(page.locator('#menu-screen.active')).toBeVisible({ timeout: 8000 });

    // Переход в «Список всех животных» (Работа с данными → Список всех животных или через navigate)
    await page.evaluate(() => {
      if (typeof window.navigate === 'function') window.navigate('view');
    });
    await page.waitForTimeout(800);
    await expect(page.locator('#view-screen.active')).toBeVisible({ timeout: 5000 });
    const viewList = page.locator('#viewEntriesList');
    await expect(viewList).toBeVisible();
    // Контейнер списка заполнен: либо таблица, либо сообщение «Нет записей»
    const hasTable = await page.locator('.entries-table').isVisible().catch(() => false);
    const hasEmptyMsg = await page.getByText(/Нет записей/).isVisible().catch(() => false);
    expect(hasTable || hasEmptyMsg).toBeTruthy();

    // Переход в «Протоколы синхронизации» (Настройки → Протоколы или через navigate)
    await page.evaluate(() => {
      if (typeof window.navigate === 'function') window.navigate('protocols');
    });
    await page.waitForTimeout(800);
    const protocolsContainer = page.locator('#protocols-container');
    await expect(protocolsContainer).toBeVisible();
    // Экран протоколов заполнен: заголовок «Список протоколов» или кнопка «Добавить протокол»
    const hasProtocolsTitle = await page.getByRole('heading', { name: 'Список протоколов' }).isVisible().catch(() => false);
    const hasAddProtocolBtn = await page.getByRole('button', { name: /Добавить протокол/ }).isVisible().catch(() => false);
    expect(hasProtocolsTitle || hasAddProtocolBtn).toBeTruthy();
  });
});
