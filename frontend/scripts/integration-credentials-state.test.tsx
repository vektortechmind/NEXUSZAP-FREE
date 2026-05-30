import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  EMPTY_INTEGRATION_CREDENTIALS_WORKSPACE,
  formatCredentialSurfaceStatus,
  getCredentialPrimaryAction,
  getCredentialSecretLabel,
  getIssuableCredentialInstances,
} from "../src/features/integrations/credentials.ts";
import { IntegrationCredentialsSection } from "../src/features/integrations/IntegrationCredentialsSection.tsx";

const workspace = {
  endpointUrl: "https://painel.exemplo.com/api/integrations/events",
  instances: [
    {
      instanceId: "instance-a",
      instanceName: "Vendas",
      instanceSlot: 1,
      instanceStatus: "CONNECTED",
      credentialStatus: "ACTIVE" as const,
      tokenPreview: "nz_live_abc***",
    },
    {
      instanceId: "instance-b",
      instanceName: "Suporte",
      instanceSlot: 2,
      instanceStatus: "DISCONNECTED",
      credentialStatus: "MISSING" as const,
      tokenPreview: null,
    },
  ],
};

const activeDetail = {
  instanceId: "instance-a",
  instanceName: "Vendas",
  instanceSlot: 1,
  instanceStatus: "CONNECTED",
  endpointUrl: "https://painel.exemplo.com/api/integrations/events",
  credentialStatus: "ACTIVE" as const,
  tokenPreview: "nz_live_abc***",
  secretToken: null,
  replayWindowMs: 300000,
  dedupWindowMs: 300000,
  issuedAt: "2026-05-29T11:00:00.000Z",
  lastUsedAt: "2026-05-29T11:30:00.000Z",
  rotatedAt: null,
  revokedAt: null,
};

const missingDetail = {
  instanceId: "instance-b",
  instanceName: "Suporte",
  instanceSlot: 2,
  instanceStatus: "DISCONNECTED",
  endpointUrl: "https://painel.exemplo.com/api/integrations/events",
  credentialStatus: "MISSING" as const,
  tokenPreview: null,
  secretToken: null,
  replayWindowMs: 300000,
  dedupWindowMs: 300000,
  issuedAt: null,
  lastUsedAt: null,
  rotatedAt: null,
  revokedAt: null,
};

test("credential helpers keep labels, issue eligibility and token disclosure rules stable", () => {
  assert.equal(formatCredentialSurfaceStatus("ACTIVE"), "Ativa");
  assert.equal(formatCredentialSurfaceStatus("MISSING"), "Ausente");
  assert.deepEqual(getCredentialPrimaryAction("ACTIVE"), {
    kind: "rotate",
    label: "Rotacionar secretToken",
    helper: "A rotação invalida imediatamente o token anterior desta instância.",
  });
  assert.equal(getCredentialPrimaryAction("DISABLED").kind, "issue");
  assert.deepEqual(getIssuableCredentialInstances(workspace).map((item) => item.instanceId), ["instance-b"]);
  assert.equal(getCredentialSecretLabel(activeDetail), "Disponível somente após emissão ou rotação.");
});

test("credentials section renders compact cards and lazy detail without revealing the full token on initial active detail", () => {
  const html = renderToStaticMarkup(
    <IntegrationCredentialsSection
      workspace={workspace}
      expandedInstanceId="instance-a"
      detail={activeDetail}
      issueModalOpen={false}
      issueModalInstanceId={null}
      loadingWorkspace={false}
      loadingDetail={false}
      actionLoading={null}
      onToggleInstance={() => undefined}
      onOpenIssueModal={() => undefined}
      onCloseIssueModal={() => undefined}
      onSelectIssueInstance={() => undefined}
      onIssueCredential={() => undefined}
      onRotateCredential={() => undefined}
      onCopyField={() => undefined}
    />,
  );

  assert.match(html, /Criar credencial/);
  assert.match(html, /Vendas/);
  assert.match(html, /Suporte/);
  assert.match(html, /Ver detalhes|Ocultar detalhes/);
  assert.match(html, /https:\/\/painel\.exemplo\.com\/api\/integrations\/events/);
  assert.match(html, /Disponível somente após emissão ou rotação\./);
  assert.doesNotMatch(html, /nz_live_secret_123/);
  assert.match(html, /Rotacionar secretToken/);
});

test("credentials section exposes creation modal and discreet missing-credential state inside the selected card", () => {
  const html = renderToStaticMarkup(
    <IntegrationCredentialsSection
      workspace={workspace}
      expandedInstanceId="instance-b"
      detail={missingDetail}
      issueModalOpen={true}
      issueModalInstanceId="instance-b"
      loadingWorkspace={false}
      loadingDetail={false}
      actionLoading={null}
      onToggleInstance={() => undefined}
      onOpenIssueModal={() => undefined}
      onCloseIssueModal={() => undefined}
      onSelectIssueInstance={() => undefined}
      onIssueCredential={() => undefined}
      onRotateCredential={() => undefined}
      onCopyField={() => undefined}
    />,
  );

  assert.match(html, /Criar credencial/);
  assert.match(html, /Emitir credencial/);
  assert.match(html, /Sem credencial ativa/);
  assert.match(html, /Emita uma credencial para liberar o secretToken\./);
  assert.match(html, /Gerar secretToken/);
});

test("credentials section shows the token only after an explicit issue or rotate response", () => {
  const html = renderToStaticMarkup(
    <IntegrationCredentialsSection
      workspace={workspace}
      expandedInstanceId="instance-a"
      detail={{ ...activeDetail, secretToken: "nz_live_secret_rotated" }}
      issueModalOpen={false}
      issueModalInstanceId={null}
      loadingWorkspace={false}
      loadingDetail={false}
      actionLoading={null}
      onToggleInstance={() => undefined}
      onOpenIssueModal={() => undefined}
      onCloseIssueModal={() => undefined}
      onSelectIssueInstance={() => undefined}
      onIssueCredential={() => undefined}
      onRotateCredential={() => undefined}
      onCopyField={() => undefined}
    />,
  );

  assert.match(html, /nz_live_secret_rotated/);
});

test("credentials section exposes empty state when there are no eligible instances", () => {
  const html = renderToStaticMarkup(
    <IntegrationCredentialsSection
      workspace={EMPTY_INTEGRATION_CREDENTIALS_WORKSPACE}
      expandedInstanceId={null}
      detail={null}
      issueModalOpen={false}
      issueModalInstanceId={null}
      loadingWorkspace={false}
      loadingDetail={false}
      actionLoading={null}
      onToggleInstance={() => undefined}
      onOpenIssueModal={() => undefined}
      onCloseIssueModal={() => undefined}
      onSelectIssueInstance={() => undefined}
      onIssueCredential={() => undefined}
      onRotateCredential={() => undefined}
      onCopyField={() => undefined}
    />,
  );

  assert.match(html, /Nenhuma instância elegível/);
});
