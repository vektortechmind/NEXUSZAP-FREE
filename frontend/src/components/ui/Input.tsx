import React, { useId } from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className, id, "aria-describedby": ariaDescribedBy, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const errorId = `${inputId}-error`;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : ariaDescribedBy}
            className={`
              w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm placeholder-slate-500
              transition-colors duration-200
              focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25
              disabled:bg-slate-100 disabled:text-slate-500
              dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/25 dark:disabled:bg-slate-950 dark:disabled:text-slate-600
              ${icon ? "pl-10" : ""}
              ${error ? "border-red-500 focus:border-red-500 focus:ring-red-500/25 dark:border-red-500 dark:focus:border-red-400 dark:focus:ring-red-400/25" : ""}
              ${className || ""}
            `}
            {...props}
          />
        </div>
        {error && (
          <p id={errorId} className="mt-1.5 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
