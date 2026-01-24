@echo off
:: === Скрипт для Windows: работает без иероглифов ===

chcp 866 >nul

echo.
echo [1] Проверка изменений...
git status | findstr "modified\|new file" >nul
if %errorlevel% neq 0 (
    echo.
    echo +++ No changes to commit.
    echo.
    goto done
)

git add .

echo.
set /p msg=Opucanue (Enter = "Obnovlenie"): 
if "%msg%"=="" set msg=Obnovlenie

echo.
echo +++ Co3daiOT kammut: "%msg%"
git commit -m "%msg%"

echo.
echo [2] Otpravka v GitHub...
git push origin main

if %errorlevel%==0 (
    echo.
    echo +++ YCNEX!
    echo.
    echo    CauT o6novlён:
    echo    https://tikqwer-lgtm.github.io/cattle-tracker/
) else (
    echo.
    echo --- OXU6KA!
    echo.
    echo    Internet? Soedinenie? Prava?
)

:done
echo.
echo --- Naimite knopky, cTo6bi 3akpblTb...
pause >nul
