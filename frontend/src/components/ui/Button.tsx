import React from "react";
import { cva, type VariantProps } from "class-variance-authority";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-lg font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 enabled:cursor-pointer",
  {
    variants: {
      variant: {
        primary:
          "border border-emerald-600 bg-emerald-600 text-white shadow-sm hover:border-emerald-500 hover:bg-emerald-500 dark:border-emerald-500 dark:bg-emerald-500 dark:text-slate-950 dark:hover:border-emerald-400 dark:hover:bg-emerald-400",
        secondary:
          "border border-slate-300 bg-white text-slate-800 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800",
        danger:
          "border border-red-600 bg-red-600 text-white shadow-sm hover:border-red-500 hover:bg-red-500 focus-visible:ring-red-500 dark:border-red-500 dark:bg-red-500 dark:hover:border-red-400 dark:hover:bg-red-400",
        ghost:
          "border border-transparent text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
      },
      size: {
        sm: "min-h-9 px-3 py-2 text-sm",
        md: "min-h-10 px-4 py-2.5 text-sm",
        lg: "min-h-11 px-5 py-3 text-base",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  children: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={loading || disabled}
        className={buttonVariants({ variant, size, className })}
        {...props}
      >
        {loading && (
          <span className="mr-2 inline-block h-4 w-4 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin" />
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
