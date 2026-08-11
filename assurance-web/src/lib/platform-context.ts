import type { AuthUser } from "@/lib/types";

export function isPlatformAdmin(user: AuthUser | null | undefined) {
  return Boolean(user?.platformAdmin);
}

export function hasAgencyContext(user: AuthUser | null | undefined) {
  return Boolean(user?.agenceId && user.operatingMode === "AGENCY");
}

export function isPlatformMode(user: AuthUser | null | undefined) {
  return isPlatformAdmin(user) && !hasAgencyContext(user);
}
