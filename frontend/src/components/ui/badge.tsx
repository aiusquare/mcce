import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground border-border",
        // Maslaha Brand Variants - High-contrast academic badges
        success:
          "border-emerald-600/30 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-700/60 font-medium",
        warning:
          "border-amber-600/30 bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-700/60 font-medium",
        info: "border-sky-600/30 bg-sky-50 text-sky-900 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-700/60 font-medium",
        gold: "border-amber-600/40 bg-amber-50 text-amber-900 dark:text-amber-300 dark:bg-amber-950/50 font-semibold shadow-xs",
        emerald:
          "border-emerald-600/30 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 font-medium",
        pending:
          "border-amber-600/30 bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300 font-medium",
        approved:
          "border-emerald-600/30 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 font-medium",
        rejected:
          "border-red-600/30 bg-red-50 text-red-900 dark:bg-red-950/50 dark:text-red-300 font-medium",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
