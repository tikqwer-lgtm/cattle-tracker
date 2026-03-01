@echo off
chcp 65001 >nul
echo Добавление правила брандмауэра для порта 3000...
netsh advfirewall firewall add rule name="Cattle Tracker Server 3000" dir=in action=allow protocol=TCP localport=3000
if %errorlevel% equ 0 (
  echo Правило добавлено. Телефон сможет подключаться к серверу по IP ПК:3000
) else (
  echo Ошибка. Запустите этот файл от имени администратора: ПКМ по файлу - "Запуск от имени администратора"
)
pause
