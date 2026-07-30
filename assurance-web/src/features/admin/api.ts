import { apiFetch, apiFetchBlob, apiUpload } from "@/lib/api/base";
import type { ApiResponse } from "@/lib/types";
import type {
  AdminAgency,
  AdminPermission,
  AdminRole,
  AdminUser,
  UpsertAdminAgencyRequest,
  UpsertAdminRoleRequest,
  UpsertAdminUserRequest,
} from "./types";

const unwrap = <T>(response: ApiResponse<T>) => response.data;

export const adminApi = {
  async users() {
    return unwrap(await apiFetch<ApiResponse<AdminUser[]>>("/api/v1/admin/users"));
  },

  async createUser(payload: UpsertAdminUserRequest) {
    return unwrap(await apiFetch<ApiResponse<AdminUser>>("/api/v1/admin/users", {
      method: "POST",
      body: JSON.stringify(payload),
    }));
  },

  async updateUser(id: string, payload: UpsertAdminUserRequest) {
    return unwrap(await apiFetch<ApiResponse<AdminUser>>(`/api/v1/admin/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }));
  },

  async deactivateUser(id: string) {
    return unwrap(await apiFetch<ApiResponse<void>>(`/api/v1/admin/users/${id}`, { method: "DELETE" }));
  },

  async resetUserPassword(id: string, password: string) {
    return unwrap(await apiFetch<ApiResponse<void>>(`/api/v1/admin/users/${id}/password`, {
      method: "PUT",
      body: JSON.stringify({ password }),
    }));
  },

  async roles() {
    return unwrap(await apiFetch<ApiResponse<AdminRole[]>>("/api/v1/admin/roles"));
  },

  async createRole(payload: UpsertAdminRoleRequest) {
    return unwrap(await apiFetch<ApiResponse<AdminRole>>("/api/v1/admin/roles", {
      method: "POST",
      body: JSON.stringify(payload),
    }));
  },

  async updateRole(id: string, payload: UpsertAdminRoleRequest) {
    return unwrap(await apiFetch<ApiResponse<AdminRole>>(`/api/v1/admin/roles/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }));
  },

  async deleteRole(id: string) {
    return unwrap(await apiFetch<ApiResponse<void>>(`/api/v1/admin/roles/${id}`, { method: "DELETE" }));
  },

  async permissions() {
    return unwrap(await apiFetch<ApiResponse<AdminPermission[]>>("/api/v1/admin/permissions"));
  },

  async agencies() {
    return unwrap(await apiFetch<ApiResponse<AdminAgency[]>>("/api/v1/admin/agencies"));
  },

  async createAgency(payload: UpsertAdminAgencyRequest) {
    return unwrap(await apiFetch<ApiResponse<AdminAgency>>("/api/v1/admin/agencies", {
      method: "POST",
      body: JSON.stringify(payload),
    }));
  },

  async updateAgency(id: string, payload: UpsertAdminAgencyRequest) {
    return unwrap(await apiFetch<ApiResponse<AdminAgency>>(`/api/v1/admin/agencies/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }));
  },

  async agencyLogo(id: string) {
    return apiFetchBlob(`/api/v1/admin/agencies/${id}/logo`);
  },

  async uploadAgencyLogo(id: string, file: File) {
    const formData = new FormData();
    formData.append("file", file);
    return unwrap(await apiUpload<ApiResponse<AdminAgency>>(`/api/v1/admin/agencies/${id}/logo`, formData));
  },

  async deleteAgencyLogo(id: string) {
    return unwrap(await apiFetch<ApiResponse<AdminAgency>>(`/api/v1/admin/agencies/${id}/logo`, {
      method: "DELETE",
    }));
  },
};
