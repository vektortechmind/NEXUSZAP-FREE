Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  INICIANDO O CHATBOT NEXUS ZAP..." -ForegroundColor White
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

Set-Location $PSScriptRoot

function Set-OrAppendEnvValue {
  param(
    [string]$EnvPath,
    [string]$Key,
    [string]$Value
  )

  $escaped = [Regex]::Escape($Key)
  $quotedValue = '"' + $Value.Replace('"', '\"') + '"'
  $newLine = "$Key=$quotedValue"

  if (-not (Test-Path -LiteralPath $EnvPath)) {
    Set-Content -LiteralPath $EnvPath -Value $newLine
    return
  }

  $content = Get-Content -LiteralPath $EnvPath -Raw
  if ($content -match "(?m)^$escaped\s*=") {
    $updated = [Regex]::Replace($content, "(?m)^$escaped\s*=.*$", $newLine)
    Set-Content -LiteralPath $EnvPath -Value $updated
  } else {
    if ($content -and -not $content.EndsWith("`r`n") -and -not $content.EndsWith("`n")) {
      $content += [Environment]::NewLine
    }
    $content += $newLine + [Environment]::NewLine
    Set-Content -LiteralPath $EnvPath -Value $content
  }
}

# [CRITICO] Matar TODOS os processos Node.js/npm - mais agressivo
Write-Host "[0/6] Limpeza agressiva de processos Node.js..." -ForegroundColor Yellow
Write-Host "     Matando processos na porta 3000..." -ForegroundColor DarkGray
$killed = 0

# Matar qualquer coisa usando porta 3000 (MUITO agressivo)
try {
  $portProcesses = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess
  if ($portProcesses) {
    foreach ($pid in $portProcesses) {
      Write-Host "     Matando PID $pid na porta 3000..." -ForegroundColor Yellow
      Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
      $killed++
    }
    Write-Host "     OK: $killed processo(s) terminado(s)" -ForegroundColor Green
  }
} catch {
  Write-Host "     Aviso: Nao conseguiu verificar porta 3000: $_" -ForegroundColor Yellow
}

# Usar Get-Process para node e npm (mais processos)
@("node", "npm") | ForEach-Object {
  $proc = Get-Process $_ -ErrorAction SilentlyContinue
  if ($proc) {
    Write-Host "     Matando processos: $_" -ForegroundColor Yellow
    $proc | Stop-Process -Force -ErrorAction SilentlyContinue
    $killed += @($proc).Count
    Write-Host "     OK: $_ processos terminados" -ForegroundColor Green
  }
}

# Taskkill como fallback
taskkill /F /IM node.exe 2>$null | Out-Null
taskkill /F /IM npm.cmd 2>$null | Out-Null
taskkill /F /IM npm 2>$null | Out-Null

# Aguardar mais tempo
Start-Sleep -Seconds 8
Write-Host "     Aguardando liberacao completa de port 3000..." -ForegroundColor DarkGray

# Verificar se porta foi liberada
$portStillInUse = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($portStillInUse) {
  Write-Host "     [AVISO] Porta 3000 AINDA em uso!" -ForegroundColor Red
  Write-Host "     Tentando forcadamente..." -ForegroundColor Yellow
  Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | ForEach-Object {
    Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
  }
  Start-Sleep -Seconds 5
} else {
  Write-Host "     OK: Porta 3000 liberada!" -ForegroundColor Green
}

Write-Host ""

Write-Host "[1/6] Verificando .env e token do Telegram..." -ForegroundColor Yellow
$envPath = Join-Path $PSScriptRoot "backend\.env"

if (-not (Test-Path -LiteralPath $envPath)) {
  Write-Host "     [ERRO] backend\.env nao encontrado." -ForegroundColor Red
  Write-Host "     Execute na raiz do projeto: .\setup-env.ps1" -ForegroundColor Yellow
  exit 1
}

$telegramToken = $env:TELEGRAM_BOT_TOKEN
if (-not [string]::IsNullOrWhiteSpace($telegramToken)) {
  Set-OrAppendEnvValue -EnvPath $envPath -Key "TELEGRAM_BOT_TOKEN" -Value $telegramToken
  Write-Host "     TELEGRAM_BOT_TOKEN sincronizado no backend\.env." -ForegroundColor Green
} else {
  Write-Host "     TELEGRAM_BOT_TOKEN nao definido. Telegram fica desativado." -ForegroundColor DarkGray
}
Write-Host ""

Write-Host "Validando ambiente local..." -ForegroundColor DarkGray
Write-Host "DATABASE_URL esperado no backend.env: file:./chatbot.db" -ForegroundColor DarkGray
Write-Host ""

# Evita prompts interativos do Prisma em scripts
$env:CI = "true"

function Invoke-WithRetry {
  param(
    [string]$Command,
    [int]$Retries = 3,
    [int]$DelaySeconds = 2
  )

  for ($i = 1; $i -le $Retries; $i++) {
    Write-Host "Executando: $Command (tentativa $i/$Retries)" -ForegroundColor DarkGray
    Invoke-Expression $Command
    if ($LASTEXITCODE -eq 0) { return $true }

    if ($i -lt $Retries) {
      Write-Host "Falhou. Tentando novamente em $DelaySeconds s..." -ForegroundColor Yellow
      Start-Sleep -Seconds $DelaySeconds
    }
  }

  return $false
}

Write-Host "[2/6] Garantindo dependencias..." -ForegroundColor Yellow
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot "backend\node_modules"))) {
  Write-Host "     Instalando dependencias do backend..." -ForegroundColor DarkGray
  Push-Location "backend"
  npm install
  if ($LASTEXITCODE -ne 0) {
    Pop-Location
    Write-Host "Falha no npm install do backend." -ForegroundColor Red
    exit 1
  }
  Pop-Location
}

if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot "frontend\node_modules"))) {
  Write-Host "     Instalando dependencias do frontend..." -ForegroundColor DarkGray
  Push-Location "frontend"
  npm install
  if ($LASTEXITCODE -ne 0) {
    Pop-Location
    Write-Host "Falha no npm install do frontend." -ForegroundColor Red
    exit 1
  }
  Pop-Location
}
Write-Host ""

Write-Host "[3/6] Preparando backend (Prisma generate + db push SQLite)..." -ForegroundColor Yellow
Push-Location "backend"

if (-not (Invoke-WithRetry -Command "npx prisma generate" -Retries 3 -DelaySeconds 2)) {
  Pop-Location
  Write-Host "Falha no prisma generate. Feche processos do backend e tente novamente." -ForegroundColor Red
  exit 1
}

# --skip-generate: ja rodou generate
if (-not (Invoke-WithRetry -Command "npx prisma db push --skip-generate --accept-data-loss" -Retries 3 -DelaySeconds 2)) {
  Pop-Location
  Write-Host "Falha no prisma db push. Verifique DATABASE_URL no backend.env (file:./chatbot.db)." -ForegroundColor Red
  exit 1
}

Pop-Location
Write-Host ""

$root = $PSScriptRoot
Write-Host "[4/6] Iniciando Backend em nova janela..." -ForegroundColor Yellow
Write-Host ""

# Abrir backend em nova janela
$backendCommand = "Set-Location -LiteralPath '$($root)\backend'; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCommand

# Esperar o backend iniciar com delay maior
Write-Host "[5/6] Aguardando Backend iniciar (ate 90 segundos)..." -ForegroundColor Yellow
Write-Host "     Aguardando 20 segundos para inicializacao completa..." -ForegroundColor DarkGray
Start-Sleep -Seconds 20

$backend_ready = $false
$max_attempts = 140
$attempt_count = 0

Write-Host "     Iniciando tentativas de conexao..." -ForegroundColor DarkGray

for ($i = 1; $i -le $max_attempts; $i++) {
  $attempt_count++
  try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/ping" -TimeoutSec 3 -ErrorAction Stop -UseBasicParsing
    
    if ($response.StatusCode -eq 200) {
      $backend_ready = $true
      Write-Host " " -ForegroundColor Green
      Write-Host "[OK] Backend respondeu! Status: $($response.StatusCode)" -ForegroundColor Green
      Write-Host "[OK] Tempo total: $([math]::Round((20 + $i * 0.33), 1)) segundo(s)" -ForegroundColor Green
      break
    }
  } catch [System.Net.WebException] {
    if ($i % 50 -eq 0) {
      Write-Host "     Tentativa $i/$max_attempts - Aguardando resposta..." -ForegroundColor DarkGray
    }
    Start-Sleep -Milliseconds 333
  } catch {
    if ($i % 50 -eq 0) {
      Write-Host "     Tentativa $i/$max_attempts - Aguardando..." -ForegroundColor DarkGray
    }
    Start-Sleep -Milliseconds 333
  }
}

if (-not $backend_ready) {
  Write-Host ""
  Write-Host "[ERRO] Backend nao respondeu em $attempt_count tentativas!" -ForegroundColor Red
  Write-Host ""
  Write-Host "Diagnostico:" -ForegroundColor Yellow
  
  # Verificar se porta 3000 esta sendo usada
  $portStatus = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
  if ($portStatus) {
    Write-Host "  [SIM] Porta 3000 esta em uso (PID: $($portStatus.OwningProcess))" -ForegroundColor Red
    Write-Host "  Mas /api/ping nao responde (possivel erro na inicializacao)" -ForegroundColor Red
  } else {
    Write-Host "  [NAO] Porta 3000 esta LIVRE - Backend nao iniciou!" -ForegroundColor Red
  }
  Write-Host ""
  Write-Host ""
  Write-Host "Dicas de resolucao:" -ForegroundColor Yellow
  Write-Host "  1. Abra uma nova terminal e tente: cd backend && npm run dev" -ForegroundColor DarkGray
  Write-Host "  2. Verifique se a porta 3000 esta livre: netstat -ano | findstr :3000" -ForegroundColor DarkGray
  Write-Host "  3. Verifique o arquivo backend.env (DATABASE_URL, JWT_SECRET, etc)" -ForegroundColor DarkGray
  Write-Host "  4. Tente: cd backend && npm install && npx prisma generate" -ForegroundColor DarkGray
  Write-Host "" -ForegroundColor Yellow
  exit 1
}

Write-Host ""
Write-Host "[6/6] Iniciando Frontend em nova janela..." -ForegroundColor Green
Write-Host "     Aguardando 5 segundos..." -ForegroundColor DarkGray
Start-Sleep -Seconds 5
Write-Host ""

# Abrir frontend em nova janela
$frontendCommand = "Set-Location -LiteralPath '$($root)\frontend'; npm run dev"
Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", $frontendCommand

Start-Sleep -Seconds 12

Write-Host ""
Write-Host "[OK] Sucesso!" -ForegroundColor Green
Write-Host ""
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "SERVIDORES INICIADOS COM SUCESSO!" -ForegroundColor White
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "[Frontend] Painel     : http://localhost:5173" -ForegroundColor Green
Write-Host "[Backend]  API        : http://localhost:3000" -ForegroundColor Green
Write-Host "[Health]   Check      : http://localhost:3000/api/health" -ForegroundColor Green
Write-Host ""
Write-Host "Voce pode minimizar esta tela, os servidores continuam rodando." -ForegroundColor DarkGray
Write-Host "Para parar tudo, feche as 2 janelas do PowerShell que abriram." -ForegroundColor DarkGray
Write-Host "===================================================" -ForegroundColor Cyan
