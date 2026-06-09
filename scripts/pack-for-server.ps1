$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path $PSScriptRoot -Parent
$OutZip = Join-Path $ProjectRoot "bolashak-hr-deploy.zip"

Write-Host "Сборка..."
Set-Location $ProjectRoot
npm install --prefix server --omit=dev
npm install --prefix client
npm run build --prefix client

$TempDir = Join-Path $env:TEMP "bolashak-hr-pack"
if (Test-Path $TempDir) { Remove-Item $TempDir -Recurse -Force }
New-Item -ItemType Directory -Path $TempDir | Out-Null

robocopy $ProjectRoot $TempDir /E /XD node_modules .git server\data /XF bolashak-hr-deploy.zip /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null

if (Test-Path $OutZip) { Remove-Item $OutZip -Force }
Compress-Archive -Path "$TempDir\*" -DestinationPath $OutZip -Force
Remove-Item $TempDir -Recurse -Force

Write-Host ""
Write-Host "Пакет готов: $OutZip" -ForegroundColor Green
Write-Host ""
Write-Host "На bolashaq-srv:" -ForegroundColor Cyan
Write-Host "  1. Распакуйте в C:\bolashak-hr"
Write-Host "  2. PowerShell (админ): cd C:\bolashak-hr"
Write-Host "  3. .\scripts\install-on-server.ps1"
Write-Host "  4. Откройте http://100.121.80.67:3002"
