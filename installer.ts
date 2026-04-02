import Fastify from "fastify";
import { readFileSync, writeFileSync, existsSync, mkdirSync, cpSync } from "fs";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = path.resolve(__dirname, "..");
const BACKEND_DIR = path.join(PROJECT_DIR, "backend");
const ENV_FILE = path.join(BACKEND_DIR, ".env");
const INSTALLER_HTML = path.join(__dirname, "installer.html");

const fastify = Fastify({ logger: true });

// Servir página do instalador
fastify.get("/", async (request, reply) => {
  const html = readFileSync(INSTALLER_HTML, "utf-8");
  reply.header("Content-Type", "text/html");
  return html;
});

// API: Salvar configuração
fastify.post("/api/setup", async (request, reply) => {
  const {
    adminEmail,
    adminPassword,
    githubRepo,
    appVersion,
    port,
    corsOrigins,
  } = request.body as any;

  // Validar
  if (!adminPassword || adminPassword.length < 6) {
    return reply.status(400).send({ error: "Senha deve ter pelo menos 6 caracteres" });
  }

  // Gerar chaves
  const crypto = await import("crypto");
  const jwtSecret = crypto.randomBytes(32).toString("base64");
  const encryptionKey = crypto.randomBytes(32).toString("base64");

  // Criar .env
  const envContent = `# ===========================================
# NexusZAP - Configuração do Ambiente
# Gerado em: ${new Date().toISOString()}
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
PORT=${port || 3000}

# ===========================================
# SEGURANÇA
# ===========================================
JWT_SECRET="${jwtSecret}"
ENCRYPTION_KEY="${encryptionKey}"

# ===========================================
# ADMIN
# ===========================================
ADMIN_EMAIL="${adminEmail || "admin@nexuszap.com"}"
ADMIN_PASSWORD="${adminPassword}"

# ===========================================
# CORS
# ===========================================
${corsOrigins ? `CORS_ORIGINS="${corsOrigins}"` : '# CORS_ORIGINS="https://app.seudominio.com"'}

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
# AUTO-UPDATE
# ===========================================
GITHUB_REPO="${githubRepo || "vektortechmind/CHATBOT"}"
APP_VERSION="${appVersion || "v1.0.0"}"
`;

  try {
    // Salvar .env
    writeFileSync(ENV_FILE, envContent);

    return {
      success: true,
      message: "Configuração salva com sucesso!"
    };
  } catch (error) {
    return reply.status(500).send({ error: "Erro ao salvar configuração" });
  }
});

// API: Instalar dependências
fastify.post("/api/install", async (request, reply) => {
  const steps: string[] = [];

  try {
    // npm install backend
    steps.push("Instalando dependências do backend...");
    await runCommand("npm", ["install"], BACKEND_DIR);

    steps.push("Gerando Prisma client...");
    await runCommand("npx", ["prisma", "generate"], BACKEND_DIR);

    steps.push("Criando banco de dados...");
    await runCommand("npx", ["prisma", "db", "push"], BACKEND_DIR);

    steps.push("Buildando backend...");
    await runCommand("npm", ["run", "build"], BACKEND_DIR);

    // npm install frontend
    const FRONTEND_DIR = path.join(PROJECT_DIR, "frontend");
    steps.push("Instalando dependências do frontend...");
    await runCommand("npm", ["install"], FRONTEND_DIR);

    steps.push("Buildando frontend...");
    await runCommand("npm", ["run", "build"], FRONTEND_DIR);

    return {
      success: true,
      steps
    };
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      error: error.message,
      steps
    });
  }
});

// API: Iniciar sistema
fastify.post("/api/start", async (request, reply) => {
  try {
    // Verificar se PM2 está instalado
    try {
      await runCommand("npx", ["pm2", "-v"], BACKEND_DIR, true);
    } catch {
      steps.push("Instalando PM2...");
      await runCommand("npm", ["install", "-g", "pm2"], BACKEND_DIR);
    }

    // Parar instâncias anteriores
    await runCommand("npx", ["pm2", "delete", "all"], BACKEND_DIR, true);

    // Criar ecosystem config
    const ecosystem = `
module.exports = {
  apps: [{
    name: 'nexuszap',
    script: 'dist/server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'development'
    }
  }]
};
`;
    writeFileSync(path.join(BACKEND_DIR, "ecosystem.config.js"), ecosystem);

    // Iniciar com PM2
    await runCommand("npx", ["pm2", "start", "ecosystem.config.js"], BACKEND_DIR);

    return {
      success: true,
      message: "Sistema iniciado!"
    };
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      error: error.message
    });
  }
});

// Função para rodar comandos
function runCommand(cmd: string, args: string[], cwd: string, silent = false): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { cwd, shell: true });
    let output = "";

    proc.stdout?.on("data", (data) => {
      output += data.toString();
      if (!silent) console.log(data.toString());
    });

    proc.stderr?.on("data", (data) => {
      output += data.toString();
      if (!silent) console.error(data.toString());
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(`Comando falhou: ${cmd} ${args.join(" ")}`));
      }
    });
  });
}

// Iniciar servidor
const start = async () => {
  try {
    await fastify.listen({ port: 3333, host: "0.0.0.0" });
    console.log(`
╔═══════════════════════════════════════════════╗
║   NexusZAP - Instalador                      ║
║                                               ║
║   Abra no navegador:                          ║
║   http://localhost:3333                       ║
║                                               ║
╚═══════════════════════════════════════════════╝
    `);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
