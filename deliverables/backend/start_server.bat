@echo off
REM Keep the window open on any error/early exit so nothing "flashes" closed.
if not defined _ZHIYI_LAUNCHED (
  set _ZHIYI_LAUNCHED=1
  cmd /k "%~f0"
  exit /b
)
setlocal enabledelayedexpansion
title ZhiYi Backend Launcher
cd /d "%~dp0"

set LOG=%TEMP%\zhiyi_start.log
echo [%date% %time%] START >> "%LOG%"

echo ==================================================
echo   ZhiYi Assistant - Backend Service Launcher
echo ==================================================
echo.

REM ============================================================
REM [0] Free port 3000 first (kill any stale local dev server
REM so the health check below reflects only the Docker API)
REM ============================================================
echo [0/4] Freeing port 3000 if occupied...
powershell -NoProfile -Command "try { netstat -ano | ForEach-Object { if ($_ -match ':3000' -and $_ -match 'LISTENING') { $parts = $_ -split '\s+'; $pid = $parts[$parts.Length-1]; if ($pid -match '^\d+$') { Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue; Write-Host ('Killed leftover process ' + $pid + ' on port 3000') } } } } catch { }"
echo   OK.
echo.

REM ============================================================
REM [1] Health check. If already healthy, skip to browser.
REM ============================================================
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri http://localhost:3000/health -UseBasicParsing -TimeoutSec 3; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if !errorlevel! neq 0 goto not_healthy
echo [1/4] API already running and healthy - skipping start.
goto show_info

:not_healthy
echo [1/4] API not running - preparing to start...
echo.

REM ============================================================
REM [2] Check Docker Desktop is running
REM ============================================================
echo [2/4] Checking Docker Desktop...
docker info >nul 2>&1
if !errorlevel! equ 0 goto docker_ok

echo   Docker Desktop is not running. Starting it now...
if exist "C:\Program Files\Docker\Docker\Docker Desktop.exe" (
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
) else (
    echo   ERROR: Docker Desktop not found at default location.
    echo   Please install Docker Desktop and try again.
    goto fail
)

set DOCKER_WAIT=0
:docker_wait
timeout /t 3 /nobreak >nul
docker info >nul 2>&1
if !errorlevel! equ 0 goto docker_ok
set /a DOCKER_WAIT+=1
if !DOCKER_WAIT! geq 20 (
    echo   ERROR: Docker engine did not become ready within 60 seconds.
    echo   Please start Docker Desktop manually and re-run this script.
    goto fail
)
echo   Waiting for Docker engine... (!DOCKER_WAIT!/20)
goto docker_wait

:docker_ok
echo   OK - Docker is running.
echo.

REM ============================================================
REM [3] Build and start all Docker Compose services
REM ============================================================
echo [3/4] Building and starting all services...

REM ============================================================
REM Auto-detect NVIDIA GPU. If present, merge docker-compose.gpu.yml so
REM Ollama gets the GPU; otherwise run on CPU. No manual editing needed.
REM ============================================================
where nvidia-smi >nul 2>&1
if !errorlevel! equ 0 (
  echo   NVIDIA GPU detected - enabling GPU acceleration for local LLM.
  set "COMPOSE_GPU=-f docker-compose.gpu.yml"
) else (
  echo   No NVIDIA GPU detected - local LLM will run on CPU.
  set "COMPOSE_GPU="
)

echo   - Redis        (cache / session / rate-limit)
echo   - MinIO        (object storage)
echo   - Ollama       (local LLM - NEXUS-Medical)
echo   - NestJS API   (port 3000)
echo.
echo   NOTE: First run may take several minutes to pull images.
echo.

docker compose -f docker-compose.yml !COMPOSE_GPU! up -d --build
if !errorlevel! neq 0 goto compose_fail
echo.
echo   OK - All containers started.
echo.
goto after_compose

:compose_fail
echo   ERROR: docker compose up failed. See errors above.
goto fail

:after_compose

REM ============================================================
REM [4] Wait for API server to be healthy
REM ============================================================
echo [4/4] Waiting for API server to be ready...
echo   (Database schema sync + seed data + app bootstrap)
set API_WAIT=0

:api_wait
timeout /t 5 /nobreak >nul
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri http://localhost:3000/health -UseBasicParsing -TimeoutSec 3; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if !errorlevel! equ 0 goto api_ok
set /a API_WAIT+=1
if !API_WAIT! geq 36 (
    echo.
    echo   WARNING: API did not respond within 3 minutes.
    echo.
    echo   Container status:
    docker compose ps
    echo.
    echo   Last 25 lines of API logs:
    docker compose logs --tail=25 api
    echo.
    echo   You can still try: http://localhost:3000/api/docs
    goto show_info
)
echo   Waiting... (!API_WAIT!/36)
goto api_wait

:api_ok
echo   OK - API server is healthy!
echo.

REM ============================================================
REM [5] Wait for Ollama NEXUS-Medical model to finish pulling
REM (first launch auto-pulls ~1GB; AI consult needs it ready)
REM ============================================================
echo [5/5] Waiting for Ollama model (NEXUS-Medical) to be ready...
set MODEL_WAIT=0
:model_wait
timeout /t 5 /nobreak >nul
docker compose exec -T ollama ollama list 2>nul | findstr /I "nexus-medical" >nul
if !errorlevel! equ 0 goto model_ok
set /a MODEL_WAIT+=1
if !MODEL_WAIT! geq 36 (
    echo.
    echo   WARNING: model not ready within 3 min. AI consult will use fallback until pulled.
    goto show_info
)
echo   Pulling model... (!MODEL_WAIT!/36)
goto model_wait
:model_ok
echo   OK - NEXUS-Medical model is ready.
echo.

REM ============================================================
REM Display service info and open browser
REM ============================================================
:show_info
echo Opening ZhiYi Assistant in browser...
echo.
echo ==================================================
echo   All Services Running
echo ==================================================
echo.
echo   App Prototype:    http://localhost:3000/prototype.html
echo   Test Dashboard:   http://localhost:3000/test.html
echo   Swagger Docs:     http://localhost:3000/api/docs
echo   API Base URL:     http://localhost:3000/v1
echo   Health Check:     http://localhost:3000/health
echo   MinIO Console:    http://localhost:9001
echo                     (user/pass: see .env  MINIO_ROOT_USER / MINIO_ROOT_PASSWORD)
echo   Ollama API:       http://localhost:11434
echo   Ollama model:    NEXUS-Medical (fableforge-ai/nexus-medical:q4_k_m, auto-pulled on first start)
echo.
echo   Container Status:
docker compose ps
echo.
echo ==================================================
echo.
echo   Useful commands:
echo   View API logs:  docker compose logs -f api
echo   Stop services:  docker compose down
echo   Rebuild API:    docker compose up -d --build --no-deps api
echo   Re-pull model:  docker compose exec ollama ollama pull fableforge-ai/nexus-medical:q4_k_m
echo.
echo ==================================================
echo.

REM Open ZhiYi Assistant prototype in default browser
start http://localhost:3000/prototype.html

echo   Browser opened. You can close this window anytime.
echo   (Services will keep running in Docker)
echo.
pause
goto end

:fail
echo.
echo   ==================================================
echo   Launcher failed. See details above.
echo   Log file: %LOG%
echo   ==================================================
echo.
pause

:end
