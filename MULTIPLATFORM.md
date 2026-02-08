# Мультиплатформенный запуск

## Веб (текущий режим)

Откройте `index.html` в браузере или разместите папку на любом веб-сервере. Для многопользовательского режима запустите бэкенд и включите API в `index.html` (см. комментарии в `<head>`).

## Бэкенд API (многопользовательский режим)

```bash
cd server
npm install
npm start
```

Сервер: `http://localhost:3000`. В `index.html` раскомментируйте и при необходимости измените:

- `window.CATTLE_TRACKER_USE_API = true;`
- `window.CATTLE_TRACKER_API_BASE = 'http://localhost:3000';`

При первом запуске зарегистрируйте пользователя через форму «Регистрация».

## Десктоп (Electron)

```bash
cd electron
npm install
npm start
```

Откроется окно с приложением. Для работы с API настройте в корневом `index.html` переменные `CATTLE_TRACKER_USE_API` и `CATTLE_TRACKER_API_BASE`.

## Мобильные приложения (Capacitor)

Из корня проекта:

```bash
npm install
npx cap add android
# и/или: npx cap add ios
npx cap sync
npx cap run android
```

Для публикации в магазины соберите проект в Android Studio / Xcode и настройте подписание.
