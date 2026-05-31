import { Menu } from "lucide-react";
import React from "react";
import { useLocation } from "react-router-dom";
import { getAppRouteTitle } from "../features/navigation/appNavigation";
import { ThemeToggle } from "./ThemeToggle";

type HeaderProps = {
  onOpenMobileSidebar: () => void;
  actions?: React.ReactNode;
};

export function Header({ onOpenMobileSidebar, actions }: HeaderProps) {
  const { pathname } = useLocation();
  const title = getAppRouteTitle(pathname);

  return (
    <header className="px-4 pt-4 sm:px-6 sm:pt-6 lg:px-8">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onOpenMobileSidebar}
            className="inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 xl:hidden"
            aria-label="Abrir menu lateral"
            title="Abrir menu"
          >
            <Menu size={18} />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-normal text-slate-950 dark:text-slate-50 sm:text-2xl">{title}</h1>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {actions}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
