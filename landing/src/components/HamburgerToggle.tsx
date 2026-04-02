import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type HamburgerToggleProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  open: boolean;
};

/**
 * Ícone de menu com três barras; ao abrir, anima para um “X”.
 */
export function HamburgerToggle({
  open,
  className,
  ...props
}: HamburgerToggleProps) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-white/90 text-slate-800 shadow-sm transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:border-slate-700/80 dark:bg-slate-900/80 dark:text-slate-100 dark:hover:bg-slate-800/90",
        className
      )}
      aria-expanded={open}
      aria-label={open ? "Fechar menu" : "Abrir menu"}
      {...props}
    >
      <span className="relative block h-[14px] w-[22px]" aria-hidden>
        <span
          className={cn(
            "absolute left-0 top-0 block h-0.5 w-[22px] rounded-full bg-current transition-transform duration-200 ease-out",
            open && "translate-y-[6px] rotate-45"
          )}
        />
        <span
          className={cn(
            "absolute left-0 top-[6px] block h-0.5 w-[22px] rounded-full bg-current transition-opacity duration-200",
            open && "opacity-0"
          )}
        />
        <span
          className={cn(
            "absolute left-0 top-[12px] block h-0.5 w-[22px] rounded-full bg-current transition-transform duration-200 ease-out",
            open && "-translate-y-[6px] -rotate-45"
          )}
        />
      </span>
    </button>
  );
}
