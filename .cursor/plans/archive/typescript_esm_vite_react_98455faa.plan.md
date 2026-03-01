---
name: TypeScript ESM Vite React
overview: Поэтапное внедрение TypeScript, ES-модулей, Vite и миграция UI на React с сохранением работы веб-, Electron- и Capacitor-сборок и E2E/unit-тестов.
todos: []
isProject: false
---

# План: TypeScript, ES-модули, Vite и React

## Текущее состояние

- **Сборка:** [scripts/build.js](scripts/build.js) конкатенирует ~30 JS-файлов в [dist/app.js](dist/app.js) в фиксированном порядке.
- **Зависимости между модулями:** глобальные переменные и `window.*` (например `navigate`, `getCurrentObjectId`, `entries`, `loadLocally`). В [index.html](index.html) — десятки `onclick="typeof window.navigate === 'function' && window.navigate(...)"`.
- **Платформы:** корневой [index.html](index.html) подключает `dist/app.js`; [electron/copy-web.js](electron/copy-web.js) копирует корень + вызывает `node scripts/build.js` и кладёт бандл в `electron/web/app.js`; Capacitor с `webDir: "."` использует корень как веб-директорию.
- **Тесты:** Vitest — [tests/*.test.mjs](tests/) (node); Playwright — e2e против `serve -p 9323 .` или Electron.

Цель — сохранить работоспособность веб, Electron, Capacitor и тестов на каждом шаге.

---

## Фаза 1: Vite как инструмент сборки (без смены стиля кода)

**Задача:** заменить конкатенацию на сборку через Vite, не вводя пока ESM в исходниках.

- Установить `vite` (и при необходимости `vite-plugin-static-concat` или аналог).
- Добавить [vite.config.js](vite.config.js):
  - Точка входа — один виртуальный или реальный entry, который подключает все файлы в том же порядке, что в [scripts/build.js](scripts/build.js) (например, через плагин, который по списку файлов собирает один бандл).
  - Выход: `dist/`, один бандл (например `dist/app.js` или `dist/assets/index-*.js`).
  - Учесть внешние скрипты из [index.html](index.html) (PapaParse, Chart.js, xlsx) — оставить как в HTML или подключить через npm и помечать как external при необходимости.
- Оставить [index.html](index.html) в корне: либо как entry для Vite (тогда Vite подставит скрипт в `dist/index.html`), либо по-прежнему один `<script src="dist/app.js">` и собирать только JS.
- Скрипты в [package.json](package.json): `build` → `vite build`, при необходимости оставить `scripts/build.js` как fallback до проверки Electron/Capacitor.
- Обновить [electron/copy-web.js](electron/copy-web.js): вместо `node scripts/build.js` вызывать `npm run build` (vite build); копировать артефакты из `dist/` (если выход изменится на `dist/index.html` + `dist/assets/`, копировать всю `dist/` в `electron/web/` и подправить пути в копии index.html).
- Проверить: веб (`npm run build` + `npx serve` или `vite preview`), Electron (`npm run electron:dist`), Capacitor (при необходимости см. фазу 1.1), E2E (Playwright по текущей схеме).

**Итог фазы 1:** Сборка идёт через Vite, выход по возможности тот же (`dist/app.js` или один бандл в `dist/`), чтобы минимум менять существующие пути.

---

## Фаза 1.1: Capacitor и единый выход Vite

- Если Vite отдаёт `dist/index.html` + хэшированные файлы в `dist/assets/`, в [package.json](package.json) в секции `capacitor` задать `webDir: "dist"` (или эквивалент для текущей версии Capacitor), чтобы мобильные сборки брали готовый `dist/`.
- Убедиться, что `cap sync` и запуск на устройстве/эмуляторе работают с новой структурой.

---

## Фаза 2: Переход на ES-модули (постепенно)

**Задача:** заменить глобальные зависимости на `import`/`export`, сохраняя совместимость с `index.html` (onclick и т.д.).

- Ввести единую точку входа ESM (например `src/main.js` или `js/main.js`):
  - Импортирует все модули в нужном порядке (по текущему [scriptOrder](scripts/build.js)).
  - В конце явно вешает на `window` всё, что ожидает HTML и старый код: `window.navigate`, `window.handleLogin`, `window.showAuthRegister`, и т.д. — список взять из [index.html](index.html) (onclick/onsubmit).
- Превращать файлы в модули по одному (или группами по папкам):
  - В конце каждого файла добавить `export {}` (или именованные export’ы).
  - Заменить использование глобальных переменных из других файлов на `import` (например, в [js/core/app.js](js/core/app.js) — импорт из storage, core, menu и т.д.).
  - В файлах, которые сейчас пишут в глобал без объявления (например [js/storage/storage.js](js/storage/storage.js): `getCurrentObjectId = function ...`), заменить на явное присваивание в `window` или на экспорт функций и их присваивание в `window` в entry.
- Порядок миграции логично начать с нижнего уровня (config, constants, utils), затем storage, api, core, ui, features, в конце menu и app.
- Обновить Vite: entry — новый `main.js`, который импортирует только модули (старые конкатенируемые файлы по мере перевода подключать через import, остальные убрать из списка конкатенации).
- После перевода всех файлов удалить [scripts/build.js](scripts/build.js) и любой плагин конкатенации; сборка только через Vite.

**Риски:** много кросс-ссылок (например, [js/core/core.js](js/core/core.js) вызывает `loadLocally`, [js/storage/storage.js](js/storage/storage.js) подменяет глобалы). Нужно явно экспортировать/импортировать или продолжать вешать часть API на `window` в entry до перехода на React.

---

## Фаза 3: Включение TypeScript

**Задача:** включить проверку типов и по возможности переписать код на TypeScript без смены UI.

- Инициализировать TypeScript: `tsconfig.json` в корне (или в `src/` при наличии).
  - Рекомендуемые опции: `"module": "ESNext"`, `"target": "ES2020"` (или по поддержке браузеров), `"moduleResolution": "bundler"`, `"strict": true`, `"allowJs": true`, `"checkJs": false` на первом этапе.
- В [vite.config.js](vite.config.js) TypeScript обрабатывается из коробки; при необходимости добавить плагин для путей.
- Переименовывать файлы по одному (или по папкам): `.js` → `.ts`. Исправлять синтаксис (JSDoc при желании оставить для части кода). Добавлять типы для аргументов и возвращаемых значений, интерфейсы для объектов (записи коров, объекты, пользователи и т.д.).
- Типы для внешних API: при использовании Chart.js, xlsx, PapaParse — установить `@types/...` там, где они есть; при отсутствии — объявить минимальные интерфейсы в `*.d.ts`.
- Сервер [server/](server/) при желании тоже перевести на TypeScript (отдельный `tsconfig.json` в `server/`, скрипты сборки/запуска через `ts-node` или сборку в JS).

**Итог фазы 3:** Фронтенд (и при необходимости бэкенд) на TypeScript, строгая типизация там, где уже переведено; ESM и Vite без изменений.

---

## Фаза 4: Миграция UI на React

**Задача:** заменить экраны на основе статичного HTML и глобальных обработчиков на React-компоненты и состояние.

- Установить React, ReactDOM; при необходимости `react-router-dom` для маршрутизации экранов.
- Точка входа: в [index.html](index.html) оставить один корневой `<div id="root">` (остальной контент экранов со временем удалить или оставить только статичную обёртку). В entry (например `src/main.tsx`) делать `createRoot(document.getElementById('root')).render(<App />)`.
- Структура приложения:
  - Один корневой компонент `App`: состояние текущего экрана (или маршрут), текущий пользователь, флаги API и т.д.
  - Навигация: вместо `window.navigate(id)` — обновление состояния/роутера (например `setScreen('menu')` или `<Route path="...">`). Все вызовы `navigate` из кода и из будущих React-обработчиков заменить на вызовы контекста/роутера.
  - Каждый текущий «экран» (auth, menu, submenu, add cow, view list, view cow, sync, analytics, …) — отдельный React-компонент. Данные (entries, объекты, пользователь) передавать через контекст или глобальное состояние (например React Context + useReducer или Zustand/Redux).
- Перенос экранов по приоритету:
  - Сначала: Auth, Menu, Submenu (навигация и базовая обвязка).
  - Затем: список и карточка коровы (view list, view cow), добавление/редактирование (add/edit cow).
  - Затем: осеменение, протоколы, экспорт/импорт, аналитика, уведомления, синхронизация, настройки.
- Внешние библиотеки: Chart.js, xlsx, PapaParse — использовать из React (ref на canvas, вызовы в useEffect или в обработчиках). При необходимости обернуть в хуки или утилиты.
- Убрать из HTML все `onclick`/`onsubmit`, которые дублируют логику в React. Заглушки в [index.html](index.html) (строки 687–721) удалить после переноса навигации и авторизации в React.
- Стили: [css/style.css](css/style.css) и [css/print.css](css/print.css) оставить глобальными или постепенно перейти на CSS-модули/стили в компонентах — по желанию.
- Тесты: E2E (Playwright) оставить на уровне «клики и проверка контента»; при необходимости обновить селекторы. Unit-тесты (Vitest) для логики (analytics-calc, search-filter и т.д.) перевести на вызовы чистых функций/хуков из React-дерева или из отдельных модулей.

**Зависимости фаз:** 4 опирается на 2 и 3 (ESM и TS), чтобы компоненты и контекст были типизированы и импортировались через модули.

---

## Сводка по инструментам и файлам


| Элемент   | Сейчас                                     | После плана                                                             |
| --------- | ------------------------------------------ | ----------------------------------------------------------------------- |
| Сборка    | `scripts/build.js` (concat)                | Vite (`vite build`)                                                     |
| Модули    | Глобалы, один бандл                        | ESM, один entry (`main.tsx`)                                            |
| Типы      | Нет                                        | TypeScript, strict                                                      |
| UI        | HTML + vanilla JS                          | React (компоненты + роутер/state)                                       |
| Веб       | index.html + dist/app.js                   | index.html + root, Vite → dist/                                         |
| Electron  | copy-web.js → web/app.js                   | copy-web копирует dist/ в electron/web/                                 |
| Capacitor | webDir "."                                 | webDir "dist" (или эквивалент)                                          |
| Тесты     | Vitest (node), Playwright (serve/Electron) | Без изменений концепции; при необходимости обновить команды и селекторы |


---

## Порядок выполнения (кратко)

1. **Фаза 1** — Vite, один бандл в dist, подстроить Electron/Capacitor.
2. **Фаза 2** — ESM: entry + экспорт/импорт по файлам, привязка к `window` в entry.
3. **Фаза 3** — TypeScript: tsconfig, переименование .js → .ts, типы и при необходимости типы для server.
4. **Фаза 4** — React: корень, навигация, перенос экранов по одному, удаление старых onclick и заглушек.

На каждом шаге проверять: `npm run build`, веб-запуск, `npm run electron:dist`, Capacitor (если используется), `npm run test`, `npm run e2e` / e2e:electron.