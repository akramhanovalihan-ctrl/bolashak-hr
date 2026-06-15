$base = "https://exquisite-quietude-production-c3c1.up.railway.app/api/hr"
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

$login = Invoke-RestMethod -Uri "$base/auth/login" -Method POST -Body (@{
  email = "aizada@bolashak.local"
  password = "admin123"
  remember = $true
} | ConvertTo-Json) -ContentType "application/json" -WebSession $session

Write-Output "Login: $($login.user.full_name) ($($login.user.role))"

$body = @{
  doc_type = "order"
  title = "ТЕСТ: Приказ о проверке документов"
  content = "Тестовый приказ от $(Get-Date -Format 'dd.MM.yyyy HH:mm'). Проверка загрузки файлов и публикации."
  visibility = @{ mode = "all" }
} | ConvertTo-Json -Depth 3

$created = Invoke-RestMethod -Uri "$base/documents" -Method POST -Body $body -ContentType "application/json" -WebSession $session
Write-Output "Document id: $($created.id)"

$filePath = Join-Path $PSScriptRoot "test-document.txt"
if (-not (Test-Path $filePath)) { throw "File not found: $filePath" }

$boundary = [System.Guid]::NewGuid().ToString()
$fileBytes = [System.IO.File]::ReadAllBytes($filePath)
$fileName = [System.IO.Path]::GetFileName($filePath)

$enc = [System.Text.Encoding]::UTF8
$bodyLines = New-Object System.Collections.Generic.List[byte]
foreach ($line in @(
  "--$boundary",
  "Content-Disposition: form-data; name=`"file`"; filename=`"$fileName`"",
  "Content-Type: text/plain",
  ""
)) {
  $bodyLines.AddRange($enc.GetBytes("$line`r`n"))
}
$bodyLines.AddRange($fileBytes)
$bodyLines.AddRange($enc.GetBytes("`r`n--$boundary--`r`n"))

try {
  $upload = Invoke-RestMethod -Uri "$base/documents/$($created.id)/file" -Method PUT -WebSession $session -ContentType "multipart/form-data; boundary=$boundary" -Body $bodyLines.ToArray()
  Write-Output "Upload: $($upload.file_name)"
} catch {
  Write-Output "Upload via curl..."
  curl.exe -s -b ($session.Cookies.GetCookies("$base") | ForEach-Object { "$($_.Name)=$($_.Value)" }) -F "file=@$filePath" -X PUT "$base/documents/$($created.id)/file"
}

$pub = Invoke-RestMethod -Uri "$base/documents/$($created.id)/publish" -Method POST -Body (@{ visibility = @{ mode = "all" } } | ConvertTo-Json -Depth 3) -ContentType "application/json" -WebSession $session
Write-Output "Published: ok=$($pub.ok)"
Write-Output "Open: https://exquisite-quietude-production-c3c1.up.railway.app/documents"
