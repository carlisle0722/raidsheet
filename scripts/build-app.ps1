$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$sourceDir = Join-Path $root "src\app"
$output = Join-Path $root "app.js"
$files = @(
  "00-bootstrap.js",
  "01-roster-owned-tab.js",
  "02-missing-raids.js",
  "03-raid-planner.js",
  "04-tools-album-memo.js",
  "05-persistence-utils.js"
)
$parts = foreach ($file in $files) {
  $path = Join-Path $sourceDir $file
  if (-not (Test-Path $path)) { throw "Missing source file: $path" }
  (Get-Content -Raw -Encoding UTF8 $path).TrimEnd()
}
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($output, ($parts -join "`r`n`r`n") + "`r`n", $utf8NoBom)
Write-Host "Built $output from src/app/*.js"