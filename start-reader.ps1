$ErrorActionPreference = 'Stop'
$readerRoot = $PSScriptRoot
$readerPort = 5175
while ($readerPort -lt 5190) {
    $occupied = Get-NetTCPConnection -LocalPort $readerPort -State Listen -ErrorAction SilentlyContinue
    if (-not $occupied) { break }
    try {
        $existing = Invoke-RestMethod "http://127.0.0.1:$readerPort/api/provenance" -TimeoutSec 2
        if ($existing.dictionary.name -eq 'CC-CEDICT' -and $existing.vocabulary.entries -gt 10000) {
            Write-Host "Wonder Chinese Read is running at http://127.0.0.1:$readerPort"
            exit 0
        }
    } catch {}
    $readerPort++
}
if ($readerPort -ge 5190) { throw 'No free reader port between 5175 and 5189.' }
if (-not (Test-Path (Join-Path $readerRoot 'dist/index.html'))) {
    Push-Location $readerRoot
    try { & npm.cmd run build; if ($LASTEXITCODE -ne 0) { throw 'Build failed.' } } finally { Pop-Location }
}
$readerNode = (Get-Command node.exe).Source
$readerLogDirectory = Join-Path $readerRoot '.cache'
New-Item -ItemType Directory -Path $readerLogDirectory -Force | Out-Null
$priorReaderPort = $env:PORT
try {
    $env:PORT = [string]$readerPort
    $readerProcess = Start-Process -FilePath $readerNode -ArgumentList @('server.mjs','--production') -WorkingDirectory $readerRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $readerLogDirectory 'server.log') -RedirectStandardError (Join-Path $readerLogDirectory 'server-error.log')
} finally { $env:PORT = $priorReaderPort }
for ($readerAttempt = 0; $readerAttempt -lt 30; $readerAttempt++) {
    try {
        Invoke-RestMethod "http://127.0.0.1:$readerPort/api/catalog" -TimeoutSec 2 | Out-Null
        Write-Host "Wonder Chinese Read: http://127.0.0.1:$readerPort"
        Write-Host "Server PID: $($readerProcess.Id)"
        exit 0
    } catch { Start-Sleep -Milliseconds 500 }
}
throw 'The reader did not start. Check .cache/server-error.log.'
