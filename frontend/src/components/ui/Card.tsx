import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ children, header, footer, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`
          rounded-lg border border-slate-200 bg-white shadow-sm transition-colors duration-200
          dark:border-slate-800 dark:bg-slate-900
          overflow-hidden
          ${className || ""}
        `}
        {...props}
      >
        {header && (
          <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
            {header}
          </div>
        )}
        <div className="px-6 py-4">
          {children}
        </div>
        {footer && (
          <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-950/45">
            {footer}
          </div>
        )}
      </div>
    );
  }
);

Card.displayName = "Card";
