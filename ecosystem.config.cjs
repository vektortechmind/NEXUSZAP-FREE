/**
 * PM2 — backend (Fastify) + frontend (vite preview sobre dist/).
 * Uso: na raiz do projeto, após build: pm2 start ecosystem.config.cjs
 */
const path = require("path");
const root = __dirname;

module.exports = {
  apps: [
    {
      name: "chatbot-api",
      cwd: path.join(root, "backend"),
      script: "dist/server.js",
      instances: 1,
      autorestart: true,
      max_memory_restart: "800M",
      env: {
        NODE_ENV: "production"
      }
    },
    {
      name: "chatbot-web",
      cwd: path.join(root, "frontend"),
      script: "npm",
      args: "run preview -- --host 0.0.0.0 --port 4173",
      interpreter: "none",
      instances: 1,
      autorestart: true,
      max_memory_restart: "400M",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
