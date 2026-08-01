import type { ApiResponse } from "../types";

export function unwrapApiResponse<T>(response: ApiResponse<T>): T {
  return response.data;
}
