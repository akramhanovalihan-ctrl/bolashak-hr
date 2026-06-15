param(
  [string]$Remote = 'origin',
  [string]$Branch = 'main'
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $ProjectRoot

if ($env:GITHUB_TOKEN) {
  $url = git remote get-url $Remote
  if ($url -match 'https://github.com/(.+)\.git') {
    $repo = $Matches[1]
    git remote set-url $Remote "https://$($env:GITHUB_TOKEN)@github.com/$repo.git"
  }
}

git push -u $Remote $Branch
Write-Host "Pushed to $Remote/$Branch"
