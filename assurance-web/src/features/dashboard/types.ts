export type DashboardData = {
  dateDu: string;
  dateAu: string;
  kpis: DashboardKpis;
  workload: DashboardWorkload;
  productionMensuelle: DashboardMonthlyProduction[];
  portefeuilleParType: DashboardBreakdown[];
  productionParCategorie: DashboardBreakdown[];
  activitesRecentes: DashboardRecentActivity[];
};

export type DashboardKpis = {
  primeNette: number;
  taxes: number;
  primeTotale: number;
  quittances: number;
  mouvements: number;
  contratsActifs: number;
  contratsBrouillon: number;
  clientsActifs: number;
};

export type DashboardWorkload = {
  echeances30Jours: number;
  quittancesAAffecter: number;
  documentsAEmettre: number;
  alertesStock: number;
  controleStockActif: boolean;
};

export type DashboardMonthlyProduction = {
  annee: number;
  mois: number;
  periode: string;
  primeNette: number;
  primeTotale: number;
  quittances: number;
};

export type DashboardBreakdown = {
  code: string;
  libelle: string;
  montant: number;
  nombre: number;
};

export type DashboardRecentActivity = {
  contratId: string;
  mouvementId: string;
  numeroDossier?: string | null;
  numeroPolice?: string | null;
  typeContrat: string;
  mouvement: string;
  codeMouvement: string;
  compagnie?: string | null;
  dateEffet?: string | null;
  primeTotale: number;
};
