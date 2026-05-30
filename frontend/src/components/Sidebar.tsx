import { Link, useLocation } from "react-router-dom";
import { LogOut, Sparkles, X } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { APP_NAV_GROUPS } from "../features/navigation/appNavigation";

type SidebarProps = {
  mobileOpen: boolean;
  onCloseMobile: () => void;
};

export function Sidebar({ mobileOpen, onCloseMobile }: SidebarProps) {
  const { pathname } = useLocation();
  const { logout } = useAuth();
  const navItems = APP_NAV_GROUPS.flatMap((group) => group.items);

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 cursor-pointer bg-slate-950/50 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
          aria-label="Fechar menu lateral"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-200/80 bg-white/94 shadow-[0_18px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl transition-transform duration-200 dark:border-slate-800/80 dark:bg-slate-950/94 dark:shadow-[0_18px_80px_rgba(2,6,23,0.5)] lg:w-24 lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between border-b border-slate-200/80 px-5 py-5 dark:border-slate-800/80 lg:justify-center lg:px-0">
          <div className="flex items-center gap-3 lg:gap-0">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[radial-gradient(circle_at_top,#34d399,#059669)] text-white shadow-[0_10px_30px_rgba(5,150,105,0.28)] dark:text-slate-950">
              <Sparkles size={22} strokeWidth={1.8} />
            </div>
            <div className="lg:hidden">
              <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">NexusZAP</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Menu principal</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-slate-300 text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden"
            aria-label="Fechar menu"
          >
            <X size={16} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5 lg:px-0 lg:py-6" aria-label="Navegação principal">
          <div className="space-y-1 lg:flex lg:flex-col lg:items-center lg:gap-2 lg:space-y-0">
            {navItems.map((nav) => {
              const Icon = nav.icon;
              const isActive = nav.path === "/" ? pathname === "/" : pathname.startsWith(nav.path);
              return (
                <Link
                  key={nav.path}
                  to={nav.path}
                  onClick={onCloseMobile}
                  aria-current={isActive ? "page" : undefined}
                  title={nav.name}
                  className={`group relative flex min-h-12 items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 lg:h-14 lg:w-14 lg:justify-center lg:px-0 ${
                    isActive
                      ? "bg-emerald-50 text-emerald-800 shadow-[inset_0_0_0_1px_rgba(52,211,153,0.45)] dark:bg-emerald-950/35 dark:text-emerald-300"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-50"
                  }`}
                >
                  <span className={`absolute left-0 top-1/2 hidden h-7 w-1 -translate-y-1/2 rounded-r-full lg:block ${isActive ? "bg-emerald-500" : "bg-transparent group-hover:bg-slate-300 dark:group-hover:bg-slate-700"}`} aria-hidden="true" />
                  <span className={isActive ? "text-emerald-700 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400"}>
                    <Icon size={20} strokeWidth={1.85} />
                  </span>
                  <span className="truncate lg:hidden">{nav.name}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-slate-200/80 px-3 py-4 dark:border-slate-800/80 lg:px-0">
          <div className="lg:flex lg:justify-center">
            <button
              type="button"
              onClick={() => {
                onCloseMobile();
                logout();
              }}
              title="Sair"
              className="flex w-full cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:text-red-400 dark:hover:bg-red-950/35 lg:h-14 lg:w-14 lg:justify-center lg:px-0"
            >
              <LogOut size={20} strokeWidth={1.85} className="shrink-0" />
              <span className="lg:hidden">Sair</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
