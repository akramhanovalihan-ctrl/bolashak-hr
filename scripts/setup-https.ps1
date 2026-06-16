#Requires -RunAsAdministrator
param(
  [string]$CertDir = '',
  [int]$HttpsPort = 3443,
  [string]$PfxPassword = 'BolashakHR-Cert-2026!'
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path $PSScriptRoot -Parent
if (-not $CertDir) { $CertDir = Join-Path $ProjectRoot 'server\certs' }
New-Item -ItemType Directory -Force -Path $CertDir | Out-Null

$pfxPath = Join-Path $CertDir 'bolashak-hr.pfx'

$dns = @('localhost', 'BOLASHAQ-SRV', 'bolashaq-srv', 'bolashaq-srv.tail094228.ts.net', '192.168.100.217', '100.121.80.67')
$cert = New-SelfSignedCertificate `
  -DnsName $dns `
  -CertStoreLocation 'Cert:\LocalMachine\My' `
  -FriendlyName 'Bolashak HR' `
  -NotAfter (Get-Date).AddYears(5)

$pwd = ConvertTo-SecureString -String $PfxPassword -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $pwd | Out-Null

$ruleName = 'Bolashak HR HTTPS'
if (-not (Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue)) {
  New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Protocol TCP -LocalPort $HttpsPort -Action Allow | Out-Null
}

Write-Host "HTTPS PFX: $pfxPath"
Write-Host "Port:      $HttpsPort"
Write-Host ""
Write-Host "Add to server/.env:"
Write-Host "HTTPS_PORT=$HttpsPort"
Write-Host "SSL_PFX_PATH=./certs/bolashak-hr.pfx"
Write-Host "SSL_PFX_PASSWORD=$PfxPassword"
Write-Host "CLIENT_URL=https://bolashaq-srv.tail094228.ts.net:$HttpsPort,https://100.121.80.67:$HttpsPort,http://100.121.80.67:3002,http://192.168.100.217:3002"
