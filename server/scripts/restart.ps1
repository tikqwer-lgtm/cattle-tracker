# Перезапуск Cattle Tracker API на сервере.
# Запуск: .\server\scripts\restart.ps1   или   .\scripts\restart.ps1

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverRoot = Split-Path -Parent $scriptDir
$addrFile = Join-Path $serverRoot "server-address.txt"
if (-not (Test-Path $addrFile)) {
    Write-Host "Создайте server-address.txt из server-address.example.txt (укажите SERVER_IP и USER)." -ForegroundColor Yellow
    exit 1
}
$content = Get-Content $addrFile -Raw
$SERVER_IP = ($content | Select-String -Pattern 'SERVER_IP=(.+)').Matches.Groups[1].Value.Trim()
$USER = ($content | Select-String -Pattern 'USER=(.+)').Matches.Groups[1].Value.Trim()
if (-not $SERVER_IP) { Write-Host "В server-address.txt задайте SERVER_IP=..." -ForegroundColor Yellow; exit 1 }
if (-not $USER) { $USER = "root" }

Write-Host "Перезапуск cattle-tracker-api на ${USER}@${SERVER_IP}..." -ForegroundColor Cyan
& ssh "${USER}@${SERVER_IP}" "systemctl restart cattle-tracker-api && systemctl status cattle-tracker-api --no-pager"
if ($LASTEXITCODE -ne 0) { exit 1 }
Write-Host "Готово." -ForegroundColor Green
