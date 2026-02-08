# Cattle Tracker API

Backend for multi-user, multiplatform cattle tracker.

## Setup

```bash
cd server
npm install
npm start
```

Server runs on `http://localhost:3000`. Set `PORT` to change.

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

Database: SQLite at `server/data/cattle.db`. Schema is created on first start.
