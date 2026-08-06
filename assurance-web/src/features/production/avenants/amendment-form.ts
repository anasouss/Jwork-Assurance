import { getAmendmentPolicy } from "./amendment-policy";
import type {
  AssistanceDraft,
  AvenantRequest,
  ContratSummary,
  GarantieInput,
  QuittancePreview,
  ReferenceOption,
  RemorqueInput,
  VehiculeInput,
} from "../types";

export type AmendmentTarget = {
  kind: "vehicule" | "remorque";
  id: string;
  label: string;
  sublabel?: string | null;
  immatriculation?: string | null;
  usageId?: string | null;
  usage?: string | null;
  numeroAttestation?: string | null;
  consommeAttestation?: boolean | null;
};

export type PrecisionDraft = {
  immatriculation?: string;
  immatriculationProvisoire?: string;
  numeroAttestation?: string;
};

export type DuplicataAttestationDraft = {
  numeroAttestation?: string;
};

export type FlotteSectionTarget = {
  kind: "vehicule" | "remorque";
  index: number;
};

export const DEFAULT_VEHICLE: VehiculeInput = {
  typeVehicule: "AUTOMOBILE",
  carburant: "Diesel",
  puissanceFiscale: "",
  cylindree: "",
  nombrePlaces: "",
  immatriculation: "",
  datePremiereCirculation: "",
  valeurVenale: undefined,
  valeurNeuf: undefined,
  valeurGlace: undefined,
};

export function normalizeVehicle(
  vehicle: VehiculeInput,
  dateEffet?: string,
  dateEcheance?: string,
  sharedCrm?: string
): VehiculeInput {
  return {
    ...vehicle,
    typeVehicule: vehicle.typeVehicule ?? "AUTOMOBILE",
    crm: vehicle.crm?.trim() || sharedCrm?.trim() || undefined,
    dateEffet,
    dateEcheance,
  };
}

export function normalizeRemorque(remorque: RemorqueInput, dateEffet?: string, dateEcheance?: string): RemorqueInput {
  return { ...remorque, dateEffet, dateEcheance };
}

export function buildAvenantAssistances(
  assistances: Record<string, AssistanceDraft>,
  options: { includeDisabled?: boolean; onlyModified?: boolean } = {}
): NonNullable<AvenantRequest["assistances"]> {
  return Object.entries(assistances).flatMap(([key, assistance]) => {
    const match = key.match(/^vehicule:(\d+)$/);
    if (!match
        || (!options.includeDisabled && !assistance.enabled)
        || (options.onlyModified && !assistance.modified)) {
      return [];
    }
    return [{
      assistanceId: assistance.assistanceId,
      vehiculeIndex: Number(match[1]),
      enabled: assistance.enabled,
      compagnieAssistanceId: assistance.compagnieAssistanceId,
      produitAssistanceId: assistance.produitAssistanceId,
      dateSouscription: assistance.dateSouscription,
      dateEffet: assistance.dateEffet,
      echeanceCode: assistance.echeanceCode,
      numeroContratOuQuittance: assistance.numeroContratOuQuittance,
      typeQuittance: "AVENANT",
    }];
  });
}

export function buildAvenantAssistancesForTarget(
  assistances: Record<string, AssistanceDraft>,
  vehiculeIndex: number
): NonNullable<AvenantRequest["assistances"]> {
  return buildAvenantAssistances({
    "vehicule:0": assistances[`vehicule:${vehiculeIndex}`] ?? { enabled: false },
  }).filter((assistance) => assistance.compagnieAssistanceId && assistance.produitAssistanceId);
}

export function hydrateAvenantAssistances(
  assistances?: AvenantRequest["assistances"]
): Record<string, AssistanceDraft> {
  const hydrated: Record<string, AssistanceDraft> = {};
  for (const assistance of assistances ?? []) {
    hydrated[`vehicule:${assistance.vehiculeIndex}`] = {
      assistanceId: assistance.assistanceId,
      enabled: assistance.enabled !== false,
      modified: true,
      compagnieAssistanceId: assistance.compagnieAssistanceId,
      produitAssistanceId: assistance.produitAssistanceId,
      dateSouscription: assistance.dateSouscription,
      dateEffet: assistance.dateEffet,
      echeanceCode: assistance.echeanceCode,
      numeroContratOuQuittance: assistance.numeroContratOuQuittance,
    };
  }
  return hydrated;
}

export function mapCurrentAssistances(
  assistances: NonNullable<ContratSummary["assistances"]>,
  vehicules: Array<{ vehiculeId?: string | number | null }>
): Record<string, AssistanceDraft> {
  const mapped: Record<string, AssistanceDraft> = {};
  for (const assistance of assistances) {
    const vehiculeIndex = assistance.vehiculeId
      ? vehicules.findIndex((vehicule) => String(vehicule.vehiculeId) === String(assistance.vehiculeId))
      : -1;
    if (vehiculeIndex < 0) continue;
    mapped[`vehicule:${vehiculeIndex}`] = {
      assistanceId: assistance.id,
      enabled: true,
      modified: false,
      compagnieAssistanceId: assistance.compagnieAssistanceId ?? undefined,
      produitAssistanceId: assistance.produitAssistanceId ?? undefined,
      dateSouscription: assistance.dateSouscription ?? undefined,
      dateEffet: assistance.dateEffet ?? undefined,
      echeanceCode: assistance.echeanceCode ?? undefined,
      dateEcheance: assistance.dateEcheance ?? undefined,
      numeroContratOuQuittance: assistance.numeroContratOuQuittance ?? undefined,
    };
  }
  return mapped;
}

export function assistanceValidationMessage(assistances: Record<string, AssistanceDraft>) {
  for (const assistance of Object.values(assistances)) {
    if (!assistance.enabled || (assistance.modified === false && assistance.assistanceId)) continue;
    if (!assistance.compagnieAssistanceId) return "La compagnie d'assistance est obligatoire";
    if (!assistance.produitAssistanceId) return "Le produit d'assistance est obligatoire";
  }
  return null;
}

export function resolveAssistanceCategorieClientId(contrat?: ContratSummary) {
  const clients = contrat?.clients ?? [];
  const preferredRole = contrat?.typeContrat === "FLOTTE" ? "PROPRIETAIRE" : "SOUSCRIPTEUR";
  const preferred = clients
    .filter((link) => link.role === preferredRole)
    .sort((left, right) => Number(Boolean(right.principalPourRole)) - Number(Boolean(left.principalPourRole)))
    .find((link) => link.client?.categorieClientId);
  const fallback = clients.find((link) => link.role === "SOUSCRIPTEUR" && link.client?.categorieClientId);
  return preferred?.client?.categorieClientId ?? fallback?.client?.categorieClientId;
}

export function vehicleValidationMessage(vehicle: VehiculeInput | undefined, usages: ReferenceOption[]) {
  if (!vehicle) return "Véhicule introuvable";
  if (!vehicle.usageId) return "L'usage est obligatoire pour chaque véhicule";
  if (!vehicle.marqueId && !vehicle.marqueLibelle?.trim()) return "La marque est obligatoire pour chaque véhicule";
  if (!vehicle.carrosserieId && !vehicle.carrosserieLibelle?.trim()) return "La carrosserie est obligatoire pour chaque véhicule";
  if (!vehicle.immatriculation?.trim()) return "L'immatriculation est obligatoire pour chaque véhicule";
  if (!vehicle.nombrePlaces?.trim()) return "Le nombre de places est obligatoire pour chaque véhicule";
  if (!vehicle.crm?.trim()) return "Le CRM est obligatoire pour chaque véhicule";
  const usage = usages.find((item) => item.id === vehicle.usageId);
  if (Boolean(usage?.byCarburantAndPf) && (!vehicle.carburant?.trim() || !vehicle.puissanceFiscale?.trim())) {
    return "Le carburant et la puissance fiscale sont obligatoires pour cet usage";
  }
  if (Boolean(usage?.bySousClasse) && !vehicle.sousClasse?.trim()) return "La sous-classe est obligatoire pour cet usage";
  if (Boolean(usage?.byPtc) && !vehicle.ptc?.trim()) return "Le PTC est obligatoire pour cet usage";
  if (Boolean(usage?.byCategorieTransport) && !vehicle.categorieTransportId) {
    return "La catégorie de transport est obligatoire pour cet usage";
  }
  if (Boolean(usage?.consommeAttestation) && !vehicle.numeroAttestation?.trim()) {
    return "Le numéro d'attestation est obligatoire pour chaque véhicule";
  }
  return null;
}

export function remorqueValidationMessage(remorque: RemorqueInput | undefined) {
  if (!remorque) return "Remorque introuvable";
  return remorque.usageId ? null : "L'usage est obligatoire pour chaque remorque";
}

export function ensureRcGaranties(
  selectedGaranties: GarantieInput[],
  vehiculeCount: number,
  remorqueCount: number,
  garanties: ReferenceOption[]
) {
  const rc = garanties.find((garantie) => Boolean(garantie.responsabiliteCivile));
  if (!rc) return selectedGaranties;
  const next = [...selectedGaranties];
  for (let index = 0; index < vehiculeCount; index++) {
    if (!next.some((garantie) => garantie.garantieId === rc.id && garantie.vehiculeIndex === index && garantie.remorqueIndex == null)) {
      next.push(rcGarantieInput(rc, { vehiculeIndex: index }));
    }
  }
  for (let index = 0; index < remorqueCount; index++) {
    if (!next.some((garantie) => garantie.garantieId === rc.id && garantie.remorqueIndex === index && garantie.vehiculeIndex == null)) {
      next.push(rcGarantieInput(rc, { remorqueIndex: index }));
    }
  }
  return next;
}

export function scopeGarantiesForTarget(selectedGaranties: GarantieInput[], target: FlotteSectionTarget): GarantieInput[] {
  return selectedGaranties
    .filter((garantie) => target.kind === "vehicule" ? garantie.vehiculeIndex === target.index : garantie.remorqueIndex === target.index)
    .map((garantie) => target.kind === "vehicule"
      ? { ...garantie, vehiculeIndex: 0, remorqueIndex: undefined }
      : { ...garantie, remorqueIndex: 0, vehiculeIndex: undefined }
    );
}

export function remapScopedPreview(preview: QuittancePreview, target: FlotteSectionTarget): QuittancePreview {
  const targetKind = target.kind.toUpperCase();
  return {
    ...preview,
    garanties: preview.garanties?.map((garantie) => target.kind === "vehicule"
      ? { ...garantie, vehiculeIndex: target.index, remorqueIndex: undefined }
      : { ...garantie, remorqueIndex: target.index, vehiculeIndex: undefined }
    ),
    targetSummaries: preview.targetSummaries?.map((summary) => (
      String(summary.kind ?? "").toUpperCase() === targetKind
        ? { ...summary, vehiculeIndex: target.kind === "vehicule" ? target.index : undefined, remorqueIndex: target.kind === "remorque" ? target.index : undefined }
        : summary
    )),
  };
}

export function splitTargets(targets: AmendmentTarget[], selectedTargetIds: string[]) {
  const selected = targets.filter((target) => selectedTargetIds.includes(targetKey(target)));
  return {
    vehiculeIds: selected.filter((target) => target.kind === "vehicule").map((target) => target.id),
    remorqueIds: selected.filter((target) => target.kind === "remorque").map((target) => target.id),
  };
}

export function mapCurrentGaranties(
  garanties: NonNullable<ContratSummary["garanties"]>,
  vehicules: VehiculeInput[],
  remorques: RemorqueInput[]
): GarantieInput[] {
  return garanties
    .map<GarantieInput | null>((garantie) => {
      const vehiculeIndex = garantie.vehiculeId
        ? vehicules.findIndex((vehicule) => String(vehicule.vehiculeId) === String(garantie.vehiculeId))
        : -1;
      const remorqueIndex = garantie.remorqueId
        ? remorques.findIndex((remorque) => String(remorque.remorqueId) === String(garantie.remorqueId))
        : -1;
      if (garantie.vehiculeId && vehiculeIndex < 0) return null;
      if (garantie.remorqueId && remorqueIndex < 0) return null;
      return {
        garantieId: garantie.garantieId,
        ligneGrilleTarifaireId: garantie.ligneGrilleTarifaireId ?? undefined,
        clientId: garantie.clientId ?? undefined,
        vehiculeIndex: vehiculeIndex >= 0 ? vehiculeIndex : undefined,
        remorqueIndex: remorqueIndex >= 0 ? remorqueIndex : undefined,
        modeSelectionne: garantie.modeSelectionne ?? undefined,
        sourceValeurSelectionnee: garantie.sourceValeurSelectionnee ?? undefined,
        formuleGarantiePersonneId: garantie.formuleGarantiePersonneId ?? undefined,
        valeurVenale: garantie.valeurVenale ?? undefined,
        valeurNeuf: garantie.valeurNeuf ?? undefined,
        valeurGlace: garantie.valeurGlace ?? undefined,
        valeurAssuree: garantie.valeurAssuree ?? undefined,
        formule: garantie.formule ?? undefined,
        montantDeces: garantie.montantDeces ?? undefined,
        montantInvalidite: garantie.montantInvalidite ?? undefined,
        montantFraisMedicaux: garantie.montantFraisMedicaux ?? undefined,
        montantFraisHospitalisation: garantie.montantFraisHospitalisation ?? undefined,
        montantFraisFuneraires: garantie.montantFraisFuneraires ?? undefined,
        montantFraisChirurgie: garantie.montantFraisChirurgie ?? undefined,
        accessoire: garantie.accessoire ?? undefined,
        capital: garantie.capital ?? undefined,
        taux: garantie.taux ?? undefined,
        prime: garantie.prime ?? undefined,
        tauxFranchise: garantie.tauxFranchise ?? undefined,
        franchiseMinimale: garantie.franchiseMinimale ?? undefined,
      } satisfies GarantieInput;
    })
    .filter((garantie): garantie is GarantieInput => Boolean(garantie));
}

export function targetKey(target: AmendmentTarget) {
  return `${target.kind}:${target.id}`;
}

export function isGuaranteeModificationCode(code: string) {
  return getAmendmentPolicy(code)?.operation === "GUARANTEE_MODIFICATION";
}

export function isDifferentialCode(code: string) {
  return getAmendmentPolicy(code)?.differential ?? false;
}

export function isPrecisionCode(code: string) {
  return getAmendmentPolicy(code)?.operation === "PRECISION";
}

export function isDuplicataCode(code: string) {
  return getAmendmentPolicy(code)?.operation === "DUPLICATA";
}

export function isVehicleTargetCreationCode(code: string) {
  const policy = getAmendmentPolicy(code);
  return policy?.operation === "TARGET_CREATION" && policy.target !== "TRAILER";
}

export function isSingleVehicleTargetCreationCode(code: string) {
  return getAmendmentPolicy(code)?.singleVehicle ?? false;
}

export function isEcheanceClosureCode(code: string) {
  return getAmendmentPolicy(code)?.closureAtTerm ?? false;
}

export function isClosureCode(code: string) {
  return getAmendmentPolicy(code)?.operation === "CLOSURE";
}

export function isTargetCreationCode(code: string) {
  return getAmendmentPolicy(code)?.operation === "TARGET_CREATION";
}

function rcGarantieInput(rc: ReferenceOption, target: Pick<GarantieInput, "vehiculeIndex" | "remorqueIndex">): GarantieInput {
  return {
    garantieId: rc.id,
    ...target,
    modeSelectionne: String(rc.modeParDefaut ?? "TAUX"),
    sourceValeurSelectionnee: "AUCUNE",
  };
}
