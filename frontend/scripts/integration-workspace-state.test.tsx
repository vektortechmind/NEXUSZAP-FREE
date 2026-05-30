import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { APP_NAV_GROUPS, getAppRouteTitle } from "../src/features/navigation/appNavigation.ts";
import { EMPTY_INTEGRATION_CREDENTIALS_WORKSPACE } from "../src/features/integrations/credentials.ts";
import { INTEGRATION_DOCUMENTATION_ROUTE } from "../src/features/integrations/integrationDocumentationContent.ts";
import { EMPTY_INTEGRATIONS, INTEGRATION_WORKSPACE_SECTIONS } from "../src/features/integrations/workspace.ts";
import { IntegrationWorkspacePage } from "../src/features/integrations/IntegrationWorkspacePage.tsx";

globalThis.React = React;

test("integration workspace is exposed in app navigation and route meta", () => {
  const operationGroup = APP_NAV_GROUPS.find((group) => group.label === "Operação");
  assert.ok(operationGroup, "grupo Operação deve existir");
  assert.ok(operationGroup?.items.some((item) => item.path === "/integracoes" && item.name === "Integrações"), "navegação deve expor a rota /integracoes");
  assert.equal(getAppRouteTitle("/integracoes"), "Integrações");
  assert.equal(getAppRouteTitle("/integracoes/documentacao"), "Integrações");
});

test("integration workspace keeps the intended compact section order", () => {
  assert.deepEqual(INTEGRATION_WORKSPACE_SECTIONS.map((section) => section.id), ["credenciais", "operacao"]);
  assert.deepEqual(INTEGRATION_WORKSPACE_SECTIONS.map((section) => section.label), ["Credenciais", "Operação"]);
});

test("integration route renders compact workspace sections and a global audit operations view", () => {
  const html = renderToStaticMarkup(
    <MemoryRouter initialEntries={["/integracoes"]}>
      <Routes>
        <Route
          path="/integracoes"
          element={(
            <IntegrationWorkspacePage
              overview={EMPTY_INTEGRATIONS}
              credentialsWorkspace={EMPTY_INTEGRATION_CREDENTIALS_WORKSPACE}
              expandedCredentialInstanceId={null}
              credentialDetail={null}
              issueModalOpen={false}
              issueModalInstanceId={null}
              credentialsLoading={false}
              credentialDetailLoading={false}
              credentialActionLoading={null}
              refreshing={false}
              onRefresh={() => undefined}
              onToggleCredentialInstance={() => undefined}
              onOpenIssueModal={() => undefined}
              onCloseIssueModal={() => undefined}
              onSelectIssueInstance={() => undefined}
              onIssueCredential={() => undefined}
              onRotateCredential={() => undefined}
              onCopyCredentialField={() => undefined}
            />
          )}
        />
      </Routes>
    </MemoryRouter>,
  );

  assert.match(html, /Workspace de integrações/);
  assert.match(html, /Credenciais e operação em um fluxo enxuto/);
  assert.match(html, /Credenciais/);
  assert.match(html, /Operação/);
  assert.match(html, /Atualizar operação/);
  assert.match(html, /Abrir documentação/);
  assert.match(html, /href="\/integracoes\/documentacao"/);
  assert.match(html, /Auditoria global/);
  assert.match(html, /Sem registros na auditoria global/);
  assert.doesNotMatch(html, /Instâncias monitoradas/);
  assert.doesNotMatch(html, />Documentação<\/h2>/);
  assert.doesNotMatch(html, /Página própria de documentação disponível no painel/);
  assert.doesNotMatch(html, /docs\/integrations\/nexuszap-plugin-api\.md/);
  assert.equal(EMPTY_INTEGRATIONS.documentation.path, INTEGRATION_DOCUMENTATION_ROUTE);
});

test("dashboard no longer embeds the integration workspace directly", () => {
  const dashboardSource = fs.readFileSync(path.resolve(import.meta.dirname, "../src/pages/Dashboard.tsx"), "utf8");
  assert.doesNotMatch(dashboardSource, /Integrações operacionais/);
});
