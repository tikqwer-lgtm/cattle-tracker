# Деплой Cattle Tracker API на Timeweb Cloud

Инструкция для VPS в [Timeweb Cloud](https://timeweb.cloud). Данные SQLite хранятся на диске сервера.

---

## Упрощение работы (скрипты на ПК)

После первого деплоя можно использовать скрипты из папки `server/scripts/` (PowerShell):

1. **server-address.txt** — скопируйте `server-address.example.txt` в `server-address.txt` и укажите IP сервера и пользователя (`SERVER_IP=...`, `USER=root`). Файл не попадает в git.
2. **ssh.ps1** — подключение по SSH к серверу (читает IP из `server-address.txt`).
3. **restart.ps1** — перезапуск сервиса `cattle-tracker-api` на сервере.
4. **deploy.ps1** — выгрузка кода на сервер (без node_modules и data), установка зависимостей и перезапуск сервиса.

Запуск из корня проекта: `.\server\scripts\ssh.ps1`, `.\server\scripts\restart.ps1`, `.\server\scripts\deploy.ps1`.

---

## 1. Создание сервера в панели Timeweb

1. Войдите в [timeweb.cloud](https://timeweb.cloud) → **Облачные серверы** (или **VPS**).
2. **Создать сервер** / **Добавить сервер**.
3. Выберите:
   - **ОС:** Ubuntu 22.04 (рекомендуется).
   - **Тариф:** минимальный (например 1 vCPU, 1 GB RAM — хватит для API).
   - **Регион:** любой (например Москва или Нидерланды).
4. Укажите пароль root (или привяжите SSH-ключ при создании).
5. Создайте сервер. Дождитесь статуса «Работает», запишите **IP-адрес** и пароль root.

Пароль и IP можно посмотреть в карточке сервера в панели.

---

## 2. Подключение по SSH

С вашего ПК (PowerShell или терминал):

```bash
ssh root@IP_АДРЕС_СЕРВЕРА
```

Введите пароль root (при входе по ключу пароль не нужен). Вы окажетесь в системе под `root`.

---

## 3. Установка Node.js 20

На сервере выполните:

```bash
# Обновление пакетов
apt update && apt upgrade -y

# Node.js 20 LTS (NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Проверка
node -v   # v20.x
npm -v
```

---

## 4. Открытие порта 3000

На многих VPS по умолчанию включён только SSH (22). Нужно разрешить входящий трафик на порт 3000.

**Если в панели Timeweb есть раздел «Файрвол» / «Сеть»** — добавьте правило: входящий TCP, порт 3000, источник 0.0.0.0/0.

**Или через ufw на сервере:**

```bash
ufw allow 22/tcp
ufw allow 3000/tcp
ufw enable
ufw status
```

---

## 5. Копирование проекта на сервер

**Вариант A — Git (если репозиторий на GitHub/GitLab):**

На сервере:

```bash
apt install -y git
git clone https://github.com/ВАШ_ЛОГИН/cattle-tracker.git
cd cattle-tracker/server
npm install --omit=dev
```

**Вариант B — SCP с вашего ПК (Windows):**

В PowerShell на ПК (подставьте IP сервера и путь к `server`):

```powershell
scp -r D:\VScode\cattle-tracker\server root@IP_АДРЕС_СЕРВЕРА:/root/
```

Затем на сервере:

```bash
cd /root/server
npm install --omit=dev
```

---

## 6. Проверка запуска

На сервере:

```bash
cd /root/server
# или cd /root/cattle-tracker/server — если клонировали через Git

export JWT_SECRET="придумайте_длинную_случайную_строку"
node server.js
```

В браузере откройте `http://IP_АДРЕС_СЕРВЕРА:3000/api/health`. Должен вернуться ответ `{"ok":true}`. Остановите сервер: **Ctrl+C**.

---

## 7. Постоянный запуск (systemd)

Создайте сервис:

```bash
nano /etc/systemd/system/cattle-tracker-api.service
```

Вставьте (замените `ВАШ_JWT_SECRET` на свою строку):

```ini
[Unit]
Description=Cattle Tracker API
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/server
Environment=PORT=3000
Environment=JWT_SECRET=ВАШ_JWT_SECRET
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Если проект лежит в `/root/cattle-tracker/server`, укажите `WorkingDirectory=/root/cattle-tracker/server`.

Включите и запустите сервис:

```bash
systemctl daemon-reload
systemctl enable cattle-tracker-api
systemctl start cattle-tracker-api
systemctl status cattle-tracker-api
```

Логи в реальном времени: `journalctl -u cattle-tracker-api -f`.

---

## 8. Настройка клиентов

В приложении «Учёт коров» (веб, Electron, мобильное):

1. Включите **режим API**.
2. **Базовый URL API:** `http://IP_АДРЕС_СЕРВЕРА:3000` (без слэша в конце).

Все устройства с этим URL будут использовать одну базу на сервере.

---

## Полезные команды

| Действие              | Команда |
|-----------------------|--------|
| Статус сервиса        | `systemctl status cattle-tracker-api` |
| Перезапуск            | `systemctl restart cattle-tracker-api` |
| Логи                  | `journalctl -u cattle-tracker-api -f`  |
| Остановить сервис     | `systemctl stop cattle-tracker-api`    |

---

## Чек-лист

- [ ] В Timeweb создан сервер Ubuntu, записан IP и пароль root.
- [ ] Подключение по SSH: `ssh root@IP`.
- [ ] Установлен Node.js 20, открыт порт 3000 (панель или ufw).
- [ ] Проект скопирован в `/root/server` (или `/root/cattle-tracker/server`), выполнен `npm install --omit=dev`.
- [ ] В сервисе задан `JWT_SECRET`, сервис включён и запущен.
- [ ] `http://IP:3000/api/health` возвращает `{"ok":true}`.
- [ ] В клиентах указан URL `http://IP:3000`.
