# ================================================
# Chatbot - Configuracao do backend/.env (PowerShell)
# ================================================
# Pode executar ANTES ou DEPOIS de "npm install": este script so cria/edita o ficheiro .env.
# Na VPS ou no PC local: mesmo fluxo. Depois de gerar o .env, instale dependencias e rode Prisma.

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   Configuracao do .env (backend)" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Quando usar: antes ou depois de npm install - o importante e ter o .env antes de npm run dev." -ForegroundColor DarkGray
Write-Host ""

$BACKEND_DIR = Join-Path $PSScriptRoot "backend"
$ENV_FILE = Join-Path $BACKEND_DIR ".env"

if (Test-Path $ENV_FILE) {
    Write-Host "Ja existe: $ENV_FILE" -ForegroundColor Yellow
    $overwrite = Read-Host "Sobrescrever? (s/n)"
    if ($overwrite -ne "s") {
        Write-Host "Cancelado." -ForegroundColor Green
        exit 0
    }
}

# Enter em branco usa $Default sem mostrar sugestao entre colchetes
function Read-Default {
    param($Prompt, $Default)
    $value = Read-Host $Prompt
    if ([string]::IsNullOrWhiteSpace($value)) { return $Default }
    return $value
}

function New-RandomBase64Key {
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    return [Convert]::ToBase64String($bytes)
}

function Read-SecretChoice {
    param(
        [string]$Nome,
        [string]$Dica
    )
    Write-Host ""
    Write-Host $Nome -ForegroundColor Cyan
    Write-Host "  1 = Definir manualmente (colar o valor)" -ForegroundColor DarkGray
    Write-Host "  2 = Gerar automaticamente (recomendado)" -ForegroundColor DarkGray
    if ($Dica) { Write-Host "  $Dica" -ForegroundColor DarkGray }
    $choice = Read-Host "Escolha 1 ou 2"
    $out = $null
    if ($choice -eq "1") {
        $manual = Read-Host "Valor"
        if ([string]::IsNullOrWhiteSpace($manual)) {
            Write-Host "Vazio - a gerar automaticamente." -ForegroundColor Yellow
            $out = New-RandomBase64Key
        } else {
            $out = $manual.Trim()
        }
    } else {
        $out = New-RandomBase64Key
    }
    return $out
}

# --- Perguntas principais ---
Write-Host "[1/6] Credenciais do painel (login)" -ForegroundColor Cyan
$ADMIN_EMAIL = Read-Default "Email do administrador" "admin@chatbot.local"

Write-Host ""
Write-Host "[2/6] Senha do administrador" -ForegroundColor Cyan
$sec = Read-Host "Senha" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
$ADMIN_PASSWORD = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

Write-Host ""
Write-Host "[3/6] CORS (producao / VPS)" -ForegroundColor Cyan
Write-Host "Dominios extra permitidos alem do localhost (ex: https://app.seudominio.com)." -ForegroundColor DarkGray
Write-Host "Se nao precisar, prima Enter para deixar em branco." -ForegroundColor DarkGray
$CORS_ORIGINS = Read-Host "CORS_ORIGINS"
if ($CORS_ORIGINS) { $CORS_ORIGINS = $CORS_ORIGINS.Trim() }

$JWT_SECRET = Read-SecretChoice -Nome "[4/6] JWT_SECRET (sessao do painel)" -Dica "Minimo ~32 caracteres se digitar manualmente."

$ENCRYPTION_KEY = Read-SecretChoice -Nome "[5/6] ENCRYPTION_KEY (tokens Telegram, etc.)" -Dica ""

Write-Host ""
Write-Host "[6/6] Servidor" -ForegroundColor Cyan
$PORT = Read-Default "Porta do servidor" "3000"

# Atualizacoes: projeto oficial (sem perguntar)
$GITHUB_REPO = "vektortechmind/CHATBOT"
$APP_VERSION = "v1.0.0"

# Bloco CORS: vazio = linhas comentadas (modelo padrao)
if ([string]::IsNullOrWhiteSpace($CORS_ORIGINS)) {
    $corsBlock = @"
# Descomente e adicione seus domínios em produção
# Padrão: permite localhost em desenvolvimento
# CORS_ORIGINS="https://app.seudominio.com,https://www.seudominio.com"
"@
} else {
    $corsBlock = "CORS_ORIGINS=`"$CORS_ORIGINS`""
}

# Template completo (comentarios e secoes)
$envContent = @"
# ===========================================
# CONFIGURAÇÕES DO BACKEND - Chatbot IA
# ===========================================
# Gerado em: $(Get-Date -Format "yyyy-MM-dd HH:mm") - setup-env.ps1

# Ambiente (development | production)
NODE_ENV="development"

# ===========================================
# BANCO DE DADOS (SQLite)
# ===========================================
# Desenvolvimento: arquivo local
DATABASE_URL="file:./chatbot.db"

# Produção (VPS): caminho absoluto fora da pasta do projeto
# Ex: DATABASE_URL="file:/var/lib/chatbot/chatbot.db"
# Ex: DATABASE_URL="file:./data/chatbot.db"

# ===========================================
# SERVIDOR
# ===========================================
PORT=$PORT

# ===========================================
# SEGURANÇA
# ===========================================
# Gere uma chave forte: openssl rand -base64 32
JWT_SECRET="$JWT_SECRET"

# Credenciais do Admin (alterar em produção!)
ADMIN_EMAIL="$ADMIN_EMAIL"
ADMIN_PASSWORD="$ADMIN_PASSWORD"

# ===========================================
# CORS (Produção)
# ===========================================
$corsBlock

# ===========================================
# TELEGRAM (Opcional)
# ===========================================
# Obtenha em: https://t.me/BotFather
# TELEGRAM_BOT_TOKEN="123456789:AA..."

# ===========================================
# OPENROUTER (Opcional)
# ===========================================
# Referer para a API OpenRouter
# OPENROUTER_REFERER="https://seusite.com"
# OPENROUTER_TITLE="Seu Chatbot"

# ===========================================
# GROQ AUDIO / WHISPER (Opcional)
# ===========================================
# Chave separada para transcrição de áudio (WhatsApp/Telegram)
# Se não configurada, usará groqKey como fallback
# Obtenha em: https://console.groq.com/keys
# GROQ_AUDIO_KEY="gsk_..."

# ===========================================
# AUTO-UPDATE (GitHub)
# ===========================================
# Projeto: https://github.com/vektortechmind/CHATBOT.git
GITHUB_REPO="$GITHUB_REPO"

# Versão atual da aplicação (para comparação)
APP_VERSION="$APP_VERSION"

# Diretórios para update e backup (opcionais)
# UPDATE_DIR="./updates"
# BACKUP_DIR="./backups"

# Chave de criptografia (gerada automaticamente se não existir)
ENCRYPTION_KEY="$ENCRYPTION_KEY"
"@

if (-not (Test-Path $BACKEND_DIR)) {
    New-Item -ItemType Directory -Path $BACKEND_DIR -Force | Out-Null
}

$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($ENV_FILE, $envContent, $utf8NoBom)

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "   .env criado com sucesso" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Ficheiro: $ENV_FILE" -ForegroundColor Cyan
Write-Host ""
Write-Host "Login do painel: $ADMIN_EMAIL" -ForegroundColor Yellow
Write-Host ""
Write-Host "Proximos passos (se ainda nao fez):" -ForegroundColor Yellow
Write-Host "   cd backend"
Write-Host "   npm install"
Write-Host "   npx prisma generate"
Write-Host "   npx prisma db push"
Write-Host "   npm run dev"
Write-Host ""
