export type EtapeSuiviSinistre = "OUVERTURE" | "EXPERTISE_AVANT" | "INSTANCE_CLIENT" | "EXPERTISE_APRES" | "COMPAGNIE" | "CLOTURE";
export type TypeDommageSinistre = "MATERIEL" | "CORPOREL" | "MIXTE";
export type ModeReparationSinistre = "NORMAL" | "PEC" | "RAPIDE";
export type PhaseExpertise = "AVANT" | "APRES";
export type EtapeTransition = { etapeSuivi: EtapeSuiviSinistre; autorisee: boolean; blocages: string[]; motifObligatoire: boolean };
export type SinistreListParams = {
  query?: string;
  clientId?: string;
  contratId?: string;
  brancheId?: string;
  statut?: StatutSinistre;
  etapeSuivi?: EtapeSuiviSinistre;
  dateDu?: string;
  dateAu?: string;
  page?: number;
  size?: number;
};
export type TypeRechercheContratSinistre = "POLICE" | "IMMATRICULATION" | "ASSURE";
export type SinistreContractOption = {
  id: string;
  numeroPolice?: string | null;
  numeroDossier?: string | null;
  brancheAssuranceCode?: string | null;
  brancheAssuranceLibelle?: string | null;
  compagnieCode?: string | null;
  compagnieLibelle?: string | null;
  clients?: Array<{ role: string; nomAffichage?: string | null }>;
  vehiculesCorrespondants?: Array<{ id: string; immatriculation?: string | null }>;
  dateEffet?: string | null;
  dateEcheance?: string | null;
};
export type OpeningDocument = {
  file: File;
  type: "CONSTAT" | "PV_POLICE" | "DECLARATION";
  dateDocument?: string;
  reference?: string;
  commentaire?: string;
};
export type MissionExpertiseRequest = {
  expertId: string;
  garageId?: string;
  phase: PhaseExpertise;
  referenceMission?: string;
  dateMission: string;
  dateRapport?: string;
  montantEstime?: number;
  montantAccepte?: number;
  statut: SinistreDetail["missionsExpertise"][number]["statut"];
  notes?: string;
};
export type SinistreOpeningRequest = {
  contratId: string;
  vehiculeId?: string;
  dateSinistre: string;
  dateDeclaration: string;
  garantieIds: string[];
  assistanceIds?: string[];
  declarer: boolean;
  referenceCompagnie?: string;
  tauxResponsabilite?: number;
  typeDommage?: TypeDommageSinistre;
  modeReparation?: ModeReparationSinistre;
  garageId?: string;
  expertInitial?: MissionExpertiseRequest;
};

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

export type DecisionCouverture =
  | "A_ETUDIER"
  | "ACCEPTEE"
  | "PARTIELLE"
  | "REFUSEE";
export type TypePartie =
  | "CONDUCTEUR"
  | "PASSAGER"
  | "ADVERSAIRE"
  | "VICTIME"
  | "BENEFICIAIRE";
export type TypeOperation = "REGLEMENT" | "RECOURS" | "FRAIS" | "ANNULATION";
export type CircuitFinancierSinistre = "DIRECT_COMPAGNIE" | "TRESORERIE_AGENCE";
export type ModeReglementSinistre =
  | "VIREMENT"
  | "CHEQUE"
  | "ESPECES"
  | "COMPENSATION"
  | "AUTRE";
export type TypeContrepartieSinistre =
  | "CLIENT"
  | "PARTIE"
  | "EXPERT"
  | "GARAGE"
  | "AUTRE";
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
  editable?: boolean;
  numeroSinistre: string;
  referenceCompagnie?: string | null;
  etapeSuivi: EtapeSuiviSinistre;
  typeDommage?: TypeDommageSinistre | null;
  modeReparation?: ModeReparationSinistre | null;
  tauxResponsabilite?: number | null;
  garageId?: string | null;
  garage?: string | null;
  premierExpert?: string | null;
  garantiesImpliquees?: string[];
  statut: StatutSinistre;
  dateSinistre: string;
  dateDeclaration: string;
  numeroPolice?: string | null;
  numeroDossier?: string | null;
  compagnie?: string | null;
  assure?: string | null;
  immatriculation?: string | null;
  gestionnaire?: string | null;
  prochaineAction?: string | null;
  dateEcheanceAction?: string | null;
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
  actionsEnRetard: number;
  provisionsOuvertes: number;
  reglementsAnnee: number;
  recoursAnnee: number;
  recents: SinistreSummary[];
};

export type SinistreStatistics = {
  annee: number;
  dateSituation: string;
  anneesDisponibles: number[];
  declares: number;
  ouverts: number;
  clotures: number;
  rejetes: number;
  actionsEnRetard: number;
  delaiMoyenClotureJours: number | null;
  provisionsOuvertes: number;
  reglementsCumules: number;
  recoursCumules: number;
  fraisCumules: number;
  evolution: { mois: number; declarations: number }[];
  parEtape: { code: string; libelle: string; nombre: number }[];
  parBranche: { code: string; libelle: string; nombre: number }[];
  parCompagnie: { id: string; nom: string; dossiers: number; provisions: number; reglements: number; recours: number; frais: number }[];
};

export type ClaimAssistance = {
  id: string;
  reference?: string | null;
  compagnie?: string | null;
  produit?: string | null;
  dateEffet: string;
  dateEcheance: string;
};

export type CoveragePreview = {
  contratId: string;
  numeroDossier?: string | null;
  numeroPolice?: string | null;
  brancheCode?: string | null;
  brancheLibelle?: string | null;
  compagnie: string;
  assure: string;
  mouvementId: string;
  numeroMouvement: string;
  mouvement: string;
  dateEffet: string;
  dateEcheance: string;
  garanties: CoverageGuarantee[];
  vehicules: Array<{
    id: string;
    immatriculation?: string | null;
    numeroAttestation?: string | null;
    marque?: string | null;
    usageCode?: string | null;
    usageLibelle?: string | null;
    garanties: CoverageGuarantee[];
  }>;
};

export type CoverageGuarantee = {
  id: string;
  mouvementGarantieId: string;
  code: string;
  libelle: string;
  responsabiliteCivile: boolean;
  typeGarantie: "VEHICULE" | "PERSONNE";
  capital?: number | null;
  prime?: number | null;
  taux?: number | null;
  tauxFranchise?: number | null;
  franchiseMinimale?: number | null;
};

export type SinistreDetail = Omit<SinistreSummary,
  | "numeroPolice" | "numeroDossier" | "compagnie" | "assure" | "immatriculation"
  | "provisionCourante" | "totalRegle" | "totalRecours" | "updatedAt"
> & {
  version: number;
  dateTransmission?: string | null;
  dateCloture?: string | null;
  tauxResponsabilite?: number | null;
  notes?: string | null;
  gestionnaireId?: string | null;
  prochaineAction?: string | null;
  dateEcheanceAction?: string | null;
  couverture: {
    contratId: string;
    mouvementId: string;
    numeroMouvement: string;
    numeroDossier?: string | null;
    numeroPolice?: string | null;
    brancheCode?: string | null;
    brancheLibelle?: string | null;
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
    totalIndemnisable: number;
    totalRegle: number;
    totalFrais: number;
    totalRecours: number;
    resteARegler: number;
  };
  assistances?: ClaimAssistance[];
  garanties: Array<{
    id: string;
    garantieId: string;
    code: string;
    libelle: string;
    impliquee: boolean;
    responsabiliteCivile: boolean;
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
    dateDocument?: string | null;
    reference?: string | null;
    montant?: number | null;
    emetteur?: string | null;
    sinistreGarantieId?: string | null;
    garantie?: string | null;
    missionExpertiseId?: string | null;
    missionExpertise?: string | null;
    garageId?: string | null;
    garage?: string | null;
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
    phase: PhaseExpertise;
    garageId?: string | null;
    garage?: string | null;
    referenceMission?: string | null;
    dateMission: string;
    dateRapport?: string | null;
    montantEstime?: number | null;
    montantAccepte?: number | null;
    statut:
      | "A_MANDATER"
      | "MANDATEE"
      | "EN_COURS"
      | "RAPPORT_RECU"
      | "VALIDEE"
      | "ANNULEE";
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
    compagnieAssuranceId?: string | null;
    compagnieAssurance?: string | null;
    typeContrepartie?: TypeContrepartieSinistre | null;
    contrepartieId?: string | null;
    contrepartie?: string | null;
    justificationContrepartieLibre?: string | null;
    beneficiaire?: string | null;
    modeReglement?: ModeReglementSinistre | null;
    circuitFinancier?: CircuitFinancierSinistre | null;
    compteTresorerieId?: string | null;
    compteTresorerie?: string | null;
    operationTresorerieId?: string | null;
    numeroOperationTresorerie?: string | null;
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
    ancienneEtape?: EtapeSuiviSinistre | null;
    nouvelleEtape?: EtapeSuiviSinistre | null;
    utilisateur: string;
    createdAt: string;
  }>;
  workflow: {
    etapes: EtapeTransition[];
    transitions: Array<{
      statut: StatutSinistre;
      autorisee: boolean;
      blocages: string[];
    }>;
    documentsRecus: number;
    documentsRejetes: number;
    documentsRequis: Array<{
      id: string;
      type: TypeDocument;
      libelle: string;
      obligatoire: boolean;
      recu: boolean;
      valide: boolean;
    }>;
  };
};

export type SinistreGestionnaire = {
  id: string;
  nom: string;
};

export type SinistreTreasuryAccount = {
  id: string;
  code: string;
  libelle: string;
  typeCompte: "CAISSE" | "BANQUE";
  natureCaisse?: "INDIVIDUELLE" | "CENTRALE" | null;
  devise: string;
  soldeCourant: number;
};

export type SinistreDuplicate = {
  id: string;
  numeroSinistre: string;
  statut: StatutSinistre;
  dateSinistre: string;
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
  conventionne?: boolean;
  typePrestataire?: "EXPERT" | "GARAGE";
  toutesCompagnies?: boolean;
  specialites?: ProviderSpecialty[];
  accords?: ProviderAgreement[];
};

export type ProviderKind = "EXPERT" | "GARAGE";
export type ProviderReference = { id: string; libelle: string };
export type ProviderSpecialty = {
  id: string; code: string; libelle: string; typePrestataire: ProviderKind; actif: boolean;
  garanties: ProviderReference[];
};
export type ProviderAgreement = {
  compagnieId: string; compagnie?: string; actif: boolean; conventionne: boolean;
  dateDebut?: string | null; dateFin?: string | null;
};
export type ProviderEligibilityContext = {
  sinistreId?: string; contratId?: string; vehiculeId?: string; dateSinistre?: string;
  garantieIds?: string[]; modeReparation?: ModeReparationSinistre; dateIntervention?: string;
};
