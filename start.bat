@echo off
chcp 65001 > nul
cd /d "%~dp0"

echo Учёт коров — запуск приложения
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo [Ошибка] Node.js не найден. Установите Node.js и добавьте его в PATH.
    echo https://nodejs.org/
    echo.
    pause
    exit /b 1
)

if not exist "electron\node_modules\.bin\electron.cmd" (
    echo Установка зависимостей Electron...
    cd electron
    call npm install
    if errorlevel 1 (
        echo [Ошибка] Не удалось установить зависимости.
        cd ..
        pause
        exit /b 1
    )
    cd ..
    echo.
)

echo Запуск десктопного приложения (Electron)...
cd /d "%~dp0electron"
call "%~dp0electron\node_modules\.bin\electron.cmd" .
if errorlevel 1 (
    echo.
    echo [Ошибка] Не удалось запустить приложение. Проверьте вывод выше.
)
cd /d "%~dp0"
echo.
pause
