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
        path: "companies",
        lazy: lazyRoute(() => import("@/features/production/pages/CompaniesDashboardPage")),
      },
      {
        path: "companies/liste",
        lazy: lazyRoute(() => import("@/features/production/pages/CompaniesPage")),
      },
      {
        path: "companies/conventions",
        lazy: lazyRoute(() => import("@/features/production/pages/CompaniesConventionsPage")),
      },
      {
        path: "admin",
        lazy: lazyRoute(() => import("@/features/admin/pages/AdminPage")),
      },
      {
        path: "production/parametres",
        lazy: lazyRoute(() => import("@/features/production/pages/ProductionSettingsPage")),
      },
      {
        path: "production/parametres/tarifs-usage",
        lazy: lazyRoute(() => import("@/features/production/pages/TarifUsageSettingsPage")),
      },
      {
        path: "production/parametres/usages",
        lazy: lazyRoute(() => import("@/features/production/pages/UsagesSettingsPage")),
      },
      {
        path: "production/parametres/garanties",
        lazy: lazyRoute(() => import("@/features/production/pages/GarantiesSettingsPage")),
      },
      {
        path: "production/parametres/marques",
        lazy: lazyRoute(() => import("@/features/production/pages/MarquesSettingsPage")),
      },
      {
        path: "production/parametres/carrosseries",
        lazy: lazyRoute(() => import("@/features/production/pages/CarrosseriesSettingsPage")),
      },
      {
        path: "production/parametres/carburants",
        lazy: lazyRoute(() => import("@/features/production/pages/CarburantsSettingsPage")),
      },
      {
        path: "production/parametres/sous-classes",
        lazy: lazyRoute(() => import("@/features/production/pages/SousClassesSettingsPage")),
      },
      {
        path: "production/parametres/categories-transport",
        lazy: lazyRoute(() => import("@/features/production/pages/CategoriesTransportSettingsPage")),
      },
      { path: "*", lazy: lazyRoute(() => import("@/pages/app/AppNotFound")) },
    ],
  },
  { path: "*", lazy: lazyRoute(() => import("@/pages/NotFound")) },
]);
