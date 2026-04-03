"use strict";

/**
 * Copia o SQLite definido em DATABASE_URL para backend/backups/.
 * Caminhos relativos em file: seguem o Prisma (relativos à pasta prisma/).
 */
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl || !dbUrl.startsWith("file:")) {
  console.error("backup-db: DATABASE_URL deve começar com file: (SQLite).");
  process.exit(1);
}

const rawPath = dbUrl.slice("file:".length);
const prismaDir = path.join(__dirname, "..", "prisma");
const dbPath = path.isAbsolute(rawPath)
  ? rawPath
  : path.join(prismaDir, rawPath.replace(/^\.\//, ""));

if (!fs.existsSync(dbPath)) {
  console.error("backup-db: arquivo não encontrado:", dbPath);
  process.exit(1);
}

const backupRoot = path.join(__dirname, "..", "backups");
fs.mkdirSync(backupRoot, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const baseName = path.basename(dbPath, path.extname(dbPath)) || "chatbot";
const dest = path.join(backupRoot, `${baseName}-${stamp}.db`);

fs.copyFileSync(dbPath, dest);
console.log("backup-db:", dest);

const extras = [`${dbPath}-shm`, `${dbPath}-wal`];
for (const extra of extras) {
  if (fs.existsSync(extra)) {
    const d = dest + extra.slice(dbPath.length);
    fs.copyFileSync(extra, d);
    console.log("backup-db:", d);
  }
}
