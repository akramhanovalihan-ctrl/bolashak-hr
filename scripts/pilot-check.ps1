$base = if ($env:HR_BASE_URL) { $env:HR_BASE_URL } else { "http://127.0.0.1:3002" }
$api = "$base/api/hr"
$fail = 0

Write-Host "=== Bolashak HR pilot check ===" -ForegroundColor Cyan

try {
  $health = Invoke-RestMethod -Uri "$base/api/health" -TimeoutSec 10
  Write-Host "[OK] health $($health.status) v$($health.version)" -ForegroundColor Green
} catch {
  Write-Host "[FAIL] health: $($_.Exception.Message)" -ForegroundColor Red
  $fail++
  exit 1
}

$roles = @(
  @{ name = "admin"; email = "aizada@bolashak.local"; pass = "admin123" },
  @{ name = "hr"; email = "talshyn@bolashak.local"; pass = "hr123" },
  @{ name = "manager"; email = "aidyn@bolashak.local"; pass = "it123" }
)

foreach ($r in $roles) {
  $s = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  try {
    $login = Invoke-RestMethod -Uri "$api/auth/login" -Method POST -Body (@{ email = $r.email; password = $r.pass } | ConvertTo-Json) -ContentType "application/json" -WebSession $s -TimeoutSec 10
    Write-Host "[OK] login $($r.name) -> $($login.user.role)" -ForegroundColor Green
    foreach ($ep in @("timesheets", "employees", "portal/dashboard", "vacations")) {
      try {
        Invoke-RestMethod -Uri "$api/$ep" -WebSession $s -TimeoutSec 15 | Out-Null
        Write-Host "      OK $ep"
      } catch {
        Write-Host "      FAIL $ep" -ForegroundColor Red
        $fail++
      }
    }
  } catch {
    Write-Host "[FAIL] login $($r.name): $($_.Exception.Message)" -ForegroundColor Red
    $fail++
  }
}

$stats = Invoke-RestMethod -Uri "$base/api/health/stats" -TimeoutSec 10
Write-Host "Data: $($stats.stats.units) units, $($stats.stats.users) users, $($stats.stats.employees) employees"

if ($fail -eq 0) {
  Write-Host "`nPilot check PASSED" -ForegroundColor Green
} else {
  Write-Host "`nPilot check FAILED ($fail errors)" -ForegroundColor Red
  exit 1
}
