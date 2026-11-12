import { describe, expect, it } from "vitest";
import type { PieceJointe, TypePieceJointe } from "../types";
import { vehiclesWithoutDocument } from "./attachment-vehicles";

describe("vehicle attachment picker", () => {
  const vehicles = [{ id: "1", libelle: "WW019681" }, { id: "2", libelle: "10783-A-70" }];
  const type: TypePieceJointe = { id: "10", libelle: "Carte grise", documentOwner: "VEHICULE", naturePieceJointeId: "20" };
  const document: PieceJointe = {
    id: "30", contratId: "40", vehiculeId: "2", typePieceJointeId: "10",
    naturePieceJointeId: "20", status: "VALID", nomFichier: "carte.pdf",
  };

  it("hides vehicles already holding the selected document", () => {
    expect(vehiclesWithoutDocument(vehicles, [document], type)).toEqual([vehicles[0]]);
  });

  it("matches the document nature across differently scoped types", () => {
    expect(vehiclesWithoutDocument(vehicles, [{ ...document, typePieceJointeId: "99" }], type))
      .toEqual([vehicles[0]]);
  });

  it("keeps vehicles eligible for other document types", () => {
    expect(vehiclesWithoutDocument(vehicles, [{ ...document, typePieceJointeId: "99", naturePieceJointeId: "98" }], type))
      .toEqual(vehicles);
  });

  it("does not block uploads because of archived documents", () => {
    expect(vehiclesWithoutDocument(vehicles, [{ ...document, archived: true }], type)).toEqual(vehicles);
    expect(vehiclesWithoutDocument(vehicles, [{ ...document, status: "ARCHIVED" }], type)).toEqual(vehicles);
  });

  it("leaves expired documents to the replacement workflow", () => {
    expect(vehiclesWithoutDocument(vehicles, [{ ...document, status: "EXPIRED" }], type)).toEqual([vehicles[0]]);
  });

  it("matches legacy attachments by type when nature is missing", () => {
    expect(vehiclesWithoutDocument(vehicles, [{ ...document, naturePieceJointeId: null, status: undefined }], type))
      .toEqual([vehicles[0]]);
  });

  it("does not confuse client documents or unassigned documents with a vehicle", () => {
    expect(vehiclesWithoutDocument(vehicles, [{ ...document, vehiculeId: null, clientId: "2" }], type)).toEqual(vehicles);
    expect(vehiclesWithoutDocument(vehicles, [document], { ...type, documentOwner: "CLIENT" })).toEqual(vehicles);
  });

  it("returns no options when every vehicle has the document", () => {
    expect(vehiclesWithoutDocument(vehicles, [document, { ...document, id: "31", vehiculeId: "1" }], type)).toEqual([]);
  });
});
