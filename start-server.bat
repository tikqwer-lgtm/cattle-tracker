@echo off
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
    echo [Error] Node.js not found. Install from https://nodejs.org/
    pause
    exit /b 1
)

if not exist "server\package.json" (
    echo [Error] Folder server not found.
    pause
    exit /b 1
)

cd /d "%~dp0server"
if errorlevel 1 (
    echo [Error] Cannot change to server folder.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo Installing server dependencies...
    call npm install
    if errorlevel 1 (
        echo [Error] npm install failed.
        pause
        exit /b 1
    )
    echo.
)

echo Server starting at http://localhost:3000
echo For chat consultant: create server\.env with DEEPSEEK_API_KEY=your_key
echo Get key at https://platform.deepseek.com/
echo Close this window to stop the server.
echo.
node "%~dp0server\server.js"

pause
