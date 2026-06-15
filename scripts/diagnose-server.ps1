# Запускать НА сервере: powershell -ExecutionPolicy Bypass -File scripts\diagnose-server.ps1
$ProjectDir = if ($PSScriptRoot) { Split-Path $PSScriptRoot -Parent } else { "C:\bolashak-hr" }
Set-Location $ProjectDir

Write-Host "=== Bolashak HR — диагностика ===" -ForegroundColor Cyan
Write-Host "Папка: $ProjectDir`n"

function Ok($msg) { Write-Host "[OK] $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "[!!] $msg" -ForegroundColor Yellow }
function Fail($msg) { Write-Host "[XX] $msg" -ForegroundColor Red }

if (Get-Command node -ErrorAction SilentlyContinue) { Ok "Node.js $(node -v)" } else { Fail "Node.js не установлен" }
if (Get-Command pm2 -ErrorAction SilentlyContinue) { Ok "PM2 установлен" } else { Fail "PM2 не установлен — npm install -g pm2" }

if (Test-Path "server\.env") {
  Ok "server\.env найден"
  $envContent = Get-Content "server\.env" -Raw
  if ($envContent -match "CHANGE_ME") { Warn "JWT_SECRET не задан (CHANGE_ME)" }
  if ($envContent -notmatch "TELEGRAM_BOT_TOKEN=\S+") { Warn "TELEGRAM_BOT_TOKEN пуст — бот не запустится" }
  if ($envContent -match "COOKIE_SECURE=true") { Warn "COOKIE_SECURE=true на HTTP — вход может не работать. Поставьте false" }
} else {
  Fail "server\.env отсутствует — скопируйте env-for-server.txt → server\.env"
}

if (Test-Path "client\dist\index.html") { Ok "Фронтенд собран (client\dist)" } else { Fail "Нет client\dist — npm run build --prefix client" }

$db = "server\data\bolashak_hr.db"
if (Test-Path $db) { Ok "База SQLite: $db ($([math]::Round((Get-Item $db).Length/1KB)) KB)" } else { Warn "База не создана — запустится при первом старте" }

Write-Host ""
Write-Host "--- PM2 ---" -ForegroundColor Cyan
if (Get-Command pm2 -ErrorAction SilentlyContinue) {
  pm2 status 2>$null
  pm2 logs bolashak-hr --lines 5 --nostream 2>$null
}

Write-Host ""
Write-Host "--- HTTP ---" -ForegroundColor Cyan
foreach ($url in @("http://localhost:3002/api/health", "http://127.0.0.1:3002/api/health")) {
  try {
    $h = Invoke-RestMethod -Uri $url -TimeoutSec 5
    Ok "$url → version $($h.version), env $($h.env)"
  } catch {
    Fail "$url → $($_.Exception.Message)"
  }
}

$rule = Get-NetFirewallRule -DisplayName "Bolashak HR" -ErrorAction SilentlyContinue
if ($rule) { Ok "Firewall: порт 3002 открыт" } else { Warn "Firewall: правило Bolashak HR не найдено" }

Write-Host ""
Write-Host "Если API не отвечает:" -ForegroundColor Yellow
Write-Host "  cd $ProjectDir"
Write-Host "  pm2 restart all"
Write-Host "  pm2 logs"
