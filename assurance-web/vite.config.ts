import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "next/link": path.resolve(__dirname, "src/next-link.tsx"),
      "next/navigation": path.resolve(__dirname, "src/next-navigation.ts"),
    },
  },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          ui: [
            "@radix-ui/react-alert-dialog",
            "@radix-ui/react-avatar",
            "@radix-ui/react-collapsible",
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-progress",
            "@radix-ui/react-separator",
            "@radix-ui/react-slot",
            "@radix-ui/react-tooltip",
            "lucide-react",
            "sonner",
            "cmdk",
          ],
          forms: ["react-hook-form", "@hookform/resolvers", "zod"],
          utils: ["date-fns", "clsx", "class-variance-authority", "tailwind-merge"],
        },
      },
    },
  },
});
