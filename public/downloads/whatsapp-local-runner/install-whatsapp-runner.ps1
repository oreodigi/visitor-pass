$ErrorActionPreference = "Stop"

$runnerUrl = "https://ticket.rimacle.com/downloads/whatsapp-local-runner"
$target = Join-Path $HOME "RimacleWhatsAppRunner"

if (-not (Get-Command node -ErrorAction SilentlyContinue) -or -not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js 20 LTS is required before installing the WhatsApp runner."
  Write-Host "Opening the Node.js download page..."
  Start-Process "https://nodejs.org/en/download"
  exit 1
}

New-Item -ItemType Directory -Force -Path $target | Out-Null

$files = @(
  "runner.mjs",
  "package.json",
  "env.example",
  "start-windows.bat",
  "README.md"
)

foreach ($file in $files) {
  Invoke-WebRequest -Uri "$runnerUrl/$file" -OutFile (Join-Path $target $file)
}

if (!(Test-Path (Join-Path $target ".env"))) {
  Copy-Item (Join-Path $target "env.example") (Join-Path $target ".env")
}

Write-Host ""
Write-Host "Rimacle WhatsApp Runner installed at:"
Write-Host $target
Write-Host ""
Write-Host "Next:"
Write-Host "1. Open .env and fill RUNNER_TOKEN and EVENT_ID."
Write-Host "2. Double-click start-windows.bat."
Write-Host ""
