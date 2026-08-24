# Запуск воркера Cursor My Machines в каталоге репозитория.
# Двойной щелчок: «Запуск-воркера.bat» в корне проекта.

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = 'Continue'

$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $Root
$env:CURSOR_WORKER_IDLE_RELEASE_TIMEOUT = '0'

function Find-AgentCli {
  $cmd = Get-Command agent -ErrorAction SilentlyContinue
  if ($cmd -and $cmd.Source) { return $cmd.Source }

  $candidates = @(
    (Join-Path $env:LOCALAPPDATA 'cursor-agent\agent.ps1'),
    (Join-Path $env:LOCALAPPDATA 'cursor-agent\agent.cmd'),
    (Join-Path $env:USERPROFILE '.local\bin\agent.exe'),
    (Join-Path $env:USERPROFILE '.local\bin\agent.cmd'),
    (Join-Path $env:USERPROFILE '.local\bin\agent.ps1'),
    (Join-Path $env:LOCALAPPDATA 'cursor-agent\agent.exe')
  )
  foreach ($p in $candidates) {
    if (Test-Path -LiteralPath $p) { return $p }
  }
  return $null
}

function Get-AgentVersionDir {
  $versions = Join-Path $env:LOCALAPPDATA 'cursor-agent\versions'
  if (-not (Test-Path -LiteralPath $versions)) { return $null }
  return Get-ChildItem -LiteralPath $versions -Directory | Sort-Object Name -Descending | Select-Object -First 1
}

function Test-BetterSqlite3 {
  $verDir = Get-AgentVersionDir
  if (-not $verDir) { return $true }
  $node = Join-Path $verDir.FullName 'node.exe'
  $mod = Join-Path $verDir.FullName 'node_modules\better-sqlite3'
  if (-not (Test-Path -LiteralPath $node) -or -not (Test-Path -LiteralPath $mod)) { return $true }
  $prev = Get-Location
  Set-Location $verDir.FullName
  try {
    & $node -e "require('./node_modules/better-sqlite3')" 2>$null | Out-Null
    return ($LASTEXITCODE -eq 0)
  } finally {
    Set-Location $prev
  }
}

function Repair-BetterSqlite3 {
  $verDir = Get-AgentVersionDir
  if (-not $verDir) { return $false }
  $mod = Join-Path $verDir.FullName 'node_modules\better-sqlite3'
  $nodeJs = 'C:\Program Files\nodejs'
  Write-Host "Пересобираю better-sqlite3 под $($verDir.Name)…"
  $oldPath = $env:PATH
  $env:PATH = "$($verDir.FullName);$nodeJs;$oldPath"
  $prev = Get-Location
  Set-Location $mod
  try {
    npm install --omit=dev --foreground-scripts
    return ($LASTEXITCODE -eq 0)
  } finally {
    Set-Location $prev
    $env:PATH = $oldPath
  }
}

function Invoke-Agent {
  param([string[]]$AgentArgs)
  $file = $script:AgentCli
  $argList = @()
  $exe = $file
  if ($file -match '\.ps1$') {
    $exe = 'powershell.exe'
    $argList = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $file) + $AgentArgs
  } elseif ($file -match '\.cmd$') {
    $exe = 'cmd.exe'
    $argList = @('/c', $file) + $AgentArgs
  } else {
    $argList = $AgentArgs
  }
  $p = Start-Process -FilePath $exe -ArgumentList $argList -WorkingDirectory $Root -Wait -PassThru -NoNewWindow
  if ($null -eq $p) { return 1 }
  return [int]$p.ExitCode
}

$script:AgentCli = Find-AgentCli
if (-not $script:AgentCli) {
  Write-Host 'CLI agent не найден. Установка: irm ''https://cursor.com/install?win32=true'' | iex'
  exit 1
}

$workerName = 'cattle-pc'
Write-Host "Репозиторий: $Root"
Write-Host "Воркер:      $workerName"
Write-Host "CLI:         $script:AgentCli"
Write-Host ''

if (-not (Test-BetterSqlite3)) {
  Write-Host 'Модуль SQLite CLI собран под другую версию Node — исправляю.'
  if (-not (Repair-BetterSqlite3) -or -not (Test-BetterSqlite3)) {
    Write-Host 'Не удалось пересобрать better-sqlite3. Нужны Python и средства сборки C++ (Visual Studio Build Tools).'
    exit 1
  }
  Write-Host 'SQLite-модуль готов.'
  Write-Host ''
}

$status = (& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $script:AgentCli status 2>&1 | Out-String)
if ($script:AgentCli -notmatch '\.ps1$') {
  $status = (& $script:AgentCli status 2>&1 | Out-String)
}

if ($status -match '(?i)not logged in') {
  Write-Host 'Нужен вход в Cursor. Сейчас откроется браузер — подтвердите аккаунт и вернитесь в это окно.'
  Write-Host ''
  $loginCode = Invoke-Agent @('login')
  if ($loginCode -ne 0) {
    Write-Host "Вход не выполнен (код $loginCode)."
    exit $loginCode
  }
}

Write-Host 'Оставьте это окно открытым. ПК не должен уходить в сон.'
Write-Host 'Остановка: Ctrl+C'
Write-Host ''

$code = Invoke-Agent @('worker', '--name', $workerName, '--worker-dir', $Root, 'start', '--verbose')
if ($code -ne 0) {
  Write-Host ''
  Write-Host "Воркер завершился с кодом $code."
}
exit $code
