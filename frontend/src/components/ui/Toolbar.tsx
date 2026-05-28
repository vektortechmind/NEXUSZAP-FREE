import React from "react";

type ToolbarProps = React.HTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode;
};

export function Toolbar({ children, className, ...props }: ToolbarProps) {
  return (
    <div
      className={`flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:flex-wrap sm:items-center ${className || ""}`}
      {...props}
    >
      {children}
    </div>
  );
}
