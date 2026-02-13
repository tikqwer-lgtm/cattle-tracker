# Деплой сервера на Timeweb: копирует файлы (без node_modules и data), на сервере npm install и перезапуск.
# Запуск: из корня проекта или из server: .\server\scripts\deploy.ps1   или   .\scripts\deploy.ps1

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverRoot = Split-Path -Parent $scriptDir
$projectRoot = Split-Path -Parent $serverRoot

$addrFile = Join-Path $serverRoot "server-address.txt"
if (-not (Test-Path $addrFile)) {
    Write-Host "Создайте server-address.txt из server-address.example.txt и укажите SERVER_IP и USER." -ForegroundColor Yellow
    exit 1
}
$content = Get-Content $addrFile -Raw
$SERVER_IP = ($content | Select-String -Pattern 'SERVER_IP=(.+)').Matches.Groups[1].Value.Trim()
$USER = ($content | Select-String -Pattern 'USER=(.+)').Matches.Groups[1].Value.Trim()
if (-not $SERVER_IP) {
    Write-Host "В server-address.txt задайте SERVER_IP=IP_АДРЕС" -ForegroundColor Yellow
    exit 1
}
if (-not $USER) { $USER = "root" }

$target = "${USER}@${SERVER_IP}"
$exclude = @("node_modules", "data", "server-address.txt", "server-address.example.txt", "scripts")
$tempDir = Join-Path $env:TEMP "cattle-deploy-$(Get-Date -Format 'yyyyMMddHHmmss')"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

try {
    Write-Host "Копирование файлов (без node_modules, data)..." -ForegroundColor Cyan
    Get-ChildItem -Path $serverRoot -Force | Where-Object { $exclude -notcontains $_.Name } | ForEach-Object {
        Copy-Item -Path $_.FullName -Destination (Join-Path $tempDir $_.Name) -Recurse -Force
    }
    # scripts — только .js, не .ps1
    $scriptDest = Join-Path $tempDir "scripts"
    New-Item -ItemType Directory -Path $scriptDest -Force | Out-Null
    Get-ChildItem -Path (Join-Path $serverRoot "scripts") -Filter "*.js" -ErrorAction SilentlyContinue | ForEach-Object {
        Copy-Item -Path $_.FullName -Destination $scriptDest -Force
    }

    $remoteNew = "/root/cattle-tracker/server-new"
    $remotePath = "/root/cattle-tracker/server"
    Write-Host "Загрузка на сервер ($target)..." -ForegroundColor Cyan
    & ssh $target "mkdir -p $remoteNew"
    & scp -r "$tempDir\*" "${target}:${remoteNew}/"
    if ($LASTEXITCODE -ne 0) { throw "scp failed" }

    Write-Host "Установка зависимостей и перезапуск сервиса на сервере..." -ForegroundColor Cyan
    $cmd = "cd ${remoteNew} && npm install --omit=dev && cp -r . ${remotePath}/ && rm -rf ${remoteNew} && systemctl restart cattle-tracker-api && systemctl status cattle-tracker-api --no-pager"
    & ssh $target $cmd
    if ($LASTEXITCODE -ne 0) { throw "ssh command failed" }

    Write-Host "Деплой завершён." -ForegroundColor Green
} finally {
    if (Test-Path $tempDir) { Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue }
}
