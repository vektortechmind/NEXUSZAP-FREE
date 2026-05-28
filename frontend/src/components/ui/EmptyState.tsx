import React from "react";

type EmptyStateProps = {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center dark:border-slate-700 dark:bg-slate-950/45 ${className || ""}`}>
      {icon && <div className="mb-4 rounded-lg bg-white p-3 text-slate-500 shadow-sm dark:bg-slate-900 dark:text-slate-400">{icon}</div>}
      <h3 className="text-sm font-semibold text-slate-950 dark:text-slate-50">{title}</h3>
      {description && <p className="mt-2 max-w-md text-sm text-slate-600 dark:text-slate-400">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
