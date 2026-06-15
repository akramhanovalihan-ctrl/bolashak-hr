# Запускать НА bolashaq-srv от имени администратора
$ErrorActionPreference = "Stop"
$ProjectDir = if ($PSScriptRoot) { Split-Path $PSScriptRoot -Parent } else { "C:\bolashak-hr" }

Write-Host "=== Bolashak HR — установка на сервер ===" -ForegroundColor Cyan
Write-Host "Папка: $ProjectDir"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js не найден. Установите LTS: https://nodejs.org" -ForegroundColor Red
  exit 1
}

$nodeVer = (node -v) -replace 'v', ''
if ([version]$nodeVer -lt [version]"18.0.0") {
  Write-Host "Нужен Node.js 18+. Сейчас: $nodeVer" -ForegroundColor Red
  exit 1
}

Set-Location $ProjectDir

if (-not (Test-Path "server\.env")) {
  if (Test-Path "server\env-for-server.txt") {
    Copy-Item "server\env-for-server.txt" "server\.env"
    Write-Host "Создан server\.env из env-for-server.txt" -ForegroundColor Green
  } elseif (Test-Path "server\.env.production") {
    Copy-Item "server\.env.production" "server\.env"
    Write-Host "Создан server\.env из шаблона — задайте JWT и TELEGRAM_BOT_TOKEN!" -ForegroundColor Yellow
  }
}

Write-Host "[1/5] Зависимости server + bot..."
npm install --prefix server --omit=dev
npm install --prefix bot --omit=dev

if (Test-Path "client\dist\index.html") {
  Write-Host "[2/5] Фронтенд уже собран"
} else {
  Write-Host "[2/5] Сборка фронтенда..."
  npm install --prefix client
  npm run build --prefix client
}

$dbPath = "server\data\bolashak_hr.db"
if (Test-Path $dbPath) {
  Write-Host "[3/5] База уже есть — пропуск db:setup"
} else {
  Write-Host "[3/5] Первый запуск — создание базы..."
  New-Item -ItemType Directory -Path "server\data" -Force | Out-Null
  npm run db:setup --prefix server
}

Write-Host "[4/5] PM2..."
if (-not (Get-Command pm2 -ErrorAction SilentlyContinue)) {
  npm install -g pm2
}
pm2 delete bolashak-hr bolashak-hr-bot -s 2>$null
pm2 start ecosystem.config.cjs --env production
pm2 save

Write-Host "[5/5] Файрвол порт 3002..."
$rule = Get-NetFirewallRule -DisplayName "Bolashak HR" -ErrorAction SilentlyContinue
if (-not $rule) {
  New-NetFirewallRule -DisplayName "Bolashak HR" -Direction Inbound -Protocol TCP -LocalPort 3002 -Action Allow | Out-Null
}

Write-Host ""
Write-Host "=== Готово! ===" -ForegroundColor Green
Write-Host "Локально:  http://localhost:3002"
Write-Host "TailScale: http://100.121.80.67:3002"
Write-Host "Логин:     aizada@bolashak.local / admin123"
Write-Host ""
pm2 status
Write-Host ""
Write-Host "Проверка: Invoke-RestMethod http://localhost:3002/api/health" -ForegroundColor Cyan
