# Деплой сервера на Timeweb: копирует файлы (без node_modules и data), на сервере npm install и перезапуск.
# Запуск: из корня проекта или из server: .\server\scripts\deploy.ps1   или   .\scripts\deploy.ps1

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverRoot = Split-Path -Parent $scriptDir
$projectRoot = Split-Path -Parent $serverRoot

$addrFile = Join-Path $serverRoot "server-address.txt"
if (-not (Test-Path $addrFile)) {
    Write-Host "Create server-address.txt from server-address.example.txt (set SERVER_IP and USER)." -ForegroundColor Yellow
    exit 1
}
$content = Get-Content $addrFile -Raw
$SERVER_IP = ($content | Select-String -Pattern 'SERVER_IP=(.+)').Matches.Groups[1].Value.Trim()
$USER = ($content | Select-String -Pattern 'USER=(.+)').Matches.Groups[1].Value.Trim()
if (-not $SERVER_IP) {
    Write-Host "Set SERVER_IP= in server-address.txt" -ForegroundColor Yellow
    exit 1
}
if (-not $USER) { $USER = "root" }

$target = "${USER}@${SERVER_IP}"
$exclude = @("node_modules", "data", "server-address.txt", "server-address.example.txt", "scripts")
$tempDir = Join-Path $env:TEMP "cattle-deploy-$(Get-Date -Format 'yyyyMMddHHmmss')"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

try {
    Write-Host "Copying files (no node_modules, data)..." -ForegroundColor Cyan
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
    $sshOpts = @('-o', 'StrictHostKeyChecking=accept-new')

    Write-Host "Uploading to server ($target)..." -ForegroundColor Cyan
    Write-Host "You will be asked for password 3 times. When typing, nothing appears - that is normal. Type password and press Enter each time." -ForegroundColor Yellow
    & ssh @sshOpts $target "mkdir -p $remoteNew"
    if ($LASTEXITCODE -ne 0) { throw "ssh connection failed" }

    & scp @sshOpts -r "$tempDir\*" "${target}:${remoteNew}/"
    if ($LASTEXITCODE -ne 0) { throw "scp failed" }

    Write-Host "Installing deps and restarting service on server..." -ForegroundColor Cyan
    $cmd = "cd ${remoteNew} && npm install --omit=dev && cp -r . ${remotePath}/ && rm -rf ${remoteNew} && systemctl restart cattle-tracker-api && systemctl status cattle-tracker-api --no-pager"
    & ssh @sshOpts $target $cmd
    if ($LASTEXITCODE -ne 0) { throw "ssh command failed" }

    Write-Host "Deploy done." -ForegroundColor Green
} finally {
    if (Test-Path $tempDir) { Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue }
}
