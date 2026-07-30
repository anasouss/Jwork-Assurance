import { apiFetch, buildQueryString } from "@/lib/api/base";
import type { ApiResponse } from "@/lib/types";
import type { DashboardData } from "./types";

export const dashboardApi = {
  async get(params: { dateDu: string; dateAu: string }) {
    const response = await apiFetch<ApiResponse<DashboardData>>(
      `/api/v1/dashboard${buildQueryString(params)}`
    );
    return response.data;
  },
};
