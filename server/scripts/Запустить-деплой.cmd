@echo off
cd /d "%~dp0"

echo.
echo  Deploy server to host from server-address.txt...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy.ps1"
set EXIT_CODE=%ERRORLEVEL%

echo.
if %EXIT_CODE% equ 0 (
  echo  Deploy done.
) else (
  echo  Deploy failed. Exit code: %EXIT_CODE%
)
echo.
pause
