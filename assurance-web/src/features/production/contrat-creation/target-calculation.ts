import type { AssistanceDraft, GarantieInput, QuittancePreview, ReferenceOption } from "../types";
import { numberOrZero, roundMoney } from "../utils/format";

export type CalculationTarget = {
  kind: "vehicule" | "remorque";
  index: number;
};

export type TargetQuittanceSummary = {
  totalNet?: number;
  evcat?: number;
  pta?: number;
  accessoire?: number;
  taxe?: number;
  cnpac?: number;
  totalAPayer?: number;
};

export function targetQuittanceSummary(
  preview: QuittancePreview | null | undefined,
  target: CalculationTarget
): TargetQuittanceSummary {
  if (!preview) return {};

  const backendSummary = backendTargetSummary(preview, target);
  if (backendSummary) {
    const pta = positiveOrUndefined(backendSummary.corporelPrimeNette);
    return {
      totalNet: backendSummary.automobilePrimeNette ?? subtractNumbers(backendSummary.primeNetteHorsEvcat, pta),
      evcat: backendSummary.evcatPrimeNette,
      pta,
      accessoire: pta == null ? undefined : backendSummary.accessoire,
      taxe: addNumbers(backendSummary.taxe, backendSummary.taxeParafiscale),
      cnpac: backendSummary.cnpac,
      totalAPayer: backendSummary.primeTotale,
    };
  }

  const autoLine = quittanceLine(preview, "AUTOMOBILE");
  const corpLine = quittanceLine(preview, "CORPOREL");
  const evcatLine = quittanceLine(preview, "EVCAT");
  const targetLines = (preview.garanties ?? []).filter((line) => previewLineMatchesTarget(line, target));
  const autoNet = roundMoney(sumPreviewLines(targetLines.filter((line) => !isPersonnePreviewLine(line))));
  const pta = roundMoney(sumPreviewLines(targetLines.filter(isPersonnePreviewLine)));
  const evcat = proportionalAmount(evcatLine?.primeNette, autoNet, autoLine?.primeNette);
  const accessoire = proportionalAmount(corpLine?.accessoire, pta, corpLine?.primeNette);
  const cnpac = targetHasRcPreviewLine(targetLines) ? targetCnpac(preview) : 0;
  const taxe = roundMoney(
    numberOrZero(proportionalAmount(lineTaxTotal(autoLine), autoNet, autoLine?.primeNette))
      + numberOrZero(proportionalAmount(lineTaxTotal(corpLine), pta, corpLine?.primeNette))
      + numberOrZero(proportionalAmount(lineTaxTotal(evcatLine), evcat, evcatLine?.primeNette))
  );
  const visiblePta = positiveOrUndefined(pta);
  const totalNet = roundMoney(autoNet);
  const totalAPayer = roundMoney(
    totalNet + numberOrZero(visiblePta) + numberOrZero(evcat) + taxe + cnpac + numberOrZero(accessoire)
  );

  return {
    totalNet,
    evcat,
    pta: visiblePta,
    accessoire: visiblePta == null ? undefined : accessoire,
    taxe,
    cnpac,
    totalAPayer,
  };
}

export function previewForTarget(
  preview: QuittancePreview | null | undefined,
  targetPreview: QuittancePreview | null | undefined,
  target?: CalculationTarget
) {
  if (!target || !targetPreview) return preview;
  if (backendTargetSummary(targetPreview, target)) return targetPreview;
  if ((targetPreview.garanties ?? []).some((line) => previewLineMatchesTarget(line, target))) return targetPreview;
  return preview;
}

export function remapAssistancesAfterVehicleRemoval(
  assistances: Record<string, AssistanceDraft>,
  removedIndex: number
) {
  const next: Record<string, AssistanceDraft> = {};
  for (const [key, assistance] of Object.entries(assistances)) {
    const match = key.match(/^vehicule:(\d+)$/);
    if (!match) {
      next[key] = assistance;
      continue;
    }
    const index = Number(match[1]);
    if (index === removedIndex) continue;
    next[`vehicule:${index > removedIndex ? index - 1 : index}`] = assistance;
  }
  return next;
}

export function previewGuaranteeLine(
  preview: QuittancePreview | null | undefined,
  garantie: ReferenceOption,
  target: CalculationTarget,
  selected?: GarantieInput
) {
  const expectedLineId = selected?.ligneGrilleTarifaireId;
  const expectedFormuleId = selected?.formuleGarantiePersonneId;
  const personne = String(garantie.typeGarantie ?? "").toUpperCase() === "PERSONNE";
  return preview?.garanties?.find((line) => {
    if (String(line.garantieId ?? "") !== String(garantie.id)) return false;
    if (!personne && target.kind === "vehicule" && line.vehiculeIndex !== target.index) return false;
    if (target.kind === "remorque" && line.remorqueIndex !== target.index) return false;
    if (expectedLineId && line.ligneGrilleTarifaireId && String(line.ligneGrilleTarifaireId) !== String(expectedLineId)) {
      return false;
    }
    if (expectedFormuleId && line.formuleGarantiePersonneId && String(line.formuleGarantiePersonneId) !== String(expectedFormuleId)) {
      return false;
    }
    return true;
  });
}

function backendTargetSummary(preview: QuittancePreview, target: CalculationTarget) {
  return preview.targetSummaries?.find((summary) => {
    const kind = String(summary.kind ?? "").toUpperCase();
    return target.kind === "vehicule"
      ? kind === "VEHICULE" && summary.vehiculeIndex === target.index
      : kind === "REMORQUE" && summary.remorqueIndex === target.index;
  });
}

function addNumbers(left?: number, right?: number) {
  if (left == null && right == null) return undefined;
  return numberOrZero(left) + numberOrZero(right);
}

function subtractNumbers(left?: number, right?: number) {
  if (left == null) return undefined;
  return roundMoney(left - numberOrZero(right));
}

function positiveOrUndefined(value?: number) {
  return value != null && value > 0 ? value : undefined;
}

function quittanceLine(preview: QuittancePreview, categorie: string) {
  return preview.lignes.find((ligne) => ligne.categorie === categorie);
}

function lineTaxTotal(line?: QuittancePreview["lignes"][number]) {
  if (!line) return undefined;
  return numberOrZero(line.taxe) + numberOrZero(line.taxeParafiscale);
}

function proportionalAmount(total: number | undefined, part: number | undefined, base: number | undefined) {
  if (total == null) return undefined;
  if (!part || !base) return 0;
  return roundMoney(total * (part / base));
}

function sumPreviewLines(lines: NonNullable<QuittancePreview["garanties"]>) {
  return lines.reduce((sum, line) => sum + numberOrZero(line.primeNette), 0);
}

function previewLineMatchesTarget(
  line: NonNullable<QuittancePreview["garanties"]>[number],
  target: CalculationTarget
) {
  return target.kind === "vehicule"
    ? line.vehiculeIndex === target.index
    : line.remorqueIndex === target.index;
}

function isPersonnePreviewLine(line: NonNullable<QuittancePreview["garanties"]>[number]) {
  const type = String(line.typeGarantie ?? "").toUpperCase();
  const code = String(line.code ?? "").trim().toUpperCase();
  return type === "PERSONNE" || code === "PP" || code === "PC" || code === "PTA";
}

function targetHasRcPreviewLine(lines: NonNullable<QuittancePreview["garanties"]>) {
  return lines.some((line) => String(line.code ?? "").trim().toUpperCase() === "RC");
}

function targetCnpac(preview: QuittancePreview) {
  const autoCnpac = numberOrZero(quittanceLine(preview, "AUTOMOBILE")?.cnpac);
  const units = new Set<string>();
  for (const line of preview.garanties ?? []) {
    if (String(line.code ?? "").trim().toUpperCase() !== "RC") continue;
    if (line.vehiculeIndex != null) units.add(`V:${line.vehiculeIndex}`);
    else if (line.remorqueIndex != null) units.add(`R:${line.remorqueIndex}`);
  }
  return units.size > 0 ? roundMoney(autoCnpac / units.size) : autoCnpac;
}
