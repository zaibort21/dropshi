param(
  [string]$Email = $env:DROPI_EMAIL,
  [string]$Password = $env:DROPI_PASSWORD,
  [string]$ChromePath = $env:DROPI_CHROME_PATH,
  [switch]$Headless = $true
)

if (-not $Email -or -not $Password) {
  Write-Host "ERROR: debes pasar Email y Password o establecer variables de entorno DROPI_EMAIL y DROPI_PASSWORD"
  exit 1
}

if ($ChromePath) { $env:DROPI_CHROME_PATH = $ChromePath }
$env:DROPI_EMAIL = $Email
$env:DROPI_PASSWORD = $Password
$env:DROPI_HEADLESS = if ($Headless) { 'true' } else { 'false' }

Write-Host "Ejecutando scraper (headless=$env:DROPI_HEADLESS)..."
node .\scrape-dropi.js --url "https://app.dropi.co/dashboard/search?search_type=simple&favorite=true&order_by=created_at&order_type=desc" 2>&1 | Tee-Object -FilePath .\scrape-run.log

Write-Host "Logs: .\scrape-run.log"
if (Test-Path .\scrape-debug.log) { Write-Host "Debug: .\scrape-debug.log" }
if (Test-Path .\image-list.json) { Write-Host "Resultado: .\image-list.json" }
