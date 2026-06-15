#Requires -RunAsAdministrator
param(
  [string]$TaskName = 'BolashakHR-SQLBackup',
  [string]$Time = '02:00'
)

$ProjectRoot = Split-Path $PSScriptRoot -Parent
$ScriptPath = Join-Path $PSScriptRoot 'backup-sqlserver.ps1'
$Action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$ScriptPath`""
$Trigger = New-ScheduledTaskTrigger -Daily -At $Time
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd
Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -RunLevel Highest -Force | Out-Null
Write-Host "Scheduled task '$TaskName' daily at $Time"
