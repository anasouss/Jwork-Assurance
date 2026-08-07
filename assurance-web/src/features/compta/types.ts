export type TypeContrat = "PARTICULIER" | "CONVENTION" | "FLOTTE";
export type CategorieMouvement =
  | "AFFAIRE_NOUVELLE"
  | "AVENANT"
  | "RENOUVELLEMENT"
  | "CARTE_VERTE";
export type StatutAffectation =
  | "NON_AFFECTEE"
  | "PARTIELLEMENT_AFFECTEE"
  | "AFFECTEE"
  | "AVEC_ECART";
export type SourceAffectation = "AUTOMATIQUE" | "MANUEL" | "IMPORT";
export type ModeAffectation = "AUTOMATIQUE" | "MANUEL_OU_IMPORT";
export type ModeVentilationQuittance = "GLOBALE" | "PAR_CATEGORIE";
export type ModeCalculCommission = "TAUX_NET" | "TAUX_BRUT_TVA_INCLUSE";
export type NiveauEcartAffectation = "EQUILIBRE" | "AVERTISSEMENT" | "BLOQUANT";

export type Rule = {
  id: string;
  compagnieAssuranceId: string;
  compagnie: string;
  typeContrat: TypeContrat;
  modeAffectation: ModeAffectation;
  modeVentilation: ModeVentilationQuittance;
  modeCalculCommission: ModeCalculCommission;
  tauxCommissionAutomobile: number;
  tauxCommissionEvcat: number;
  tauxCommissionCorporel: number;
  tauxTvaIncluseCommission: number;
  retenueParDefaut: boolean;
  tauxRetenue: number;
  seuilAvertissementEcart: number;
  margeManquanteMaximale: number;
  margeDepassementMaximale: number;
  dateDebut: string;
  dateFin?: string | null;
  excelFeuille?: string | null;
  excelLigneEntete: number;
  excelColonneNumeroPolice?: string | null;
  excelColonneNumeroQuittance?: string | null;
  excelColonneDateEffet?: string | null;
  excelColonneDateEcheance?: string | null;
  excelColonnePrimeNette?: string | null;
  excelColonneTaxes?: string | null;
  excelColonneAccessoires?: string | null;
  excelColonneMontantTtc?: string | null;
  excelColonneCommissionNette?: string | null;
  excelColonneNetCompagnie?: string | null;
  excelColonneActe?: string | null;
  excelColonneCategorie?: string | null;
  excelColonneStatut?: string | null;
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
  quittanceId?: string | null;
  numeroQuittanceCompagnie: string;
  source: SourceAffectation;
  dateEffet: string;
  dateEcheance?: string | null;
  acteSource?: string | null;
  categorieSource?: string | null;
  categorieQuittance?: "AUTOMOBILE" | "EVCAT" | "CORPOREL" | "ASSISTANCE" | "TOTAL" | null;
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
  | "categorieQuittance"
  | "statutSource"
  | "primeNette"
  | "montantTaxes"
  | "accessoires"
  | "montantTtc"
  | "commissionNette"
>;

export type BatchAllocationRequest = {
  quittanceIds: string[];
  source: SourceAffectation;
  avecRetenue: boolean;
  fichierSource?: string;
  lignes: Array<AllocationRequestLine & { quittanceId: string }>;
};

export type BatchAllocationResponse = {
  quittances: QuittanceAllocation[];
  lignes: AllocationLine[];
  montantTtcAttendu: number;
  montantTtcAffecte: number;
  ecart: number;
  equilibre: boolean;
  seuilAvertissementEcart: number;
  margeManquanteMaximale: number;
  margeDepassementMaximale: number;
  niveauEcart: NiveauEcartAffectation;
  validationAutorisee: boolean;
};

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
  seuilAvertissementEcart: number;
  margeManquanteMaximale: number;
  margeDepassementMaximale: number;
  niveauEcart: NiveauEcartAffectation;
  validationAutorisee: boolean;
};

export type ReferenceOption = {
  id: string;
  code?: string;
  libelle: string;
};

export type ClientDocumentType = "RELEVE" | "FACTURE";
export type ClientDocumentStatus = "EMIS" | "ANNULE";
export type BillableElementNature =
  | "CONTRAT"
  | "MOUVEMENT_CONTRAT"
  | "CARTE_VERTE"
  | "ASSISTANCE"
  | "FRAIS_DOCUMENT";
export type ConventionBillingStatus = "A_FACTURER" | "FACTUREE" | "ANNULEE";
export type Fractionnement = "MENSUEL" | "TRIMESTRIEL" | "SEMESTRIEL" | "ANNUEL";

export type ConventionBillingInstallment = {
  id: string;
  contratId: string;
  documentId?: string | null;
  payeurId: string;
  payeurType: "CLIENT" | "GROUPE";
  payeurNom: string;
  numeroDossier?: string | null;
  numeroPolice?: string | null;
  compagnieId?: string | null;
  compagnie?: string | null;
  conventionId?: string | null;
  convention?: string | null;
  fractionnement: Fractionnement;
  numeroPeriode: number;
  nombrePeriodes: number;
  periodeDebut: string;
  periodeFin: string;
  dateEcheance: string;
  statut: ConventionBillingStatus;
  primeNette: number;
  taxes: number;
  accessoires: number;
  montantTtc: number;
};

export type ConventionBillingPage = {
  summary: {
    total: number;
    aFacturer: number;
    facturees: number;
    montantAFacturer: number;
  };
  page: PageInfo;
  rows: ConventionBillingInstallment[];
};

export type CreateConventionInvoiceRequest = {
  echeanceIds: string[];
  dateEcheance?: string;
  notes?: string;
};

export type ClientDocumentSource = {
  elementFacturableId?: string | null;
  documentClientId?: string | null;
  nature?: BillableElementNature | null;
  quittanceId?: string | null;
  contratId: string;
  mouvementId?: string | null;
  dossier: string;
  police: string;
  typeContrat: TypeContrat;
  mouvement: string;
  reference?: string | null;
  compagnie: string;
  dateEffet: string;
  dateEcheance?: string | null;
  payeurType: "CLIENT" | "GROUPE";
  payeurId: string;
  payeurNom: string;
  souscripteurId?: string | null;
  souscripteurNom?: string | null;
  primeNette: number;
  taxes: number;
  accessoires: number;
  montantTtc: number;
  dejaFacturee: boolean;
  facturable: boolean;
};

export type PageInfo = {
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
};

export type ClientDocumentSourcePage = {
  summary: {
    total: number;
  };
  page: PageInfo;
  rows: ClientDocumentSource[];
};

export type ClientDocumentLine = {
  id: string;
  quittanceId?: string | null;
  elementFacturableId?: string | null;
  nature?: BillableElementNature | null;
  echeanceFacturationConventionId?: string | null;
  contratId: string;
  mouvementId?: string | null;
  ordre: number;
  dateOperation: string;
  dateEcheance?: string | null;
  numeroDossier: string;
  numeroPolice: string;
  numeroQuittance: string;
  mouvement: string;
  compagnie: string;
  debit: number;
  credit: number;
  primeNette: number;
  taxes: number;
  accessoires: number;
  montantTtc: number;
};

export type ClientDocument = {
  id: string;
  typeDocument: ClientDocumentType;
  statut: ClientDocumentStatus;
  numero: string;
  dateEmission: string;
  periodeDebut: string;
  periodeFin: string;
  dateEcheance?: string | null;
  clientPayeurId?: string | null;
  groupePayeurId?: string | null;
  payeurNom: string;
  payeurIdentifiant?: string | null;
  payeurAdresse?: string | null;
  totalDebit: number;
  totalCredit: number;
  totalDocument: number;
  notes?: string | null;
  dateAnnulation?: string | null;
  motifAnnulation?: string | null;
  signatureDisponible: boolean;
  lignes: ClientDocumentLine[];
};

export type ClientDocumentPage = {
  summary: {
    total: number;
  };
  page: PageInfo;
  rows: ClientDocument[];
};

export type CreateClientDocumentRequest = {
  typeDocument: ClientDocumentType;
  elementFacturableIds: string[];
  dateEcheance?: string;
  notes?: string;
};

export type ClientPaymentMode =
  | "ESPECES"
  | "CHEQUE"
  | "EFFET"
  | "VIREMENT"
  | "VERSEMENT_BANCAIRE"
  | "CARTE"
  | "PRELEVEMENT";

export type ClientPaymentStatus = "VALIDE" | "ANNULE";
export type PaymentInstrumentStatus = "EN_ATTENTE" | "CONFIRME" | "REJETE" | "REMPLACE";
export type PaymentAllocationStatus = "EN_ATTENTE" | "CONFIRMEE" | "ANNULEE";
export type TreasuryAccountType = "CAISSE" | "BANQUE";

export type ClientReceivable = {
  source: ClientDocumentSource;
  montantConfirme: number;
  montantEnAttente: number;
  soldeOuvert: number;
  statut: "IMPAYEE" | "PARTIELLEMENT_REGLEE" | "COUVERTE_EN_ATTENTE" | "PAYEE";
};

export type ClientReceivablePage = {
  summary: {
    total: number;
    montantInitial: number;
    montantConfirme: number;
    montantEnAttente: number;
    soldeOuvert: number;
  };
  page: PageInfo;
  rows: ClientReceivable[];
};

export type PaymentAllocation = {
  id: string;
  elementFacturableId?: string | null;
  documentClientId?: string | null;
  montant: number;
  statut: PaymentAllocationStatus;
};

export type PaymentInstrument = {
  id: string;
  reglementId: string;
  numeroReglement: string;
  payeurNom: string;
  mode: ClientPaymentMode;
  statut: PaymentInstrumentStatus;
  montant: number;
  dateInstrument: string;
  dateEcheance?: string | null;
  referenceInstrument?: string | null;
  banqueEmettrice?: string | null;
  compteTresorerieId?: string | null;
  compteTresorerie?: string | null;
  affectations: PaymentAllocation[];
};

export type ClientPayment = {
  id: string;
  numero: string;
  dateReglement: string;
  clientPayeurId?: string | null;
  groupePayeurId?: string | null;
  payeurNom: string;
  statut: ClientPaymentStatus;
  montantTotal: number;
  montantNonAffecte: number;
  notes?: string | null;
  creePar: string;
  instruments: PaymentInstrument[];
};

export type ClientPaymentPage = {
  page: PageInfo;
  rows: ClientPayment[];
};

export type CreateClientPaymentRequest = {
  dateReglement: string;
  clientPayeurId?: string;
  groupePayeurId?: string;
  notes?: string;
  instruments: Array<{
    mode: ClientPaymentMode;
    montant: number;
    dateInstrument?: string;
    dateEcheance?: string;
    referenceInstrument?: string;
    banqueEmettrice?: string;
    compteTresorerieId?: string;
    affectations: Array<{
      elementFacturableId?: string;
      documentClientId?: string;
      montant: number;
    }>;
  }>;
};

export type ReplacePaymentInstrumentRequest = {
  mode: ClientPaymentMode;
  montant: number;
  dateInstrument?: string;
  dateEcheance?: string;
  referenceInstrument?: string;
  banqueEmettrice?: string;
  compteTresorerieId?: string;
};

export type TreasuryAccount = {
  id: string;
  code: string;
  libelle: string;
  typeCompte: TreasuryAccountType;
  nomBanque?: string | null;
  rib?: string | null;
  devise: string;
  soldeInitial: number;
  soldeCourant: number;
  actif: boolean;
};

export type UpsertTreasuryAccountRequest = {
  code: string;
  libelle: string;
  typeCompte: TreasuryAccountType;
  nomBanque?: string;
  rib?: string;
  soldeInitial: number;
  actif: boolean;
};

export type TreasuryMovement = {
  id: string;
  compteTresorerieId: string;
  compteTresorerie: string;
  instrumentReglementId?: string | null;
  nature: "REGLEMENT_CLIENT" | "REJET_INSTRUMENT" | "REMISE_BANQUE" | "TRANSFERT" | "AJUSTEMENT";
  sens: "ENTREE" | "SORTIE";
  dateOperation: string;
  dateValeur?: string | null;
  montant: number;
  reference?: string | null;
  libelle: string;
};

export type TreasuryMovementPage = {
  page: PageInfo;
  rows: TreasuryMovement[];
};
