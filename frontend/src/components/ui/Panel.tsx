import React from "react";

type PanelProps = React.HTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode;
  tone?: "default" | "muted" | "accent";
};

const tones = {
  default: "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900",
  muted: "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/45",
  accent: "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/70 dark:bg-emerald-950/25",
};

export const Panel = React.forwardRef<HTMLDivElement, PanelProps>(
  ({ children, className, tone = "default", ...props }, ref) => (
    <div
      ref={ref}
      className={`rounded-lg border shadow-sm ${tones[tone]} ${className || ""}`}
      {...props}
    >
      {children}
    </div>
  )
);

Panel.displayName = "Panel";
