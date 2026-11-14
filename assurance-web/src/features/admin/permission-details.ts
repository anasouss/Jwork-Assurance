import type { AdminPermission } from "./types";

export function permissionPrerequisites(permission: AdminPermission, catalogue: AdminPermission[]) {
  const byCode = new Map(catalogue.map(item => [item.code, item]));
  const codes = new Set<string>();
  const pending = [...permission.requiredPermissionCodes];
  while (pending.length > 0) {
    const code = pending.pop()!;
    if (codes.has(code) || code === permission.code) continue;
    codes.add(code);
    pending.push(...(byCode.get(code)?.requiredPermissionCodes ?? []));
  }
  return [...codes].sort().map(code => ({ code, label: byCode.get(code)?.nom ?? code }));
}
