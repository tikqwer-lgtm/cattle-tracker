# Cattle Tracker API

Backend for multi-user, multiplatform cattle tracker. Один сервер — единый источник данных для всех клиентов (десктоп, веб, мобильные).

## Setup

Из корня проекта можно запустить **start-server.bat** (Windows) — скрипт сам установит зависимости при первом запуске и запустит сервер. Или вручную:

```bash
cd server
npm install
npm start
```

Server runs on `http://localhost:3000`. Set `PORT` to change.

Автозапуск при старте Windows: поместите ярлык на `start-server.bat` в папку автозагрузки (`Win+R` → `shell:startup`).

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
- `GET /api/objects` — list objects
- `POST /api/objects` — body: `{ name }`
- `GET /api/objects/:id/entries` — list entries
- `POST /api/objects/:id/entries` — create entry (body = entry object)
- `GET /api/objects/:id/entries/:cattleId` — get one entry
- `PUT /api/objects/:id/entries/:cattleId` — update entry
- `DELETE /api/objects/:id/entries/:cattleId` — delete entry
- `POST /api/chat` — чат-консультант: body `{ messages: [{ role, content }, ...] }`, возвращает `{ content }`. Контекст — документация приложения (README, инструкции). Требуется переменная окружения **`DEEPSEEK_API_KEY`** (API DeepSeek); без неё маршрут возвращает 503.

Database: SQLite at `server/data/cattle.db`. Schema is created on first start.

## Безопасность и формат ответов

- **Rate limiting:** для маршрутов `/api/auth` действует ограничение: не более 30 запросов с одного IP за 15 минут. При превышении возвращается `429` и `{ error: "Слишком много попыток входа..." }`.
- **Ошибки API:** ответы об ошибках имеют единый формат `{ error: string }` (при необходимости с полем `code`). Клиент отображает `data.error || data.message`.
