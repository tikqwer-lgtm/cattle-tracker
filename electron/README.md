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

Итоговые файлы появятся в `electron/dist/`. Перед сборкой имеет смысл скопировать веб-приложение (index.html, css, js) в `electron/` или настроить `extraResources` в `package.json`, чтобы они попали в пакет.
