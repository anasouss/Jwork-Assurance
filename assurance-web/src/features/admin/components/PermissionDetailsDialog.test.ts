import { describe, expect, it } from "vitest";
import type { AdminPermission } from "../types";
import { permissionPrerequisites } from "../permission-details";

function permission(code: string, requiredPermissionCodes: string[] = []): AdminPermission {
  return { id: code, code, nom: code, module: "administration", superAdminOnly: false, requiredPermissionCodes };
}

describe("permission explanation prerequisites", () => {
  it("includes transitive prerequisites without inventing write grants", () => {
    const create = permission("user:create", ["user:view", "user:assign-role"]);
    const assign = permission("user:assign-role", ["user:view", "role:view"]);
    const catalogue = [create, assign, permission("user:view"), permission("role:view"), permission("user:delete")];
    expect(permissionPrerequisites(create, catalogue).map(item => item.code))
      .toEqual(["role:view", "user:assign-role", "user:view"]);
  });

  it("terminates cycles and preserves a missing prerequisite code as a label", () => {
    const first = permission("first:view", ["second:view", "missing:view"]);
    const second = permission("second:view", ["first:view"]);
    expect(permissionPrerequisites(first, [first, second]))
      .toEqual([{ code: "missing:view", label: "missing:view" }, { code: "second:view", label: "second:view" }]);
  });
});
