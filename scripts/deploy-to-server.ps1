# Копирует проект на bolashaq-srv и запускает установку
param(
  [string]$ServerIP = "100.121.80.67",
  [string]$RemotePath = "C:\bolashak-hr"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path $PSScriptRoot -Parent

Write-Host "=== Деплой Bolashak HR на $ServerIP ===" -ForegroundColor Cyan

# Проверка TailScale / сети
$ping = Test-Connection -ComputerName $ServerIP -Count 1 -Quiet -ErrorAction SilentlyContinue
if (-not $ping) {
  Write-Host "Сервер $ServerIP недоступен. Проверьте TailScale VPN." -ForegroundColor Red
  Write-Host ""
  Write-Host "Альтернатива — ручной деплой:" -ForegroundColor Yellow
  Write-Host "1. Скопируйте папку проекта на сервер в $RemotePath"
  Write-Host "2. Запустите scripts\install-on-server.ps1 от администратора"
  exit 1
}

$sharePath = "\\$ServerIP\c$\bolashak-hr"
Write-Host "Копирование в $sharePath ..."

$exclude = @('node_modules', '.git', 'server\data', 'client\dist')
$items = Get-ChildItem $ProjectRoot -Force | Where-Object {
  $_.Name -notin $exclude
}

if (-not (Test-Path $sharePath)) {
  try {
    New-Item -ItemType Directory -Path $sharePath -Force | Out-Null
  } catch {
    Write-Host "Нет доступа к $sharePath" -ForegroundColor Red
    Write-Host "Скопируйте папку вручную через RDP и запустите install-on-server.ps1"
    exit 1
  }
}

robocopy $ProjectRoot $sharePath /MIR /XD node_modules .git server\data client\dist /NFL /NDL /NJH /NJS /nc /ns /np
if ($LASTEXITCODE -ge 8) { throw "robocopy failed: $LASTEXITCODE" }

Write-Host "Запуск установки на сервере..."
Invoke-Command -ComputerName $ServerIP -ScriptBlock {
  param($dir)
  Set-Location $dir
  powershell -ExecutionPolicy Bypass -File "$dir\scripts\install-on-server.ps1"
} -ArgumentList $RemotePath -ErrorAction SilentlyContinue

if ($LASTEXITCODE -ne 0 -or $?) {
  Write-Host ""
  Write-Host "Авто-установка через WinRM может быть недоступна." -ForegroundColor Yellow
  Write-Host "Файлы скопированы. На сервере выполните:" -ForegroundColor Yellow
  Write-Host "  cd C:\bolashak-hr" -ForegroundColor White
  Write-Host "  powershell -ExecutionPolicy Bypass -File scripts\install-on-server.ps1" -ForegroundColor White
}

Write-Host ""
Write-Host "Откройте: http://${ServerIP}:3002" -ForegroundColor Green
