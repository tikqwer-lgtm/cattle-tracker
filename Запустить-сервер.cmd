@echo off
chcp 65001 >nul
cd /d "%~dp0server"
echo Запуск сервера Учёт коров (порт 3000)...
echo Не закрывайте это окно, пока нужен доступ с телефона.
echo.
node server.js
pause
