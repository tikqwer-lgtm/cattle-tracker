@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Воркер Cursor — cattle-pc
echo Запуск воркера в этом проекте. Окно не закрывайте.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-agent-worker.ps1"
if errorlevel 1 (
  echo.
  echo Воркер не запустился.
  pause
)
