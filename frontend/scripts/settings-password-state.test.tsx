import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const srcRoot = path.resolve(import.meta.dirname, "../src");

test("settings page exposes an internal admin password change form", () => {
  const source = fs.readFileSync(path.join(srcRoot, "pages/Apis.tsx"), "utf8");

  assert.match(source, /Senha do administrador/);
  assert.match(source, /handleChangePassword/);
  assert.match(source, /current-password/);
  assert.match(source, /new-password/);
  assert.match(source, /As senhas não conferem\./);
  assert.match(source, /Alterar senha/);
  assert.match(source, /navigate\("\/login", \{ replace: true \}\)/);
  assert.match(source, /passwordSaving/);
});

test("auth context sends the change-password contract and clears local session", () => {
  const source = fs.readFileSync(path.join(srcRoot, "contexts/AuthContext.tsx"), "utf8");

  assert.match(source, /changePassword: \(currentPassword: string, newPassword: string, confirmPassword: string\) => Promise<void>/);
  assert.match(source, /api\.post\("\/auth\/change-password", \{ currentPassword, newPassword, confirmPassword \}\)/);
  assert.match(source, /setUser\(null\)/);
});

