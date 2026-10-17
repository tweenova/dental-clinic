@echo off
REM ============================================================================
REM Marlow Dental API - Local Development Runner
REM Activates .venv and starts Uvicorn ASGI server
REM ============================================================================

cd /d "%~dp0"

if exist ".venv\Scripts\activate.bat" (
    call ".venv\Scripts\activate.bat"
    echo Starting Marlow Dental API with .venv on http://127.0.0.1:8000...
    uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload %*
) else (
    where uv >nul 2>nul
    if %ERRORLEVEL% equ 0 (
        echo Starting Marlow Dental API via uv run uvicorn...
        uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload %*
    ) else (
        echo ERROR: Virtual environment (.venv) not found.
        echo Please create it using 'uv venv .venv' or 'python -m venv .venv'.
        exit /b 1
    )
)
