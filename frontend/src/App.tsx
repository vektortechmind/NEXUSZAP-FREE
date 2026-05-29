import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ToastProvider } from "./contexts/ToastContext";
import { Login } from "./pages/Login";
import { Instancia } from "./pages/Instancia";
import { Agente } from "./pages/Agente";
import { Apis } from "./pages/Apis";
import { Dashboard } from "./pages/Dashboard";
import { DockerSetup } from "./pages/DockerSetup";
import { CreateAdmin } from "./pages/CreateAdmin";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { ThemeProvider } from "./contexts/ThemeProvider";
import { AppShell } from "./components/ui/AppShell";
import { Button } from "./components/ui/Button";
import { InlineAlert } from "./components/ui/InlineAlert";

/** Layout único para rotas autenticadas — evita remontar Sidebar/Header a cada troca de página. */
const PrivateRoute = () => {
  const { user, loading, error } = useAuth();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setMobileSidebarOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!mobileSidebarOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileSidebarOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileSidebarOpen]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[var(--nexus-bg)]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 rounded-full border-2 border-slate-300 border-t-emerald-600 motion-safe:animate-spin dark:border-slate-700 dark:border-t-emerald-400" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Validando sessão...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[var(--nexus-bg)] p-4">
        <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <InlineAlert tone="danger" icon={<AlertTriangle size={18} />} title="Erro de conexão">
            {error}
          </InlineAlert>
          <div className="mt-5 space-y-2 text-sm text-slate-600 dark:text-slate-400">
            <p className="font-semibold text-slate-900 dark:text-slate-100">Verificações rápidas</p>
            <ol className="list-inside list-decimal space-y-1">
              <li>Confirme se a stack Docker está rodando na VPS.</li>
              <li>Verifique o container <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono dark:bg-slate-800">nexus-backend</code>.</li>
              <li>Confira se o domínio informado no setup aponta para esta VPS.</li>
            </ol>
          </div>
          <Button onClick={() => window.location.reload()} className="mt-5 w-full" variant="danger">
            Recarregar página
          </Button>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <AppShell
      sidebar={(
        <Sidebar
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
        />
      )}
      header={<Header onOpenMobileSidebar={() => setMobileSidebarOpen(true)} />}
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <Outlet />
      </div>
    </AppShell>
  );
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/docker-setup" element={<DockerSetup />} />
      <Route path="/criar-admin" element={<CreateAdmin />} />
      <Route path="/agent" element={<Navigate to="/agente" replace />} />
      <Route element={<PrivateRoute />}>
        <Route index element={<Instancia />} />
        <Route path="agente" element={<Agente />} />
        <Route path="telegram" element={<Navigate to="/agente" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="settings" element={<Apis />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
