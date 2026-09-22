[CmdletBinding()]
param([ValidateSet('Start','Stop','Status')][string]$Action = 'Start', [switch]$ShowErrors)

$ErrorActionPreference = 'Stop'
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$runtime = Join-Path $env:LOCALAPPDATA 'GhostyWorkbenchDev'
$receiptPath = Join-Path $runtime 'desktop-runtime.json'
$node = Join-Path $env:LOCALAPPDATA 'GhostyWorkbenchTools/node-v24.13.1-win-x64/node.exe'
$mutex = New-Object Threading.Mutex($false, 'Local\GhostyWorkbenchDesktopLauncher')
$locked = $false

function Get-OwnedRunner {
    if (-not (Test-Path -LiteralPath $receiptPath)) { return $null }
    $receipt = Get-Content -LiteralPath $receiptPath -Raw | ConvertFrom-Json
    if ($receipt.repo -ne $repo) { throw 'Runtime receipt belongs to a different checkout.' }
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($receipt.pid)"
    if (-not $process) { return $null }
    if ($process.CreationDate.ToUniversalTime().ToString('o') -ne $receipt.createdUtc) { return $null }
    if ($process.ExecutablePath -ne $node -or $process.CommandLine -notlike '*scripts/dev-runner.ts*dev:desktop*' -or $process.CommandLine -notlike "*$runtime*") {
        throw 'Runtime identity does not match; refusing to reuse or stop it.'
    }
    return $process
}

try {
    $locked = $mutex.WaitOne(0)
    if (-not $locked) { throw 'Another desktop launch operation is in progress.' }
    $runner = Get-OwnedRunner
    if ($Action -eq 'Status') {
        [pscustomobject]@{ running = [bool]$runner; pid = $(if ($runner) { $runner.ProcessId } else { $null }); repo = $repo; runtime = $runtime }
        return
    }
    if ($Action -eq 'Stop') {
        if ($runner) {
            # Captured PID + creation time + executable + command were verified above.
            & taskkill.exe /PID $runner.ProcessId /T /F | Out-Null
            if ($LASTEXITCODE -ne 0) { throw 'Could not stop the owned desktop process tree.' }
        }
        Write-Output 'Ghosty Workbench development processes stopped. Data preserved.'
        return
    }
    if ($runner) {
        Write-Output 'Ghosty Workbench development is already running. Use its taskbar window; to reopen a closed window, run Stop then Start.'
        return
    }
    if (-not (Test-Path -LiteralPath $node)) { throw "Required private Node runtime is missing: $node" }
    if (-not (Test-Path -LiteralPath (Join-Path $repo 'apps/desktop/node_modules/electron'))) { throw 'Desktop dependencies are missing. Follow docs/operations/ghosty-workbench.md.' }
    foreach ($port in @(19833,27873,19834)) {
        if (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue) { throw "Port $port is occupied. Do not launch a second runtime; inspect its owner." }
    }
    New-Item -ItemType Directory -Path $runtime -Force | Out-Null
    $env:PATH = "$(Split-Path $node);$repo\node_modules\.bin;$env:PATH"
    $env:T3CODE_PORT_OFFSET = '14100'
    $env:T3CODE_DESKTOP_USER_DATA_DIR = Join-Path $runtime 'electron-profile'
    $env:T3CODE_DISABLE_AUTO_UPDATE = '1'
    $env:T3CODE_DESKTOP_APP_USER_MODEL_ID = 'com.ghosty.workbench.dev'
    $env:T3CODE_DESKTOP_REMOTE_DEBUGGING_PORT = '19834'
    $state = Join-Path $runtime 'state'
    $arguments = 'scripts/dev-runner.ts dev:desktop --port 27873 --host 127.0.0.1 --dev-url http://127.0.0.1:19833 --home-dir "' + $state + '"'
    $process = Start-Process -FilePath $node -ArgumentList $arguments -WorkingDirectory $repo -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtime 'desktop.log') -RedirectStandardError (Join-Path $runtime 'desktop-error.log')
    $identity = Get-CimInstance Win32_Process -Filter "ProcessId = $($process.Id)"
    if (-not $identity) { throw "Desktop runner exited immediately. See $runtime logs." }
    [ordered]@{ pid = $process.Id; createdUtc = $identity.CreationDate.ToUniversalTime().ToString('o'); repo = $repo; state = $state; profile = $env:T3CODE_DESKTOP_USER_DATA_DIR; webUrl = 'http://127.0.0.1:19833'; backendPort = 27873; debugPort = 19834; mode = 'dev:desktop' } |
        ConvertTo-Json | Set-Content -LiteralPath $receiptPath -Encoding UTF8
    Write-Output "Starting Ghosty Workbench desktop. First launch builds the desktop shell; later UI edits update live. Logs: $runtime"
} catch {
    if ($ShowErrors) {
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'Ghosty Workbench launcher') | Out-Null
    }
    throw
} finally {
    if ($locked) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}
