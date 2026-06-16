import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const srcRoot = path.resolve(import.meta.dirname, "../src");

test("setup pages use the setup status guard and redirect closed installs to login", () => {
  const dockerSetupSource = fs.readFileSync(path.join(srcRoot, "pages/DockerSetup.tsx"), "utf8");
  const createAdminSource = fs.readFileSync(path.join(srcRoot, "pages/CreateAdmin.tsx"), "utf8");
  const guardSource = fs.readFileSync(path.join(srcRoot, "features/setup/useSetupRouteGuard.ts"), "utf8");

  assert.match(dockerSetupSource, /useSetupRouteGuard\(\)/);
  assert.match(createAdminSource, /useSetupRouteGuard\(\)/);
  assert.match(guardSource, /api\.get<SetupStatusResponse>\(buildStatusUrl\(search\)\)/);
  assert.match(guardSource, /navigate\("\/login", \{ replace: true \}\)/);
  assert.match(guardSource, /setupOpen/);
  assert.match(guardSource, /setupCompleted/);
});
