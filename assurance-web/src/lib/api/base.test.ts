import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearAuth, getAccessToken, saveAuth } from "@/lib/auth";
import type { AuthResponse } from "@/lib/types";
import { apiFetch, refreshAuthSession } from "./base";

const session = (accessToken: string): AuthResponse => ({
  accessToken,
  sessionId: "12",
  tokenType: "Bearer",
  expiresIn: 900,
  user: {
    id: "7",
    email: "agent@example.test",
    fullName: "Agent Test",
    roleCode: "AGENT",
    roleName: "Agent",
    agenceId: "1",
    agenceName: "Agence Test",
    permissions: ["contrat:view"],
  },
});

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("authenticated API requests", () => {
  beforeEach(() => {
    clearAuth();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not refresh when access is forbidden", async () => {
    saveAuth(session("access-1"));
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ message: "Forbidden" }, 403));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiFetch("/api/v1/secure")).rejects.toThrow("Forbidden");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refreshes once after a 401 and retries with the new access token", async () => {
    saveAuth(session("expired-access"));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 401))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: session("fresh-access") }))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { id: 44 } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiFetch<{ success: boolean; data: { id: string } }>("/api/v1/secure");

    expect(result.data.id).toBe("44");
    expect(getAccessToken()).toBe("fresh-access");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const refreshOptions = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(refreshOptions.credentials).toBe("include");
    expect(new Headers(refreshOptions.headers).get("X-Auth-Request")).toBe("1");
    const retryOptions = fetchMock.mock.calls[2]?.[1] as RequestInit;
    expect(new Headers(retryOptions.headers).get("Authorization")).toBe("Bearer fresh-access");
  });

  it("deduplicates concurrent refresh requests in one browser context", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ success: true, data: session("shared-access") })
    );
    vi.stubGlobal("fetch", fetchMock);

    const [first, second] = await Promise.all([
      refreshAuthSession(),
      refreshAuthSession(),
    ]);

    expect(first.accessToken).toBe("shared-access");
    expect(second.accessToken).toBe("shared-access");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reuses a session refreshed by another browser tab while waiting for the lock", async () => {
    saveAuth(session("expired-access"));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("navigator", {
      locks: {
        request: async (_name: string, callback: () => Promise<AuthResponse>) => {
          saveAuth(session("other-tab-access"));
          return callback();
        },
      },
    });

    const result = await refreshAuthSession();

    expect(result.accessToken).toBe("other-tab-access");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
