"use strict";

/**
 * Backup PostgreSQL usando pg_dump. Requer pg_dump no PATH e DATABASE_URL PostgreSQL.
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl || !/^postgres(?:ql)?:\/\//i.test(dbUrl)) {
  console.error("backup-db: DATABASE_URL deve ser PostgreSQL (postgresql://...).");
  process.exit(1);
}

const backupRoot = path.join(__dirname, "..", "backups");
fs.mkdirSync(backupRoot, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const dest = path.join(backupRoot, `postgres-${stamp}.dump`);

const result = spawnSync("pg_dump", [dbUrl, "--format=custom", "--file", dest], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.error) {
  console.error("backup-db: falha ao executar pg_dump:", result.error.message);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(`backup-db: pg_dump finalizou com status ${result.status}`);
  process.exit(result.status || 1);
}

console.log("backup-db:", dest);
