@echo off
cd /d "%~dp0"

echo.
echo  Building installer...
echo.

call npm run installer
set EXIT_CODE=%ERRORLEVEL%

echo.
if %EXIT_CODE% equ 0 (
  echo  Done. Installer: electron\dist\*.exe
  echo.
  dir /b "electron\dist\*.exe" 2>nul
) else (
  echo  Build failed. Exit code: %EXIT_CODE%
)
echo.
pause
