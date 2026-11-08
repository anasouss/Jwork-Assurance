import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/base", () => ({ apiFetch: vi.fn(), buildQueryString: vi.fn() }));

import { apiFetch } from "@/lib/api/base";
import { activityKeys, getBusinessActivity } from "./business-activity";
import { accountingSummaryFields, activityChangeSections, guaranteeSummaryFields, groupActivityChanges, groupActivityReferences } from "./business-activity-presentation";

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
  it("consolidates historical invoice lines and allocations without losing before/after values", () => {
    const changes = [
      { label: "REG-26-000005 - Moyen 2 - Affectation 1 - Statut", beforeValue: "En attente", afterValue: "Annulee" },
      { label: "Ligne 1 - Dossier", beforeValue: null, afterValue: "MATU26-0021" },
      { label: "Numero", beforeValue: null, afterValue: "FAC-26-000010" },
      { label: "REG-26-000005 - Moyen 3 - Affectation 2 - Montant", beforeValue: null, afterValue: "0,00" },
      { label: "Ligne 2 - Montant TTC", beforeValue: null, afterValue: "125,00" },
      { label: "REG-26-000005 - Moyen 3 - Affectation 2 - Moyen de paiement", beforeValue: null, afterValue: "Cheque - 555444" },
    ];
    const sections = activityChangeSections(changes, "COMPTABILITE_CLIENT");
    expect(sections.map(section => section.title)).toEqual(["Informations générales", "Lignes du document", "Affectations des règlements"]);
    expect(sections[1].groups).toHaveLength(2);
    expect(sections[2].groups).toHaveLength(2);
    expect(sections.flatMap(section => section.groups.flatMap(group => group.changes))).toHaveLength(changes.length);
    expect(accountingSummaryFields(sections[2].groups[0], true).summary[4])
      .toMatchObject({ beforeValue: "En attente", afterValue: "Annulee" });
    const summary = accountingSummaryFields(sections[2].groups[1], true).summary;
    expect(summary[0]?.afterValue).toBe("Cheque - 555444");
    expect(summary[3]?.afterValue).toBe("0,00");
    expect(activityChangeSections(changes, "SINISTRES").every(section => section.kind === "fields")).toBe(true);
  });

  it("keeps extra invoice and allocation fields accessible without guessing missing cheque references", () => {
    const group = groupActivityChanges([
      { label: "Moyen 2 - Affectation 1 - Document", beforeValue: "FAC-1", afterValue: null },
      { label: "Moyen 2 - Affectation 1 - Payeur", beforeValue: "Client", afterValue: null },
    ])[0];
    const fields = accountingSummaryFields(group, true);
    expect(fields.summary[0]).toBeUndefined();
    expect(fields.summary[2]?.beforeValue).toBe("FAC-1");
    expect(fields.additional.map(change => change.label)).toEqual(["Payeur"]);
    expect(accountingSummaryFields(groupActivityChanges([
      { label: "Ligne 1 - Taxes", beforeValue: null, afterValue: "20,00" },
    ])[0], false).additional[0].afterValue).toBe("20,00");
  });

  it("orders production details by workflow with every quittance category last", () => {
    const changes = [
      { label: "Quittance - EVCAT - Taxes", beforeValue: null, afterValue: "1,00" },
      { label: "Responsabilite Civile (75959-B-1) - Capital", beforeValue: null, afterValue: "50 000 000,00" },
      { label: "Quittance - Prime nette", beforeValue: "100,00", afterValue: "200,00" },
      { label: "Protection Passagers (Contrat) - Deces", beforeValue: null, afterValue: "10 000,00" },
      { label: "Vol (75959-B-1) - Base assuree", beforeValue: null, afterValue: "Valeur venale" },
      { label: "Vehicule 1 - Immatriculation", beforeValue: null, afterValue: "75959-B-1" },
      { label: "Quittance - Automobile - Taxes", beforeValue: null, afterValue: "10,00" },
      { label: "Statut", beforeValue: "Brouillon", afterValue: "Actif" },
    ];
    const sections = activityChangeSections(changes, "PRODUCTION");
    expect(sections.map(section => section.title)).toEqual([
      "Informations générales", "Vehicule 1", "Garanties véhicule", "Garanties des personnes", "Quittance",
    ]);
    expect(sections[2].groups.map(group => group.title)).toEqual(["Responsabilite Civile (75959-B-1)", "Vol (75959-B-1)"]);
    expect(sections.at(-1)?.groups.map(group => group.title)).toEqual(["Quittance", "Quittance - Automobile", "Quittance - EVCAT"]);
    expect(sections.flatMap(section => section.groups.flatMap(group => group.changes))).toHaveLength(changes.length);
  });

  it("keeps both capital and insured value plus every extra guarantee field", () => {
    const group = groupActivityChanges([
      { label: "Vol (A) - Valeur assuree", beforeValue: "100", afterValue: "200" },
      { label: "Vol (A) - Capital", beforeValue: "100", afterValue: "200" },
      { label: "Vol (A) - Franchise", beforeValue: null, afterValue: "0,00" },
      { label: "Vol (A) - Taux", beforeValue: "1", afterValue: "2" },
    ])[0];
    const fields = guaranteeSummaryFields(group, false);
    expect(fields.summary[0]).toMatchObject({ label: "Valeur assuree", beforeValue: "100", afterValue: "200" });
    expect(fields.summary[1]?.afterValue).toBe("0,00");
    expect(fields.additional.map(change => change.label)).toEqual(["Capital", "Taux"]);
    expect(fields.summary.filter(Boolean).length + fields.additional.length).toBe(group.changes.length);
  });

  it("does not guess a guarantee category from its name or regroup unrelated modules", () => {
    const changes = [{ label: "Protection spéciale (Contrat) - Prime", beforeValue: "10", afterValue: "20" }];
    expect(activityChangeSections(changes, "PRODUCTION")[0].kind).toBe("guarantees");
    expect(activityChangeSections(changes, "SINISTRES")[0].kind).toBe("fields");
    expect(guaranteeSummaryFields(groupActivityChanges(changes)[0], false).summary[3])
      .toMatchObject({ beforeValue: "10", afterValue: "20" });
  });

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
