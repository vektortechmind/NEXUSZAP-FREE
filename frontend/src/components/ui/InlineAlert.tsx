import React from "react";

type AlertTone = "info" | "success" | "warning" | "danger";

type InlineAlertProps = React.HTMLAttributes<HTMLDivElement> & {
  tone?: AlertTone;
  icon?: React.ReactNode;
  title?: string;
  children: React.ReactNode;
};

const tones: Record<AlertTone, string> = {
  info: "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/70 dark:bg-blue-950/35 dark:text-blue-200",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/70 dark:bg-emerald-950/35 dark:text-emerald-200",
  warning: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/35 dark:text-amber-200",
  danger: "border-red-200 bg-red-50 text-red-900 dark:border-red-900/70 dark:bg-red-950/35 dark:text-red-200",
};

export function InlineAlert({ tone = "info", icon, title, children, className, ...props }: InlineAlertProps) {
  return (
    <div className={`flex gap-3 rounded-lg border px-4 py-3 ${tones[tone]} ${className || ""}`} role={tone === "danger" ? "alert" : "status"} {...props}>
      {icon && <div className="mt-0.5 shrink-0">{icon}</div>}
      <div className="min-w-0 text-sm">
        {title && <p className="font-semibold">{title}</p>}
        <div className={title ? "mt-1" : ""}>{children}</div>
      </div>
    </div>
  );
}
