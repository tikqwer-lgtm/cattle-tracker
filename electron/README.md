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
npm install
npm run dist
```

Перед первой сборкой обязательно выполните `npm install`, иначе в пакет не попадёт `electron-updater` и в установленной версии будет «Модуль обновлений не загружен».

Итоговые файлы появятся в `electron/dist/`. Скрипт `copy-web.js` перед сборкой копирует веб-приложение в `electron/`.

## Автообновление

Проверка обновлений идёт через **GitHub Releases**. Ошибка «Cannot find latest.yml» значит: в релизе нет файла `latest.yml` или установщика с нужным именем.

### Как выложить релиз (один раз для каждой версии)

1. **Соберите проект** (в папке `electron/`):
   ```bash
   npm install
   npm run dist
   ```

2. **Создайте Release на GitHub**  
   Репозиторий: https://github.com/tikqwer-lgtm/cattle-tracker → вкладка **Releases** → **Draft a new release**.

3. **Укажите тег версии**  
   Тег должен совпадать с версией в `electron/package.json`, например: **`v1.0.1`** (обязательно буква `v` в начале).  
   Можно создать тег из интерфейса при создании релиза.

4. **Загрузите из `electron/dist/` два файла:**
   - **`latest.yml`**
   - **`cattle-tracker-desktop-setup-1.0.1.exe`** (имя совпадает с версией в `package.json`; в сборке задано через `artifactName`, так что exe и `latest.yml` всегда соответствуют друг другу).

5. Опубликуйте релиз (**Publish release**).

После этого установленная версия сможет находить `latest.yml` по адресу  
`https://github.com/tikqwer-lgtm/cattle-tracker/releases/download/v1.0.1/latest.yml`  
и при проверке обновлений не будет 404.

Если репозиторий другой — измените в `electron/package.json` в секции `build.publish` поля `owner` и `repo`.
