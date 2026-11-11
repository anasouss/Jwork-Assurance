import { toast as sonnerToast } from "sonner";

// Preserve Sonner's API and caller overrides while giving errors more reading time.
export const toast = Object.assign(
  (...args: Parameters<typeof sonnerToast>) => sonnerToast(...args),
  {
    ...sonnerToast,
    success: (...[message, options]: Parameters<typeof sonnerToast.success>) =>
      sonnerToast.success(message, { duration: 4000, ...options }),
    error: (...[message, options]: Parameters<typeof sonnerToast.error>) =>
      sonnerToast.error(message, { duration: 8000, ...options }),
    warning: (...[message, options]: Parameters<typeof sonnerToast.warning>) =>
      sonnerToast.warning(message, { duration: 6000, ...options }),
  },
);
