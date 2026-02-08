@echo off
chcp 65001 > nul
cd /d "%~dp0"

echo Учёт коров — запуск приложения
echo.

if not exist "electron\node_modules" (
    echo Установка зависимостей Electron...
    cd electron
    call npm install
    cd ..
    echo.
)

echo Запуск десктопного приложения (Electron)...
cd electron
call npm start
cd ..
