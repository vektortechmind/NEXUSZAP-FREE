import { useState, type ReactNode } from "react";
import {
  Bot,
  Boxes,
  KeyRound,
  LogOut,
  MessageCircle,
  Moon,
  Smartphone,
  Sparkles,
  Square,
  Send,
  Sun,
  MessageSquareText,
  Save,
  Upload,
  FileText,
  Wifi,
  LayoutDashboard,
  MessageSquare,
  FileText as FileIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { HamburgerToggle } from "../HamburgerToggle";
import { Badge } from "./Badge";
import { PanelCard } from "./PanelCard";

const PREVIEW_VERSION = "1.0.0";

type Panel = "/" | "/agente" | "/telegram" | "/apis" | "/dashboard";

const btnPrimary =
  "inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent active:scale-[0.98] disabled:opacity-50 bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-[0_10px_24px_-12px_rgba(79,70,229,0.85)] hover:from-blue-500 hover:to-violet-500 hover:shadow-[0_18px_32px_-16px_rgba(59,130,246,0.9)] focus:ring-blue-500 px-4 py-2.5 text-sm";

const btnDangerSm =
  "inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent active:scale-[0.98] bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-[0_10px_24px_-12px_rgba(225,29,72,0.85)] hover:from-rose-500 hover:to-red-500 focus:ring-rose-500 px-3 py-2 text-sm";

const btnSecondarySm =
  "inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all border border-slate-200/80 bg-white/75 text-slate-800 backdrop-blur-xl hover:bg-white dark:border-slate-700/80 dark:bg-slate-800/65 dark:text-slate-100 dark:hover:bg-slate-700/70 px-3 py-2 text-sm";

function ThemeTogglePreview({
  previewTheme,
  onToggle,
}: {
  previewTheme: "light" | "dark";
  onToggle: () => void;
}) {
  const isDark = previewTheme === "dark";
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={isDark}
      aria-label={isDark ? "Tema escuro no demo (clique para claro)" : "Tema claro no demo (clique para escuro)"}
      title="Alterna só a visualização do painel abaixo"
      className="inline-flex items-center justify-center rounded-xl border border-slate-200/70 bg-white/75 p-2 text-slate-600 transition-all duration-200 hover:bg-white hover:text-slate-900 hover:shadow-[0_10px_30px_-20px_rgba(59,130,246,0.8)] dark:border-slate-700/70 dark:bg-slate-900/70 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
    >
      {isDark ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}

function PreviewHeader({
  previewTheme,
  onTogglePreviewTheme,
  menuOpen,
  onMenuClick,
}: {
  previewTheme: "light" | "dark";
  onTogglePreviewTheme: () => void;
  menuOpen: boolean;
  onMenuClick: () => void;
}) {
  return (
    <header className="border-b border-slate-200/70 bg-white/70 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/55">
      <div className="flex items-center justify-between gap-3 px-3 py-3 sm:gap-4 sm:px-6 sm:py-4">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
            Dashboard
          </h2>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
            Painel de controle
            <span className="text-slate-400 dark:text-slate-500"> · v{PREVIEW_VERSION}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <ThemeTogglePreview previewTheme={previewTheme} onToggle={onTogglePreviewTheme} />
          <HamburgerToggle open={menuOpen} onClick={onMenuClick} className="lg:hidden" />
        </div>
      </div>
    </header>
  );
}

function PreviewSidebar({
  panel,
  onSelect,
  onNavigate,
  className,
}: {
  panel: Panel;
  onSelect: (p: Panel) => void;
  onNavigate?: () => void;
  className?: string;
}) {
  const navs: { name: string; path: Panel; icon: ReactNode }[] = [
    { name: "Dashboard", path: "/dashboard", icon: <LayoutDashboard size={20} /> },
    { name: "Instâncias", path: "/", icon: <Boxes size={20} /> },
    { name: "Agente IA", path: "/agente", icon: <Bot size={20} /> },
    { name: "Telegram IA", path: "/telegram", icon: <Send size={20} /> },
    { name: "Configurações", path: "/apis", icon: <KeyRound size={20} /> },
  ];

  return (
    <aside
      className={cn(
        "flex w-64 shrink-0 flex-col overflow-y-auto overscroll-contain border-r border-slate-200/70 bg-white/72 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/55",
        className
      )}
    >
      <div className="border-b border-slate-200/70 p-4 dark:border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 shadow-[0_14px_30px_-16px_rgba(79,70,229,0.95)]">
            <Bot className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">
              Nexus<span className="text-blue-500 dark:text-blue-400">ZAP</span>
            </h1>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">IA Intelligence</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-2 px-3 py-6">
        {navs.map((nav) => {
          const isActive =
            nav.path === "/" ? panel === "/" : panel === nav.path;
          return (
            <button
              key={nav.path}
              type="button"
              onClick={() => {
                onSelect(nav.path);
                onNavigate?.();
              }}
              title={nav.name}
              className={`relative flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-all duration-200 ${
                isActive
                  ? "border border-blue-200/80 bg-blue-50/85 text-blue-700 shadow-[0_10px_24px_-20px_rgba(59,130,246,0.9)] dark:border-blue-800/60 dark:bg-blue-950/35 dark:text-blue-300"
                  : "text-slate-700 hover:bg-slate-100/80 dark:text-slate-300 dark:hover:bg-slate-800/70"
              }`}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 h-5 w-px -translate-y-1/2 rounded-r-full bg-gradient-to-b from-blue-500 to-violet-500 shadow-[0_0_10px_1px_rgba(99,102,241,0.42)]" />
              )}
              <span className={`shrink-0 ${isActive ? "text-blue-600 dark:text-blue-300" : ""}`}>
                {nav.icon}
              </span>
              <span className="text-sm font-medium">{nav.name}</span>
            </button>
          );
        })}
      </nav>

      <div className="space-y-3 border-t border-slate-200/70 p-4 dark:border-slate-800/80">
        <p className="text-center text-[10px] tabular-nums text-slate-400 dark:text-slate-500">v{PREVIEW_VERSION}</p>
        <button
          type="button"
          disabled
          title="Demonstração — login no app real"
          className="flex w-full cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-red-600 opacity-70 dark:text-red-400"
        >
          <LogOut size={18} className="shrink-0" />
          <span className="text-sm font-medium">Sair</span>
        </button>
      </div>
    </aside>
  );
}

function InstanciaPanel() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
        <div>
          <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">Vendas Principal</h1>
          <p className="text-gray-600 dark:text-gray-400">Gerencie sua conexão WhatsApp</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Badge variant="success">
            <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-current" />
            Conectado
          </Badge>
          <button type="button" className={btnDangerSm}>
            <Square className="h-4 w-4" />
            Desconectar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <PanelCard className="lg:col-span-2">
          <div className="space-y-6">
            <div>
              <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">Informações da Instância</h2>
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200/70 bg-white/70 p-4 backdrop-blur-xl dark:border-slate-700/70 dark:bg-slate-800/50">
                  <p className="mb-1 text-xs font-semibold text-gray-600 dark:text-gray-400">ID</p>
                  <p className="font-mono text-sm text-gray-900 dark:text-gray-100">a1b2c3d4-e5f6-7890-abcd-ef1234567890</p>
                </div>
                <div className="rounded-xl border border-slate-200/70 bg-white/70 p-4 backdrop-blur-xl dark:border-slate-700/70 dark:bg-slate-800/50">
                  <p className="mb-1 text-xs font-semibold text-gray-600 dark:text-gray-400">Status</p>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-green-400 shadow-[0_0_14px_2px_rgba(74,222,128,0.7)]" />
                    <span className="font-medium text-gray-900 dark:text-gray-100">Conectado</span>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200/70 bg-white/70 p-4 backdrop-blur-xl dark:border-slate-700/70 dark:bg-slate-800/50">
                  <p className="mb-1 text-xs font-semibold text-gray-600 dark:text-gray-400">Telegram</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">BOT (Suporte)</span>
                    <Badge variant="success">ONLINE</Badge>
                  </div>
                </div>
                <div className="space-y-3 rounded-xl border border-slate-200/70 bg-white/70 p-4 backdrop-blur-xl dark:border-slate-700/70 dark:bg-slate-800/50">
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">Atendimento com IA por canal</p>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">WhatsApp</span>
                    </div>
                    <button type="button" className={btnDangerSm}>
                      Desativar IA
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Telegram</span>
                    </div>
                    <button type="button" className={btnDangerSm}>
                      Desativar IA
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </PanelCard>

        <PanelCard
          header={<h3 className="font-semibold text-gray-900 dark:text-white">Conexão WhatsApp</h3>}
        >
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-950/50">
              <Smartphone className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <p className="mb-1 text-sm font-medium text-gray-900 dark:text-gray-100">Dispositivo Conectado</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Sua instância está pronta para uso</p>
          </div>
        </PanelCard>
      </div>
    </div>
  );
}

function AgentePanel() {
  return (
    <div className="space-y-8">
      <div>
        <div className="mb-2 flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">Cérebro & Contexto</span>
        </div>
        <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">Personalidade da IA</h1>
        <p className="text-gray-600 dark:text-gray-400">Defina como o agente deve se comportar e o que ele deve saber</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <PanelCard className="lg:col-span-3">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-950/50">
                <MessageSquareText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Prompt do Sistema</h2>
            </div>
            <button type="button" className={btnPrimary + " px-3 py-2 text-sm"}>
              <Save className="mr-2 h-4 w-4" />
              Salvar
            </button>
          </div>
          <textarea
            readOnly
            className="min-h-[200px] w-full resize-none rounded-xl border border-slate-200/80 bg-white/80 p-4 text-sm text-gray-800 dark:border-slate-700 dark:bg-slate-900/50 dark:text-gray-100"
            value="Você é o atendente da Vendas Principal. Seja cordial, objetivo e use a base de conhecimento quando relevante."
          />
        </PanelCard>

        <PanelCard className="lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <Upload className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Base de conhecimento</h2>
          </div>
          <div className="mb-4 rounded-xl border border-dashed border-slate-300/80 bg-slate-50/80 py-8 text-center text-sm text-slate-500 dark:border-slate-600 dark:bg-slate-800/40 dark:text-slate-400">
            Arraste arquivos ou clique para enviar
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-lg border border-slate-200/70 bg-white/60 px-3 py-2 text-sm dark:border-slate-700/70 dark:bg-slate-800/40">
              <span className="flex items-center gap-2 truncate text-gray-800 dark:text-gray-100">
                <FileText className="h-4 w-4 shrink-0 text-slate-500" />
                catalogo.pdf
              </span>
              <span className="text-xs text-slate-500">WhatsApp</span>
            </div>
          </div>
        </PanelCard>
      </div>
    </div>
  );
}

function TelegramPanel() {
  return (
    <div className="space-y-8">
      <div>
        <div className="mb-2 flex items-center gap-3">
          <Send className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">Canal Telegram</span>
        </div>
        <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">Telegram IA</h1>
        <p className="text-gray-600 dark:text-gray-400">Prompt e arquivos específicos do bot no Telegram</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <PanelCard className="lg:col-span-3">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Prompt Telegram</h2>
            <button type="button" className={btnPrimary + " px-3 py-2 text-sm"}>
              <Save className="mr-2 h-4 w-4" />
              Salvar
            </button>
          </div>
          <textarea
            readOnly
            className="min-h-[180px] w-full resize-none rounded-xl border border-slate-200/80 bg-white/80 p-4 text-sm dark:border-slate-700 dark:bg-slate-900/50"
            value="Responda no Telegram com o mesmo tom da marca, em português."
          />
        </PanelCard>
        <PanelCard className="lg:col-span-2">
          <h2 className="mb-4 text-lg font-bold text-gray-900 dark:text-white">Arquivos (Telegram)</h2>
          <div className="rounded-xl border border-slate-200/70 bg-white/60 p-3 text-sm text-gray-700 dark:border-slate-700/70 dark:bg-slate-800/40 dark:text-gray-200">
            politica-suporte.docx
          </div>
        </PanelCard>
      </div>
    </div>
  );
}

function DashboardPanel() {
  const stats = [
    { label: "Total de Mensagens", value: "1.247", icon: <MessageSquare className="w-6 h-6" />, color: "green" },
    { label: "WhatsApp", value: "892", icon: <Smartphone className="w-6 h-6" />, color: "blue" },
    { label: "Telegram", value: "355", icon: <Send className="w-6 h-6" />, color: "purple" },
    { label: "Total de Arquivos", value: "12", icon: <FileIcon className="w-6 h-6" />, color: "orange" },
  ];

  const colorClasses: Record<string, { bg: string; text: string }> = {
    blue: { bg: "bg-blue-100 dark:bg-blue-950/40", text: "text-blue-600 dark:text-blue-400" },
    green: { bg: "bg-green-100 dark:bg-green-950/40", text: "text-green-600 dark:text-green-400" },
    purple: { bg: "bg-purple-100 dark:bg-purple-950/40", text: "text-purple-600 dark:text-purple-400" },
    orange: { bg: "bg-orange-100 dark:bg-orange-950/40", text: "text-orange-600 dark:text-orange-400" },
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400">Visão geral das mensagens e arquivos</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <PanelCard key={stat.label} className="p-6">
            <div className={`w-12 h-12 rounded-lg ${colorClasses[stat.color].bg} ${colorClasses[stat.color].text} flex items-center justify-center mb-4`}>
              {stat.icon}
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{stat.label}</p>
          </PanelCard>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PanelCard className="p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Mensagens por Canal</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-300">WhatsApp</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">892</span>
              </div>
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full" style={{ width: "72%" }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-300">Telegram</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">355</span>
              </div>
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-purple-500 to-purple-400 rounded-full" style={{ width: "28%" }} />
              </div>
            </div>
          </div>
        </PanelCard>

        <PanelCard className="p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Status dos Canais</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Smartphone className="w-5 h-5 text-green-600" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">WhatsApp</span>
              </div>
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">Online</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Send className="w-5 h-5 text-green-600" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Telegram</span>
              </div>
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">Online</span>
            </div>
          </div>
        </PanelCard>
      </div>
    </div>
  );
}

function ApisPanel() {
  return (
    <div className="space-y-8">
      <div>
        <div className="mb-2 flex items-center gap-3">
          <KeyRound className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">Integrações</span>
        </div>
        <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">Configurações</h1>
        <p className="text-gray-600 dark:text-gray-400">Chaves de API e provedor de chat (Groq, Gemini, OpenRouter)</p>
      </div>

      <PanelCard>
        <div className="space-y-6">
          <div>
            <label className="mb-2 block text-xs font-semibold text-gray-600 dark:text-gray-400">Provedor de chat</label>
            <div className="rounded-xl border border-slate-200/70 bg-white/80 px-4 py-3 text-sm text-gray-900 dark:border-slate-700 dark:bg-slate-800/50 dark:text-gray-100">
              openrouter (OpenRouter)
            </div>
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold text-gray-600 dark:text-gray-400">OpenRouter API Key</label>
            <div className="rounded-xl border border-slate-200/70 bg-slate-50/90 px-4 py-3 font-mono text-sm tracking-widest text-gray-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-gray-400">
              ••••••••••••••••
            </div>
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold text-gray-600 dark:text-gray-400">Modelo OpenRouter</label>
            <div className="rounded-xl border border-slate-200/70 bg-white/80 px-4 py-3 font-mono text-sm text-gray-900 dark:border-slate-700 dark:bg-slate-800/50 dark:text-gray-100">
              anthropic/claude-3-haiku
            </div>
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold text-gray-600 dark:text-gray-400">Gemini API Key</label>
            <div className="rounded-xl border border-slate-200/70 bg-slate-50/90 px-4 py-3 font-mono text-sm tracking-widest text-gray-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-gray-400">
              ••••••••••••••••
            </div>
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold text-gray-600 dark:text-gray-400">Groq API Key</label>
            <div className="rounded-xl border border-slate-200/70 bg-slate-50/90 px-4 py-3 font-mono text-sm tracking-widest text-gray-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-gray-400">
              ••••••••••••••••
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className={btnSecondarySm}>
              <Wifi className="mr-2 h-4 w-4" />
              Testar provedores
            </button>
            <button type="button" className={btnPrimary + " px-4 py-2.5 text-sm"}>
              Salvar configurações
            </button>
          </div>
        </div>
      </PanelCard>
    </div>
  );
}

export function DashboardPreview() {
  const [panel, setPanel] = useState<Panel>("/");
  const [previewTheme, setPreviewTheme] = useState<"light" | "dark">("dark");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const previewScopeClass = previewTheme === "light" ? "light-scope" : "dark";

  const handleDemoScroll = (e: React.WheelEvent | React.TouchEvent) => {
    const main = e.currentTarget as HTMLElement;
    const isAtTop = main.scrollTop === 0;
    const isAtBottom = main.scrollTop + main.clientHeight >= main.scrollHeight - 5;
    
    let delta = 0;
    
    if ('deltaY' in e) {
      delta = e.deltaY;
    } else {
      // Touch event
      const touch = e.touches[0];
      if (!touch) return;
      
      const isScrollingDown = touch.clientY < 100;
      const isScrollingUp = touch.clientY > window.innerHeight - 100;
      
      if (isScrollingDown && isAtBottom) delta = 50;
      if (isScrollingUp && isAtTop) delta = -50;
    }
    
    if ((delta > 0 && isAtBottom) || (delta < 0 && isAtTop)) {
      e.preventDefault();
      window.scrollBy({ top: delta, behavior: 'smooth' });
    }
  };

  return (
    <div
      className={`mx-auto max-w-6xl overflow-hidden rounded-2xl border border-slate-200/70 bg-white/40 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.45)] backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/30 ${previewScopeClass}`}
    >
      <div className="relative flex h-[min(720px,85dvh)] min-h-[360px] flex-col overflow-hidden sm:min-h-[480px] lg:min-h-[560px] lg:flex-row">
        {mobileNavOpen && (
          <button
            type="button"
            className="absolute inset-0 z-20 bg-slate-900/40 backdrop-blur-[1px] lg:hidden"
            aria-label="Fechar menu do painel"
            onClick={() => setMobileNavOpen(false)}
          />
        )}
        <PreviewSidebar
          panel={panel}
          onSelect={setPanel}
          onNavigate={() => setMobileNavOpen(false)}
          className={cn(
            "absolute inset-y-0 left-0 z-30 h-full max-w-[min(17rem,88vw)] shadow-[0_16px_48px_-12px_rgba(15,23,42,0.45)] transition-transform duration-300 ease-out dark:shadow-black/40",
            "lg:relative lg:z-0 lg:max-w-none lg:shadow-none",
            mobileNavOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          )}
        />
        <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col lg:z-auto">
          <PreviewHeader
            previewTheme={previewTheme}
            menuOpen={mobileNavOpen}
            onMenuClick={() => setMobileNavOpen((o) => !o)}
            onTogglePreviewTheme={() =>
              setPreviewTheme((t) => (t === "dark" ? "light" : "dark"))
            }
          />
          <main 
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y"
            onWheel={(e) => handleDemoScroll(e)}
            onTouchMove={(e) => handleDemoScroll(e)}
          >
            <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-8 lg:px-8">
              {panel === "/dashboard" && <DashboardPanel />}
              {panel === "/" && <InstanciaPanel />}
              {panel === "/agente" && <AgentePanel />}
              {panel === "/telegram" && <TelegramPanel />}
              {panel === "/apis" && <ApisPanel />}
            </div>
          </main>
        </div>
      </div>
      <p className="border-t border-slate-200/70 bg-slate-50/80 px-3 py-2 text-center text-[10px] text-slate-500 sm:px-4 sm:text-[11px] dark:border-slate-800/80 dark:bg-slate-900/50 dark:text-slate-500">
        Visualização estática — o painel real exige login
      </p>
    </div>
  );
}
