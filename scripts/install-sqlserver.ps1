#Requires -RunAsAdministrator
$ErrorActionPreference = "Stop"
$SetupDir = "C:\bolashak-sql-setup"
$SaPassword = "BolashakHR@2026!"
$InstanceName = "SQLEXPRESS"

New-Item -ItemType Directory -Force -Path $SetupDir | Out-Null
New-Item -ItemType Directory -Force -Path "$SetupDir\media" | Out-Null

$Bootstrapper = Join-Path $SetupDir "SQL2022-SSEI-Expr.exe"
if (-not (Test-Path $Bootstrapper)) {
  Write-Host "Downloading SQL Server 2022 Express bootstrapper..."
  Invoke-WebRequest -Uri "https://download.microsoft.com/download/5/1/4/5145fe04-4d30-4b85-b0d1-39533663a2f1/SQL2022-SSEI-Expr.exe" -OutFile $Bootstrapper
}

$mediaFiles = Get-ChildItem "$SetupDir\media" -Filter "SQLEXPR_x64_*.exe" -ErrorAction SilentlyContinue
$SetupExe = $mediaFiles | Where-Object { $_.Length -gt 100MB } | Select-Object -First 1

if (-not $SetupExe) {
  Write-Host "Downloading SQL Server media (~300 MB, several minutes)..."
  Remove-Item "$SetupDir\media\*" -Force -ErrorAction SilentlyContinue
  $proc = Start-Process -FilePath $Bootstrapper -ArgumentList "/ACTION=Download","MEDIAPATH=$SetupDir\media","MEDIATYPE=Core","/QUIET" -PassThru -Wait
  if ($proc.ExitCode -ne 0) { throw "Media download failed: $($proc.ExitCode)" }

  for ($i = 0; $i -lt 60; $i++) {
    $SetupExe = Get-ChildItem "$SetupDir\media" -Filter "SQLEXPR_x64_*.exe" -ErrorAction SilentlyContinue |
      Where-Object { $_.Length -gt 100MB } | Select-Object -First 1
    if ($SetupExe) { break }
    Start-Sleep -Seconds 5
  }
}

if (-not $SetupExe) {
  Get-ChildItem "$SetupDir\media" | Format-Table Name, Length
  throw "SQL Server media not downloaded"
}

Write-Host "Using media: $($SetupExe.FullName)"

$ExtractDir = Join-Path $SetupDir "extract"
if (-not (Test-Path (Join-Path $ExtractDir "setup.exe"))) {
  Write-Host "Extracting installer..."
  if (Test-Path $ExtractDir) { Remove-Item $ExtractDir -Recurse -Force }
  $proc = Start-Process -FilePath $SetupExe.FullName -ArgumentList "/q","/x:$ExtractDir" -PassThru -Wait
  if ($proc.ExitCode -ne 0) { throw "Extract failed: $($proc.ExitCode)" }
}

$ConfigFile = Join-Path $ExtractDir "ConfigurationFile.ini"
@"
[OPTIONS]
ACTION=Install
IACCEPTSQLSERVERLICENSETERMS=True
QUIET=True
FEATURES=SQLENGINE
INSTANCENAME=$InstanceName
SECURITYMODE=SQL
SAPWD=$SaPassword
SQLSVCACCOUNT=""NT AUTHORITY\NETWORK SERVICE""
SQLSYSADMINACCOUNTS=""BUILTIN\Users""
TCPENABLED=1
NPENABLED=1
"@ | Set-Content -Path $ConfigFile -Encoding ASCII

$serviceName = "MSSQL`$$InstanceName"
$existing = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if ($existing) {
  Write-Host "SQL Server service exists: $serviceName"
  if ($existing.Status -ne "Running") { Start-Service $serviceName }
} else {
  Write-Host "Installing SQL Server Express (10-20 min)..."
  $setup = Join-Path $ExtractDir "setup.exe"
  $proc = Start-Process -FilePath $setup -ArgumentList "/ConfigurationFile=$ConfigFile" -PassThru -Wait
  if ($proc.ExitCode -ne 0) { throw "SQL Server setup failed: $($proc.ExitCode)" }
  Start-Sleep -Seconds 15
  Start-Service $serviceName
}

# Enable TCP and restart
$sqlBrowser = Get-Service -Name "SQLBrowser" -ErrorAction SilentlyContinue
if ($sqlBrowser -and $sqlBrowser.Status -ne "Running") {
  Set-Service SQLBrowser -StartupType Manual
  Start-Service SQLBrowser
}

$projectRoot = Split-Path $PSScriptRoot -Parent
$EnvFile = Join-Path $projectRoot "server\.env"
$envContent = Get-Content $EnvFile -Raw
$envContent = $envContent -replace 'SQLSERVER_HOST=.*', "SQLSERVER_HOST=localhost\\$InstanceName"
$envContent = $envContent -replace 'SQLSERVER_PASSWORD=.*', "SQLSERVER_PASSWORD=$SaPassword"
Set-Content $EnvFile $envContent.TrimEnd() -Encoding UTF8

Write-Host ""
Write-Host "=== SQL Server ready ==="
Write-Host "Instance: localhost\$InstanceName"
Write-Host "SA password: $SaPassword"
Write-Host "Updated: server\.env"
