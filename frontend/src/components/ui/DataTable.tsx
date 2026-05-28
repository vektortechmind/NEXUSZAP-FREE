import React from "react";

type DataTableProps = React.TableHTMLAttributes<HTMLTableElement> & {
  caption?: string;
  children: React.ReactNode;
};

export function DataTable({ caption, children, className, ...props }: DataTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="overflow-x-auto">
        <table className={`min-w-full text-left text-sm ${className || ""}`} {...props}>
          {caption && <caption className="sr-only">{caption}</caption>}
          {children}
        </table>
      </div>
    </div>
  );
}

export function DataTableHeader({ children }: { children: React.ReactNode }) {
  return (
    <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-800 dark:bg-slate-950/45 dark:text-slate-400">
      {children}
    </thead>
  );
}

export function DataTableCell({ children, className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={`px-4 py-3 align-middle ${className || ""}`} {...props}>
      {children}
    </td>
  );
}

export function DataTableHeadCell({ children, className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={`px-4 py-3 align-middle ${className || ""}`} {...props}>
      {children}
    </th>
  );
}
