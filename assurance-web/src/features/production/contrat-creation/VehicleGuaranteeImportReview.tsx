import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { cn } from "@/lib/utils";
import type {
  GarantieInput,
  QuittancePreview,
  ReferenceOption,
  VehicleImportPreview,
  VehiculeInput,
} from "../types";
import type { ContractPricingMode, ContractTarget } from "./ContractTargetsSection";
import { TargetGuaranteesTable } from "./TargetGuaranteesTable";

type Props = {
  preview: VehicleImportPreview;
  vehicles: VehiculeInput[];
  garanties: ReferenceOption[];
  lignes: ReferenceOption[];
  formulesPersonne: ReferenceOption[];
  usages: ReferenceOption[];
  grilleSelected: boolean;
  pricingMode: ContractPricingMode;
  selected: GarantieInput[];
  setSelected: Dispatch<SetStateAction<GarantieInput[]>>;
  calculationPreview?: QuittancePreview | null;
  previewing?: boolean;
  onRequestCalculation: (target: ContractTarget, selected: GarantieInput[]) => void;
};

export function VehicleGuaranteeImportReview({
  preview,
  vehicles,
  garanties,
  lignes,
  formulesPersonne,
  usages,
  grilleSelected,
  pricingMode,
  selected,
  setSelected,
  calculationPreview,
  previewing,
  onRequestCalculation,
}: Props) {
  const [activeVehicleIndex, setActiveVehicleIndex] = useState(0);
  const vehicleGuarantees = useMemo(
    () => garanties.filter((garantie) => String(garantie.typeGarantie ?? "VEHICULE") !== "PERSONNE"),
    [garanties]
  );
  const personGuarantees = useMemo(
    () => garanties.filter((garantie) => String(garantie.typeGarantie ?? "") === "PERSONNE"),
    [garanties]
  );
  const activeVehicle = vehicles[activeVehicleIndex];
  const activeTarget = activeVehicle ? vehicleTarget(activeVehicle, activeVehicleIndex, usages) : undefined;

  return (
    <div className="grid gap-3">
      {preview.lignesGarantiesEnErreur > 0 ? <GuaranteeImportErrors preview={preview} /> : null}
      {activeTarget ? (
        <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
          <div className="grid content-start gap-2">
            {vehicles.map((vehicle, index) => {
              const count = selected.filter((item) => item.vehiculeIndex === index).length;
              return (
                <button
                  key={`${vehicle.immatriculation ?? "vehicle"}-${index}`}
                  type="button"
                  className={cn(
                    "flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm",
                    index === activeVehicleIndex
                      ? "border-emerald-600 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
                      : "hover:bg-muted/60"
                  )}
                  onClick={() => {
                    setActiveVehicleIndex(index);
                    onRequestCalculation(vehicleTarget(vehicle, index, usages), selected);
                  }}
                >
                  <span className="truncate font-medium">{vehicle.immatriculation || `Véhicule ${index + 1}`}</span>
                  <span className="text-xs text-muted-foreground">{count}</span>
                </button>
              );
            })}
          </div>
          <TargetGuaranteesTable
            target={activeTarget}
            garanties={vehicleGuarantees}
            personneGaranties={personGuarantees}
            selected={selected}
            setSelected={setSelected}
            locked={[]}
            lignes={lignes}
            formulesPersonne={formulesPersonne}
            usages={usages}
            compagniesAssistance={[]}
            produitsAssistance={[]}
            assistance={{ enabled: false }}
            onAssistanceChange={() => undefined}
            showAssistance={false}
            showAssistanceContractReference={false}
            grilleSelected={grilleSelected}
            pricingMode={pricingMode}
            preview={calculationPreview}
            previewing={previewing}
            onRequestCalculation={(target, _garantieId, nextSelected) =>
              onRequestCalculation(target, nextSelected ?? selected)
            }
            layout="tariff"
            primeColumnLabel="Prime nette"
          />
        </div>
      ) : (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          Aucun véhicule valide à configurer.
        </div>
      )}
    </div>
  );
}

function vehicleTarget(vehicle: VehiculeInput, index: number, usages: ReferenceOption[]): ContractTarget {
  return {
    kind: "vehicule",
    index,
    label: vehicle.immatriculation?.trim() || `Véhicule ${index + 1}`,
    usageId: vehicle.usageId,
    usageCode: usages.find((usage) => usage.id === vehicle.usageId)?.code ?? undefined,
    categorieTransportId: vehicle.categorieTransportId,
    valeurVenale: vehicle.valeurVenale,
    valeurNeuf: vehicle.valeurNeuf,
    valeurGlace: vehicle.valeurGlace,
  };
}

function GuaranteeImportErrors({ preview }: { preview: VehicleImportPreview }) {
  return (
    <div className="grid gap-2 rounded-md border border-red-200 bg-red-50/60 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/20 dark:text-red-200">
      {preview.lignesGaranties.filter((row) => row.erreurs.length > 0).map((row) => (
        <div key={row.numeroLigne}>
          <span className="font-semibold">{row.immatriculation || `Ligne ${row.numeroLigne}`} :</span>{" "}
          {row.erreurs.join(" · ")}
        </div>
      ))}
    </div>
  );
}
