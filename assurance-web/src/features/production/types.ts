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
  [key: string]: unknown;
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

export type ElementFacturable = {
  id: string;
  contratId: string;
  numeroContrat: string;
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
export type RoleClientContrat = "SOUSCRIPTEUR" | "PROPRIETAIRE" | "CONDUCTEUR" | "BENEFICIAIRE";

export type ClientInput = {
  clientId?: string;
  role: RoleClientContrat;
  principalPourRole: boolean;
  client: {
    agenceId?: string;
    typeClient: TypeClient;
    civilite?: string;
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
    activite?: string;
    conducteurHabituel?: boolean;
    sahara?: boolean;
    justificatifSahara?: string;
    telephones?: { numero: string; principal?: boolean; whatsapp?: boolean }[];
  };
};

export type VehiculeInput = {
  typeVehicule: "AUTOMOBILE" | "CAMION" | "MOTO" | "BUS" | "TRACTEUR" | "AUTRE";
  usageId?: string;
  marqueId?: string;
  carrosserieId?: string;
  categorieTransportId?: string;
  immatriculation?: string;
  immatriculationProvisoire?: string;
  modele?: string;
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
  coefficientProrata?: number;
  valeurVenale?: number;
  valeurNeuf?: number;
  valeurGlace?: number;
  organismeCredit?: boolean;
  nomOrganismeCredit?: string;
  dateFinCredit?: string;
};

export type RemorqueInput = {
  usageId?: string;
  marqueId?: string;
  immatriculation?: string;
  modele?: string;
  ptc?: string;
  dateMiseEnCirculation?: string;
  dateEffet?: string;
  dateEcheance?: string;
  crm?: string;
  numeroAttestation?: string;
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

export type CreateContratRequest = {
  agenceId: string;
  compagnieAssuranceId?: string;
  conventionId?: string;
  usageId?: string;
  grilleTarifaireId?: string;
  typeContrat: TypeContrat;
  numeroContrat: string;
  numeroDevis?: string;
  numeroPolice?: string;
  numeroAttestation?: string;
  dateEffet?: string;
  dateEcheance?: string;
  echeance?: string;
  modeReglement?: string;
  numeroBonCommande?: string;
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
};

export type UpsertGrilleTarifaireRequest = {
  compagnieAssuranceId: string;
  libelle: string;
  description?: string;
  actif?: boolean;
};

export type UpsertLigneGrilleTarifaireRequest = {
  garantieId: string;
  usageId?: string;
  categorieTransportId?: string;
  modeTarification?: string;
  libelleOption?: string;
  prime?: number;
  capital?: number;
  taux?: number;
  tauxFranchise?: number;
  franchiseMinimale?: number;
  actif?: boolean;
};

export type ContratSummary = {
  id: string;
  numeroContrat: string;
  numeroPolice?: string | null;
  typeContrat: TypeContrat;
  statut: string;
  agenceId?: string;
  compagnieAssuranceId?: string;
  conventionId?: string | null;
  contratOrigineId?: string | null;
  renouvele?: boolean;
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
  modePaiement?: string | null;
  modeReglement?: string | null;
  numeroBonCommande?: string | null;
  periodicite?: string | null;
  fractionnement?: string | null;
  tauxRc?: number | null;
  modeSaisieGaranties?: string | null;
  saisiePrimeNette?: boolean | null;
  nombreVehicules?: number | null;
  nombreRemorques?: number | null;
  prospection?: boolean | null;
  assistance?: boolean | null;
  crmPartage?: boolean | null;
  crmPartageValeur?: string | null;
  primeTotale?: number;
  clients?: { clientId: string; nomAffichage: string; role: string; principalPourRole: boolean }[];
  vehicules?: {
    vehiculeId: string;
    typeVehicule: string;
    usageCode?: string | null;
    usageLibelle?: string | null;
    immatriculation?: string | null;
    numeroAttestation?: string | null;
    marque?: string | null;
    modele?: string | null;
    categorieTransportLibelle?: string | null;
    valeurVenale?: number | null;
    valeurNeuf?: number | null;
    valeurGlace?: number | null;
  }[];
  remorques?: {
    remorqueId: string;
    usageCode?: string | null;
    usageLibelle?: string | null;
    immatriculation?: string | null;
    numeroAttestation?: string | null;
    marque?: string | null;
    modele?: string | null;
    ptc?: string | null;
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
    prime?: number | null;
    capital?: number | null;
    taux?: number | null;
  }[];
  mouvements?: {
    id: string;
    code?: string | null;
    libelle?: string | null;
    categorie?: string | null;
    statut?: string | null;
    numeroMouvement?: string | null;
    dateEffet?: string | null;
    dateEcheance?: string | null;
    primeTotale?: number | null;
  }[];
  elementsFacturables?: ElementFacturable[];
};
