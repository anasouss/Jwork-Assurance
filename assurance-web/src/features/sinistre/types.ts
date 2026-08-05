export type StatutSinistre =
  | "BROUILLON"
  | "DECLARE"
  | "DOSSIER_INCOMPLET"
  | "TRANSMIS_COMPAGNIE"
  | "EXPERTISE"
  | "EN_ATTENTE_REGLEMENT"
  | "PARTIELLEMENT_REGLE"
  | "REGLE"
  | "CLOTURE"
  | "REJETE"
  | "ANNULE"
  | "ROUVERT";

export type NatureSinistre =
  | "ACCIDENT"
  | "VOL"
  | "INCENDIE"
  | "BRIS_DE_GLACE"
  | "DOMMAGE_VEHICULE"
  | "CORPOREL"
  | "ASSISTANCE"
  | "AUTRE";

export type DecisionCouverture = "A_ETUDIER" | "ACCEPTEE" | "REFUSEE";
export type TypePartie =
  | "CONDUCTEUR"
  | "PASSAGER"
  | "TIERS"
  | "TEMOIN"
  | "AUTRE";
export type TypeOperation = "REGLEMENT" | "RECOURS" | "FRAIS" | "ANNULATION";
export type TypeDocument =
  | "DECLARATION"
  | "CONSTAT"
  | "PV_POLICE"
  | "CARTE_GRISE"
  | "PERMIS"
  | "PHOTO"
  | "DEVIS"
  | "RAPPORT_EXPERT"
  | "ACCORD"
  | "FACTURE"
  | "REGLEMENT"
  | "RECOURS"
  | "AUTRE";

export type PageMetadata = {
  number: number;
  size: number;
  totalPages: number;
  totalElements: number;
  first: boolean;
  last: boolean;
};

export type PagedResponse<T> = { items: T[]; page: PageMetadata };

export type SinistreSummary = {
  id: string;
  numeroSinistre: string;
  referenceCompagnie?: string | null;
  statut: StatutSinistre;
  nature: NatureSinistre;
  dateSinistre: string;
  dateDeclaration: string;
  numeroPolice?: string | null;
  numeroDossier?: string | null;
  compagnie?: string | null;
  assure?: string | null;
  immatriculation?: string | null;
  gestionnaire?: string | null;
  provisionCourante: number;
  totalRegle: number;
  totalRecours: number;
  updatedAt: string;
};

export type SinistreDashboard = {
  ouverts: number;
  declaresCeMois: number;
  enExpertise: number;
  enAttenteReglement: number;
  provisionsOuvertes: number;
  reglementsAnnee: number;
  recoursAnnee: number;
  recents: SinistreSummary[];
};

export type CoveragePreview = {
  contratId: string;
  numeroDossier?: string | null;
  numeroPolice?: string | null;
  compagnie: string;
  assure: string;
  mouvementId: string;
  numeroMouvement: string;
  mouvement: string;
  dateEffet: string;
  dateEcheance: string;
  vehicules: Array<{
    id: string;
    immatriculation?: string | null;
    numeroAttestation?: string | null;
    marque?: string | null;
    usageCode?: string | null;
    usageLibelle?: string | null;
    garanties: Array<{
      id: string;
      mouvementGarantieId: string;
      code: string;
      libelle: string;
      capital?: number | null;
      prime?: number | null;
      taux?: number | null;
      tauxFranchise?: number | null;
      franchiseMinimale?: number | null;
    }>;
  }>;
};

export type SinistreDetail = SinistreSummary & {
  version: number;
  heureSinistre?: string | null;
  dateTransmission?: string | null;
  dateCloture?: string | null;
  villeId?: string | null;
  ville?: string | null;
  lieu?: string | null;
  circonstances?: string | null;
  numeroPv?: string | null;
  tauxResponsabilite?: number | null;
  notes?: string | null;
  gestionnaireId?: string | null;
  couverture: {
    contratId: string;
    mouvementId: string;
    numeroMouvement: string;
    numeroDossier?: string | null;
    numeroPolice?: string | null;
    compagnie: string;
    clientCode?: string | null;
    assure: string;
    dateEffet: string;
    dateEcheance: string;
    vehiculeId?: string | null;
    immatriculation?: string | null;
    numeroAttestation?: string | null;
    marque?: string | null;
    usageCode?: string | null;
    usageLibelle?: string | null;
  };
  totaux: {
    provisionCourante: number;
    totalRegle: number;
    totalFrais: number;
    totalRecours: number;
    resteARegler: number;
  };
  garanties: Array<{
    id: string;
    garantieId: string;
    code: string;
    libelle: string;
    impliquee: boolean;
    capital?: number | null;
    prime?: number | null;
    taux?: number | null;
    tauxFranchise?: number | null;
    franchiseMinimale?: number | null;
    decisionCouverture: DecisionCouverture;
    franchiseAppliquee?: number | null;
    montantIndemnisable?: number | null;
  }>;
  parties: Array<{
    id: string;
    type: TypePartie;
    nom: string;
    telephone?: string | null;
    cin?: string | null;
    numeroPermis?: string | null;
    immatriculation?: string | null;
    compagnieAdverse?: string | null;
    numeroPoliceAdverse?: string | null;
    notes?: string | null;
  }>;
  documents: Array<{
    id: string;
    type: TypeDocument;
    statut: "RECU" | "VALIDE" | "REJETE";
    nomFichier: string;
    contentType?: string | null;
    tailleOctets: number;
    commentaire?: string | null;
    deposePar: string;
    validePar?: string | null;
    createdAt: string;
    dateValidation?: string | null;
  }>;
  missionsExpertise: Array<{
    id: string;
    expertId: string;
    expert: string;
    garageId?: string | null;
    garage?: string | null;
    referenceMission?: string | null;
    dateMission: string;
    dateRapport?: string | null;
    montantEstime?: number | null;
    montantAccepte?: number | null;
    statut: "A_MANDATER" | "MANDATEE" | "RAPPORT_RECU" | "VALIDEE" | "ANNULEE";
    notes?: string | null;
  }>;
  provisions: Array<{
    id: string;
    dateProvision: string;
    montant: number;
    motif: string;
    saisiePar: string;
    createdAt: string;
  }>;
  operations: Array<{
    id: string;
    type: TypeOperation;
    dateOperation: string;
    montant: number;
    reference?: string | null;
    beneficiaire?: string | null;
    modeReglement?: string | null;
    notes?: string | null;
    operationAnnuleeId?: string | null;
    saisiePar: string;
    createdAt: string;
  }>;
  evenements: Array<{
    id: string;
    type: string;
    description: string;
    ancienStatut?: StatutSinistre | null;
    nouveauStatut?: StatutSinistre | null;
    utilisateur: string;
    createdAt: string;
  }>;
};

export type Intervenant = {
  id: string;
  code: string;
  nom: string;
  telephone?: string | null;
  email?: string | null;
  adresse?: string | null;
  villeId?: string | null;
  ville?: string | null;
  actif: boolean;
};
