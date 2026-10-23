$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    $localRuntime = Join-Path $PSScriptRoot '.tools\node-v22.23.2-win-x64'
    if (-not (Test-Path -LiteralPath (Join-Path $localRuntime 'node.exe'))) {
        throw 'Install Node.js 22.13 or newer, then run this script again.'
    }
    $env:Path = "$localRuntime;$env:Path"
}
if (-not (Test-Path -LiteralPath 'node_modules')) {
    & npm.cmd install
    if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
}
if (-not (Test-Path -LiteralPath '.env')) { Copy-Item -LiteralPath '.env.example' -Destination '.env' }
& npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'The application build failed.' }
Write-Host 'Open http://localhost:3000 in your browser. Press Ctrl+C to stop.'
& npm.cmd start
