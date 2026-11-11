import { RouterProvider } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { router } from "./router";

export function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <RouterProvider router={router} />
      <Toaster />
    </ThemeProvider>
  );
}
