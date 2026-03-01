@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo  Сборка APK для телефона...
echo.

rem Java для сборки Android (JBR из Android Studio)
if not defined JAVA_HOME (
  if exist "C:\Program Files\Android\Android Studio\jbr\bin\java.exe" (
    set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
  ) else if exist "%LOCALAPPDATA%\Programs\Android Studio\jbr\bin\java.exe" (
    set "JAVA_HOME=%LOCALAPPDATA%\Programs\Android Studio\jbr"
  ) else (
    echo  Ошибка: JAVA_HOME не задан и Android Studio JBR не найден.
    echo  Установите Android Studio или задайте JAVA_HOME вручную.
    echo.
    pause
    exit /b 1
  )
)

echo  1/3 Сборка веб-приложения...
call npm run build
if errorlevel 1 (
  echo  Ошибка сборки.
  pause
  exit /b 1
)

echo  2/3 Синхронизация с Android...
call npx cap sync android
if errorlevel 1 (
  echo  Ошибка синхронизации.
  pause
  exit /b 1
)

echo  3/3 Сборка APK...
cd android
call gradlew.bat assembleDebug
set EXIT_CODE=%ERRORLEVEL%
cd ..

echo.
if %EXIT_CODE% equ 0 (
  echo  Готово.
  echo.
  echo  APK: android\app\build\outputs\apk\debug\app-debug.apk
  echo.
  echo  Скопируйте этот файл на телефон и откройте для установки или обновления.
  echo.
  set "APK_PATH=android\app\build\outputs\apk\debug\app-debug.apk"
  if exist "%APK_PATH%" (
    echo  Открыть папку с APK? (Y/N)
    choice /C YN /N /M "  "
    if errorlevel 2 goto :eof
    start "" "android\app\build\outputs\apk\debug"
  )
) else (
  echo  Сборка APK не удалась. Код выхода: %EXIT_CODE%
)
echo.
pause
