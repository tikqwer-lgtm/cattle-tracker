# Инструкции для агентов Cursor

## Cursor Cloud specific instructions

Облачный агент работает **в `main`**, как локальный ПК. APK на сервер — только после того, как коммит уже в `origin/main`.

1. Секреты среды (дашборд [Cloud Agents → Secrets](https://cursor.com/dashboard/cloud-agents)), не файлы в git:
   - Runtime Secret: `CATTLE_TRACKER_APK_UPLOAD_USER`, `CATTLE_TRACKER_APK_UPLOAD_PASSWORD` (или `CATTLE_TRACKER_APK_UPLOAD_TOKEN`)
   - Environment Variable: `CATTLE_TRACKER_API_BASE` = `http://31.130.155.149:3000` (без `/api`)
2. Перед правками: `git fetch origin && git checkout main && git pull origin main`.
3. После правок: коммит → `git push origin main`. Не оставлять результат только на `cursor/*` и не останавливаться на PR.
4. Если push в `main` не удался — **не** выкладывать APK, сообщить пользователю.
5. После успешного push из корня: `npm run mobile:installer` (не пропускать из‑за «нет SDK» — SDK ставится образом `.cursor/Dockerfile`).
6. Windows-установщик (`npm run installer`) в Linux **не собирать**.
7. После успешной загрузки APK: `PATCH /api/reports/:id` `{ "status": "done" }`.
8. Сеть: исходящий HTTP на API (`31.130.155.149:3000`) и git push на origin должны быть разрешены.

Заявки: `npm run ideas:pull` (только `kind=improvement`, `status=new` — после «Принять» у администратора).
