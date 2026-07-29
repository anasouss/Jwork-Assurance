export type TypeContrat = "PARTICULIER" | "CONVENTION" | "FLOTTE";
export type CategorieMouvement =
  | "AFFAIRE_NOUVELLE"
  | "AVENANT"
  | "RENOUVELLEMENT"
  | "DOCUMENT"
  | "SERVICE";
export type StatutAffectation =
  | "NON_AFFECTEE"
  | "PARTIELLEMENT_AFFECTEE"
  | "AFFECTEE"
  | "AVEC_ECART";
export type SourceAffectation = "AUTOMATIQUE" | "MANUEL" | "IMPORT";
export type ModeAffectation = "AUTOMATIQUE" | "MANUEL_OU_IMPORT";
export type ModeCalculCommission = "TAUX_NET" | "TAUX_BRUT_TVA_INCLUSE";

export type Rule = {
  id: string;
  compagnieAssuranceId: string;
  compagnie: string;
  typeContrat: TypeContrat;
  modeAffectation: ModeAffectation;
  modeCalculCommission: ModeCalculCommission;
  tauxCommissionAutomobile: number;
  tauxCommissionEvcat: number;
  tauxCommissionCorporel: number;
  tauxTvaIncluseCommission: number;
  retenueParDefaut: boolean;
  tauxRetenue: number;
  dateDebut: string;
  dateFin?: string | null;
  actif: boolean;
};

export type RuleRequest = Omit<Rule, "id" | "compagnie">;

export type RulePage = {
  rows: Rule[];
  page: {
    number: number;
    size: number;
    totalElements: number;
    totalPages: number;
    first: boolean;
    last: boolean;
  };
};

export type AllocationLine = {
  id?: string;
  numeroQuittanceCompagnie: string;
  source: SourceAffectation;
  dateEffet: string;
  dateEcheance?: string | null;
  acteSource?: string | null;
  categorieSource?: string | null;
  statutSource?: string | null;
  fichierSource?: string | null;
  primeNette: number;
  montantTaxes: number;
  accessoires: number;
  montantTtc: number;
  commissionNette: number;
  avecRetenue: boolean;
  tauxRetenue: number;
  montantRetenue: number;
  netCompagnie: number;
};

export type QuittanceAllocation = {
  quittanceId: string;
  contratId: string;
  mouvementId?: string | null;
  dossier: string;
  produit: string;
  typeContrat: TypeContrat;
  mouvement: string;
  nature?: CategorieMouvement | null;
  souscripteur: string;
  police: string;
  compagnieId?: string | null;
  compagnie: string;
  dateEffet: string;
  dateEcheance?: string | null;
  primeNette: number;
  montantTaxes: number;
  accessoires: number;
  montantTtc: number;
  montantAffecte: number;
  ecart: number;
  numerosQuittanceCompagnie: string;
  commissionCalculee?: number | null;
  retenueCalculee?: number | null;
  netCompagnieCalcule?: number | null;
  avecRetenue: boolean;
  statutAffectation: StatutAffectation;
  regle?: Rule | null;
  lignes: AllocationLine[];
};

export type QuittancePage = {
  summary: {
    total: number;
    nonAffectees: number;
    partiellementAffectees: number;
    affectees: number;
    avecEcart: number;
    montantTtc: number;
    montantAffecte: number;
  };
  page: {
    number: number;
    size: number;
    totalElements: number;
    totalPages: number;
    first: boolean;
    last: boolean;
  };
  rows: QuittanceAllocation[];
};

export type AllocationRequestLine = Pick<
  AllocationLine,
  | "numeroQuittanceCompagnie"
  | "dateEffet"
  | "dateEcheance"
  | "acteSource"
  | "categorieSource"
  | "statutSource"
  | "primeNette"
  | "montantTaxes"
  | "accessoires"
  | "montantTtc"
  | "commissionNette"
>;

export type AllocationRequest = {
  source: SourceAffectation;
  avecRetenue: boolean;
  numeroQuittanceCompagnie?: string;
  fichierSource?: string;
  lignes: AllocationRequestLine[];
};

export type ImportPreview = {
  fichier: string;
  lignesLues: number;
  lignes: AllocationLine[];
  erreurs: string[];
  primeNette: number;
  montantTaxes: number;
  accessoires: number;
  montantTtc: number;
  commissionNette: number;
  netCompagnie: number;
  ecart: number;
  equilibre: boolean;
};

export type ReferenceOption = {
  id: string;
  code?: string;
  libelle: string;
};
