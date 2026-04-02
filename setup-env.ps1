# ================================================
# NexusZAP - Configuração do .env (Windows)
# ================================================

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   NexusZAP - Configuracao do Ambiente" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Verificar diretório
$BACKEND_DIR = ".\backend"
$ENV_FILE = "$BACKEND_DIR\.env"

if (Test-Path $ENV_FILE) {
    Write-Host "O arquivo .env ja existe!" -ForegroundColor Yellow
    $overwrite = Read-Host "Deseja sobrescrever? (s/n)"
    if ($overwrite -ne "s") {
        Write-Host "Configuracao cancelada." -ForegroundColor Green
        exit
    }
}

# Função para ler entrada com valor padrão
function Read-Default {
    param($Prompt, $Default)
    if ($Default) {
        $value = Read-Host "$Prompt [$Default]"
        if ([string]::IsNullOrWhiteSpace($value)) { $value = $Default }
    } else {
        $value = Read-Host $Prompt
    }
    return $value
}

# Credenciais Admin
Write-Host "[1/6] Credenciais do Administrador" -ForegroundColor Cyan
$ADMIN_EMAIL = Read-Default "Email do admin" "admin@nexuszap.com"
$ADMIN_PASSWORD = Read-Host "Senha do admin" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($ADMIN_PASSWORD)
$ADMIN_PASSWORD = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

# GitHub
Write-Host ""
Write-Host "[2/6] GitHub" -ForegroundColor Cyan
$GITHUB_REPO = Read-Default "Usuario/Repo (ex: usuario/chatbot)" "vektortechmind/CHATBOT"

# Versão
Write-Host ""
Write-Host "[3/6] Versao" -ForegroundColor Cyan
$APP_VERSION = Read-Default "Versao do sistema" "v1.0.0"

# Porta
Write-Host ""
Write-Host "[4/6] Servidor" -ForegroundColor Cyan
$PORT = Read-Default "Porta do servidor" "3000"

# CORS
Write-Host ""
Write-Host "[5/6] CORS (pressione Enter para pular)" -ForegroundColor Cyan
$CORS_ORIGINS = Read-Host "Dominios permitidos (ex: https://app.exemplo.com)"

# Gerar chaves
Write-Host ""
Write-Host "Gerando chaves de seguranca..." -ForegroundColor Yellow
$JWT_SECRET = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) | ForEach-Object { [byte]$_ })
$ENCRYPTION_KEY = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) | ForEach-Object { [byte]$_ })

# Criar arquivo .env
Write-Host ""
Write-Host "Criando arquivo .env..." -ForegroundColor Green

$envContent = @"
# ===========================================
# NexusZAP - Configuracao do Ambiente
# Gerado em: $(Get-Date)
# ===========================================

# Ambiente
NODE_ENV="development"

# ===========================================
# BANCO DE DADOS
# ===========================================
DATABASE_URL="file:./chatbot.db"

# ===========================================
# SERVIDOR
# ===========================================
PORT=$PORT

# ===========================================
# SEGURANCA
# ===========================================
JWT_SECRET="$JWT_SECRET"
ENCRYPTION_KEY="$ENCRYPTION_KEY"

# ===========================================
# ADMIN
# ===========================================
ADMIN_EMAIL="$ADMIN_EMAIL"
ADMIN_PASSWORD="$ADMIN_PASSWORD"

# ===========================================
# CORS
# ===========================================
$($CORS_ORIGINS ? "CORS_ORIGINS=`"$CORS_ORIGINS`"" : "# CORS_ORIGINS=`"https://app.seudominio.com`"")

# ===========================================
# TELEGRAM (Opcional)
# ===========================================
# Obtenha em: https://t.me/BotFather
# TELEGRAM_BOT_TOKEN="seu-token-aqui"

# ===========================================
# APIs de IA (configure pelo painel)
# ===========================================
# GEMINI_KEY="sua-chave-aqui"
# GROQ_KEY="sua-chave-aqui"
# OPENROUTER_KEY="sua-chave-aqui"

# ===========================================
# AUTO-UPDATE (GitHub)
# ===========================================
GITHUB_REPO="$GITHUB_REPO"
APP_VERSION="$APP_VERSION"
"@

# Garantir que o diretório existe
if (-not (Test-Path $BACKEND_DIR)) {
    New-Item -ItemType Directory -Path $BACKEND_DIR -Force | Out-Null
}

# Criar arquivo
$envContent | Out-File -FilePath $ENV_FILE -Encoding UTF8

# Finalização
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "   CONFIGURACAO CONCLUIDA!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Arquivo: $ENV_FILE" -ForegroundColor Cyan
Write-Host ""
Write-Host "Credenciais:" -ForegroundColor Yellow
Write-Host "   Email:    $ADMIN_EMAIL"
Write-Host "   Senha:    $ADMIN_PASSWORD"
Write-Host ""
Write-Host "Proximos passos:" -ForegroundColor Yellow
Write-Host "   1. cd backend"
Write-Host "   2. npm install"
Write-Host "   3. npx prisma generate"
Write-Host "   4. npx prisma db push"
Write-Host "   5. npm run dev"
Write-Host ""
