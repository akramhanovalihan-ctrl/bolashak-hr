param(
  [string]$BackupDir = $env:BACKUP_DIR,
  [int]$RetentionDays = 14
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $ProjectRoot

Write-Host "SQL backup via Node/mssql..."
node scripts/backup-sqlserver.mjs
if ($LASTEXITCODE -ne 0) { throw "backup-sqlserver.mjs failed ($LASTEXITCODE)" }
Write-Host "Backup OK"
