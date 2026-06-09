import React from "react";

const badgeVariants = {
  default: "border border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
  success: "border border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/55 dark:text-emerald-300",
  danger: "border border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/55 dark:text-red-300",
  warning: "border border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/55 dark:text-amber-300",
  info: "border border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/55 dark:text-blue-300",
};

export const Badge = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement> & {
    variant?: "default" | "success" | "danger" | "warning" | "info";
  }
>(({ children, variant = "default", className, ...props }, ref) => {
  return (
    <span
      ref={ref}
      className={`
        inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold
        ${badgeVariants[variant]}
        ${className || ""}
      `}
      {...props}
    >
      {children}
    </span>
  );
});

Badge.displayName = "Badge";
