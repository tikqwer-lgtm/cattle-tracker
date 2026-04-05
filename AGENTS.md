# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Cattle Tracker ("Учёт коров") — multi-platform cattle management app (Web, Electron desktop, Android via Capacitor). Tech stack: Vite + React 19 + TypeScript frontend, Node.js/Express + SQLite (sql.js) backend.

### Running services

| Service | Command | Port | Notes |
|---------|---------|------|-------|
| **API server** | `cd server && node server.js` | 3000 | Creates default admin `Panko` / `123456` on first run. Auto-retries ports 3000–3010 if busy. |
| **Web (static)** | `npx serve -p 9323 .` (from root) | 9323 | Serves the built web app; requires `npm run build` first. |

### Key commands (see `package.json` scripts)

- **Build frontend**: `npm run build` (produces `dist/app.js`)
- **Lint**: `npx eslint .` (pre-existing warnings in `dist/`, `electron/`, `e2e/` due to `ecmaVersion: 5` config)
- **Unit tests**: `npm test` (Vitest, runs `tests/` directory)
- **E2E tests**: `npm run e2e` (Playwright, needs `npx playwright install chromium && npx playwright install-deps` first)

### Gotchas

- The web app connects to the server via localStorage keys. In headless testing, set `cattleTracker_apiBase`, `cattleTracker_useApiMode`, and `cattleTracker_lastConnectUrl` in localStorage before reload to connect programmatically.
- The `connectToServer()` function triggers `location.reload()` after saving the server URL — not suitable for single-page Playwright flows; set localStorage directly instead.
- Entries API is nested under objects: `POST /api/objects/:objectId/entries` (not `/api/entries`). The body must include a `cattleId` field.
- No Docker, no `.devcontainer`. Pure Node.js setup with `npm install` at root and in `server/`.
- Electron and Android/Capacitor builds are optional; the core dev loop is build + server + static file server.
