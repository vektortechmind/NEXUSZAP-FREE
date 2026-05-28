import { Moon, Sun } from "lucide-react";
import { useTheme } from "../contexts/useTheme";

type ThemeToggleProps = {
  className?: string;
};

export function ThemeToggle({ className = "" }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Usar tema claro" : "Usar tema escuro"}
      title={isDark ? "Tema claro" : "Tema escuro"}
      className={`
        inline-flex cursor-pointer items-center justify-center rounded-lg border border-slate-300 bg-white p-2 text-slate-600 shadow-sm
        transition-colors duration-200 hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500
        dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100
        ${className}
      `}
    >
      {isDark ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}
