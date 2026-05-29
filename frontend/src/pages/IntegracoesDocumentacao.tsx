import { ArrowLeft, BookOpenText, Cable, KeyRound } from "lucide-react";
import { Link } from "react-router-dom";
import { Panel } from "../components/ui/Panel";
import { Section } from "../components/ui/Section";
import {
  INTEGRATION_CREDENTIAL_FIELDS,
  INTEGRATION_CURL_EXAMPLE,
  INTEGRATION_ENDPOINT_PATH,
  INTEGRATION_ENDPOINT_URL_EXAMPLE,
  INTEGRATION_PAYLOAD_FIELDS,
  INTEGRATION_PHONE_FIELD_PRIORITY,
  INTEGRATION_REQUEST_EXAMPLE,
  INTEGRATION_RESPONSE_CODES,
  INTEGRATION_SUPPORTED_EVENTS,
  INTEGRATION_SUPPORTED_MESSAGE_TYPES,
  INTEGRATION_TROUBLESHOOTING,
} from "../features/integrations/integrationDocumentationContent";

const docsButtonClassName = "inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800";

function CodeBlock({ code, language }: { code: string; language: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-sm dark:border-slate-800">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
        <span>{language}</span>
        <span>Copiável</span>
      </div>
      <pre className="overflow-x-auto p-4 text-sm leading-6 text-slate-100"><code>{code}</code></pre>
    </div>
  );
}

export function IntegracoesDocumentacao() {
  return (
    <div className="space-y-8">
      <Panel className="overflow-hidden rounded-3xl border-emerald-200 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_45%),linear-gradient(135deg,_rgba(255,255,255,0.98),_rgba(240,253,244,0.92))] p-6 shadow-[0_30px_80px_-45px_rgba(16,185,129,0.55)] dark:border-emerald-900/70 dark:bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_35%),linear-gradient(135deg,_rgba(2,6,23,0.98),_rgba(3,15,10,0.96))] sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-4xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">Documentação técnica da integração</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50 sm:text-4xl">Contrato operacional do endpoint público de integrações</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-700 dark:text-slate-300">Use esta página para integrar sistemas externos ao endpoint real do NexusZAP. O fluxo correto é: selecionar a instância, abrir a seção <strong>Credenciais</strong>, copiar <code className="rounded bg-white/80 px-1.5 py-0.5 font-mono text-xs dark:bg-slate-900/80">instanceId</code>, <code className="rounded bg-white/80 px-1.5 py-0.5 font-mono text-xs dark:bg-slate-900/80">endpointUrl</code> e emitir ou rotacionar o <code className="rounded bg-white/80 px-1.5 py-0.5 font-mono text-xs dark:bg-slate-900/80">secretToken</code> antes de configurar o sistema externo.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-stretch">
            <Link to="/integracoes" className={docsButtonClassName}>
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              Voltar para integrações
            </Link>
            <a href="#documentacao" className={docsButtonClassName}>
              <BookOpenText className="mr-2 h-4 w-4" aria-hidden="true" />
              Ir para resumo
            </a>
          </div>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          <Panel tone="accent" className="p-5">
            <div className="flex items-center gap-3 text-emerald-800 dark:text-emerald-300">
              <Cable className="h-5 w-5" aria-hidden="true" />
              <p className="text-sm font-semibold uppercase tracking-wide">Endpoint</p>
            </div>
            <p className="mt-3 break-all font-mono text-sm text-slate-900 dark:text-slate-50">{INTEGRATION_ENDPOINT_URL_EXAMPLE}</p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">O caminho público final já inclui <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs dark:bg-slate-900">{INTEGRATION_ENDPOINT_PATH}</code>.</p>
          </Panel>
          <Panel className="p-5">
            <div className="flex items-center gap-3 text-slate-900 dark:text-slate-50">
              <KeyRound className="h-5 w-5" aria-hidden="true" />
              <p className="text-sm font-semibold uppercase tracking-wide">Credenciais</p>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400"><code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs dark:bg-slate-800">instanceId</code> e <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs dark:bg-slate-800">secretToken</code> são obtidos na seção <strong>Credenciais</strong> da própria área de integrações. Não dependem de arquivo local nem de acesso ao repositório.</p>
          </Panel>
          <Panel className="p-5">
            <div className="flex items-center gap-3 text-slate-900 dark:text-slate-50">
              <BookOpenText className="h-5 w-5" aria-hidden="true" />
              <p className="text-sm font-semibold uppercase tracking-wide">Mensageria</p>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">Os templates padrão desta fase trabalham com <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs dark:bg-slate-800">text</code>, <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs dark:bg-slate-800">link</code> e <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs dark:bg-slate-800">document</code>.</p>
          </Panel>
        </div>
      </Panel>

      <Section id="documentacao" title="Visão geral e pré-requisitos" description="Esta documentação reflete o endpoint real já implementado em /api/integrations/events e separa claramente Credenciais de Documentação.">
        <div className="grid gap-4 xl:grid-cols-2">
          <Panel className="p-5">
            <h2 className="text-base font-semibold text-slate-950 dark:text-slate-50">Antes de integrar</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
              <li>Selecione a instância correta na área de integrações.</li>
              <li>Abra <strong>Credenciais</strong> e copie <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs dark:bg-slate-800">endpointUrl</code> e <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs dark:bg-slate-800">instanceId</code>.</li>
              <li>Emita ou rotacione o <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs dark:bg-slate-800">secretToken</code> ativo na mesma seção.</li>
              <li>Garanta que o sistema externo envie <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs dark:bg-slate-800">POST</code> com <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs dark:bg-slate-800">Content-Type: application/json</code>.</li>
              <li>Sincronize o relógio do integrador porque o endpoint valida <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs dark:bg-slate-800">timestamp</code>.</li>
            </ul>
          </Panel>
          <Panel className="p-5">
            <h2 className="text-base font-semibold text-slate-950 dark:text-slate-50">Onde obter as credenciais</h2>
            <div className="mt-4 space-y-4 text-sm leading-6 text-slate-600 dark:text-slate-400">
              {INTEGRATION_CREDENTIAL_FIELDS.map((field) => (
                <div key={field.name} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/45">
                  <p className="font-mono text-sm font-semibold text-slate-950 dark:text-slate-50">{field.name}</p>
                  <p className="mt-1">{field.description}</p>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </Section>

      <Section title="Autenticação e request" description="Cada chamada é autenticada por Bearer token e validada contra a instância autorizada pela credencial.">
        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <Panel className="p-5">
              <h2 className="text-base font-semibold text-slate-950 dark:text-slate-50">Headers obrigatórios</h2>
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 font-mono text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-950/45 dark:text-slate-50">
                <p>Authorization: Bearer &lt;secretToken&gt;</p>
                <p>Content-Type: application/json</p>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">Se o <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs dark:bg-slate-800">instanceId</code> do body não pertencer à mesma credencial autenticada, a chamada é rejeitada.</p>
            </Panel>
            <CodeBlock language="json" code={INTEGRATION_REQUEST_EXAMPLE} />
            <CodeBlock language="bash" code={INTEGRATION_CURL_EXAMPLE} />
          </div>
          <Panel className="p-5">
            <h2 className="text-base font-semibold text-slate-950 dark:text-slate-50">Campos obrigatórios do body</h2>
            <div className="mt-4 space-y-3">
              {INTEGRATION_PAYLOAD_FIELDS.map((field) => (
                <div key={field.name} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/45">
                  <p className="font-mono text-sm font-semibold text-slate-950 dark:text-slate-50">{field.name}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">{field.description}</p>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </Section>

      <Section title="Eventos, payload e regras operacionais" description="O contrato aceita payload variável, mas apenas campos conhecidos entram no contexto normalizado oficial.">
        <div className="grid gap-4 xl:grid-cols-3">
          <Panel className="p-5 xl:col-span-2">
            <h2 className="text-base font-semibold text-slate-950 dark:text-slate-50">Eventos suportados</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {INTEGRATION_SUPPORTED_EVENTS.map((eventSlug) => (
                <span key={eventSlug} className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-mono text-xs font-semibold text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/35 dark:text-emerald-300">{eventSlug}</span>
              ))}
            </div>
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-950/45 dark:text-slate-400">
              <p className="font-semibold text-slate-950 dark:text-slate-50">Tipos de mensagem atuais</p>
              <p className="mt-2 font-mono text-xs text-slate-700 dark:text-slate-300">{INTEGRATION_SUPPORTED_MESSAGE_TYPES.join(" | ")}</p>
            </div>
          </Panel>
          <Panel className="p-5">
            <h2 className="text-base font-semibold text-slate-950 dark:text-slate-50">Normalização do destinatário</h2>
            <ol className="mt-4 space-y-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
              {INTEGRATION_PHONE_FIELD_PRIORITY.map((field, index) => (
                <li key={field}><span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">{index + 1}</span><code className="font-mono text-xs">{field}</code></li>
              ))}
            </ol>
            <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-400">A deduplicação é por credencial, a replay window atual é <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs dark:bg-slate-800">300000 ms</code> e o skew futuro tolerado é <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs dark:bg-slate-800">30000 ms</code>.</p>
          </Panel>
        </div>
      </Section>

      <Section title="Respostas HTTP previsíveis" description="Esses retornos ajudam a diagnosticar rapidamente falhas de contrato, autenticação, janela temporal e dispatch.">
        <Panel className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
              <thead className="bg-slate-50 dark:bg-slate-950/45">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-900 dark:text-slate-50">HTTP</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-900 dark:text-slate-50">Código</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-900 dark:text-slate-50">Significado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {INTEGRATION_RESPONSE_CODES.map((item) => (
                  <tr key={item.code}>
                    <td className="px-4 py-3 font-mono text-slate-900 dark:text-slate-50">{item.status}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">{item.code}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{item.meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </Section>

      <Section title="Troubleshooting técnico" description="Use estes pontos antes de concluir que o endpoint falhou; a maior parte dos erros vem de credencial, instância ou payload incorreto.">
        <div className="grid gap-4 xl:grid-cols-2">
          {INTEGRATION_TROUBLESHOOTING.map((item) => (
            <Panel key={item.title} className="p-5">
              <h2 className="text-base font-semibold text-slate-950 dark:text-slate-50">{item.title}</h2>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
                {item.steps.map((step) => <li key={step}>{step}</li>)}
              </ul>
            </Panel>
          ))}
        </div>
      </Section>
    </div>
  );
}
