import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/base", () => ({ apiFetch: vi.fn(), buildQueryString: vi.fn() }));

import { apiFetch } from "@/lib/api/base";
import { activityKeys, getBusinessActivity } from "./business-activity";
import { groupActivityChanges, groupActivityReferences } from "./business-activity-presentation";

describe("business activity queries", () => {
  it("separates agency and platform list/detail caches", () => {
    expect(activityKeys.list("7", { page: 0 })).not.toEqual(activityKeys.list("8", { page: 0 }));
    expect(activityKeys.scope(null)).not.toEqual(activityKeys.scope("7"));
    expect(activityKeys.detail("7", "1")).not.toEqual(activityKeys.detail("8", "1"));
  });

  it("loads detail from its protected endpoint rather than using list snapshots", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ success: true, data: { id: "42", changes: [] } });
    expect(await getBusinessActivity("42")).toEqual({ id: "42", changes: [] });
    expect(apiFetch).toHaveBeenCalledWith("/api/v1/business-activities/42");
  });
});

describe("business activity presentation", () => {
  it("groups guarantee fields without repeating their name on every row or losing zero values", () => {
    const groups = groupActivityChanges([
      { label: "Statut", beforeValue: null, afterValue: "Actif" },
      { label: "Bris de Glace (75959-B-1) - Prime", beforeValue: null, afterValue: "7,81" },
      { label: "Bris de Glace (75959-B-1) - Franchise", beforeValue: null, afterValue: "0,00" },
      { label: "Quittance - Automobile - Taxes", beforeValue: null, afterValue: "15,00" },
    ]);
    expect(groups.map(group => group.title)).toEqual(["Informations générales", "Bris de Glace (75959-B-1)", "Quittance - Automobile"]);
    expect(groups[1].mode).toBe("added");
    expect(groups[1].changes.map(change => change.label)).toEqual(["Prime", "Franchise"]);
    expect(groups[1].changes[1].afterValue).toBe("0,00");
    expect(groups.flatMap(group => group.changes)).toHaveLength(4);
  });

  it("retains before/after comparisons for updates including removed and added fields", () => {
    const changes = [
      { label: "Véhicule 1 - Marque", beforeValue: "Toyota", afterValue: "Seat" },
      { label: "Véhicule 1 - Attestation", beforeValue: "123", afterValue: null },
      { label: "Véhicule 1 - Notes", beforeValue: null, afterValue: "Nouvelle note" },
    ];
    expect(groupActivityChanges(changes)[0]).toMatchObject({ mode: "compared", changes: [
      { ...changes[0], label: "Marque" }, { ...changes[1], label: "Attestation" }, { ...changes[2], label: "Notes" },
    ] });
  });

  it("presents deleted data as previous values and handles empty details", () => {
    expect(groupActivityChanges([{ label: "Numéro", beforeValue: "FAC-1", afterValue: null }])[0].mode).toBe("removed");
    expect(groupActivityChanges([])).toEqual([]);
  });

  it("labels reference groups and removes only duplicate identities and the primary subject", () => {
    const subject = { type: "CONTRAT", id: "1", label: "MATU26-0028" };
    const groups = groupActivityReferences({ subject, references: [subject,
      { type: "VEHICULE", id: "1", label: "75959-B-1" },
      { type: "VEHICULE", id: "1", label: "75959-B-1" },
      { type: "GARANTIE", id: "1", label: "Bris de glace" },
      { type: "NEW_TYPE", id: "2", label: "Autre objet" },
    ] } as Parameters<typeof groupActivityReferences>[0]);
    expect(groups.map(group => group.label)).toEqual(["Véhicules", "Garanties", "Autres références"]);
    expect(groups.flatMap(group => group.references)).toHaveLength(3);
  });
});
