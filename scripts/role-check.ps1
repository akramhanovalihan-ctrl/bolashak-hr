$base = "http://localhost:3002/api/hr"
$roles = @(
  @{ name = "admin"; email = "aizada@bolashak.local"; pass = "admin123" },
  @{ name = "hr"; email = "talshyn@bolashak.local"; pass = "hr123" },
  @{ name = "finance"; email = "galina@bolashak.local"; pass = "fin123" },
  @{ name = "manager"; email = "aidyn@bolashak.local"; pass = "it123" }
)
$endpoints = @(
  "employees",
  "units",
  "users",
  "timesheets",
  "payroll?year=2026&month=6",
  "vacations",
  "shifts?unit_id=x&year=2026&month=6",
  "disciplinary",
  "analytics/dashboard?year=2026&month=6",
  "documents",
  "portal"
)

foreach ($r in $roles) {
  $s = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  try {
    $login = Invoke-RestMethod -Uri "$base/auth/login" -Method POST -Body (@{ email = $r.email; password = $r.pass; remember = $true } | ConvertTo-Json) -ContentType "application/json" -WebSession $s
    Write-Output "=== $($r.name) ($($login.user.role)) ==="
    foreach ($ep in $endpoints) {
      try {
        $res = Invoke-WebRequest -Uri "$base/$ep" -WebSession $s -UseBasicParsing
        Write-Output "  $ep : $($res.StatusCode)"
      } catch {
        $code = $_.Exception.Response.StatusCode.value__
        Write-Output "  $ep : $code"
      }
    }
  } catch {
    Write-Output "=== $($r.name) LOGIN FAIL ==="
  }
}
