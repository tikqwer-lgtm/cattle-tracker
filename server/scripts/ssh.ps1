# Подключение по SSH к серверу API.
# Запуск: .\server\scripts\ssh.ps1   или   .\scripts\ssh.ps1

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

& ssh "${USER}@${SERVER_IP}"
