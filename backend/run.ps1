<#
.SYNOPSIS
    Starts the Marlow Dental API development server with the local virtual environment.

.DESCRIPTION
    Activates the local .venv if present and launches Uvicorn with automatic reload.
    Supports passing additional arguments directly to uvicorn.

.EXAMPLE
    .\run.ps1
    .\run.ps1 --port 8080
#>

[CmdletBinding()]
param (
    [string]$HostAddress = "127.0.0.1",
    [int]$Port = 8000,
    [switch]$NoReload
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

$VenvPython = Join-Path $ScriptDir ".venv\Scripts\python.exe"
$VenvUvicorn = Join-Path $ScriptDir ".venv\Scripts\uvicorn.exe"
$VenvActivate = Join-Path $ScriptDir ".venv\Scripts\Activate.ps1"

if (-not (Test-Path $VenvPython)) {
    Write-Warning "Virtual environment not detected at .venv. Checking for 'uv'..."
    if (Get-Command uv -ErrorAction SilentlyContinue) {
        $uvArgs = @("run", "uvicorn", "app.main:app", "--host", $HostAddress, "--port", "$Port")
        if (-not $NoReload) {
            $uvArgs += "--reload"
        }
        if ($args) {
            $uvArgs += $args
        }
        uv @uvArgs
        exit $LASTEXITCODE
    } else {
        Write-Error "Virtual environment (.venv) not found. Please run 'uv venv .venv' or 'python -m venv .venv'."
        exit 1
    }
}

# Ensure .venv is activated in current session if script was dot-sourced or interactive
if (Test-Path $VenvActivate) {
    & $VenvActivate
}

$uvicornArgs = @("app.main:app", "--host", $HostAddress, "--port", "$Port")
if (-not $NoReload) {
    $uvicornArgs += "--reload"
}
if ($args) {
    $uvicornArgs += $args
}

Write-Host "Starting Marlow Dental API on http://$($HostAddress):$($Port) (Reload: $(-not $NoReload))..." -ForegroundColor Green
& $VenvUvicorn @uvicornArgs

