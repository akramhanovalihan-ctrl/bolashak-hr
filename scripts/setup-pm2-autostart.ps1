#Requires -RunAsAdministrator
$ProjectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $ProjectRoot

npm install -g pm2 pm2-windows-startup 2>&1 | Out-Null
pm2-startup install 2>&1
pm2 save 2>&1
Write-Host "PM2 autostart configured. Reboot server to verify."
