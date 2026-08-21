# Запуск воркера Cursor My Machines в каталоге репозитория.
# Двойной щелчок: «Запуск-воркера.bat» в корне проекта.
# Окно не закрывать — пока оно открыто, задачи могут выполняться на этом ПК.

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $Root

function Find-AgentCli {
  $cmd = Get-Command agent -ErrorAction SilentlyContinue
  if ($cmd -and $cmd.Source) { return $cmd.Source }

  $candidates = @(
    (Join-Path $env:USERPROFILE '.local\bin\agent.exe'),
    (Join-Path $env:USERPROFILE '.local\bin\agent.cmd'),
    (Join-Path $env:USERPROFILE '.local\bin\agent.ps1'),
    (Join-Path $env:LOCALAPPDATA 'cursor-agent\agent.exe')
  )
  foreach ($p in $candidates) {
    if (Test-Path -LiteralPath $p) { return $p }
  }

  $searchRoots = @(
    (Join-Path $env:LOCALAPPDATA 'cursor-agent'),
    (Join-Path $env:USERPROFILE '.local')
  )
  foreach ($dir in $searchRoots) {
    if (-not (Test-Path -LiteralPath $dir)) { continue }
    $hit = Get-ChildItem -LiteralPath $dir -Filter 'agent.exe' -Recurse -ErrorAction SilentlyContinue |
      Select-Object -First 1
    if ($hit) { return $hit.FullName }
  }
  return $null
}

function Install-AgentCli {
  Write-Host 'CLI agent не найден. Ставлю с cursor.com/install …'
  irm 'https://cursor.com/install?win32=true' | iex
}

$agent = Find-AgentCli
if (-not $agent) {
  Write-Host 'Чтобы задачи с облака выполнялись на этом ПК, нужен CLI Cursor (команда agent).'
  $ans = Read-Host 'Установить сейчас? [Y/n]'
  if ($ans -and $ans -notmatch '^[YyДд]') {
    Write-Host 'Отмена. Установка вручную в PowerShell:'
    Write-Host "  irm 'https://cursor.com/install?win32=true' | iex"
    exit 1
  }
  Install-AgentCli
  $env:Path = "$env:USERPROFILE\.local\bin;$env:LOCALAPPDATA\cursor-agent;$env:Path"
  $agent = Find-AgentCli
  if (-not $agent) {
    Write-Host 'После установки закройте окно и запустите ярлык снова (чтобы подхватился PATH).'
    exit 1
  }
}

$workerName = 'cattle-pc'
Write-Host "Репозиторий: $Root"
Write-Host "Воркер:      $workerName"
Write-Host "CLI:         $agent"
Write-Host ''
Write-Host 'Оставьте это окно открытым. ПК не должен уходить в сон.'
Write-Host 'Остановка: Ctrl+C'
Write-Host ''

& $agent worker start --name $workerName --worker-dir $Root
exit $LASTEXITCODE
