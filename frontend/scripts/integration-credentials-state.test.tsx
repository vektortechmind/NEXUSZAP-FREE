import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  EMPTY_INTEGRATION_CREDENTIALS_WORKSPACE,
  formatCredentialSurfaceStatus,
  getCredentialPrimaryAction,
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

const detail = {
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

test("credential helpers keep labels and primary action stable", () => {
  assert.equal(formatCredentialSurfaceStatus("ACTIVE"), "Ativa");
  assert.equal(formatCredentialSurfaceStatus("MISSING"), "Ausente");
  assert.deepEqual(getCredentialPrimaryAction("ACTIVE"), {
    kind: "rotate",
    label: "Rotacionar secretToken",
    helper: "A rotação invalida imediatamente o token anterior desta instância.",
  });
  assert.equal(getCredentialPrimaryAction("DISABLED").kind, "issue");
});

test("credentials section renders selection, readonly fields and explicit rotation without revealing an existing token", () => {
  const html = renderToStaticMarkup(
    <IntegrationCredentialsSection
      workspace={workspace}
      selectedInstanceId="instance-a"
      detail={detail}
      loadingWorkspace={false}
      loadingDetail={false}
      actionLoading={null}
      onSelectInstance={() => undefined}
      onIssueCredential={() => undefined}
      onRotateCredential={() => undefined}
      onCopyField={() => undefined}
    />,
  );

  assert.match(html, /Instância/);
  assert.match(html, /instance-a/);
  assert.match(html, /https:\/\/painel\.exemplo\.com\/api\/integrations\/events/);
  assert.doesNotMatch(html, /nz_live_secret_123/);
  assert.match(html, /Nenhuma credencial ativa para esta instância\./);
  assert.match(html, /Copiar/);
  assert.match(html, /Rotacionar secretToken/);
});

test("credentials section shows the token only after an explicit issue or rotate response", () => {
  const html = renderToStaticMarkup(
    <IntegrationCredentialsSection
      workspace={workspace}
      selectedInstanceId="instance-a"
      detail={{ ...detail, secretToken: "nz_live_secret_rotated" }}
      loadingWorkspace={false}
      loadingDetail={false}
      actionLoading={null}
      onSelectInstance={() => undefined}
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
      selectedInstanceId={null}
      detail={null}
      loadingWorkspace={false}
      loadingDetail={false}
      actionLoading={null}
      onSelectInstance={() => undefined}
      onIssueCredential={() => undefined}
      onRotateCredential={() => undefined}
      onCopyField={() => undefined}
    />,
  );

  assert.match(html, /Nenhuma instância elegível/);
});
