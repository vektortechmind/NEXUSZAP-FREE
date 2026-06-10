import { useState } from "react";
import { isAxiosError } from "axios";
import { useAuth } from "../contexts/AuthContext";
import { AlertCircle, Lock, Mail } from "lucide-react";
import { Navigate } from "react-router-dom";
import { APP_VERSION } from "../version";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { InlineAlert } from "../components/ui/InlineAlert";
import { ThemeToggle } from "../components/ThemeToggle";
import { BrandLogo } from "../components/BrandLogo";

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

  return (
    <div className="min-h-screen w-full bg-[var(--nexus-bg)] text-[var(--nexus-text)]">
      <div className="fixed right-4 top-4 z-20">
        <ThemeToggle />
      </div>

      <main className="mx-auto flex min-h-screen w-full max-w-7xl items-center justify-center px-4 py-20 sm:px-6 lg:px-8">
        <section className="flex w-full items-center justify-center" aria-labelledby="login-title">
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
            <div className="mb-8 text-center">
              <BrandLogo className="mx-auto mb-7 h-20 w-auto max-w-[360px] object-contain sm:h-24 sm:max-w-[410px]" />
              <h2 id="login-title" className="text-2xl font-semibold tracking-normal text-slate-950 dark:text-slate-50">
                Entrar no painel
              </h2>
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

            <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-500">
              NexusZAP v{APP_VERSION}
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
