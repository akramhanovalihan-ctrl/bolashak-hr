$ErrorActionPreference = "Stop"
$ExtractDir = "C:\bolashak-sql-setup\extract"
$SaPassword = "BolashakHR@2026!"
$InstanceName = "SQLEXPRESS"

if (-not (Test-Path "$ExtractDir\setup.exe")) {
  throw "setup.exe not found. Run media download first."
}

$ConfigFile = "$ExtractDir\ConfigurationFile.ini"
@"
[OPTIONS]
ACTION=Install
IACCEPTSQLSERVERLICENSETERMS=True
QUIET=True
FEATURES=SQLENGINE
INSTANCENAME=$InstanceName
SECURITYMODE=SQL
SAPWD=$SaPassword
SQLSVCACCOUNT="NT AUTHORITY\NETWORK SERVICE"
SQLSYSADMINACCOUNTS="BUILTIN\Administrators"
ADDCURRENTUSERASSQLADMIN="True"
TCPENABLED=1
NPENABLED=1
"@ | Set-Content $ConfigFile -Encoding ASCII

$serviceName = "MSSQL`$$InstanceName"
$existing = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if ($existing) {
  if ($existing.Status -ne "Running") { Start-Service $serviceName }
  Write-Output "ALREADY_INSTALLED"
  exit 0
}

$proc = Start-Process -FilePath "$ExtractDir\setup.exe" -ArgumentList "/ConfigurationFile=$ConfigFile" -PassThru -Wait
if ($proc.ExitCode -ne 0) {
  Write-Output "SETUP_FAILED:$($proc.ExitCode)"
  exit $proc.ExitCode
}

Start-Sleep -Seconds 20
Start-Service $serviceName
Write-Output "INSTALLED_OK"
