import type { CSSProperties } from "react";
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { cn } from "@/lib/utils";
import "./sonner.css";

export function Toaster({ className, style, toastOptions, icons, ...props }: ToasterProps) {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="top-right"
      duration={5000}
      closeButton
      visibleToasts={3}
      gap={12}
      offset={24}
      mobileOffset={16}
      containerAriaLabel="Notifications"
      {...props}
      className={cn("app-toaster", className)}
      icons={{
        success: <><CircleCheckIcon aria-hidden="true" /><span className="sr-only">Succès : </span></>,
        error: <><OctagonXIcon aria-hidden="true" /><span className="sr-only">Erreur : </span></>,
        warning: <><TriangleAlertIcon aria-hidden="true" /><span className="sr-only">Attention : </span></>,
        info: <><InfoIcon aria-hidden="true" /><span className="sr-only">Information : </span></>,
        loading: <Loader2Icon aria-label="En cours" className="animate-spin motion-reduce:animate-none" />,
        ...icons,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "8px",
          "--width": "380px",
          fontFamily: "var(--font-sans)",
          ...style,
        } as CSSProperties
      }
      toastOptions={{ closeButtonAriaLabel: "Fermer la notification", ...toastOptions }}
    />
  );
}
