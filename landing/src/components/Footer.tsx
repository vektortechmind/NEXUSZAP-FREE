import { Bot } from "lucide-react";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-200/70 bg-white/40 py-16 backdrop-blur-sm dark:border-slate-800/80 dark:bg-slate-950/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-12">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 shadow-[0_14px_30px_-16px_rgba(79,70,229,0.95)]">
              <Bot className="text-white" size={22} />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                Nexus<span className="text-blue-500 dark:text-blue-400">ZAP</span>
              </span>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">IA Intelligence</p>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-6 text-sm text-slate-600 dark:text-slate-400">
            <a href="#" className="transition-colors hover:text-blue-600 dark:hover:text-blue-400">
              Termos de Uso
            </a>
            <a href="#" className="transition-colors hover:text-blue-600 dark:hover:text-blue-400">
              Política de Privacidade
            </a>
            <a href="#" className="transition-colors hover:text-blue-600 dark:hover:text-blue-400">
              Contato
            </a>
          </div>
        </div>

        <div className="border-t border-slate-200/70 pt-8 text-center text-sm text-slate-500 dark:text-slate-500">
          © {currentYear} NexusZAP. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
}
