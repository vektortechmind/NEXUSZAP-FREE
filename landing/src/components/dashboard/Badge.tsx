import React from "react";

export const Badge = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement> & {
    variant?: "default" | "success" | "danger" | "warning" | "info";
  }
>(({ children, variant = "default", className, ...props }, ref) => {
  const variants = {
    default:
      "border border-slate-200/80 bg-slate-100/80 text-slate-700 dark:border-slate-700/80 dark:bg-slate-800/75 dark:text-slate-200",
    success:
      "border border-emerald-200/80 bg-emerald-50/90 text-emerald-700 shadow-[0_0_18px_-10px_rgba(34,197,94,0.7)] dark:border-emerald-800/70 dark:bg-emerald-950/45 dark:text-emerald-300",
    danger:
      "border border-rose-200/80 bg-rose-50/90 text-rose-700 dark:border-rose-800/70 dark:bg-rose-950/45 dark:text-rose-300",
    warning:
      "border border-amber-200/80 bg-amber-50/90 text-amber-700 dark:border-amber-800/70 dark:bg-amber-950/45 dark:text-amber-300",
    info: "border border-blue-200/80 bg-blue-50/90 text-blue-700 dark:border-blue-800/70 dark:bg-blue-950/45 dark:text-blue-300",
  };

  return (
    <span
      ref={ref}
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold backdrop-blur-lg ${variants[variant]} ${className ?? ""}`}
      {...props}
    >
      {children}
    </span>
  );
});

Badge.displayName = "Badge";
