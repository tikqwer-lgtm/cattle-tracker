# Инструкции для агентов Cursor

## Cursor Cloud specific instructions

Облачный крон должен **доводить правки клиента до APK на сервере**, не останавливаясь на PR.

1. Секреты среды (дашборд [Cloud Agents → Secrets](https://cursor.com/dashboard/cloud-agents)), не файлы в git:
   - Runtime Secret: `CATTLE_TRACKER_APK_UPLOAD_USER`, `CATTLE_TRACKER_APK_UPLOAD_PASSWORD` (или `CATTLE_TRACKER_APK_UPLOAD_TOKEN`)
   - Environment Variable: `CATTLE_TRACKER_API_BASE` = `http://31.130.155.149:3000` (без `/api`)
2. После правок клиента из корня: `npm run mobile:installer` (не пропускать из‑за «нет SDK» — SDK ставится образом `.cursor/Dockerfile`).
3. Windows-установщик (`npm run installer`) в Linux **не собирать**.
4. После успешной загрузки APK: `PATCH /api/reports/:id` `{ "status": "done" }`.
5. Сеть: исходящий HTTP на API (`31.130.155.149:3000`) должен быть разрешён в настройках сети Cloud Agents.

Заявки: `npm run ideas:pull` (только `kind=improvement`, `status=new`).
