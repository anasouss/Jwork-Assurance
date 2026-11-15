import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/api/base";
import { portalApi } from "./client-portal-api";

vi.mock("@/lib/api/base", async importOriginal => {
  const original = await importOriginal<typeof import("@/lib/api/base")>();
  return { ...original, apiFetch: vi.fn() };
});

describe("client portal account lookup", () => {
  beforeEach(() => vi.mocked(apiFetch).mockReset());

  it("uses null when a successful response omits its empty data field", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ success: true });
    await expect(portalApi.account("53")).resolves.toBeNull();
  });

  it("keeps explicit null as the no-account state", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ success: true, data: null });
    await expect(portalApi.account("53")).resolves.toBeNull();
  });

  it("does not hide server failures as missing accounts", async () => {
    vi.mocked(apiFetch).mockRejectedValue(new Error("Server failure"));
    await expect(portalApi.account("53")).rejects.toThrow("Server failure");
  });
});
