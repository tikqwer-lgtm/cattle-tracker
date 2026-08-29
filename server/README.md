# Cattle Tracker API

Backend for multi-user, multiplatform cattle tracker. Один сервер — единый источник данных для всех клиентов (десктоп, веб, мобильные).

## Setup

Из корня проекта: `npm run server`. Или вручную:

```bash
cd server
npm install
npm start
```

Server runs on `http://localhost:3000`. Set `PORT` to change.

Автозапуск при старте Windows: создайте задачу/ярлык, вызывающий `npm run server` из корня проекта (`Win+R` → `shell:startup`).

## Развёртывание на сервер (обновление кода)

**Автоматически (PowerShell):** создайте `server/server-address.txt` по образцу `server-address.example.txt` (укажите `SERVER_IP=` и `USER=`). Затем из корня проекта выполните:
```powershell
.\server\scripts\deploy.ps1
```
Или `cd server && npm run deploy`. Каталоги `node_modules`, `data` и **`apk`** (боевой файл обновления для телефонов) на сервер не копируются.
Введите пароль SSH при запросе. На сервере должны существовать каталог `/root/cattle-tracker/server` и сервис systemd `cattle-tracker-api`.

**Вручную:** скопируйте содержимое папки `server/` на сервер (без `node_modules` и `data`). На сервере:
```bash
cd /path/to/server
npm install --omit=dev
# перезапустите процесс (systemctl restart cattle-tracker-api, или pm2 restart, или заново node server.js)
```

## Развёртывание в интернете (HTTPS)

Для доступа из интернета сервер должен работать по **HTTPS**. Рекомендуемая схема:

1. Установите сервер на VPS или облачном хостинге (Node.js на порту 3000 или за обратным прокси).
2. Настройте обратный прокси (Nginx, Caddy или облачный Load Balancer) с SSL: сертификат (Let's Encrypt или другой) и проксирование на `http://localhost:3000`.
3. Пользователи в приложении вводят в «Адрес сервера» только **https://** URL (например `https://api.ваш-домен.ru`), без указания порта при использовании 443.

Без HTTPS современные окружения могут блокировать запросы к API. В локальной сети допустим `http://IP:3000`.

## Endpoints

- `POST /api/auth/register` — body: `{ username, password, role? }`
- `POST /api/auth/login` — body: `{ username, password }` → `{ user, token }`
- `GET /api/auth/me` — requires `Authorization: Bearer <token>`
- `GET /api/auth/check-username?username=...` — проверка занятости логина (без авторизации)
- `GET /api/admin/users` — список пользователей (только admin), requires auth
- `DELETE /api/admin/users/:id` — удаление пользователя (только admin)
- `POST /api/reports` — отправить отчёт (body: `{ message, payload? }`), requires auth
- `GET /api/reports` — список отчётов (только admin), requires auth
- `DELETE /api/reports/:id` — удалить отчёт (только admin)
- `GET /api/objects` — list objects
- `POST /api/objects` — body: `{ name, copyFromObjectId? }`; при `copyFromObjectId` сервер копирует **все слои** (записи, протоколы, стойломеста, profile, farm_settings) в новую базу (ответ `{ id, name, entriesCopied }`)
- `GET /api/objects/:id/profile` — карточка хозяйства (JSON в `objects.profile_json`)
- `PUT /api/objects/:id/profile` — сохранить карточку (admin/manager/operator)
- `GET /api/objects/:id/farm-settings` — справочники `{ technicians, bulls, drugs }`
- `PUT /api/objects/:id/farm-settings` — сохранить справочники
- `GET /api/objects/:id/farm-card` — расширенный bundle карточки (контакты, адреса, показатели)
- `PUT /api/objects/:id/farm-card` — сохранить bundle карточки
- `GET /api/objects/:id/export` — полный снимок базы: `entries`, `protocols`, `stall_layout`, `profile`, `farm_settings`, `farm_card`
- `POST /api/objects/import` — импорт снимка в новую базу (те же поля)
- `GET /api/geosuggest?text=...` — подсказки адреса (нужен `YANDEX_MAPS_API_KEY` в `.env`)
- `GET /api/objects/:id/entries` — list entries
- `POST /api/objects/:id/entries` — create entry (body = entry object)
- `GET /api/objects/:id/entries/:cattleId` — get one entry
- `PUT /api/objects/:id/entries/:cattleId` — update entry
- `DELETE /api/objects/:id/entries/:cattleId` — delete entry
- `POST /api/chat` — чат-консультант: body `{ messages: [{ role, content }, ...] }`, возвращает `{ content }`. Контекст — документация приложения (README, инструкции). Требуется переменная окружения **`DEEPSEEK_API_KEY`** (API DeepSeek); без неё маршрут возвращает 503.

Database: SQLite at `server/data/cattle.db`. Schema is created on first start.

### Учётные записи и вход администратора

- При **первом** запуске на **пустой** базе сервер создаёт пользователя **`Panko`** с паролем **`123456`** (роль `admin`).
- Если база уже существовала или логин `Panko` появился иначе, пароль может быть **другим** — тогда `123456` не подойдёт.
- На **другом сервере** (VPS) своя копия `cattle.db`: там свои пользователи; пароль из документации действует только если там так и создавали первого админа.

**Сброс пароля на своём сервере** (из каталога `server/`, желательно остановить `node server.js`):

```bash
node scripts/reset-user-password.js Panko НовыйНадёжныйПароль
```

Или: `npm run reset-password -- Panko НовыйНадёжныйПароль`

### Хранение APK на другом сервере (например 31.130.155.149)

API по-прежнему **один** — загрузка идёт через `POST /api/admin/mobile-apk` на тот хост, где запущен Node. Файлы пишутся в каталог на **диске** процесса.

Чтобы физически хранить APK на **внешней** машине:

1. На сервере с API смонтируйте каталог с удалённого хоста (NFS, **SSHFS**, SMB и т.п.) в, например, `/var/lib/cattle-tracker-apk`.
2. В `server/.env` задайте абсолютный путь:
   ```bash
   APK_STORAGE_DIR=/var/lib/cattle-tracker-apk
   ```
3. Перезапустите API. У пользователя Node должны быть права **записи** в этот каталог.

Если сам API крутится **на** 31.130.155.149, ничего монтировать не нужно: по умолчанию используется `server/apk` на этом хосте.

## Безопасность и формат ответов

- **Rate limiting:** для маршрутов `/api/auth` действует ограничение: не более 30 запросов с одного IP за 15 минут. При превышении возвращается `429` и `{ error: "Слишком много попыток входа..." }`.
- **Ошибки API:** ответы об ошибках имеют единый формат `{ error: string }` (при необходимости с полем `code`). Клиент отображает `data.error || data.message`.
