$b = "http://localhost:3002/api/hr/auth/login"
@("alhan@bolashak.local", "aidyn@bolashak.local") | ForEach-Object {
  try {
    $x = Invoke-RestMethod -Uri $b -Method POST -Body (@{ email = $_; password = "it123" } | ConvertTo-Json) -ContentType "application/json"
    Write-Output "OK $_ role=$($x.user.role)"
  } catch {
    Write-Output "FAIL $_"
  }
}
