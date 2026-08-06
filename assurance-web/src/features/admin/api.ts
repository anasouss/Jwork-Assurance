import { apiFetch, apiFetchBlob, apiUpload } from "@/lib/api/base";
import type { ApiResponse } from "@/lib/types";
import type {
  AdminAgency,
  AdminPermission,
  AdminRole,
  AdminUser,
  AdminUserSession,
  UpsertAdminAgencyRequest,
  UpsertAdminRoleRequest,
  UpsertAdminUserRequest,
  UpsertPlatformAdminRequest,
} from "./types";

const unwrap = <T>(response: ApiResponse<T>) => response.data;

export const adminApi = {
  async platformAdmins() {
    return unwrap(await apiFetch<ApiResponse<AdminUser[]>>("/api/v1/admin/platform-admins"));
  },

  async createPlatformAdmin(payload: UpsertPlatformAdminRequest) {
    return unwrap(await apiFetch<ApiResponse<AdminUser>>("/api/v1/admin/platform-admins", {
      method: "POST",
      body: JSON.stringify(payload),
    }));
  },

  async updatePlatformAdmin(id: string, payload: UpsertPlatformAdminRequest) {
    return unwrap(await apiFetch<ApiResponse<AdminUser>>(`/api/v1/admin/platform-admins/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }));
  },

  async deactivatePlatformAdmin(id: string) {
    return unwrap(await apiFetch<ApiResponse<void>>(`/api/v1/admin/platform-admins/${id}`, { method: "DELETE" }));
  },

  async resetPlatformAdminPassword(id: string, password: string) {
    return unwrap(await apiFetch<ApiResponse<void>>(`/api/v1/admin/platform-admins/${id}/password`, {
      method: "PUT",
      body: JSON.stringify({ password }),
    }));
  },

  async platformAdminSessions(id: string) {
    return unwrap(await apiFetch<ApiResponse<AdminUserSession[]>>(`/api/v1/admin/platform-admins/${id}/sessions`));
  },

  async revokePlatformAdminSession(userId: string, sessionId: string) {
    return unwrap(await apiFetch<ApiResponse<void>>(`/api/v1/admin/platform-admins/${userId}/sessions/${sessionId}`, {
      method: "DELETE",
    }));
  },

  async revokeAllPlatformAdminSessions(userId: string) {
    return unwrap(await apiFetch<ApiResponse<void>>(`/api/v1/admin/platform-admins/${userId}/sessions`, {
      method: "DELETE",
    }));
  },

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

  async userSessions(id: string) {
    return unwrap(await apiFetch<ApiResponse<AdminUserSession[]>>(`/api/v1/admin/users/${id}/sessions`));
  },

  async revokeUserSession(userId: string, sessionId: string) {
    return unwrap(await apiFetch<ApiResponse<void>>(`/api/v1/admin/users/${userId}/sessions/${sessionId}`, {
      method: "DELETE",
    }));
  },

  async revokeAllUserSessions(userId: string) {
    return unwrap(await apiFetch<ApiResponse<void>>(`/api/v1/admin/users/${userId}/sessions`, {
      method: "DELETE",
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

  async agencySignature(id: string) {
    return apiFetchBlob(`/api/v1/admin/agencies/${id}/signature`);
  },

  async uploadAgencySignature(id: string, file: File) {
    const formData = new FormData();
    formData.append("file", file);
    return unwrap(await apiUpload<ApiResponse<AdminAgency>>(
      `/api/v1/admin/agencies/${id}/signature`,
      formData
    ));
  },

  async deleteAgencySignature(id: string) {
    return unwrap(await apiFetch<ApiResponse<AdminAgency>>(`/api/v1/admin/agencies/${id}/signature`, {
      method: "DELETE",
    }));
  },
};
