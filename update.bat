@echo off
chcp 866 >nul
echo.
echo [1] Проверка изменений...
git status | findstr "modified\|new file" >nul
if %errorlevel% neq 0 (
    echo +++ Нет изменений для отправки.
    echo.
    goto finish
)
git add .
echo.
set /p msg=Описание (Enter = "Обновление"): 
if "%msg%"=="" set msg=Обновление
echo +++ Коммит: "%msg%"
git commit -m "%msg%"
echo.
echo [2] Отправка в GitHub...
git push origin main
echo.
if %errorlevel%==0 (
    echo +++ УСПЕШНО!
    echo    https://tikqwer-lgtm.github.io/cattle-tracker/
) else (
    echo --- ОШИБКА!
    echo    Проверьте интернет или выполните 'git pull'
)
:finish
echo.
echo --- Готово. Нажмите любую клавишу...
pause >nul
