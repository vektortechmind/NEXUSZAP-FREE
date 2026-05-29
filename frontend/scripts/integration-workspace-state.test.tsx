import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { APP_NAV_GROUPS, getAppRouteTitle } from "../src/features/navigation/appNavigation.ts";
import { EMPTY_INTEGRATIONS } from "../src/features/integrations/workspace.ts";
import { IntegrationWorkspacePage } from "../src/features/integrations/IntegrationWorkspacePage.tsx";
import { INTEGRATION_WORKSPACE_SECTIONS } from "../src/features/integrations/workspace.ts";

test("integration workspace is exposed in app navigation and route meta", () => {
  const operationGroup = APP_NAV_GROUPS.find((group) => group.label === "Operação");
  assert.ok(operationGroup, "grupo Operação deve existir");
  assert.ok(operationGroup?.items.some((item) => item.path === "/integracoes" && item.name === "Integrações"), "navegação deve expor a rota /integracoes");
  assert.equal(getAppRouteTitle("/integracoes"), "Integrações");
  assert.equal(getAppRouteTitle("/integracoes/documentacao"), "Integrações");
});

test("integration workspace keeps the intended information architecture order", () => {
  assert.deepEqual(INTEGRATION_WORKSPACE_SECTIONS.map((section) => section.id), ["credenciais", "operacao", "documentacao"]);
  assert.match(INTEGRATION_WORKSPACE_SECTIONS[0].description, /instanceId|secretToken/i);
  assert.match(INTEGRATION_WORKSPACE_SECTIONS[2].description, /documentação técnica|rota dedicada/i);
});

test("integration route renders the dedicated workspace sections", () => {
  const html = renderToStaticMarkup(
    <MemoryRouter initialEntries={["/integracoes"]}>
      <Routes>
        <Route path="/integracoes" element={<IntegrationWorkspacePage overview={EMPTY_INTEGRATIONS} refreshing={false} onRefresh={() => undefined} />} />
      </Routes>
    </MemoryRouter>,
  );

  assert.match(html, /Workspace de integrações/);
  assert.match(html, /Credenciais/);
  assert.match(html, /Operação/);
  assert.match(html, /Documentação/);
  assert.match(html, /Atualizar operação/);
});

test("dashboard no longer embeds the integration workspace directly", () => {
  const dashboardSource = fs.readFileSync(path.resolve(import.meta.dirname, "../src/pages/Dashboard.tsx"), "utf8");
  assert.doesNotMatch(dashboardSource, /Integrações operacionais/);
});
