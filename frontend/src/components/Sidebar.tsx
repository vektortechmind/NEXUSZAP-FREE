import { Link, useLocation } from "react-router-dom";
import { LogOut, X } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { APP_NAV_GROUPS } from "../features/navigation/appNavigation";
import { BrandLogo } from "./BrandLogo";

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
          className="fixed inset-0 z-30 cursor-pointer bg-slate-950/50 backdrop-blur-sm xl:hidden"
          onClick={onCloseMobile}
          aria-label="Fechar menu lateral"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-200/80 bg-white/94 shadow-[0_18px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl transition-transform duration-200 dark:border-slate-800/80 dark:bg-slate-950/94 dark:shadow-[0_18px_80px_rgba(2,6,23,0.5)] xl:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="relative flex items-center justify-center px-5 py-5">
          <div className="flex items-center justify-center">
            <BrandLogo className="mx-auto h-12 w-auto max-w-[188px] object-contain" />
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            className="absolute right-5 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-slate-300 text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 xl:hidden"
            aria-label="Fechar menu"
          >
            <X size={16} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5" aria-label="Navegação principal">
          <div className="space-y-1">
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
                  className={`group relative flex min-h-12 items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                    isActive
                      ? "bg-emerald-50 text-emerald-800 shadow-[inset_0_0_0_1px_rgba(52,211,153,0.45)] dark:bg-emerald-950/35 dark:text-emerald-300"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-50"
                  }`}
                >
                  <span className={`absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full ${isActive ? "bg-emerald-500" : "bg-transparent group-hover:bg-slate-300 dark:group-hover:bg-slate-700"}`} aria-hidden="true" />
                  <span className={isActive ? "text-emerald-700 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400"}>
                    <Icon size={20} strokeWidth={1.85} />
                  </span>
                  <span className="truncate">{nav.name}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-slate-200/80 px-3 py-4 dark:border-slate-800/80">
          <div>
            <button
              type="button"
              onClick={() => {
                onCloseMobile();
                logout();
              }}
              title="Sair"
              className="flex w-full cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:text-red-400 dark:hover:bg-red-950/35"
            >
              <LogOut size={20} strokeWidth={1.85} className="shrink-0" />
              <span>Sair</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

