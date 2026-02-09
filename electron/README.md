# Учёт коров — Desktop (Electron)

Запуск приложения в отдельном окне на Windows / macOS / Linux.

## Запуск из исходников

1. Установите зависимости в корне проекта (если ещё не установлены) и в `electron/`:

   ```bash
   cd electron
   npm install
   npm start
   ```

2. Окно откроет `index.html` из родительской папки. Для работы с сервером API раскомментируйте в корневом `index.html` строки с `CATTLE_TRACKER_USE_API` и `CATTLE_TRACKER_API_BASE` и укажите URL бэкенда (например `http://localhost:3000`).

## Сборка исполняемого файла

Из папки `electron/`:

```bash
npm run dist
```

Итоговые файлы появятся в `electron/dist/`. Скрипт `copy-web.js` перед сборкой копирует веб-приложение в `electron/`.

## Автообновление

Проверка обновлений идёт через GitHub Releases (репозиторий из `build.publish` в `package.json`). Чтобы «Не удалось проверить обновления» не появлялось:

1. Создайте **Release** в GitHub (репозиторий `tikqwer-lgtm/cattle-tracker` или свой — поправьте `publish` в `electron/package.json`).
2. Тег релиза должен совпадать с версией в `package.json`, например `v1.0.1`.
3. В этот релиз загрузите установщик из `dist/` и файл **`latest.yml`** (он тоже лежит в `dist/` после сборки) — без него updater не узнает новую версию.

Если релизов ещё нет или репозиторий другой — измените в `electron/package.json` в секции `build.publish` поля `owner` и `repo` под свой GitHub.
