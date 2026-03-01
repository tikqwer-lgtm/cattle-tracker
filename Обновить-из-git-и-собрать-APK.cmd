@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo  Обновление из git и сборка APK...
echo.

echo  0/4 Обновление кода из git...
git pull
if errorlevel 1 (
  echo  Внимание: git pull завершился с ошибкой. Продолжить сборку текущего кода? (Y/N)
  choice /C YN /N /M "  "
  if errorlevel 2 (
    echo  Отменено.
    pause
    exit /b 1
  )
)

echo.
echo  Зависимости npm (при необходимости)...
call npm install
if errorlevel 1 (
  echo  Ошибка npm install.
  pause
  exit /b 1
)

echo.
rem Дальше — те же шаги, что в Собрать-APK.cmd
if not defined JAVA_HOME (
  if exist "C:\Program Files\Android\Android Studio\jbr\bin\java.exe" (
    set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
  ) else if exist "%LOCALAPPDATA%\Programs\Android Studio\jbr\bin\java.exe" (
    set "JAVA_HOME=%LOCALAPPDATA%\Programs\Android Studio\jbr"
  ) else (
    echo  Ошибка: JAVA_HOME не задан.
    pause
    exit /b 1
  )
)

echo  1/4 Сборка веб-приложения...
call npm run build
if errorlevel 1 ( echo  Ошибка сборки. & pause & exit /b 1 )

echo  2/4 Синхронизация с Android...
call npx cap sync android
if errorlevel 1 ( echo  Ошибка синхронизации. & pause & exit /b 1 )

echo  3/4 Сборка APK...
cd android
call gradlew.bat assembleDebug
set EXIT_CODE=%ERRORLEVEL%
cd ..

echo.
if %EXIT_CODE% equ 0 (
  echo  4/4 Готово.
  echo.
  echo  APK: android\app\build\outputs\apk\debug\app-debug.apk
  echo  Скопируйте файл на телефон для установки/обновления.
  echo.
  set "APK_PATH=android\app\build\outputs\apk\debug\app-debug.apk"
  if exist "%APK_PATH%" (
    echo  Открыть папку с APK? (Y/N)
    choice /C YN /N /M "  "
    if not errorlevel 2 start "" "android\app\build\outputs\apk\debug"
  )
) else (
  echo  Сборка APK не удалась. Код: %EXIT_CODE%
)
echo.
pause
