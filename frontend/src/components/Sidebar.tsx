import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Bot, LogOut, X } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { APP_VERSION } from "../version";
import { APP_NAV_GROUPS } from "../features/navigation/appNavigation";

type SidebarProps = {
  mobileOpen: boolean;
  onCloseMobile: () => void;
};

export function Sidebar({ mobileOpen, onCloseMobile }: SidebarProps) {
  const { pathname } = useLocation();
  const { logout } = useAuth();
  const [desktopExpanded, setDesktopExpanded] = useState(false);
  const desktopCompact = !desktopExpanded;

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 cursor-pointer bg-slate-950/45 lg:hidden"
          onClick={onCloseMobile}
          aria-label="Fechar menu lateral"
        />
      )}
      <aside
        onMouseEnter={() => setDesktopExpanded(true)}
        onMouseLeave={() => setDesktopExpanded(false)}
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-[width,transform] duration-200 dark:border-slate-800 dark:bg-slate-950 lg:static lg:translate-x-0 ${desktopExpanded ? "lg:w-64" : "lg:w-[4.5rem]"} ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="border-b border-slate-200 p-5 dark:border-slate-800">
          <div className={`flex items-center gap-3 ${desktopCompact ? "lg:justify-center" : ""}`}>
            <button
              type="button"
              onClick={onCloseMobile}
              className="absolute right-3 top-3 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden"
              aria-label="Fechar menu"
            >
              <X size={16} />
            </button>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm dark:bg-emerald-500 dark:text-slate-950">
              <Bot size={22} />
            </div>
            <div className={`min-w-0 overflow-hidden transition-[max-width,opacity] duration-200 ${desktopExpanded ? "lg:max-w-[8.5rem] lg:opacity-100" : "lg:max-w-0 lg:opacity-0"}`}>
              <h1 className="text-lg font-semibold text-slate-950 dark:text-slate-50">
                Nexus<span className="text-emerald-600 dark:text-emerald-400">ZAP</span>
              </h1>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Command Center</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5" aria-label="Navegação principal">
          {APP_NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className={`px-3 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 transition-opacity duration-200 dark:text-slate-500 ${desktopExpanded ? "lg:opacity-100" : "lg:opacity-0 lg:pointer-events-none"}`}>
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map((nav) => {
                  const Icon = nav.icon;
                  const isActive = nav.path === "/" ? pathname === "/" : pathname.startsWith(nav.path);
                  return (
                    <Link
                      key={nav.path}
                      to={nav.path}
                      onClick={onCloseMobile}
                      aria-current={isActive ? "page" : undefined}
                      title={nav.name}
                      className={`relative flex min-h-10 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${desktopCompact ? "lg:justify-center" : ""} ${
                        isActive
                          ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-950/35 dark:text-emerald-300 dark:ring-emerald-900/70"
                          : "text-slate-700 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-slate-50"
                      }`}
                    >
                      <span className={isActive ? "text-emerald-700 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400"}>
                        <Icon size={18} />
                      </span>
                      <span className={`truncate overflow-hidden transition-[max-width,opacity] duration-200 ${desktopExpanded ? "lg:max-w-[8.5rem] lg:opacity-100" : "lg:max-w-0 lg:opacity-0"}`}>{nav.name}</span>
                      {isActive && <span className={`ml-auto h-1.5 w-1.5 rounded-full bg-emerald-500 transition-opacity duration-200 ${desktopExpanded ? "lg:opacity-100" : "lg:opacity-0"}`} aria-hidden="true" />}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="space-y-3 border-t border-slate-200 p-4 dark:border-slate-800">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            <div className={`overflow-hidden transition-[max-height,opacity] duration-200 ${desktopExpanded ? "lg:max-h-16 lg:opacity-100" : "lg:max-h-0 lg:opacity-0"}`}>
              <p className="font-medium text-slate-800 dark:text-slate-200">Sistema</p>
              <p className="tabular-nums">Versão {APP_VERSION}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              onCloseMobile();
              logout();
            }}
            title="Sair"
            className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:text-red-400 dark:hover:bg-red-950/35 ${desktopCompact ? "lg:justify-center" : ""}`}
          >
            <LogOut size={18} className="shrink-0" />
            <span className={`overflow-hidden transition-[max-width,opacity] duration-200 ${desktopExpanded ? "lg:max-w-24 lg:opacity-100" : "lg:max-w-0 lg:opacity-0"}`}>Sair</span>
          </button>
        </div>
      </aside>
    </>
  );
}
