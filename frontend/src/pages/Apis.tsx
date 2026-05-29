import type React from "react";
import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { api, apiLong } from "../lib/axios";
import { AlertCircle, BookOpen, Check, Layers, RefreshCw, Save, Search, Shield, Wifi } from "lucide-react";
import { UpdateSection } from "../components/UpdateSection";
import { Button } from "../components/ui/Button";
import { DataTable, DataTableCell, DataTableHeadCell, DataTableHeader } from "../components/ui/DataTable";
import { EmptyState } from "../components/ui/EmptyState";
import { InlineAlert } from "../components/ui/InlineAlert";
import { Panel } from "../components/ui/Panel";
import { Section } from "../components/ui/Section";
import { Skeleton } from "../components/ui/Skeleton";
import { StatusDot } from "../components/ui/StatusDot";
import { Tabs } from "../components/ui/Tabs";
import { Toolbar } from "../components/ui/Toolbar";
import { useToast } from "../contexts/ToastContext";
import {
  buildConfigSavePayload,
  configuredLabel,
  labelForHealth,
  providers,
  toneForHealth,
  usdPerMillionTokens,
} from "../features/settings/providerSettings";
import type { AgentConfig, ProviderHealth, ProviderId } from "../features/settings/providerSettings";
import { useOpenRouterModels } from "../features/settings/useOpenRouterModels";

function ApiSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <Skeleton className="h-16" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_25rem]">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    </div>
  );
}

export function Apis() {
  const [cfg, setCfg] = useState<AgentConfig | null>(null);
  const [health, setHealth] = useState<ProviderHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<ProviderId>("gemini");
  const { addToast } = useToast();

  const load = useCallback(async () => {
    try {
      const res = await api.get<AgentConfig>("/agent/config");
      const data = res.data;
      setCfg({
        ...data,
        geminiKey: null,
        groqKey: null,
        groqAudioKey: null,
        openrouterKey: null,
        openrouterModel: data.openrouterModel ?? null,
      });
      setError(null);
    } catch (err) {
      setError("Não foi possível carregar a configuração");
      console.error(err);
    }
  }, []);

  const test = useCallback(async () => {
    setTesting(true);
    setHealthError(null);
    try {
      const res = await apiLong.get<ProviderHealth>("/agent/providers-health");
      setHealth(res.data);
    } catch (err) {
      setHealthError("Não foi possível testar os provedores (timeout ou rede)");
      console.error(err);
    } finally {
      setTesting(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await load();
      setLoading(false);
      void test();
    };
    void init();
  }, [load, test]);

  const {
    modelTab,
    setModelTab,
    modelSearch,
    setModelSearch,
    models: orModels,
    loading: orLoading,
    error: orError,
    listedModels,
    idSet: orIdSet,
    refreshModels,
  } = useOpenRouterModels(cfg?.openrouterKey);

  const selectedMeta = providers.find((provider) => provider.id === selectedProvider) ?? providers[0];
  const selectedHealth = health?.results?.find((result) => result.provider === selectedProvider) ?? null;
  const configuredCount = providers.filter((provider) => configuredLabel(cfg ?? ({} as AgentConfig), provider.field)).length;
  const onlineCount = health?.results?.filter((result) => result.configured && result.ok).length ?? 0;

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!cfg) return;
    setSaving(true);
    try {
      await api.put("/agent/config", buildConfigSavePayload(cfg));
      addToast("Configurações salvas com sucesso", "success");
      await load();
      await test();
    } catch (err) {
      let msg = "Erro ao salvar configurações";
      if (axios.isAxiosError(err) && err.response?.data) {
        const data = err.response.data as { error?: string; message?: string };
        msg = data.error || data.message || msg;
      }
      addToast(msg, "error");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <ApiSkeleton />;

  if (error || !cfg) {
    return (
      <InlineAlert tone="danger" icon={<AlertCircle size={18} aria-hidden="true" />} title="Erro ao carregar configurações">
        <div className="space-y-3">
          <p>{error || "Dados não disponíveis"}</p>
          <Button variant="secondary" size="sm" onClick={() => { setLoading(true); void load().finally(() => setLoading(false)); }}>Tente novamente</Button>
        </div>
      </InlineAlert>
    );
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <Toolbar aria-label="Ações de configuração">
        <div className="flex w-full flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
              <StatusDot tone={onlineCount > 0 ? "success" : "warning"} pulse={onlineCount > 0} />
              {onlineCount} provedores online
            </span>
            <span>{configuredCount} chaves salvas</span>
            <span>Preferencial: {cfg.chatProvider || "não definido"}</span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" variant="secondary" onClick={() => void test()} disabled={testing} loading={testing} className="w-full sm:w-auto">
              <Wifi className="mr-2 h-4 w-4" aria-hidden="true" />
              Testar provedores
            </Button>
            <Button type="submit" disabled={saving} loading={saving} className="w-full sm:w-auto">
              <Save className="mr-2 h-4 w-4" aria-hidden="true" />
              Salvar configurações
            </Button>
            <Button type="button" variant="ghost" onClick={() => window.open("/guia-chaves-api.html", "_blank", "noopener,noreferrer")} className="w-full sm:w-auto">
              <BookOpen className="mr-2 h-4 w-4" aria-hidden="true" />
              Guia APIs
            </Button>
          </div>
        </div>
      </Toolbar>

      {healthError && <InlineAlert tone="warning" icon={<AlertCircle size={16} aria-hidden="true" />}>{healthError}</InlineAlert>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_25rem]">
        <Section title="Provedores IA" description="Status, chave salva, latência e seleção do provedor preferencial.">
          <DataTable caption="Provedores IA configurados">
            <DataTableHeader>
              <tr>
                <DataTableHeadCell>Provedor</DataTableHeadCell>
                <DataTableHeadCell className="hidden md:table-cell">Chave</DataTableHeadCell>
                <DataTableHeadCell>Status</DataTableHeadCell>
                <DataTableHeadCell className="text-right">Ação</DataTableHeadCell>
              </tr>
            </DataTableHeader>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {providers.map((provider) => {
                const result = health?.results?.find((item) => item.provider === provider.id) ?? null;
                const selected = provider.id === selectedProvider;
                const savedLabel = configuredLabel(cfg, provider.field);
                return (
                  <tr key={provider.id} className={selected ? "bg-emerald-50/60 dark:bg-emerald-950/20" : undefined}>
                    <DataTableCell>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-950 dark:text-slate-50">{provider.label}</p>
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{provider.description}</p>
                      </div>
                    </DataTableCell>
                    <DataTableCell className="hidden md:table-cell">
                      <span className="font-mono text-xs text-slate-600 dark:text-slate-400">{savedLabel || "Não salva"}</span>
                    </DataTableCell>
                    <DataTableCell>
                      <span className="inline-flex max-w-[11rem] items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
                        <StatusDot tone={toneForHealth(result)} pulse={Boolean(result?.configured && result.ok)} />
                        <span className="truncate">{labelForHealth(result)}</span>
                      </span>
                    </DataTableCell>
                    <DataTableCell className="text-right">
                      <Button type="button" variant={selected ? "primary" : "secondary"} size="sm" onClick={() => setSelectedProvider(provider.id)}>
                        Editar
                      </Button>
                    </DataTableCell>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
        </Section>

        <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <Section title="Detalhe do provedor" description="Edite a chave sem expor valores salvos.">
            <Panel className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-950 dark:text-slate-50">{selectedMeta.label}</h2>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{selectedMeta.description}</p>
                </div>
                <StatusDot tone={toneForHealth(selectedHealth)} pulse={Boolean(selectedHealth?.configured && selectedHealth.ok)} />
              </div>

              <div className="mt-4 space-y-4">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  <span className="mb-1.5 block">Chave API</span>
                  <input
                    type="password"
                    value={cfg[selectedMeta.field] ?? ""}
                    onChange={(event) => setCfg({ ...cfg, [selectedMeta.field]: event.target.value })}
                    placeholder={selectedMeta.placeholder}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-mono text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </label>
                <InlineAlert tone="info" icon={<Shield size={16} aria-hidden="true" />}>
                  Campo vazio mantém a chave já salva. Valor salvo: {configuredLabel(cfg, selectedMeta.field) || "nenhum"}.
                </InlineAlert>

                {selectedMeta.canBePreferred && (
                  <Button
                    type="button"
                    variant={cfg.chatProvider === selectedMeta.id ? "primary" : "secondary"}
                    onClick={() => setCfg({ ...cfg, chatProvider: selectedMeta.id })}
                    className="w-full"
                  >
                    <Check className="mr-2 h-4 w-4" aria-hidden="true" />
                    {cfg.chatProvider === selectedMeta.id ? "Provedor preferencial" : "Definir como preferencial"}
                  </Button>
                )}

                {selectedHealth?.error && (
                  <InlineAlert tone="danger" icon={<AlertCircle size={16} aria-hidden="true" />}>
                    {selectedHealth.error}
                  </InlineAlert>
                )}
              </div>
            </Panel>
          </Section>
        </aside>
      </div>

      <Section title="OpenRouter Models" description="Selecione o modelo principal e navegue pela lista retornada pela API.">
        <Panel className="space-y-4 p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              <span className="mb-1.5 block">Modelo usado no chat</span>
              <select
                value={cfg.openrouterModel ?? ""}
                onChange={(event) => setCfg({ ...cfg, openrouterModel: event.target.value === "" ? null : event.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="">Padrão interno (meta-llama/llama-3-8b-instruct:free)</option>
                {cfg.openrouterModel && orModels && !orIdSet.has(cfg.openrouterModel) && <option value={cfg.openrouterModel}>{cfg.openrouterModel} (salvo - não listado agora)</option>}
                {orModels && <optgroup label="Grátis">{orModels.free.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}</optgroup>}
                {orModels && <optgroup label="Pagos">{orModels.paid.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}</optgroup>}
              </select>
            </label>
            <Button type="button" variant="secondary" onClick={() => void refreshModels()} disabled={orLoading || (cfg.openrouterKey?.trim().length ?? 0) < 12} loading={orLoading} className="w-full lg:w-auto">
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              Atualizar modelos
            </Button>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <Tabs
              ariaLabel="Filtro de modelos OpenRouter"
              value={modelTab}
              onChange={setModelTab}
              items={[
                { value: "free", label: `Grátis ${orModels?.totalFree ?? 0}` },
                { value: "paid", label: `Pagos ${orModels?.totalPaid ?? 0}` },
              ]}
            />
            <label className="relative block text-sm font-medium text-slate-700 dark:text-slate-300 lg:w-80">
              <span className="sr-only">Buscar modelo</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                value={modelSearch}
                onChange={(event) => setModelSearch(event.target.value)}
                placeholder="Buscar modelo"
                className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </label>
          </div>

          {orError && <InlineAlert tone="danger" icon={<AlertCircle size={16} aria-hidden="true" />}>{orError}</InlineAlert>}
          {!orModels && !orLoading && !orError && (
            <EmptyState icon={<Layers size={22} aria-hidden="true" />} title="Informe uma nova chave OpenRouter" description="Por segurança, chaves salvas não são retornadas ao frontend. Digite uma chave para listar modelos agora." />
          )}
          {orLoading && <Skeleton className="h-64" />}
          {orModels && !orLoading && (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {listedModels.map((model) => (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => setCfg({ ...cfg, openrouterModel: model.id })}
                  className={`min-w-0 rounded-lg border p-3 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${cfg.openrouterModel === model.id ? "border-emerald-400 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/25" : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"}`}
                >
                  <p className="truncate text-sm font-semibold text-slate-950 dark:text-slate-50">{model.name}</p>
                  <p className="mt-1 break-all font-mono text-[11px] text-slate-600 dark:text-slate-400">{model.id}</p>
                  <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">Prompt {usdPerMillionTokens(model.pricingPrompt)} · Conclusão {usdPerMillionTokens(model.pricingCompletion)}</p>
                </button>
              ))}
              {listedModels.length === 0 && <EmptyState title="Nenhum modelo encontrado" description="Ajuste a busca ou alterne entre modelos grátis e pagos." className="md:col-span-2 xl:col-span-3" />}
            </div>
          )}
        </Panel>
      </Section>

      <UpdateSection />
    </form>
  );
}

