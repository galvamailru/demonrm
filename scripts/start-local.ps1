# Локальный запуск без сборки frontend/backend образов (обход недоступности Docker Hub)
# Требуется: Node.js 20+, Python 3.12+, Docker только для Postgres (опционально)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

Write-Host "=== Demo NRM: локальный запуск ===" -ForegroundColor Cyan

# Postgres
$pgRunning = $false
try {
    $null = docker info 2>$null
    Write-Host "Запуск PostgreSQL (docker compose db-only)..."
    docker compose -f docker-compose.db-only.yml up -d
    $pgRunning = $true
} catch {
    Write-Host "Docker недоступен. Убедитесь, что Postgres слушает localhost:5433 (user/pass/db: nrm)" -ForegroundColor Yellow
}

$env:DATABASE_URL = "postgresql://nrm:nrm@localhost:5433/nrm"
$env:CORS_ORIGINS = "http://localhost:5173,http://localhost:8080"

# Backend
Write-Host "Backend: http://localhost:8000" -ForegroundColor Green
$backendJob = Start-Job -ScriptBlock {
    param($root)
    Set-Location "$root\backend"
    if (-not (Test-Path ".venv")) { python -m venv .venv }
    & .\.venv\Scripts\pip.exe install -q -r requirements.txt
    $env:DATABASE_URL = "postgresql://nrm:nrm@localhost:5433/nrm"
    $env:CORS_ORIGINS = "http://localhost:5173,http://localhost:8080"
    & .\.venv\Scripts\uvicorn.exe app.main:app --host 0.0.0.0 --port 8000
} -ArgumentList $Root

Start-Sleep -Seconds 3

# Frontend
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Green
Set-Location "$Root\frontend"
if (-not (Test-Path "node_modules")) { npm install }
$env:VITE_API_URL = ""
npm run dev

# Cleanup on exit (Ctrl+C in frontend stops script; stop backend job)
Stop-Job $backendJob -ErrorAction SilentlyContinue
Remove-Job $backendJob -ErrorAction SilentlyContinue
