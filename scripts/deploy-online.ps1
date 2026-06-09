# Деплой Bolashak HR в облако Railway (бесплатно, постоянная ссылка)
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

Write-Host "=== Деплой Bolashak HR в Railway ===" -ForegroundColor Cyan

$whoami = npx @railway/cli@latest whoami 2>&1
if ($whoami -match "Unauthorized") {
  Write-Host ""
  Write-Host "Нужна авторизация Railway (один раз):" -ForegroundColor Yellow
  Write-Host "1. Откроется код — зайдите на https://railway.com/activate" -ForegroundColor Yellow
  Write-Host "2. Войдите через Google/GitHub (бесплатно)" -ForegroundColor Yellow
  Write-Host "3. Введите код из терминала" -ForegroundColor Yellow
  Write-Host ""
  npx @railway/cli@latest login --browserless
}

Write-Host "Создание проекта..."
npx @railway/cli@latest init --name bolashak-hr 2>$null

Write-Host "Деплой (5-10 мин)..."
npx @railway/cli@latest up --detach

Write-Host "Получение ссылки..."
$url = npx @railway/cli@latest domain 2>&1
if (-not $url -or $url -match "error") {
  npx @railway/cli@latest domain --generate
  $url = npx @railway/cli@latest domain
}

Write-Host ""
Write-Host "=== ГОТОВО ===" -ForegroundColor Green
Write-Host "Ссылка: https://$url"
Write-Host "Логин:  aizada@bolashak.local / admin123"
Write-Host ""
Write-Host "Сайт работает 24/7 без вашего ПК." -ForegroundColor Green
