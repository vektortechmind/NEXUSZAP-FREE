Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  CHATBOT IA MULTI-INSTANCIAS - SETUP INICIAL" -ForegroundColor White
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

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

Write-Host "[0/4] Configuracao inicial..." -ForegroundColor Yellow
$envPath = Join-Path $scriptDir "backend\.env"

if (-not (Test-Path -LiteralPath $envPath)) {
  Write-Host "      Erro: backend\.env nao encontrado." -ForegroundColor Red
  Write-Host "      Crie o ficheiro executando na raiz do projeto: .\setup-env.ps1" -ForegroundColor Yellow
  exit 1
}

$telegramToken = $env:TELEGRAM_BOT_TOKEN
if (-not [string]::IsNullOrWhiteSpace($telegramToken)) {
  Set-OrAppendEnvValue -EnvPath $envPath -Key "TELEGRAM_BOT_TOKEN" -Value $telegramToken
  Write-Host "      TELEGRAM_BOT_TOKEN aplicado no backend\.env (via variavel do sistema)." -ForegroundColor Green
} else {
  Write-Host "      Dica: defina TELEGRAM_BOT_TOKEN para ativar o bot Telegram automatico." -ForegroundColor DarkGray
}

Write-Host "      Confira backend\.env (DATABASE_URL, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD)." -ForegroundColor DarkGray
Write-Host ""

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

Write-Host "[1/4] Instalando dependencias do Backend (Fastify, Prisma, Baileys, Telegram, etc)..." -ForegroundColor Yellow
Set-Location -Path "backend"
npm install
if ($LASTEXITCODE -ne 0) {
  Write-Host "Erro ao instalar dependencias do backend." -ForegroundColor Red
  exit 1
}
Write-Host ""

Write-Host "- Sincronizando schema Prisma (SQLite)..." -ForegroundColor DarkGray
if (-not (Invoke-WithRetry -Command "npx prisma generate" -Retries 3 -DelaySeconds 2)) {
  Write-Host "Falha no prisma generate. Feche processos que usam o backend e rode novamente." -ForegroundColor Red
  exit 1
}

if (-not (Invoke-WithRetry -Command "npx prisma db push --accept-data-loss" -Retries 3 -DelaySeconds 2)) {
  Write-Host "Falha no prisma db push. Verifique DATABASE_URL no backend\.env (file:./chatbot.db)." -ForegroundColor Red
  exit 1
}
Set-Location -Path ".."
Write-Host ""

Write-Host "[2/4] Instalando dependencias do Frontend (React, Vite, Tailwind)..." -ForegroundColor Yellow
Set-Location -Path "frontend"
npm install
if ($LASTEXITCODE -ne 0) {
  Write-Host "Erro ao instalar dependencias do frontend." -ForegroundColor Red
  exit 1
}
Set-Location -Path ".."
Write-Host ""

Write-Host "[3/4] Build rapido de validacao (backend)..." -ForegroundColor Yellow
Set-Location -Path "backend"
npm run build
if ($LASTEXITCODE -ne 0) {
  Write-Host "Erro no build do backend. Revise as mensagens acima." -ForegroundColor Red
  exit 1
}
Set-Location -Path ".."
Write-Host ""

Write-Host "[4/4] =============================================" -ForegroundColor Green
Write-Host "  TUDO PRONTO! O SISTEMA ESTA 100% INSTALADO." -ForegroundColor White
Write-Host "===================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Para iniciar tudo automaticamente, execute: .\start.ps1" -ForegroundColor Cyan
Write-Host ""
Write-Host "Chaves de API (Gemini/Groq/OpenRouter): abra GUIA_CHAVES_API.html no navegador" -ForegroundColor DarkGray
Write-Host "===================================================" -ForegroundColor Cyan
