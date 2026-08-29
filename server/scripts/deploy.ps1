# Деплой сервера на Timeweb: копирует файлы (без node_modules, data и apk), на сервере npm install и перезапуск.
# Запуск: .\server\scripts\deploy.ps1
# Без deploy.env — три раза запросит пароль SSH. С server/deploy.env (CATTLE_TRACKER_SSH_PASSWORD) — без запроса.

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverRoot = Split-Path -Parent $scriptDir
$projectRoot = Split-Path -Parent $serverRoot

function Read-DeployEnvFile {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return @{} }
    $map = @{}
    Get-Content $Path -Encoding UTF8 | ForEach-Object {
        $line = $_.Trim()
        if (-not $line -or $line.StartsWith('#')) { return }
        $eq = $line.IndexOf('=')
        if ($eq -lt 1) { return }
        $k = $line.Substring(0, $eq).Trim()
        $v = $line.Substring($eq + 1).Trim()
        if ($v.StartsWith('"') -and $v.EndsWith('"')) { $v = $v.Substring(1, $v.Length - 2) }
        $map[$k] = $v
    }
    return $map
}

$envMap = @{}
foreach ($p in @(
    (Join-Path $projectRoot '.env'),
    (Join-Path $projectRoot '.env.local'),
    (Join-Path $serverRoot 'deploy.env')
)) {
    foreach ($kv in (Read-DeployEnvFile $p).GetEnumerator()) {
        $envMap[$kv.Key] = $kv.Value
    }
}
$sshPassword = $envMap['CATTLE_TRACKER_SSH_PASSWORD']
if (-not $sshPassword) { $sshPassword = $env:CATTLE_TRACKER_SSH_PASSWORD }

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
$exclude = @("node_modules", "data", "apk", "server-address.txt", "server-address.example.txt", "deploy.env", "deploy.env.example", "scripts")
$tempDir = Join-Path $env:TEMP "cattle-deploy-$(Get-Date -Format 'yyyyMMddHHmmss')"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

function Invoke-DeployWithPoshSsh {
    param(
        [string]$Password,
        [string]$TempDir,
        [string]$RemoteNew,
        [string]$RemotePath
    )
    if (-not (Get-Module -ListAvailable -Name Posh-SSH)) {
        Write-Host "Installing Posh-SSH module (once)..." -ForegroundColor Cyan
        Install-Module -Name Posh-SSH -Scope CurrentUser -Force -AllowClobber
    }
    Import-Module Posh-SSH -ErrorAction Stop
    $sec = ConvertTo-SecureString $Password -AsPlainText -Force
    $cred = New-Object System.Management.Automation.PSCredential($USER, $sec)

    $session = New-SSHSession -ComputerName $SERVER_IP -Credential $cred -AcceptKey -ErrorAction Stop
    try {
        Invoke-SSHCommand -SessionId $session.SessionId -Command "mkdir -p $RemoteNew" | Out-Null
        Set-SCPItem -ComputerName $SERVER_IP -Credential $cred -Path "$TempDir\*" -Destination "${RemoteNew}/" -AcceptKey -Recurse
        $cmd = "cd ${RemoteNew} && npm install --omit=dev && cp -r . ${RemotePath}/ && rm -rf ${RemoteNew} && systemctl restart cattle-tracker-api && systemctl status cattle-tracker-api --no-pager"
        $result = Invoke-SSHCommand -SessionId $session.SessionId -Command $cmd
        if ($result.ExitStatus -ne 0) {
            if ($result.Error) { Write-Host $result.Error -ForegroundColor Red }
            if ($result.Output) { Write-Host ($result.Output -join "`n") }
            throw "Remote deploy command failed (exit $($result.ExitStatus))"
        }
        if ($result.Output) { Write-Host ($result.Output -join "`n") }
    } finally {
        Remove-SSHSession -SessionId $session.SessionId -ErrorAction SilentlyContinue | Out-Null
    }
}

try {
    Write-Host "Copying files (no node_modules, data)..." -ForegroundColor Cyan
    Get-ChildItem -Path $serverRoot -Force | Where-Object { $exclude -notcontains $_.Name } | ForEach-Object {
        Copy-Item -Path $_.FullName -Destination (Join-Path $tempDir $_.Name) -Recurse -Force
    }
    $scriptDest = Join-Path $tempDir "scripts"
    New-Item -ItemType Directory -Path $scriptDest -Force | Out-Null
    Get-ChildItem -Path (Join-Path $serverRoot "scripts") -Filter "*.js" -ErrorAction SilentlyContinue | ForEach-Object {
        Copy-Item -Path $_.FullName -Destination $scriptDest -Force
    }

    $remoteNew = "/root/cattle-tracker/server-new"
    $remotePath = "/root/cattle-tracker/server"

    Write-Host "Uploading to server ($target)..." -ForegroundColor Cyan
    if ($sshPassword) {
        $deployNode = Join-Path $scriptDir "deploy-node.js"
        if (Test-Path $deployNode) {
            Write-Host "Using password from deploy.env (Node ssh2)..." -ForegroundColor Cyan
            & node $deployNode
            if ($LASTEXITCODE -ne 0) { throw "deploy-node.js failed" }
        } else {
            Write-Host "Using password from deploy.env (Posh-SSH)..." -ForegroundColor Cyan
            Invoke-DeployWithPoshSsh -Password $sshPassword -TempDir $tempDir -RemoteNew $remoteNew -RemotePath $remotePath
        }
    } else {
        Write-Host "You will be asked for password 3 times. When typing, nothing appears - that is normal." -ForegroundColor Yellow
        Write-Host "Tip: copy server/deploy.env.example to server/deploy.env and set CATTLE_TRACKER_SSH_PASSWORD for non-interactive deploy." -ForegroundColor Yellow
        $sshOpts = @('-o', 'StrictHostKeyChecking=accept-new')
        & ssh @sshOpts $target "mkdir -p $remoteNew"
        if ($LASTEXITCODE -ne 0) { throw "ssh connection failed" }
        & scp @sshOpts -r "$tempDir\*" "${target}:${remoteNew}/"
        if ($LASTEXITCODE -ne 0) { throw "scp failed" }
        Write-Host "Installing deps and restarting service on server..." -ForegroundColor Cyan
        $cmd = "cd ${remoteNew} && npm install --omit=dev && cp -r . ${remotePath}/ && rm -rf ${remoteNew} && systemctl restart cattle-tracker-api && systemctl status cattle-tracker-api --no-pager"
        & ssh @sshOpts $target $cmd
        if ($LASTEXITCODE -ne 0) { throw "ssh command failed" }
    }

    Write-Host "Deploy done." -ForegroundColor Green
} finally {
    if (Test-Path $tempDir) { Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue }
}
