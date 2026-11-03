import { describe, expect, it } from "vitest";
import {
  buildAvenantAssistances,
  DEFAULT_VEHICLE,
  inheritConventionVehicleUsage,
  ensureRcGaranties,
  mapCurrentGaranties,
  restoreExtensionGaranties,
  scopeGarantiesForTarget,
  normalizeVehicle,
  vehicleValidationMessage,
} from "./amendment-form";
import type { ContratSummary, GarantieInput, ReferenceOption } from "../types";

describe("amendment form adapters", () => {
  it("accepts an amendment vehicle without CRM while keeping usage requirements", () => {
    const vehicle = {
      ...DEFAULT_VEHICLE, usageId: "1", marqueId: "2", carrosserieId: "3",
      immatriculation: "67114-A-40", nombrePlaces: "7", crm: undefined,
    };
    const usages = [{ id: "1", libelle: "Tourisme", byPuissanceFiscale: true }];
    expect(vehicleValidationMessage({ ...vehicle, puissanceFiscale: "9" }, usages)).toBeNull();
    expect(vehicleValidationMessage(vehicle, usages)).toBe("La puissance fiscale est obligatoire pour cet usage");
    expect(vehicleValidationMessage({ ...vehicle, immatriculation: "" }, usages))
      .toBe("L'immatriculation est obligatoire pour chaque véhicule");
  });

  it("preserves existing CRM values without inventing one for amendment vehicles", () => {
    expect(normalizeVehicle({ ...DEFAULT_VEHICLE, crm: "0.90" }).crm).toBe("0.90");
    expect(normalizeVehicle({ ...DEFAULT_VEHICLE }, undefined, undefined, "0.95").crm).toBe("0.95");
    expect(normalizeVehicle({ ...DEFAULT_VEHICLE }).crm).toBeUndefined();
  });

  it("inherits convention usage for new vehicles and reopened drafts without mutating them", () => {
    const vehicles = [{ ...DEFAULT_VEHICLE, usageId: undefined }, { ...DEFAULT_VEHICLE, usageId: "old-usage" }];
    expect(inheritConventionVehicleUsage(vehicles, { typeContrat: "CONVENTION", usageId: "contract-usage" }))
      .toEqual([{ ...DEFAULT_VEHICLE, usageId: "contract-usage" }, { ...DEFAULT_VEHICLE, usageId: "contract-usage" }]);
    expect(vehicles).toEqual([{ ...DEFAULT_VEHICLE, usageId: undefined }, { ...DEFAULT_VEHICLE, usageId: "old-usage" }]);
  });

  it("keeps fleet and mono vehicle usages unchanged", () => {
    const vehicles = [{ ...DEFAULT_VEHICLE, usageId: "vehicle-usage" }];
    expect(inheritConventionVehicleUsage(vehicles, { typeContrat: "FLOTTE", usageId: "contract-usage" })).toBe(vehicles);
    expect(inheritConventionVehicleUsage(vehicles, { typeContrat: "PARTICULIER", usageId: "contract-usage" })).toBe(vehicles);
    expect(inheritConventionVehicleUsage(vehicles)).toBe(vehicles);
  });

  it("does not invent a missing convention contract usage from an old draft", () => {
    expect(inheritConventionVehicleUsage([{ ...DEFAULT_VEHICLE, usageId: "old-usage" }], { typeContrat: "CONVENTION" }))
      .toEqual([{ ...DEFAULT_VEHICLE, usageId: undefined }]);
  });

  it("retains existing person guarantees when restoring an old extension draft", () => {
    const pp: GarantieInput = { garantieId: "PP", modeSelectionne: "PROTECTION", montantDeces: 20000 };
    const pc: GarantieInput = { garantieId: "PC", modeSelectionne: "PROTECTION", montantDeces: 50000 };
    const added: GarantieInput = { garantieId: "V", vehiculeIndex: 0 };
    expect(restoreExtensionGaranties([pp, pc], [added])).toEqual([pp, pc, added]);
    expect(restoreExtensionGaranties([pp], [{ garantieId: "PP", vehiculeIndex: 0 }])).toEqual([pp]);
  });
  it("adds one mandatory RC guarantee per target without duplicating existing RC", () => {
    const rc: ReferenceOption = {
      id: "1",
      code: "RC",
      libelle: "Responsabilite Civile",
      responsabiliteCivile: true,
      modeParDefaut: "TAUX",
    };
    const selected: GarantieInput[] = [{
      garantieId: "1",
      vehiculeIndex: 0,
      modeSelectionne: "TAUX",
      sourceValeurSelectionnee: "AUCUNE",
    }];

    expect(ensureRcGaranties(selected, 2, 1, [rc])).toMatchObject([
      selected[0],
      { garantieId: "1", vehiculeIndex: 1, modeSelectionne: "TAUX" },
      { garantieId: "1", remorqueIndex: 0, modeSelectionne: "TAUX" },
    ]);
  });

  it("scopes a target preview payload to index zero without mutating the source", () => {
    const selected: GarantieInput[] = [
      { garantieId: "1", vehiculeIndex: 0 },
      { garantieId: "4", vehiculeIndex: 2, prime: 22.6 },
      { garantieId: "7", remorqueIndex: 0 },
    ];

    expect(scopeGarantiesForTarget(selected, { kind: "vehicule", index: 2 })).toEqual([
      expect.objectContaining({ garantieId: "4", vehiculeIndex: 0, remorqueIndex: undefined, prime: 22.6 }),
    ]);
    expect(selected[1].vehiculeIndex).toBe(2);
  });

  it("serializes only modified assistance deltas when requested", () => {
    const result = buildAvenantAssistances({
      "vehicule:0": { enabled: true, modified: false, assistanceId: "10" },
      "vehicule:1": {
        enabled: false,
        modified: true,
        assistanceId: "11",
        compagnieAssistanceId: "3",
        produitAssistanceId: "8",
      },
    }, { includeDisabled: true, onlyModified: true });

    expect(result).toEqual([
      expect.objectContaining({
        assistanceId: "11",
        vehiculeIndex: 1,
        enabled: false,
        typeQuittance: "AVENANT",
      }),
    ]);
  });

  it("preserves persisted guarantee financial values while mapping target indexes", () => {
    const garanties = [{
      garantieId: "1",
      vehiculeId: "22",
      modeSelectionne: "TAUX",
      sourceValeurSelectionnee: "AUCUNE",
      capital: 50_000_000,
      prime: -51.81,
      taux: 1,
    }] as NonNullable<ContratSummary["garanties"]>;

    expect(mapCurrentGaranties(garanties, [{ vehiculeId: "22" }], [])).toEqual([
      expect.objectContaining({
        garantieId: "1",
        vehiculeIndex: 0,
        capital: 50_000_000,
        prime: -51.81,
        taux: 1,
      }),
    ]);
  });
});
