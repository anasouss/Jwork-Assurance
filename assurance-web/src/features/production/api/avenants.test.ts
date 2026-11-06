import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/api/base";
import { avenantApi } from "./avenants";

vi.mock("@/lib/api/base", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/api/base")>(),
  apiFetch: vi.fn(),
}));

describe("amendment draft caller context", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
    vi.mocked(apiFetch).mockResolvedValue({ success: true, data: { id: "1" } });
  });

  it("keeps caller context separate from the persisted amendment request", async () => {
    const request = { codeTypeMouvement: "EXG_M", dateEffet: "2026-10-28" };
    await avenantApi.saveAvenantDraft("97", request, {
      intent: "SAVE_TARGET", targetKind: "VEHICULE", targetIndex: 0, section: "GARANTIES",
    });
    const [path, options] = vi.mocked(apiFetch).mock.calls[0];
    expect(path).toContain("/EXG_M/brouillon?intent=SAVE_TARGET&targetKind=VEHICULE&targetIndex=0&section=GARANTIES");
    expect(JSON.parse(String(options?.body))).toEqual(request);
  });

  it("distinguishes preparation for validation from an ordinary draft save", async () => {
    const request = { codeTypeMouvement: "EXG_M" };
    await avenantApi.saveAvenantDraft("97", request);
    await avenantApi.saveAvenantDraft("97", request, { intent: "PREPARE_VALIDATION" });
    expect(vi.mocked(apiFetch).mock.calls[0][0]).toContain("intent=SAVE_DRAFT");
    expect(vi.mocked(apiFetch).mock.calls[1][0]).toContain("intent=PREPARE_VALIDATION");
  });
});
