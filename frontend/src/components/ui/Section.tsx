import React from "react";

type SectionProps = React.HTMLAttributes<HTMLElement> & {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
};

export function Section({ title, description, actions, children, className, ...props }: SectionProps) {
  return (
    <section className={`space-y-4 ${className || ""}`} {...props}>
      {(title || description || actions) && (
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-3 dark:border-slate-800 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold text-slate-950 dark:text-slate-50">{title}</h2>}
            {description && <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
