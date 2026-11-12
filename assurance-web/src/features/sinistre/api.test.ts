import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch, apiFetchBlob, apiUpload } from "@/lib/api/base";
import { sinistreApi, sinistreKeys } from "./api";
import type { SinistreListParams, SinistreOpeningRequest } from "./types";

vi.mock("@/lib/api/base", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/api/base")>(),
  apiFetch: vi.fn(),
  apiFetchBlob: vi.fn(),
  apiUpload: vi.fn(),
}));

describe("claims API contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiFetch).mockResolvedValue({ success: true, data: { id: "12" } });
    vi.mocked(apiUpload).mockResolvedValue({ success: true, data: { id: "12" } });
    vi.mocked(apiFetchBlob).mockResolvedValue(new Blob(["xlsx"]));
  });

  it("opens the claim and its typed files in one ordered multipart request", async () => {
    const constat = new File(["constat"], "constat.pdf", { type: "application/pdf" });
    const pv = new File(["pv"], "pv.pdf", { type: "application/pdf" });
    const request: SinistreOpeningRequest = {
      contratId: "9007199254740993", nature: "ACCIDENT", dateSinistre: "2026-11-01",
      dateDeclaration: "2026-11-02", garantieIds: ["72"], tauxResponsabilite: 0,
      typeDommage: "MIXTE", modeReparation: "PEC", garageId: "35",
      expertInitial: { expertId: "38", phase: "AVANT", dateMission: "2026-11-03", statut: "MANDATEE" },
      declarer: true,
    };
    await sinistreApi.open(request, [
      { type: "CONSTAT", file: constat, reference: "C-1" },
      { type: "PV_POLICE", file: pv, commentaire: "PV initial" },
    ]);
    expect(apiUpload).toHaveBeenCalledTimes(1);
    expect(apiFetch).not.toHaveBeenCalled();
    const [path, form] = vi.mocked(apiUpload).mock.calls[0];
    expect(path).toBe("/api/v1/sinistres/ouverture");
    const requestPart = form.get("request") as Blob;
    const documentsPart = form.get("documents") as Blob;
    expect(requestPart.type).toBe("application/json");
    expect(documentsPart.type).toBe("application/json");
    expect(JSON.parse(await requestPart.text())).toEqual(request);
    expect(JSON.parse(await documentsPart.text())).toEqual([
      { type: "CONSTAT", reference: "C-1" },
      { type: "PV_POLICE", commentaire: "PV initial" },
    ]);
    const files = form.getAll("files") as File[];
    expect(files.map((file) => file.name)).toEqual(["constat.pdf", "pv.pdf"]);
    expect(await files[0].text()).toBe("constat");
    expect(await files[1].text()).toBe("pv");
  });

  it("also opens a draft without making separate file requests", async () => {
    await sinistreApi.open({ contratId: "1", nature: "VOL", dateSinistre: "2026-11-01", dateDeclaration: "2026-11-02", garantieIds: [], declarer: false }, []);
    const form = vi.mocked(apiUpload).mock.calls[0][1];
    expect(form.getAll("files")).toEqual([]);
    expect(JSON.parse(await (form.get("documents") as Blob).text())).toEqual([]);
  });

  it("sends operational stage and optimistic version without a financial status", async () => {
    await sinistreApi.changeStage("12", "INSTANCE_CLIENT", "Attente des pièces du client", 7);
    const [path, options] = vi.mocked(apiFetch).mock.calls[0];
    expect(path).toBe("/api/v1/sinistres/12/etape");
    expect(options?.method).toBe("POST");
    expect(JSON.parse(String(options?.body))).toEqual({
      etapeSuivi: "INSTANCE_CLIENT", motif: "Attente des pièces du client", version: 7,
    });
  });

  it("exports all matching rows with precisely the applied list filters", async () => {
    const filters: SinistreListParams = {
      query: "12345-A-6", clientId: "7", contratId: "8", brancheId: "9",
      statut: "DECLARE", etapeSuivi: "OUVERTURE", nature: "ACCIDENT",
      dateDu: "2026-11-01", dateAu: "2026-11-12", page: 3, size: 25,
    };
    await sinistreApi.list(filters);
    await sinistreApi.exportRegister(filters);
    const listUrl = new URL(vi.mocked(apiFetch).mock.calls[0][0], "https://test.invalid");
    const exportUrl = new URL(vi.mocked(apiFetchBlob).mock.calls[0][0], "https://test.invalid");
    expect(exportUrl.pathname).toBe("/api/v1/sinistres/registre/export");
    listUrl.searchParams.delete("page");
    listUrl.searchParams.delete("size");
    expect(exportUrl.search).toBe(listUrl.search);
    expect(filters.page).toBe(3);
    expect(filters.size).toBe(25);
  });

  it("separates city-filtered expert caches and requests", async () => {
    expect(sinistreKeys.experts(false, "1")).not.toEqual(sinistreKeys.experts(false, "2"));
    await sinistreApi.experts(false, "14");
    expect(apiFetch).toHaveBeenCalledWith("/api/v1/sinistres/referentiels/experts?includeInactive=false&villeId=14");
  });

  it("looks up historical contracts through the claims domain with minimal client fields", async () => {
    const contracts = [{
      id: "9007199254740993", numeroPolice: "P-14", brancheAssuranceCode: "AUTOMOBILE",
      clients: [{ role: "PROPRIETAIRE", nomAffichage: "Assuré" }],
      dateEffet: "2025-01-01", dateEcheance: "2025-12-31",
    }];
    vi.mocked(apiFetch).mockResolvedValueOnce({ success: true, data: contracts });
    expect(await sinistreApi.lookupContracts("7", "12345-A-6")).toEqual(contracts);
    expect(apiFetch).toHaveBeenCalledWith("/api/v1/sinistres/contrats?brancheId=7&query=12345-A-6");
    expect(sinistreKeys.contracts("7", "P-14")).not.toEqual(sinistreKeys.contracts("8", "P-14"));
  });

  it("does not invent a reason when the backend allows an ordinary next step", async () => {
    await sinistreApi.changeStage("12", "EXPERTISE_AVANT", undefined, 8);
    expect(JSON.parse(String(vi.mocked(apiFetch).mock.calls[0][1]?.body))).toEqual({
      etapeSuivi: "EXPERTISE_AVANT", version: 8,
    });
  });
});
