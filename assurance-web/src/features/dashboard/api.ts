import { apiFetch, buildQueryString } from "@/lib/api/base";
import type { ApiResponse } from "@/lib/types";
import type { DashboardData, PlatformDashboardData } from "./types";

export const dashboardApi = {
  async get(params: { dateDu: string; dateAu: string }) {
    const response = await apiFetch<ApiResponse<DashboardData>>(
      `/api/v1/dashboard${buildQueryString(params)}`
    );
    return response.data;
  },
};

export const platformDashboardApi = {
  async get(params: { dateDu: string; dateAu: string; agenceId?: string }) {
    const response = await apiFetch<ApiResponse<PlatformDashboardData>>(
      `/api/v1/platform/dashboard${buildQueryString(params)}`
    );
    return response.data;
  },
};
