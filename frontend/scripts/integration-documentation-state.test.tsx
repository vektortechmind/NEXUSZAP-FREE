import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { IntegracoesDocumentacao } from "../src/pages/IntegracoesDocumentacao.tsx";

globalThis.React = React;

test("integration documentation route renders the public contract without local repository paths", () => {
  const html = renderToStaticMarkup(
    <MemoryRouter initialEntries={["/integracoes/documentacao"]}>
      <Routes>
        <Route path="/integracoes/documentacao" element={<IntegracoesDocumentacao />} />
      </Routes>
    </MemoryRouter>,
  );

  assert.match(html, /Contrato operacional do endpoint público de integrações/);
  assert.match(html, /Voltar para integrações/);
  assert.match(html, /instanceId/);
  assert.match(html, /secretToken/);
  assert.match(html, /Credenciais/);
  assert.match(html, /Authorization: Bearer/);
  assert.match(html, /\/api\/integrations\/events/);
  assert.match(html, /pedido_pago/);
  assert.match(html, /INTEGRATION_REPLAY_WINDOW_VIOLATION/);
  assert.doesNotMatch(html, /docs\/integrations\/nexuszap-plugin-api\.md/);
});
