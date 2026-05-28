import { useMemo, useState } from "react";
import { isAxiosError } from "axios";
import { ArrowRight, CheckCircle2, Globe2, KeyRound, ServerCog } from "lucide-react";
import { api } from "../lib/axios";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { InlineAlert } from "../components/ui/InlineAlert";
import { ThemeToggle } from "../components/ThemeToggle";

function apiError(err: unknown, fallback: string): string {
  if (!isAxiosError(err)) return fallback;
  return (err.response?.data as { error?: string } | undefined)?.error ?? fallback;
}

export function DockerSetup() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const token = params.get("token") ?? "";
  const [domain, setDomain] = useState("");
  const [nextUrl, setNextUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setNextUrl("");
    try {
      const res = await api.post<{ nextUrl: string }>("/setup/docker", { domain, token });
      setNextUrl(res.data.nextUrl);
    } catch (err) {
      setError(apiError(err, "Não foi possível salvar a configuração."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--nexus-bg)] text-[var(--nexus-text)]">
      <div className="fixed right-4 top-4 z-20"><ThemeToggle /></div>
      <main className="mx-auto grid min-h-screen max-w-6xl grid-cols-1 gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(24rem,28rem)] lg:px-8">
        <section className="flex flex-col justify-center">
          <div className="mb-8 inline-flex h-14 w-14 items-center justify-center rounded-lg bg-emerald-600 text-white dark:bg-emerald-500 dark:text-slate-950">
            <ServerCog size={28} aria-hidden="true" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Configuração inicial</p>
          <h1 className="mt-3 max-w-2xl text-4xl font-semibold leading-tight text-slate-950 dark:text-slate-50 sm:text-5xl">
            Conecte o Docker ao domínio público.
          </h1>
          <p className="mt-5 max-w-xl text-base text-slate-600 dark:text-slate-400">
            Informe o domínio que vai abrir o painel. O instalador ajusta `APP_URL`, origens permitidas e prepara o próximo passo do administrador.
          </p>
          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            {["APP_URL", "CORS", "Admin"].map((item) => (
              <div key={item} className="border-t border-slate-200 pt-4 dark:border-slate-800">
                <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">{item}</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Preparado para produção</p>
              </div>
            ))}
          </div>
        </section>

        <section className="flex items-center" aria-labelledby="docker-setup-title">
          <div className="w-full rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
            <div className="mb-6">
              <h2 id="docker-setup-title" className="text-2xl font-semibold text-slate-950 dark:text-slate-50">Docker setup</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Use `seudominio.com` ou `https://seudominio.com`.</p>
            </div>

            {!token && (
              <InlineAlert tone="warning" icon={<KeyRound size={18} />} title="Token ausente">
                Abra a URL completa exibida no terminal da instalação.
              </InlineAlert>
            )}

            {error && <InlineAlert className="mt-4" tone="danger" title="Falha ao salvar">{error}</InlineAlert>}
            {nextUrl && (
              <InlineAlert className="mt-4" tone="success" icon={<CheckCircle2 size={18} />} title="Domínio salvo">
                <a className="font-semibold underline underline-offset-4" href={nextUrl}>Continuar para criar administrador</a>
              </InlineAlert>
            )}

            <form onSubmit={submit} className="mt-6 space-y-5">
              <Input
                label="Domínio público"
                placeholder="seudominio.com"
                icon={<Globe2 size={18} />}
                value={domain}
                onChange={(event) => setDomain(event.target.value)}
                disabled={loading}
                required
              />
              <Button type="submit" size="lg" className="w-full" loading={loading} disabled={!token}>
                Salvar e continuar <ArrowRight className="ml-2" size={18} aria-hidden="true" />
              </Button>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}
