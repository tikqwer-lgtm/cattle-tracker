Write-Host "`n[1] Проверка изменений..." -ForegroundColor Yellow
$changes = git status --porcelain
if (-not $changes) {
    Write-Host "`n✅ Нет изменений." -ForegroundColor Green
    Start-Sleep -Seconds 2
    exit
}

git add .

$commitMsg = Read-Host "`nОписание (Enter = 'Обновление')"
if (!$commitMsg) { $commitMsg = "Обновление" }

Write-Host "`n📝 Коммит: '$commitMsg'" -ForegroundColor Green
git commit -m "$commitMsg"

Write-Host "`n📤 Отправка в GitHub..." -ForegroundColor Yellow
git push origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n🎉 УСПЕШНО!" -ForegroundColor Green
    Write-Host "   🌐 https://tikqwer-lgtm.github.io/cattle-tracker/"
} else {
    Write-Host "`n❌ ОШИБКА!" -ForegroundColor Red
    Write-Host "   Проверьте интернет или выполните 'git pull'"
}

Write-Host "`n⏸ Готово. Нажмите любую клавишу..." -ForegroundColor Gray
$Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") | Out-Null
