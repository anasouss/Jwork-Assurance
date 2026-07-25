import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground",
        accent:
          "border-transparent bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-900/80 dark:text-amber-300 shadow-sm",
        success:
          "border-transparent bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/80 dark:text-green-300 shadow-sm",
        warning:
          "border-transparent bg-orange-100 text-orange-800 hover:bg-orange-100 dark:bg-orange-900/80 dark:text-orange-300 shadow-sm",
        info:
          "border-transparent bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-900/80 dark:text-blue-300 shadow-sm",
        yellow:
          "border-transparent bg-yellow-100 text-yellow-800 hover:bg-yellow-100 dark:bg-yellow-900/80 dark:text-yellow-300 shadow-sm",
        gray:
          "border-transparent bg-gray-100 text-gray-800 hover:bg-gray-100 dark:bg-gray-900/80 dark:text-gray-300 shadow-sm",
        purple:
          "border-transparent bg-purple-100 text-purple-800 hover:bg-purple-100 dark:bg-purple-900/80 dark:text-purple-300 shadow-sm",
        red:
          "border-transparent bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900/80 dark:text-red-300 shadow-sm",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
