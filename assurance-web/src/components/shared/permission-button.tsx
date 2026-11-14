import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth-store";

type PermissionButtonProps = ComponentProps<typeof Button> & {
  permission: string;
};

export function PermissionButton({ permission, ...props }: PermissionButtonProps) {
  const allowed = useAuthStore(state => state.user?.permissions.includes(permission) ?? false);
  return allowed ? <Button {...props} /> : null;
}
