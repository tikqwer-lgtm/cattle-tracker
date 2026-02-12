@echo off
chcp 65001 > nul
cd /d "%~dp0"

echo Cattle Tracker — запуск сервера API
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo [Ошибка] Node.js не найден. Установите Node.js: https://nodejs.org/
    pause
    exit /b 1
)

if not exist "server\package.json" (
    echo [Ошибка] Папка server не найдена.
    pause
    exit /b 1
)

cd server
if not exist "node_modules" (
    echo Установка зависимостей сервера...
    call npm install
    if errorlevel 1 (
        echo [Ошибка] Не удалось установить зависимости.
        cd ..
        pause
        exit /b 1
    )
    echo.
)

echo Сервер запускается. Адрес: http://localhost:3000
echo Для чат-консультанта задайте переменную DEEPSEEK_API_KEY (ключ с https://platform.deepseek.com/)
echo Чат-консультант работает только при наличии интернета (DeepSeek API).
echo Закройте окно для остановки сервера.
echo.
node server.js

cd /d "%~dp0"
pause
