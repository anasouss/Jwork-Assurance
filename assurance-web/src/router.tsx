import type { ComponentType } from "react";
import { Navigate, createBrowserRouter } from "react-router-dom";

const lazyRoute = (load: () => Promise<{ default: ComponentType }>) => async () => {
  const module = await load();
  return { Component: module.default };
};

export const router = createBrowserRouter([
  {
    path: "/login",
    lazy: lazyRoute(() => import("@/pages/public/LoginPage")),
  },
  {
    path: "/",
    element: <Navigate to="/app" replace />,
  },
  {
    path: "/app",
    lazy: lazyRoute(() => import("@/layouts/AppLayout")),
    children: [
      { index: true, lazy: lazyRoute(() => import("@/pages/app/AppIndexPage")) },
      {
        path: "production",
        lazy: lazyRoute(() => import("@/features/production/pages/ProductionDashboardPage")),
      },
      {
        path: "production/ajouter-dossier",
        lazy: lazyRoute(() => import("@/features/production/pages/ContratCreationPage")),
      },
      {
        path: "production/ajouter-dossier/particulier",
        lazy: lazyRoute(() => import("@/features/production/pages/ParticulierContratCreationPage")),
      },
      {
        path: "production/ajouter-dossier/flotte",
        lazy: lazyRoute(() => import("@/features/production/pages/FlotteContratCreationPage")),
      },
      {
        path: "production/ajouter-dossier/convention",
        lazy: lazyRoute(() => import("@/features/production/pages/ConventionContratCreationPage")),
      },
      {
        path: "production/contrats",
        lazy: lazyRoute(() => import("@/features/production/pages/ContratsPage")),
      },
      {
        path: "production/attestations-stock",
        lazy: lazyRoute(() => import("@/features/production/pages/AttestationStockPage")),
      },
      {
        path: "compta/quittances",
        lazy: lazyRoute(() => import("@/features/production/pages/QuittancesPage")),
      },
      {
        path: "production/parametres",
        lazy: lazyRoute(() => import("@/features/production/pages/ProductionSettingsPage")),
      },
      { path: "*", lazy: lazyRoute(() => import("@/pages/app/AppNotFound")) },
    ],
  },
  { path: "*", lazy: lazyRoute(() => import("@/pages/NotFound")) },
]);
