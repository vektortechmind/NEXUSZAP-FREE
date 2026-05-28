@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT=%~dp0"
cd /d "%ROOT%" || exit /b 1

echo.
echo ========================================
echo NexusZAP - Instalacao completa
echo ========================================
echo.

call :require node "Instale Node.js 18+ antes de continuar."
if errorlevel 1 exit /b 1

call :require npm "Instale npm antes de continuar."
if errorlevel 1 exit /b 1

call :ensure_env
if errorlevel 1 exit /b 1

echo.
echo [1/5] Instalando dependencias da raiz...
call npm install
if errorlevel 1 exit /b 1

echo.
echo [2/5] Instalando dependencias do backend...
pushd backend || exit /b 1
if exist package-lock.json (
  call npm ci
) else (
  call npm install
)
if errorlevel 1 exit /b 1
call npm run db:generate
if errorlevel 1 exit /b 1
popd

echo.
echo [3/5] Instalando dependencias do frontend...
pushd frontend || exit /b 1
if exist package-lock.json (
  call npm ci
) else (
  call npm install
)
if errorlevel 1 exit /b 1
popd

echo.
echo [4/5] Buildando backend e frontend...
call npm run build
if errorlevel 1 exit /b 1

echo.
echo [5/5] Subindo stack Docker, se Docker estiver disponivel...
where docker >nul 2>nul
if errorlevel 1 (
  echo Docker nao encontrado. Instalacao local concluida; suba PostgreSQL e rode: npm run dev
) else (
  call :load_env
  docker compose version >nul 2>nul
  if errorlevel 1 (
    echo Docker Compose nao encontrado. Instalacao local concluida.
  ) else (
    docker compose up -d --build
    if errorlevel 1 exit /b 1
    echo Stack Docker iniciada. Painel: http://localhost  API: http://localhost:3000
  )
)

call :remove_ps1

echo.
echo Instalacao concluida.
exit /b 0

:require
where %~1 >nul 2>nul
if errorlevel 1 (
  echo ERRO: %~2
  exit /b 1
)
exit /b 0

:random_key
for /f "usebackq delims=" %%A in (`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`) do set "%~1=%%A"
exit /b 0

:random_password
for /f "usebackq delims=" %%A in (`node -e "console.log(require('crypto').randomBytes(18).toString('base64').replace(/[+/=]/g,'A')+'a1!')"`) do set "%~1=%%A"
exit /b 0

:ensure_env
if exist "backend\.env" (
  echo backend\.env ja existe. Mantendo configuracao atual.
  exit /b 0
)

if not exist backend mkdir backend
call :random_key JWT_SECRET
call :random_key ENCRYPTION_KEY
call :random_password ADMIN_PASSWORD

set "ADMIN_EMAIL=admin@nexuszap.com"
set "DATABASE_URL=postgresql://nexus:nexus_secret@localhost:5432/nexus_chatbot_db?schema=public"
set "CORS_ORIGINS=http://localhost,http://localhost:5173,http://localhost:4173"

(
  echo NODE_ENV="production"
  echo DATABASE_URL="%DATABASE_URL%"
  echo PORT=3000
  echo JWT_SECRET="%JWT_SECRET%"
  echo ENCRYPTION_KEY="%ENCRYPTION_KEY%"
  echo ADMIN_EMAIL="%ADMIN_EMAIL%"
  echo ADMIN_PASSWORD="%ADMIN_PASSWORD%"
  echo CORS_ORIGINS="%CORS_ORIGINS%"
  echo GITHUB_REPO="vektortechmind/NEXUSZAP-FREE"
) > "backend\.env"

echo backend\.env criado automaticamente.
echo Login inicial: %ADMIN_EMAIL%
echo Senha inicial: %ADMIN_PASSWORD%
exit /b 0

:load_env
if not exist "backend\.env" exit /b 0
for /f "usebackq eol=# tokens=1,* delims==" %%A in ("backend\.env") do (
  if not "%%A"=="" (
    set "env_value=%%~B"
    set "%%A=!env_value!"
  )
)
exit /b 0

:remove_ps1
for /r "%ROOT%" %%F in (*.ps1) do del /f /q "%%F" >nul 2>nul
exit /b 0
