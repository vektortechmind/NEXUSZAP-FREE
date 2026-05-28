import { useMemo, useState } from "react";
import { isAxiosError } from "axios";
import { CheckCircle2, KeyRound, Lock, Mail, ShieldCheck, UserPlus } from "lucide-react";
import { api } from "../lib/axios";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { InlineAlert } from "../components/ui/InlineAlert";
import { ThemeToggle } from "../components/ThemeToggle";

function apiError(err: unknown): string {
  if (!isAxiosError(err)) return "Não foi possível criar o administrador.";
  return (err.response?.data as { error?: string } | undefined)?.error ?? "Não foi possível criar o administrador.";
}

export function CreateAdmin() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const token = params.get("token") ?? "";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api.post("/setup/admin", { email, password, confirmPassword, token });
      setDone(true);
    } catch (err) {
      setError(apiError(err));
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
            <UserPlus size={28} aria-hidden="true" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Primeiro acesso</p>
          <h1 className="mt-3 max-w-2xl text-4xl font-semibold leading-tight text-slate-950 dark:text-slate-50 sm:text-5xl">
            Crie o administrador principal.
          </h1>
          <p className="mt-5 max-w-xl text-base text-slate-600 dark:text-slate-400">
            Essa etapa substitui a credencial temporária gerada na instalação e bloqueia nova criação pública.
          </p>
          <div className="mt-10 flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
            <ShieldCheck size={18} className="text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
            <span>Use uma senha forte com maiúscula, minúscula, número e símbolo.</span>
          </div>
        </section>

        <section className="flex items-center" aria-labelledby="create-admin-title">
          <div className="w-full rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
            <div className="mb-6">
              <h2 id="create-admin-title" className="text-2xl font-semibold text-slate-950 dark:text-slate-50">Criar admin</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Defina o email e a senha usados no login do painel.</p>
            </div>

            {!token && (
              <InlineAlert tone="warning" icon={<KeyRound size={18} />} title="Token ausente">
                Abra a URL completa exibida no terminal da instalação.
              </InlineAlert>
            )}

            {error && <InlineAlert className="mt-4" tone="danger" title="Falha ao criar admin">{error}</InlineAlert>}
            {done && (
              <InlineAlert className="mt-4" tone="success" icon={<CheckCircle2 size={18} />} title="Administrador criado">
                <a className="font-semibold underline underline-offset-4" href="/login">Entrar no painel</a>
              </InlineAlert>
            )}

            <form onSubmit={submit} className="mt-6 space-y-5">
              <Input label="Email do administrador" type="email" placeholder="admin@seudominio.com" icon={<Mail size={18} />} value={email} onChange={(event) => setEmail(event.target.value)} disabled={loading || done} required />
              <Input label="Senha" type="password" placeholder="Mínimo 12 caracteres" icon={<Lock size={18} />} value={password} onChange={(event) => setPassword(event.target.value)} disabled={loading || done} required />
              <Input label="Confirmar senha" type="password" placeholder="Repita a senha" icon={<Lock size={18} />} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} disabled={loading || done} required />
              <Button type="submit" size="lg" className="w-full" loading={loading} disabled={!token || done}>
                Criar administrador
              </Button>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}
