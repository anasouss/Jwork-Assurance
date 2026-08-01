import { apiFetch } from "@/lib/api/base";
import type { ApiResponse, ElementFacturable } from "../types";

import { unwrapApiResponse as unwrap } from "./response";

export const accountingApi = {
  async listBillableItems() {
    return unwrap(
      await apiFetch<ApiResponse<ElementFacturable[]>>(
        "/api/v1/compta/elements-facturables",
      ),
    );
  },
};
