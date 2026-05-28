import React from "react";
import { Panel } from "./Panel";

type MetricProps = {
  label: string;
  value: React.ReactNode;
  description?: string;
  icon?: React.ReactNode;
  trend?: React.ReactNode;
  tone?: "default" | "success" | "info" | "warning" | "danger";
  className?: string;
};

const toneClasses = {
  default: "text-slate-600 dark:text-slate-400",
  success: "text-emerald-700 dark:text-emerald-400",
  info: "text-blue-700 dark:text-blue-400",
  warning: "text-amber-700 dark:text-amber-400",
  danger: "text-red-700 dark:text-red-400",
};

export function Metric({ label, value, description, icon, trend, tone = "default", className }: MetricProps) {
  return (
    <Panel className={`p-4 ${className || ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{label}</p>
          <div className="mt-2 text-3xl font-semibold leading-none tracking-normal text-slate-950 dark:text-slate-50">
            {value}
          </div>
        </div>
        {icon && <div className={`shrink-0 rounded-lg bg-slate-100 p-2 dark:bg-slate-800 ${toneClasses[tone]}`}>{icon}</div>}
      </div>
      {(description || trend) && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
          {description && <p className="text-slate-600 dark:text-slate-400">{description}</p>}
          {trend && <div className={toneClasses[tone]}>{trend}</div>}
        </div>
      )}
    </Panel>
  );
}
