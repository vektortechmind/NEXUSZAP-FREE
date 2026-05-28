import { useState } from "react";
import { isAxiosError } from "axios";
import { useAuth } from "../contexts/AuthContext";
import { AlertCircle, Bot, Database, Lock, Mail, MessageCircle, ShieldCheck } from "lucide-react";
import { Navigate } from "react-router-dom";
import { APP_VERSION } from "../version";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { InlineAlert } from "../components/ui/InlineAlert";
import { ThemeToggle } from "../components/ThemeToggle";

function loginErrorMessage(err: unknown): string {
  if (!isAxiosError(err)) {
    return "Erro inesperado ao entrar. Tente de novo.";
  }
  const status = err.response?.status;
  const serverMsg = err.response?.data as { error?: string } | undefined;

  if (status === 401) {
    return "Email ou senha incorretos.";
  }
  if (status === 400) {
    return "Dados inválidos. Verifique o formato do email.";
  }
  if (status === 429) {
    return "Muitas tentativas. Aguarde 1 minuto.";
  }

  if (!err.response) {
    const code = err.code;
    if (code === "ECONNREFUSED" || code === "ERR_NETWORK") {
      return "Não conseguiu conectar ao servidor. Verifique se o backend está rodando.";
    }
  }

  return serverMsg?.error ?? "Erro ao fazer login. Tente novamente.";
}

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, user } = useAuth();

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(email, password);
    } catch (err: unknown) {
      setError(loginErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const productSignals = [
    {
      icon: <MessageCircle size={18} aria-hidden="true" />,
      label: "Canais conectados",
      value: "WhatsApp e Telegram",
    },
    {
      icon: <Bot size={18} aria-hidden="true" />,
      label: "Atendimento com IA",
      value: "Agente configurável",
    },
    {
      icon: <Database size={18} aria-hidden="true" />,
      label: "Base protegida",
      value: "Conhecimento e chaves seguras",
    },
  ];

  return (
    <div className="min-h-screen w-full bg-[var(--nexus-bg)] text-[var(--nexus-text)]">
      <div className="fixed right-4 top-4 z-20">
        <ThemeToggle />
      </div>

      <main className="mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(26rem,30rem)] lg:gap-16 lg:px-8">
        <section className="order-2 flex flex-col justify-center border-t border-slate-200 pt-10 dark:border-slate-800 lg:order-1 lg:border-t-0 lg:pt-0">
          <div className="max-w-2xl">
            <div className="mb-8 inline-flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-600 text-white dark:bg-emerald-500 dark:text-slate-950">
                <Bot size={20} aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">NexusZAP</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">Command Center</p>
              </div>
            </div>

            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
              Operação com IA
            </p>
            <h1 className="max-w-xl text-4xl font-semibold leading-tight tracking-normal text-slate-950 dark:text-slate-50 sm:text-5xl">
              Painel seguro para operar atendimento automatizado.
            </h1>
            <p className="mt-5 max-w-xl text-base text-slate-600 dark:text-slate-400">
              Controle conexões, provedores de IA e base de conhecimento em uma superfície única, focada em operação diária.
            </p>

            <div className="mt-10 grid gap-3 sm:grid-cols-3 lg:max-w-3xl">
              {productSignals.map((item) => (
                <div key={item.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="mb-3 inline-flex rounded-md bg-slate-100 p-2 text-emerald-700 dark:bg-slate-800 dark:text-emerald-400">
                    {item.icon}
                  </div>
                  <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">{item.label}</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-10 flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
              <ShieldCheck size={18} className="text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
              <span>Autenticação protegida e sessão validada pelo backend.</span>
            </div>
          </div>
        </section>

        <section className="order-1 flex items-center justify-center pb-10 lg:order-2 lg:pb-0" aria-labelledby="login-title">
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
            <div className="mb-8">
              <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-600 text-white dark:bg-emerald-500 dark:text-slate-950">
                <ShieldCheck size={24} aria-hidden="true" />
              </div>
              <h2 id="login-title" className="text-2xl font-semibold tracking-normal text-slate-950 dark:text-slate-50">
                Entrar no painel
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Use suas credenciais administrativas para acessar o NexusZAP.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <InlineAlert tone="danger" icon={<AlertCircle size={18} aria-hidden="true" />} title="Não foi possível entrar">
                {error}
              </InlineAlert>
            )}

            <Input
              label="Email"
              id="login-email"
              type="email"
              placeholder="admin@seudominio.com"
              icon={<Mail size={18} />}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              autoComplete="email"
              autoFocus
              required
            />

            <Input
              label="Senha"
              id="login-password"
              type="password"
              placeholder="••••••••"
              icon={<Lock size={18} />}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoComplete="current-password"
              required
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              loading={loading}
            >
              Entrar
            </Button>
          </form>

            <div className="mt-8 border-t border-slate-200 pt-5 dark:border-slate-800">
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                O acesso é restrito a administradores. As chaves de IA e tokens permanecem protegidos no servidor.
              </p>
            </div>

            <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-500">
              NexusZAP v{APP_VERSION}
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
