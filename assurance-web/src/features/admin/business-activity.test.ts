import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/base", () => ({ apiFetch: vi.fn(), buildQueryString: vi.fn() }));

import { apiFetch } from "@/lib/api/base";
import { activityKeys, getBusinessActivity } from "./business-activity";

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
