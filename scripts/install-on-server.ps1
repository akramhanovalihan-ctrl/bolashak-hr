# Запускать НА bolashaq-srv от имени администратора
$ErrorActionPreference = "Stop"
$ProjectDir = "C:\bolashak-hr"

Write-Host "=== Bolashak HR — установка на сервер ===" -ForegroundColor Cyan

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js не найден. Установите: https://nodejs.org" -ForegroundColor Red
  exit 1
}

Set-Location $ProjectDir

if (-not (Test-Path "server\.env")) {
  Copy-Item "server\.env.production" "server\.env"
  Write-Host "Создан server\.env из шаблона — проверьте JWT_SECRET!" -ForegroundColor Yellow
}

Write-Host "[1/5] Установка зависимостей..."
npm install --prefix server --omit=dev

if (Test-Path "client\dist\index.html") {
  Write-Host "[2/5] Фронтенд уже собран (client\dist)"
} else {
  Write-Host "[2/5] Сборка фронтенда..."
  npm install --prefix client
  npm run build --prefix client
}

Write-Host "[3/5] База данных..."
npm run db:setup --prefix server

Write-Host "[4/5] PM2..."
if (-not (Get-Command pm2 -ErrorAction SilentlyContinue)) {
  npm install -g pm2
}
pm2 delete bolashak-hr -s 2>$null
pm2 start ecosystem.config.cjs --env production
pm2 save

Write-Host "[5/5] Файрвол — порт 3002..."
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
