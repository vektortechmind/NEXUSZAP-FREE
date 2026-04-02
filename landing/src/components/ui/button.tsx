import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-[0_10px_24px_-12px_rgba(79,70,229,0.85)] hover:from-blue-500 hover:to-violet-500 hover:shadow-[0_18px_32px_-16px_rgba(59,130,246,0.9)] focus:ring-blue-500",
        secondary:
          "border border-slate-200/80 bg-white/75 text-slate-800 backdrop-blur-xl hover:bg-white dark:border-slate-700/80 dark:bg-slate-800/65 dark:text-slate-100 dark:hover:bg-slate-700/70 focus:ring-slate-400",
        outline:
          "border border-slate-200/80 bg-white/75 text-slate-800 backdrop-blur-xl hover:bg-white dark:border-slate-700/80 dark:bg-slate-800/65 dark:text-slate-100 dark:hover:bg-slate-700/70 focus:ring-slate-400",
        ghost:
          "text-slate-700 hover:bg-slate-100/70 dark:text-slate-300 dark:hover:bg-slate-800/70 focus:ring-slate-400",
        destructive:
          "bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-[0_10px_24px_-12px_rgba(225,29,72,0.85)] hover:from-rose-500 hover:to-red-500 focus:ring-rose-500",
        link: "text-blue-600 dark:text-blue-400 underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-9 px-4 py-2 text-sm",
        sm: "px-3 py-2 text-sm",
        lg: "min-h-11 px-8 py-3 text-base rounded-xl",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  )
);
Button.displayName = "Button";

export { Button, buttonVariants };
