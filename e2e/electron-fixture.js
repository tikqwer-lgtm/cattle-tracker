// @ts-check
/**
 * Фикстура для e2e: страница = уже открытое окно Electron (подключение по CDP).
 * Используется только в проекте "electron".
 */
const { test: base, chromium } = require('@playwright/test');

const CDP_URL = 'http://localhost:9222';

const test = base.extend({
  page: async ({}, use) => {
    const browser = await chromium.connectOverCDP(CDP_URL);
    const ctx = browser.contexts()[0];
    const page = ctx && ctx.pages()[0] ? ctx.pages()[0] : await ctx.newPage();
    await use(page);
    // Не закрываем browser — это окно приложения
  },
});

module.exports = { test };
