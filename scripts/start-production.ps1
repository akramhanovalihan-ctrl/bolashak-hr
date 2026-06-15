$ProjectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $ProjectRoot

Write-Host "Сборка фронтенда..."
npm run build --prefix client

Copy-Item "server\.env.production" "server\.env" -ErrorAction SilentlyContinue

$env:NODE_ENV = "production"
Set-Location server
node src/index.js
