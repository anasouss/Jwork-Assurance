export type ApiResponse<T> = {
  success: boolean;
  message?: string;
  data: T;
};

export type ReferenceOption = {
  id: string;
  code?: string | null;
  libelle: string;
  description?: string | null;
  actif?: boolean | null;
  compagnieAssuranceId?: string | null;
  compagnieAssuranceLibelle?: string | null;
  critereSelectionTarif?: "TAUX_PRIME" | "TAUX_FRANCHISE" | null;
  [key: string]: unknown;
};

export type UpsertCompagnieAssistanceRequest = {
  code: string;
  nom: string;
  email?: string;
  telephone?: string;
  actif?: boolean;
};

export type UpsertProduitAssistanceRequest = {
  compagnieAssistanceId: string;
  categorieClientId?: string;
  libelle: string;
  type?: string;
  prestations?: string;
  usageIds?: string[];
  actif?: boolean;
};

export type UpsertCategorieClientRequest = {
  code: string;
  libelle: string;
  usageIds?: string[];
  actif?: boolean;
};

export type UpsertTarifProduitAssistanceRequest = {
  dateDebut: string;
  dateFin?: string;
  montantHt: number;
  montantTtc: number;
  actif?: boolean;
};

export type LivraisonAttestation = {
  id: string;
  agenceId?: string | null;
  compagnieAssuranceId: string;
  compagnieAssuranceNom: string;
  source: "COMMANDE" | "RECEPTION_DIRECTE";
  statut: "DEMANDEE" | "REFUSEE" | "RECEPTION_PARTIELLE" | "RECEPTION_COMPLETE" | "VALIDEE";
  dateDemande?: string | null;
  dateReception?: string | null;
  referenceCommande?: string | null;
  referenceBl?: string | null;
  quantiteDemandee: number;
  quantiteRecue: number;
  validee: boolean;
  lignes: LivraisonAttestationLigne[];
  lots: LivraisonAttestationLot[];
};

export type LivraisonAttestationLigne = {
  id: string;
  usageId?: string | null;
  usageCode?: string | null;
  groupeUsageAttestationId: string;
  groupeUsageAttestationCode: string;
  groupeUsageAttestationLibelle: string;
  quantiteDemandee: number;
  quantiteRecue: number;
};

export type LivraisonAttestationLot = {
  id: string;
  groupeUsageAttestationCode: string;
  prefixe: string;
  numeroDebut: string;
  numeroFin: string;
  quantite: number;
  actif: boolean;
};

export type AttestationStockStatus = "DISPONIBLE" | "RESERVEE" | "UTILISEE" | "ANNULEE" | "DESACTIVEE";

export type AttestationNumeroValidation = {
  controleStockActif: boolean;
  validationRequise: boolean;
  disponible: boolean;
  numeroNormalise?: string | null;
  prefixe?: string | null;
  codeUsageStock?: string | null;
  statut?: AttestationStockStatus | null;
  message?: string | null;
  suggestions?: string[];
};

export type AttestationStockDashboard = {
  controleStockActif: boolean;
  summary: {
    total: number;
    disponible: number;
    reservee: number;
    utilisee: number;
    annulee: number;
    desactivee: number;
  };
  stocksParCompagnieUsage: AttestationStockCompanyUsage[];
  seuils: SeuilStockAttestation[];
};

export type AttestationStockCompanyUsage = {
  compagnieAssuranceId: string;
  compagnieAssuranceNom: string;
  groupeUsageAttestationId: string;
  groupeUsageAttestationCode: string;
  groupeUsageAttestationLibelle: string;
  groupeUsageAttestationCouleur?: string | null;
  total: number;
  disponible: number;
  reservee: number;
  utilisee: number;
  annulee: number;
  desactivee: number;
  minimumStock?: number | null;
  stockFaible?: boolean | null;
};

export type AttestationStockItem = {
  id: string;
  compagnieAssuranceId: string;
  compagnieAssuranceNom: string;
  groupeUsageAttestationId: string;
  groupeUsageAttestationCode: string;
  groupeUsageAttestationLibelle: string;
  numero: string;
  serie?: string | null;
  statut: AttestationStockStatus;
  dateUtilisation?: string | null;
  dateAnnulation?: string | null;
  motifAnnulation?: string | null;
  assure?: string | null;
  numeroDossier?: string | null;
  numeroPolice?: string | null;
  dateEffet?: string | null;
  dateReception?: string | null;
  referenceLivraison?: string | null;
};

export type SeuilStockAttestation = {
  id: string;
  compagnieAssuranceId: string;
  compagnieAssuranceNom: string;
  groupeUsageAttestationId: string;
  groupeUsageAttestationCode: string;
  groupeUsageAttestationLibelle: string;
  minimumStock: number;
  stockDisponible: number;
  stockFaible: boolean;
  derniereEvaluation?: string | null;
};

export type UpsertSeuilStockAttestationRequest = {
  compagnieAssuranceId: string;
  groupeUsageAttestationId: string;
  minimumStock: number;
};

export type CreateLivraisonAttestationRequest = {
  compagnieAssuranceId: string;
  source: "COMMANDE" | "RECEPTION_DIRECTE";
  dateDemande?: string;
  dateReception?: string;
  referenceBl?: string;
  commentaireDecision?: string;
  lignes: {
    usageId?: string;
    groupeUsageAttestationId?: string;
    groupeUsageAttestationCode?: string;
    quantiteDemandee?: number;
    numeroDebut?: string;
    numeroFin?: string;
  }[];
};

export type AddLotAttestationRequest = {
  usageId?: string;
  groupeUsageAttestationId?: string;
  groupeUsageAttestationCode?: string;
  quantite?: number;
  numeroDebut: string;
  numeroFin: string;
};

export type AddLotsAttestationRequest = {
  lots: AddLotAttestationRequest[];
};

export type ElementFacturable = {
  id: string;
  contratId: string;
  numeroContrat?: string;
  mouvementContratId?: string | null;
  codeMouvement?: string | null;
  libelleMouvement?: string | null;
  compagnieAssuranceId?: string | null;
  fractionnement?: string | null;
  splitAllowed?: boolean | null;
  expectedSplitCount?: number | null;
  nature: string;
  statut: string;
  referenceSource?: string | null;
  libelle: string;
  dateDebut?: string | null;
  dateFin?: string | null;
  primeNette: number;
  taxe: number;
  taxeParafiscale: number;
  accessoire: number;
  cnpac: number;
  primeTotale: number;
  lignesQuittance?: QuittancePreview["lignes"];
  targetSummaries?: QuittancePreview["targetSummaries"];
};

export type MouvementDisponible = {
  code: string;
  libelle: string;
  categorie?: string | null;
  typeImpact?: string | null;
  modifieGaranties?: boolean | null;
  garantiesEditables?: boolean | null;
  modifieVehicule?: boolean | null;
  modifieRemorque?: boolean | null;
  cnpacSeul?: boolean | null;
  genereQuittance?: boolean | null;
  autoriseAssistance?: boolean | null;
  autoriseCarteVerte?: boolean | null;
  consommeAttestation?: boolean | null;
  clotureContrat?: boolean | null;
  renouvelleContrat?: boolean | null;
};

export type ContratActions = {
  contratId: string;
  renouvelable: boolean;
  avenantsAutorises: boolean;
  carteVerteAutorisee: boolean;
  assistanceAutorisee: boolean;
  mouvementsDisponibles: MouvementDisponible[];
};

export type MouvementContratRequest = {
  codeTypeMouvement: string;
  numeroMouvement?: string;
  dateEffet?: string;
  dateEcheance?: string;
  notes?: string;
};

export type AvenantRequest = {
  codeTypeMouvement: string;
  numeroMouvement?: string;
  dateEffet?: string;
  dateEcheance?: string;
  notes?: string;
  vehiculeIds?: string[];
  remorqueIds?: string[];
  precisions?: {
    vehiculeId?: string;
    remorqueId?: string;
    immatriculation?: string;
    immatriculationProvisoire?: string;
    numeroAttestation?: string;
  }[];
  attestations?: {
    vehiculeId?: string;
    remorqueId?: string;
    numeroAttestation?: string;
  }[];
  vehicules?: VehiculeInput[];
  remorques?: RemorqueInput[];
  garanties?: GarantieInput[];
  assistances?: {
    assistanceId?: string;
    vehiculeIndex: number;
    enabled?: boolean;
    compagnieAssistanceId?: string;
    produitAssistanceId?: string;
    dateSouscription?: string;
    dateEffet?: string;
    echeanceCode?: string;
    numeroContratOuQuittance?: string;
    typeQuittance?: string;
  }[];
};

export type AvenantDraft = {
  id: string;
  contratId: string;
  codeTypeMouvement: string;
  updatedAt?: string | null;
  request: AvenantRequest;
};

export type AvenantDraftSummary = {
  id: string;
  contratId: string;
  codeTypeMouvement: string;
  libelleTypeMouvement?: string | null;
  dateEffet?: string | null;
  dateEcheance?: string | null;
  updatedAt?: string | null;
};

export type AvenantContext = {
  contrat: ContratSummary;
  mouvementsDisponibles: MouvementDisponible[];
};

export type AvenantMovement = {
  id: string;
  code?: string | null;
  libelle?: string | null;
  categorie?: string | null;
  statut?: string | null;
  numeroMouvement?: string | null;
  dateEffet?: string | null;
  dateEcheance?: string | null;
  primeNette?: number | null;
  taxe?: number | null;
  taxeParafiscale?: number | null;
  accessoire?: number | null;
  cnpac?: number | null;
  primeTotale?: number | null;
};

export type AvenantDetail = {
  contratId: string;
  mouvement: AvenantMovement;
  donneesEnregistrees: AvenantRequest;
  impactFinancier?: QuittancePreview | null;
};

export type Quittance = QuittancePreview & {
  id?: string;
  contratId?: string;
  mouvementContratId?: string | null;
  codeMouvement?: string | null;
  typeImpactMouvement?: string | null;
  elementFacturableId?: string | null;
  numeroQuittance?: string | null;
  categorie?: string | null;
  globale?: boolean | null;
  dateDebut?: string | null;
  dateFin?: string | null;
};

export type TypeContrat = "PARTICULIER" | "CONVENTION" | "FLOTTE";
export type TypeClient = "PERSONNE_PHYSIQUE" | "PERSONNE_MORALE";
export type GenreClient = "HOMME" | "FEMME";
export type RoleClientContrat = "SOUSCRIPTEUR" | "PROPRIETAIRE" | "CONDUCTEUR" | "BENEFICIAIRE";
export type RelationGroupeClient = "TETE_GROUPE" | "FILIALE" | "SOCIETE_LIEE";
export type TypePayeurPrime = "SOUSCRIPTEUR" | "TRESORERIE_GROUPE" | "MEMBRE_GROUPE" | "TIERS_MANDATE";
export type ModeFacturationContrat = "DIRECTE" | "CONSOLIDEE_GROUPE";

export type ClientInput = {
  clientId?: string;
  sameAsRole?: RoleClientContrat;
  role: RoleClientContrat;
  principalPourRole: boolean;
  groupeClientId?: string;
  relationGroupe?: RelationGroupeClient;
  retirerGroupesActifs?: boolean;
  client: {
    typeClient: TypeClient;
    genre?: GenreClient;
    prenom?: string;
    nom?: string;
    raisonSociale?: string;
    cin?: string;
    cinValidite?: string;
    rc?: string;
    ice?: string;
    numeroPermis?: string;
    dateDelivrancePermis?: string;
    dateValiditePermis?: string;
    dateNaissance?: string;
    adresse?: string;
    villeId?: string;
    categorieClientId?: string;
    telephone?: string;
    email?: string;
    conducteurHabituel?: boolean;
    sahara?: boolean;
    justificatifSahara?: string;
    telephones?: { numero: string; principal?: boolean; whatsapp?: boolean }[];
  };
};

export type ClientResponse = ClientInput["client"] & {
  id: string;
  agenceId?: string | null;
  clientParentId?: string | null;
  codeClient?: string | null;
  nomAffichage?: string | null;
  ville?: string | null;
  villeSaharienne?: boolean | null;
  categorieClientCode?: string | null;
  categorieClientLibelle?: string | null;
  actif?: boolean | null;
  telephones?: { id?: string; numero: string; principal?: boolean; whatsapp?: boolean }[];
  groupe?: {
    id: string;
    code: string;
    libelle: string;
    typeRelation: RelationGroupeClient;
    clientTresorerieId?: string | null;
    clientTresorerieNom?: string | null;
    facturationConsolideeDefaut?: boolean | null;
  } | null;
};

export type GroupeClient = {
  id: string;
  code: string;
  libelle: string;
  clientTeteId?: string | null;
  clientTeteNom?: string | null;
  clientTresorerieId?: string | null;
  clientTresorerieNom?: string | null;
  facturationConsolideeDefaut: boolean;
  actif: boolean;
  membres: {
    membershipId: string;
    clientId: string;
    clientNom: string;
    typeRelation: RelationGroupeClient;
    dateDebut?: string | null;
    dateFin?: string | null;
    principal: boolean;
  }[];
};

export type ClientPage = {
  items: ClientResponse[];
  page: {
    number: number;
    size: number;
    totalPages: number;
    totalElements: number;
    first: boolean;
    last: boolean;
  };
};

export type PageMetadata = {
  number: number;
  size: number;
  totalPages: number;
  totalElements: number;
  first: boolean;
  last: boolean;
};

export type PagedResponse<T> = {
  items: T[];
  page: PageMetadata;
};

export type ClientCrm = {
  client: ClientResponse;
  groupes: GroupeClient[];
  contrats: {
    id: string;
    numeroDossier?: string | null;
    numeroPolice?: string | null;
    typeContrat?: string | null;
    statut?: string | null;
    dateEffet?: string | null;
    dateEcheance?: string | null;
    compagnie?: string | null;
    roleClient?: string | null;
    typePayeurPrime?: string | null;
    payeurPrimeNom?: string | null;
    modeFacturation?: string | null;
    primeTotale: number;
    mouvements: {
      id: string;
      numeroMouvement?: string | null;
      code?: string | null;
      libelle?: string | null;
      categorie?: string | null;
      statut?: string | null;
      dateEffet?: string | null;
      dateEcheance?: string | null;
      primeTotale: number;
    }[];
  }[];
  totalQuittances: number;
  totalImpayes: number;
};

export type VehiculeInput = {
  vehiculeId?: string | number;
  typeVehicule: "AUTOMOBILE" | "CAMION" | "MOTO" | "BUS" | "TRACTEUR" | "AUTRE";
  usageId?: string;
  marqueId?: string;
  marqueLibelle?: string;
  carrosserieId?: string;
  carrosserieLibelle?: string;
  categorieTransportId?: string;
  immatriculation?: string;
  immatriculationProvisoire?: string;
  carburant?: string;
  puissanceFiscale?: string;
  nombrePlaces?: string;
  sousClasse?: string;
  ptc?: string;
  datePremiereCirculation?: string;
  dateExpirationCarteGrise?: string;
  dateEffet?: string;
  dateEcheance?: string;
  crm?: string;
  numeroAttestation?: string;
  numeroAttestationInitiale?: string;
  coefficientProrata?: number;
  remorque?: boolean;
  valeurVenale?: number;
  valeurNeuf?: number;
  valeurGlace?: number;
  organismeCredit?: boolean;
  nomOrganismeCredit?: string;
  montantCredit?: number;
  dateFinCredit?: string;
};

export type VehiculeResponse = VehiculeInput & {
  vehiculeId?: string | number;
  usageCode?: string | null;
  usageLibelle?: string | null;
  groupeUsageAttestationCode?: string | null;
  consommeAttestation?: boolean | null;
  marque?: string | null;
  carrosserie?: string | null;
  categorieTransportCode?: string | null;
  categorieTransportLibelle?: string | null;
};

export type RemorqueInput = {
  remorqueId?: string | number;
  usageId?: string;
  marqueId?: string;
  marqueLibelle?: string;
  immatriculation?: string;
  ptc?: string;
  dateMiseEnCirculation?: string;
  dateEffet?: string;
  dateEcheance?: string;
  crm?: string;
  numeroAttestation?: string;
  numeroAttestationInitiale?: string;
  coefficientProrata?: number;
  valeurAssuree?: number;
};

export type GarantieInput = {
  garantieId: string;
  ligneGrilleTarifaireId?: string;
  clientId?: string;
  vehiculeIndex?: number;
  remorqueIndex?: number;
  modeSelectionne?: string;
  sourceValeurSelectionnee?: string;
  formuleGarantiePersonneId?: string;
  valeurVenale?: number;
  valeurNeuf?: number;
  valeurGlace?: number;
  valeurAssuree?: number;
  formule?: string;
  montantDeces?: number;
  montantInvalidite?: number;
  montantFraisMedicaux?: number;
  montantFraisHospitalisation?: number;
  montantFraisFuneraires?: number;
  montantFraisChirurgie?: number;
  accessoire?: number;
  capital?: number;
  taux?: number;
  prime?: number;
  tauxFranchise?: number;
  franchiseMinimale?: number;
};

export type QuittanceInput = {
  categorie: "AUTOMOBILE" | "CORPOREL" | "EVCAT" | "ASSISTANCE" | "TOTAL";
  ordre?: number;
  globale?: boolean;
  primeNette?: number;
  taxe?: number;
  taxeParafiscale?: number;
  accessoire?: number;
  cnpac?: number;
  primeTotale?: number;
};

export type AssistanceDraft = {
  assistanceId?: string;
  enabled: boolean;
  modified?: boolean;
  compagnieAssistanceId?: string;
  produitAssistanceId?: string;
  dateEffet?: string;
  dateSouscription?: string;
  echeanceCode?: string;
  dateEcheance?: string;
  numeroContratOuQuittance?: string;
};

export type AssistanceContrat = {
  id: string;
  contratId: string;
  mouvementContratId?: string | null;
  vehiculeId?: string | null;
  vehiculeImmatriculation?: string | null;
  compagnieAssistanceId?: string | null;
  compagnieAssistanceLibelle?: string | null;
  produitAssistanceId?: string | null;
  tarifProduitAssistanceId?: string | null;
  produit?: string | null;
  dateSouscription?: string | null;
  dateEffet?: string | null;
  dateEcheance?: string | null;
  echeanceCode?: string | null;
  numeroContratOuQuittance?: string | null;
  trimestres?: number | null;
  prorataRatio?: number | null;
  primeNette?: number | null;
  primeTotale?: number | null;
  elementFacturableId?: string | null;
};

export type AssistanceContratContext = {
  contratId: string;
  numeroDossier?: string | null;
  numeroPolice?: string | null;
  typeContrat: TypeContrat;
  dateEffet?: string | null;
  dateEcheance?: string | null;
  echeanceCode?: string | null;
  mouvementContratId?: string | null;
  mouvementCode?: string | null;
  mouvementLibelle?: string | null;
  categorieClientId?: string | null;
  vehiculesEligibles: {
    id: string;
    immatriculation?: string | null;
    usageId?: string | null;
    usageCode?: string | null;
    usageLibelle?: string | null;
    dateEffet?: string | null;
    dateEcheance?: string | null;
  }[];
  assistances: AssistanceContrat[];
  compagnies: {
    id: string;
    code?: string | null;
    libelle: string;
  }[];
  produits: {
    id: string;
    libelle: string;
    type?: string | null;
    compagnieAssistanceId?: string | null;
    categorieClientId?: string | null;
    usageIds?: string[];
    prestations?: string | null;
    tarifProduitAssistanceId?: string | null;
    dateDebutTarif?: string | null;
    dateFinTarif?: string | null;
    montantHt?: number | null;
    montantTtc?: number | null;
  }[];
};

export type UpsertAssistanceContratRequest = {
  mouvementContratId?: string | null;
  vehiculeId: string;
  compagnieAssistanceId: string;
  produitAssistanceId: string;
  dateSouscription?: string;
  dateEffet?: string;
  echeanceCode?: string;
  numeroContratOuQuittance?: string;
  typeQuittance?: string;
};

export type CarteVerte = {
  id: string;
  contratId: string;
  mouvementContratId?: string | null;
  vehiculeId?: string | null;
  vehiculeImmatriculation?: string | null;
  numero?: string | null;
  dateEffet?: string | null;
  dateEcheance?: string | null;
  numeroPoliceContrat?: string | null;
  numeroDossier?: string | null;
  montant?: number | null;
  elementFacturableId?: string | null;
};

export type CarteVerteContext = {
  contratId: string;
  numeroDossier?: string | null;
  numeroPolice?: string | null;
  typeContrat: TypeContrat;
  dateEffet?: string | null;
  dateEcheance?: string | null;
  mouvementContratId?: string | null;
  mouvementCode?: string | null;
  mouvementLibelle?: string | null;
  prefixeCarteVerte?: string | null;
  montant?: number | null;
  vehiculesEligibles: {
    id: string;
    immatriculation?: string | null;
    usageCode?: string | null;
    usageLibelle?: string | null;
    dateEffet?: string | null;
    dateEcheance?: string | null;
  }[];
  cartesVertes: CarteVerte[];
};

export type UpsertCarteVerteRequest = {
  mouvementContratId?: string | null;
  vehiculeId: string;
  numero: string;
  dateEffet?: string;
};

export type CreateContratRequest = {
  compagnieAssuranceId?: string;
  conventionId?: string;
  usageId?: string;
  grilleTarifaireId?: string;
  typeContrat: TypeContrat;
  numeroContrat?: string;
  numeroDevis?: string;
  numeroPolice?: string;
  numeroAttestation?: string;
  dateEffet?: string;
  dateEcheance?: string;
  echeance?: string;
  typeRenouvellement?: "renouvelable" | "ferme";
  modeTermeRenouvellement?: "CABINET" | "COMPAGNIE";
  periodicite?: string;
  modeReglement?: string;
  numeroBonCommande?: string;
  montantBulletin?: number;
  typePayeurPrime?: TypePayeurPrime;
  payeurPrimeClientId?: string;
  groupeFacturationId?: string;
  modeFacturation?: ModeFacturationContrat;
  fractionnement?: "ANNUEL" | "SEMESTRIEL" | "TRIMESTRIEL" | "MENSUEL";
  tauxRc?: number;
  modeSaisieGaranties?: "MANUELLE" | "MANUELLE_AVEC_PRIME_NETTE" | "AUTOMATIQUE_GRILLE";
  saisiePrimeNette?: boolean;
  nombreVehicules?: number;
  nombreRemorques?: number;
  prospection?: boolean;
  assistance?: boolean;
  crmPartage?: boolean;
  crmPartageValeur?: string;
  clients: ClientInput[];
  vehicules: VehiculeInput[];
  remorques: RemorqueInput[];
  garanties: GarantieInput[];
  quittances?: QuittanceInput[];
};

export type QuittancePreview = {
  numeroContrat?: string;
  type?: string;
  primeNette: number;
  taxe: number;
  taxeParafiscale: number;
  accessoire: number;
  cnpac: number;
  primeTotale: number;
  lignes: {
    categorie: string;
    ordre: number;
    globale: boolean;
    primeNette: number;
    taxe: number;
    taxeParafiscale: number;
    accessoire: number;
    cnpac: number;
    primeTotale: number;
  }[];
  garanties?: {
    garantieId?: string;
    code?: string;
    libelle?: string;
    typeGarantie?: string;
    vehiculeIndex?: number;
    remorqueIndex?: number;
    ligneGrilleTarifaireId?: string;
    modeSelectionne?: string;
    sourceValeurSelectionnee?: string;
    formuleGarantiePersonneId?: string;
    capital?: number;
    valeurVenale?: number;
    valeurNeuf?: number;
    valeurGlace?: number;
    taux?: number;
    primeAnnuelle?: number;
    primeNette?: number;
    tauxFranchise?: number;
    franchiseMinimale?: number;
  }[];
  assistances?: AssistanceContrat[];
  targetSummaries?: {
    kind?: string;
    vehiculeIndex?: number;
    remorqueIndex?: number;
    primeNette?: number;
    primeNetteHorsEvcat?: number;
    automobilePrimeNette?: number;
    corporelPrimeNette?: number;
    evcatPrimeNette?: number;
    taxe?: number;
    taxeParafiscale?: number;
    accessoire?: number;
    cnpac?: number;
    primeTotale?: number;
  }[];
};

export type EcheanceAutomobileRow = {
  contratId: string;
  dossier?: string | null;
  client?: string | null;
  codeClient?: string | null;
  police?: string | null;
  marque?: string | null;
  matricule?: string | null;
  dateEcheance?: string | null;
  typeContrat: TypeContrat;
  typeContratLabel?: string | null;
  compagnieId?: string | null;
  compagnie?: string | null;
  telephone?: string | null;
  observation?: string | null;
  preTermeDraftId?: string | null;
  renouvellementTermeCompagnieEligible: boolean;
};

export type EcheanceAutomobileResponse = {
  dateDu: string;
  dateAu: string;
  compagnieId?: string | null;
  typeContrat?: TypeContrat | null;
  search?: string | null;
  summary: {
    contratCount: number;
    compagnieCount: number;
  };
  page: {
    number: number;
    size: number;
    totalElements: number;
    totalPages: number;
    first: boolean;
    last: boolean;
  };
  rows: EcheanceAutomobileRow[];
};

export type UpsertGrilleTarifaireRequest = {
  compagnieAssuranceId: string;
  libelle: string;
  description?: string;
  actif?: boolean;
};

export type UpsertLigneGrilleTarifaireRequest = {
  id?: string;
  garantieId: string;
  usageId?: string;
  categorieTransportId?: string;
  puissanceFiscaleMin?: number;
  puissanceFiscaleMax?: number;
  nombrePlacesMin?: number;
  nombrePlacesMax?: number;
  ptcMin?: number;
  ptcMax?: number;
  sousClasse?: string;
  carburant?: string;
  modeTarification?: string;
  libelleOption?: string;
  prime?: number;
  capital?: number;
  taux?: number;
  tauxFranchise?: number;
  franchiseMinimale?: number;
  ordreAffichage?: number;
  actif?: boolean;
};

export type UpsertFormuleGarantiePersonneRequest = {
  id?: string;
  garantieId: string;
  usageId?: string;
  formule?: string;
  montantDeces?: number;
  montantInvalidite?: number;
  montantFraisMedicaux?: number;
  montantFraisHospitalisation?: number;
  montantFraisFuneraires?: number;
  montantFraisChirurgie?: number;
  primeNette?: number;
  accessoire?: number;
  ordreAffichage?: number;
  actif?: boolean;
};

export type UpsertGrilleUsageConfigurationRequest = {
  lignes?: UpsertLigneGrilleTarifaireRequest[];
  formulesPersonne?: UpsertFormuleGarantiePersonneRequest[];
};

export type UpsertUsageRequest = {
  code: string;
  libelle: string;
  criteria?: string;
  groupeUsageAttestationId?: string;
  consommeAttestation?: boolean;
  byCarburantAndPf?: boolean;
  bySousClasse?: boolean;
  byPtc?: boolean;
  byPrime?: boolean;
  byCategorieTransport?: boolean;
  garantiesPersonne?: boolean;
  actif?: boolean;
};

export type UpsertGroupeUsageAttestationRequest = {
  code: string;
  libelle: string;
  couleur?: string;
  compagnieRestrictionIds?: string[];
  visibleStock?: boolean;
  actif?: boolean;
};

export type UpsertGroupeExclusionGarantieRequest = {
  code: string;
  libelle: string;
  typeGarantie?: string;
  actif?: boolean;
};

export type UpsertTarifUsageRequest = {
  usageId: string;
  categorieTransportId?: string;
  puissanceFiscaleMin?: number;
  puissanceFiscaleMax?: number;
  nombrePlacesMin?: number;
  nombrePlacesMax?: number;
  ptcMin?: number;
  ptcMax?: number;
  sousClasse?: string;
  carburant?: string;
  primeNette?: number;
  primeParPlace?: number;
  actif?: boolean;
};

export type UpsertGarantieRequest = {
  code: string;
  libelle: string;
  description?: string;
  branche?: string;
  groupeExclusionId?: string;
  typeGarantie?: string;
  obligatoire?: boolean;
  responsabiliteCivile?: boolean;
  defenseRecours?: boolean;
  requiertValeurVenale?: boolean;
  requiertValeurNeuf?: boolean;
  requiertValeurGlace?: boolean;
  avecFranchise?: boolean;
  avecFranchiseMinimale?: boolean;
  avecCapital?: boolean;
  tarificationMultiple?: boolean;
  modesTarificationMultiple?: string[];
  modesAutorises?: string[];
  modeParDefaut?: string;
  critereSelectionTarif?: "TAUX_PRIME" | "TAUX_FRANCHISE";
  sourcesValeurAutorisees?: string[];
  sourceValeurParDefaut?: string;
  saisieManuelleAutorisee?: boolean;
  verrouillee?: boolean;
  compagniesSansProrataIds?: string[];
  ordreAffichage?: number;
  actif?: boolean;
};

export type BulkUpdateTarifUsageRequest = {
  tarifIds?: string[];
  usageIds?: string[];
  adjustmentType: "PERCENT" | "FIXED";
  direction: "INCREASE" | "DECREASE";
  value: number;
};

export type UpsertCompagnieAssuranceRequest = {
  code: string;
  nom: string;
  adresse?: string;
  ville?: string;
  email?: string;
  telephone?: string;
  rc?: string;
  ice?: string;
  prefixeAttestation?: string;
  prefixeCarteVerte?: string;
  ordreAffichage?: number;
  actif?: boolean;
};

export type UpsertConventionRequest = {
  compagnieAssuranceId: string;
  code: string;
  intitule: string;
  description?: string;
  organismeConventionne?: string;
  typeEcheance: "A_ECHEANCE" | "DATE_A_DATE";
  echeance?: string;
  fractionnement?: "MENSUEL" | "TRIMESTRIEL" | "SEMESTRIEL" | "ANNUEL";
  categorieClientId: string;
  grilleTarifaireId: string;
  usageIds: string[];
  actif?: boolean;
};

export type UpsertReferenceRequest = {
  libelle: string;
  actif?: boolean;
};

export type UpsertCodeReferenceRequest = {
  code: string;
  libelle: string;
  actif?: boolean;
};

export type TypePieceJointe = {
  id: string;
  libelle: string;
  typeContrat?: TypeContrat | null;
  typeClient?: TypeClient | null;
  typeMouvementId?: string | null;
  typeMouvementCode?: string | null;
  typeMouvementLibelle?: string | null;
  obligatoire?: boolean | null;
  actif?: boolean | null;
  ordreAffichage?: number | null;
};

export type UpsertTypePieceJointeRequest = {
  libelle: string;
  typeContrat?: TypeContrat | null;
  typeClient?: TypeClient | null;
  typeMouvementId?: string | null;
  obligatoire?: boolean;
  actif?: boolean;
  ordreAffichage?: number | null;
};

export type PieceJointe = {
  id: string;
  contratId: string;
  mouvementContratId?: string | null;
  typePieceJointeId?: string | null;
  typePieceJointeLibelle?: string | null;
  obligatoire?: boolean | null;
  nomFichier: string;
  contentType?: string | null;
  tailleOctets?: number | null;
  createdAt?: string | null;
};

export type PiecesJointesContrat = {
  contratId: string;
  numeroDossier?: string | null;
  numeroPolice?: string | null;
  typeContrat: TypeContrat;
  typeClient?: TypeClient | null;
  mouvementContratId?: string | null;
  mouvementCode?: string | null;
  mouvementLibelle?: string | null;
  types: TypePieceJointe[];
  pieces: PieceJointe[];
};

export type ContratSummary = {
  id: string;
  numeroContrat?: string | null;
  numeroDevis?: string | null;
  numeroDossier?: string | null;
  numeroPolice?: string | null;
  createdAt?: string | null;
  typeContrat: TypeContrat;
  statut: string;
  agenceId?: string;
  compagnieAssuranceId?: string;
  conventionId?: string | null;
  categorieClientId?: string | null;
  categorieClientCode?: string | null;
  categorieClientLibelle?: string | null;
  contratOrigineId?: string | null;
  renouvele?: boolean;
  modeTermeRenouvellement?: "CABINET" | "COMPAGNIE" | null;
  renouvellementTermeCompagnieEligible?: boolean | null;
  usageId?: string;
  usageCode?: string;
  usageLibelle?: string;
  groupeUsageAttestationCode?: string | null;
  groupeUsageAttestationLibelle?: string | null;
  consommeAttestation?: boolean | null;
  grilleTarifaireId?: string | null;
  dateEffet?: string;
  dateEcheance?: string;
  numeroAttestation?: string;
  echeance?: string | null;
  typeRenouvellement?: string | null;
  modePaiement?: string | null;
  modeReglement?: string | null;
  numeroBonCommande?: string | null;
  montantBulletin?: number | null;
  typePayeurPrime?: TypePayeurPrime | null;
  payeurPrimeClientId?: string | null;
  payeurPrimeNom?: string | null;
  groupeFacturationId?: string | null;
  groupeFacturationNom?: string | null;
  modeFacturation?: ModeFacturationContrat | null;
  periodicite?: string | null;
  fractionnement?: string | null;
  tauxRc?: number | null;
  modeSaisieGaranties?: string | null;
  saisiePrimeNette?: boolean | null;
  nombreVehicules?: number | null;
  nombreRemorques?: number | null;
  brouillon?: boolean | null;
  prospection?: boolean | null;
  assistance?: boolean | null;
  crmPartage?: boolean | null;
  crmPartageValeur?: string | null;
  primeTotale?: number;
  clients?: { clientId: string; nomAffichage: string; role: string; principalPourRole: boolean; client?: ClientResponse }[];
  vehicules?: {
    vehiculeId: string;
    typeVehicule: string;
    usageId?: string | null;
    usageCode?: string | null;
    usageLibelle?: string | null;
    groupeUsageAttestationCode?: string | null;
    consommeAttestation?: boolean | null;
    immatriculation?: string | null;
    numeroAttestation?: string | null;
    remorque?: boolean | null;
    marqueId?: string | null;
    marque?: string | null;
    carrosserieId?: string | null;
    carrosserie?: string | null;
    categorieTransportId?: string | null;
    categorieTransportCode?: string | null;
    categorieTransportLibelle?: string | null;
    carburant?: string | null;
    puissanceFiscale?: string | null;
    nombrePlaces?: string | null;
    sousClasse?: string | null;
    ptc?: string | null;
    datePremiereCirculation?: string | null;
    dateExpirationCarteGrise?: string | null;
    dateEffet?: string | null;
    dateEcheance?: string | null;
    crm?: string | null;
    coefficientProrata?: number | null;
    valeurVenale?: number | null;
    valeurNeuf?: number | null;
    valeurGlace?: number | null;
    organismeCredit?: boolean | null;
    nomOrganismeCredit?: string | null;
    montantCredit?: number | null;
    dateFinCredit?: string | null;
  }[];
  remorques?: {
    remorqueId: string;
    usageId?: string | null;
    usageCode?: string | null;
    usageLibelle?: string | null;
    groupeUsageAttestationCode?: string | null;
    consommeAttestation?: boolean | null;
    immatriculation?: string | null;
    numeroAttestation?: string | null;
    marqueId?: string | null;
    marque?: string | null;
    ptc?: string | null;
    dateMiseEnCirculation?: string | null;
    dateEffet?: string | null;
    dateEcheance?: string | null;
    crm?: string | null;
    coefficientProrata?: number | null;
    valeurAssuree?: number | null;
  }[];
  garanties?: {
    contratGarantieId: string;
    garantieId: string;
    code?: string | null;
    libelle: string;
    typeGarantie?: string | null;
    vehiculeId?: string | null;
    remorqueId?: string | null;
    clientId?: string | null;
    ligneGrilleTarifaireId?: string | null;
    modeSelectionne?: string | null;
    sourceValeurSelectionnee?: string | null;
    formuleGarantiePersonneId?: string | null;
    valeurVenale?: number | null;
    valeurNeuf?: number | null;
    valeurGlace?: number | null;
    valeurAssuree?: number | null;
    formule?: string | null;
    montantDeces?: number | null;
    montantInvalidite?: number | null;
    montantFraisMedicaux?: number | null;
    montantFraisHospitalisation?: number | null;
    montantFraisFuneraires?: number | null;
    montantFraisChirurgie?: number | null;
    accessoire?: number | null;
    prime?: number | null;
    capital?: number | null;
    taux?: number | null;
    tauxFranchise?: number | null;
    franchiseMinimale?: number | null;
  }[];
  assistances?: AssistanceContrat[];
  mouvements?: {
    id: string;
    code?: string | null;
    libelle?: string | null;
    categorie?: string | null;
    statut?: string | null;
    numeroMouvement?: string | null;
    dateEffet?: string | null;
    dateEcheance?: string | null;
    autoriseAssistance?: boolean | null;
    autoriseCarteVerte?: boolean | null;
    primeTotale?: number | null;
  }[];
  avenantDrafts?: AvenantDraftSummary[];
  elementsFacturables?: ElementFacturable[];
  targetSummaries?: QuittancePreview["targetSummaries"];
  quittanceGenerale?: QuittancePreview | null;
};

export type ContratListItem = {
  id: string;
  numeroContrat?: string | null;
  numeroDevis?: string | null;
  numeroDossier?: string | null;
  numeroPolice?: string | null;
  createdAt?: string | null;
  typeContrat: TypeContrat;
  statut: string;
  compagnieAssuranceId?: string | null;
  compagnieCode?: string | null;
  compagnieLibelle?: string | null;
  conventionId?: string | null;
  conventionCode?: string | null;
  conventionLibelle?: string | null;
  contratOrigineId?: string | null;
  renouvele?: boolean | null;
  modeTermeRenouvellement?: "CABINET" | "COMPAGNIE" | null;
  renouvellementTermeCompagnieEligible?: boolean | null;
  dateEffet?: string | null;
  dateEcheance?: string | null;
  typeRenouvellement?: string | null;
  brouillon?: boolean | null;
  prospection?: boolean | null;
  premierTypeVehicule?: string | null;
  clients?: {
    clientId: string;
    codeClient?: string | null;
    nomAffichage?: string | null;
    role: string;
    principalPourRole: boolean;
  }[];
  mouvements?: NonNullable<ContratSummary["mouvements"]>;
  avenantDrafts?: AvenantDraftSummary[];
};

export type ContratListGroup = {
  key: string;
  contrats: ContratListItem[];
};
