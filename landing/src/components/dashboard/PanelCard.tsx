import React from "react";

/** Equivalente ao `Card` do painel (`frontend/src/components/ui/Card.tsx`). */
export const PanelCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { header?: React.ReactNode; footer?: React.ReactNode }
>(({ children, header, footer, className, ...props }, ref) => (
  <div
    ref={ref}
    className={`
      overflow-hidden rounded-2xl border border-white/60 bg-white/80 shadow-[0_14px_40px_-24px_rgba(15,23,42,0.45)] backdrop-blur-xl transition-all duration-300
      hover:shadow-[0_20px_56px_-30px_rgba(59,130,246,0.5)] dark:border-white/10 dark:bg-slate-900/65 dark:shadow-[0_24px_64px_-36px_rgba(2,6,23,0.95)]
      ${className ?? ""}
    `}
    {...props}
  >
    {header && (
      <div className="border-b border-slate-200/70 px-6 py-4 dark:border-slate-700/70">{header}</div>
    )}
    <div className="px-6 py-4">{children}</div>
    {footer && (
      <div className="border-t border-slate-200/70 bg-white/55 px-6 py-4 dark:border-slate-700/70 dark:bg-slate-800/30">
        {footer}
      </div>
    )}
  </div>
));

PanelCard.displayName = "PanelCard";
