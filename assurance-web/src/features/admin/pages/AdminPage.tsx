import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Edit,
  ImageIcon,
  KeyRound,
  Laptop,
  Monitor,
  MonitorSmartphone,
  Plus,
  Search,
  ShieldCheck,
  Smartphone,
  Tablet,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { TableRowActions } from "@/components/shared/table-row-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuthStore } from "@/store/auth-store";
import { adminApi } from "../api";
import type {
  AdminAgency,
  AdminPermission,
  AdminRole,
  AdminUser,
  AdminUserSession,
  UpsertAdminAgencyRequest,
  UpsertAdminRoleRequest,
  UpsertAdminUserRequest,
} from "../types";

export default function AdminPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const permissions = user?.permissions ?? [];
  const canManageUsers = permissions.includes("user:manage") || permissions.includes("config:manage");
  const canManageRoles = permissions.includes("role:manage") || permissions.includes("config:manage");
  const canManageAgencies = permissions.includes("agence:create") || permissions.includes("config:manage");
  const canViewAgencies = permissions.includes("agence:view") || permissions.includes("config:view");

  const users = useQuery({ queryKey: ["admin", "users"], queryFn: adminApi.users, staleTime: 30_000 });
  const roles = useQuery({ queryKey: ["admin", "roles"], queryFn: adminApi.roles, staleTime: 30_000 });
  const permissionsQuery = useQuery({ queryKey: ["admin", "permissions"], queryFn: adminApi.permissions, staleTime: 60_000 });
  const agencies = useQuery({
    queryKey: ["admin", "agencies"],
    queryFn: adminApi.agencies,
    staleTime: 60_000,
    enabled: canViewAgencies,
  });

  const availableAgencies = useMemo<AdminAgency[]>(() => {
    if (canViewAgencies) {
      return agencies.data ?? [];
    }
    return user?.agenceId ? [{
      id: user.agenceId,
      code: "",
      nom: user.agenceName ?? "Agence",
      logoDisponible: false,
      statut: "ACTIVE",
    }] : [];
  }, [agencies.data, canViewAgencies, user?.agenceId, user?.agenceName]);

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-fuchsia-700 dark:text-fuchsia-400">Administration d’agence</p>
        <h1 className="text-2xl font-semibold">Accès et organisation</h1>
        <p className="text-sm text-muted-foreground">
          Gérez les comptes de l’agence, leurs rôles et les appareils connectés.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <SummaryCard icon={Users} label="Utilisateurs" value={users.data?.length ?? 0} detail={`${users.data?.filter((item) => item.actif).length ?? 0} actifs`} />
        <SummaryCard icon={ShieldCheck} label="Rôles d’agence" value={roles.data?.length ?? 0} detail={`${permissionsQuery.data?.length ?? 0} permissions disponibles`} />
        <SummaryCard icon={Building2} label="Agences accessibles" value={availableAgencies.length} detail={canViewAgencies ? "Périmètre plateforme" : user?.agenceName ?? "Agence courante"} />
      </div>

      <Tabs defaultValue="users" className="grid gap-4">
        <TabsList className="w-fit">
          <TabsTrigger value="users">Utilisateurs</TabsTrigger>
          <TabsTrigger value="roles">Rôles & permissions</TabsTrigger>
          {canViewAgencies ? <TabsTrigger value="agencies">Agences</TabsTrigger> : null}
        </TabsList>

        <TabsContent value="users">
          <UsersPanel
            users={users.data ?? []}
            roles={roles.data ?? []}
            agencies={availableAgencies}
            canManage={canManageUsers}
            currentUserId={user?.id}
            onChanged={() => queryClient.invalidateQueries({ queryKey: ["admin", "users"] })}
          />
        </TabsContent>

        <TabsContent value="roles">
          <RolesPanel
            roles={roles.data ?? []}
            permissions={permissionsQuery.data ?? []}
            agencies={availableAgencies}
            canManage={canManageRoles}
            onChanged={async () => {
              await queryClient.invalidateQueries({ queryKey: ["admin", "roles"] });
              await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
            }}
          />
        </TabsContent>

        {canViewAgencies ? (
          <TabsContent value="agencies">
            <AgenciesPanel
              agencies={agencies.data ?? []}
              canManage={canManageAgencies}
              onChanged={() => queryClient.invalidateQueries({ queryKey: ["admin", "agencies"] })}
            />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <Card className="rounded-md shadow-none">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="grid size-10 shrink-0 place-items-center rounded-md bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950/40 dark:text-fuchsia-300">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{label}</div>
          <div className="truncate text-xs text-muted-foreground">{detail}</div>
        </div>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}

function UsersPanel({
  users,
  roles,
  agencies,
  canManage,
  currentUserId,
  onChanged,
}: {
  users: AdminUser[];
  roles: AdminRole[];
  agencies: AdminAgency[];
  canManage: boolean;
  currentUserId?: string;
  onChanged: () => void;
}) {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState<AdminUser | null>(null);
  const [sessionsTarget, setSessionsTarget] = useState<AdminUser | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<AdminUser | null>(null);
  const [form, setForm] = useState<UpsertAdminUserRequest>(emptyUser(agencies[0]?.id, roles[0]?.id));
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!dialogOpen) return;
    const defaultAgencyId = agencies[0]?.id;
    const defaultRoleId = roles.find(
      (role) => String(role.agenceId) === String(defaultAgencyId),
    )?.id;
    setForm(editing ? userToForm(editing) : emptyUser(defaultAgencyId, defaultRoleId));
  }, [agencies, dialogOpen, editing, roles]);

  const rolesForAgency = useMemo(
    () => roles.filter(
      (role) => String(role.agenceId) === String(form.agenceId),
    ),
    [form.agenceId, roles],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((item) => !term || [
      item.fullName,
      item.email,
      item.agenceNom,
      item.roleNom,
      item.telephone,
    ].some((value) => String(value ?? "").toLowerCase().includes(term)));
  }, [search, users]);

  const save = useMutation({
    mutationFn: () => editing ? adminApi.updateUser(editing.id, form) : adminApi.createUser(form),
    onSuccess: async () => {
      setDialogOpen(false);
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      onChanged();
      toast.success("Utilisateur enregistré");
    },
    onError: showError,
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => adminApi.deactivateUser(id),
    onSuccess: async () => {
      setDeactivateTarget(null);
      await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      onChanged();
      toast.success("Utilisateur désactivé");
    },
    onError: showError,
  });

  return (
    <div className="grid gap-4 rounded-lg border bg-card p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative md:max-w-md md:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Filtrer utilisateurs" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <Button disabled={!canManage} onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="size-4" />
          Ajouter utilisateur
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Utilisateur</TableHead>
              <TableHead>Agence</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead>Téléphone</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Dernière connexion</TableHead>
              <TableHead className="w-20 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <div className="font-medium">{item.fullName}</div>
                  <div className="text-xs text-muted-foreground">{item.email}</div>
                </TableCell>
                <TableCell>{item.agenceNom ?? "-"}</TableCell>
                <TableCell>{item.roleNom ?? item.roleCode ?? "-"}</TableCell>
                <TableCell>{item.telephone ?? "-"}</TableCell>
                <TableCell><Badge variant={item.actif ? "default" : "outline"}>{item.actif ? "Actif" : "Inactif"}</Badge></TableCell>
                <TableCell>{formatDateTime(item.lastLogin)}</TableCell>
                <TableCell className="text-right">
                  <TableRowActions
                    label={`Actions ${item.fullName}`}
                    actions={[
                      {
                        label: "Modifier",
                        icon: Edit,
                        disabled: !canManage,
                        onSelect: () => { setEditing(item); setDialogOpen(true); },
                      },
                      {
                        label: "Appareils connectés",
                        icon: MonitorSmartphone,
                        onSelect: () => setSessionsTarget(item),
                      },
                      {
                        label: "Changer le mot de passe",
                        icon: KeyRound,
                        disabled: !canManage,
                        onSelect: () => setPasswordTarget(item),
                      },
                      {
                        label: "Désactiver",
                        icon: Trash2,
                        destructive: true,
                        disabled: !canManage || item.id === currentUserId || !item.actif,
                        onSelect: () => setDeactivateTarget(item),
                      },
                    ]}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier utilisateur" : "Ajouter utilisateur"}</DialogTitle>
            <DialogDescription>Associez l'utilisateur à une agence et un rôle.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <LabeledInput label="Prénom" value={form.prenom} onChange={(value) => setForm({ ...form, prenom: value })} />
            <LabeledInput label="Nom" value={form.nom} onChange={(value) => setForm({ ...form, nom: value })} />
            <LabeledInput label="Email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} />
            <LabeledInput label="Téléphone" value={form.telephone ?? ""} onChange={(value) => setForm({ ...form, telephone: value })} />
            <LabeledInput label={editing ? "Nouveau mot de passe" : "Mot de passe"} type="password" value={form.password ?? ""} onChange={(value) => setForm({ ...form, password: value })} />
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Agence</span>
              <Select
                value={form.agenceId ?? ""}
                onValueChange={(value) => setForm({
                  ...form,
                  agenceId: value,
                  roleId: roles.find(
                    (role) => String(role.agenceId) === String(value),
                  )?.id ?? "",
                })}
              >
                <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>{agencies.map((agence) => <SelectItem key={agence.id} value={agence.id}>{agence.nom}</SelectItem>)}</SelectContent>
              </Select>
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Rôle</span>
              <Select value={form.roleId} onValueChange={(value) => setForm({ ...form, roleId: value })}>
                <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>{rolesForAgency.map((role) => <SelectItem key={role.id} value={role.id}>{role.nom}</SelectItem>)}</SelectContent>
              </Select>
            </label>
            <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <Checkbox checked={form.actif} onCheckedChange={(checked) => setForm({ ...form, actif: Boolean(checked) })} />
              Actif
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ResetPasswordDialog user={passwordTarget} onOpenChange={(open) => !open && setPasswordTarget(null)} onChanged={onChanged} />
      <UserSessionsDialog
        user={sessionsTarget}
        canRevoke={canManage}
        onOpenChange={(open) => !open && setSessionsTarget(null)}
      />
      <AlertDialog open={Boolean(deactivateTarget)} onOpenChange={(open) => !open && setDeactivateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Désactiver cet utilisateur ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le compte de {deactivateTarget?.fullName} sera désactivé et toutes ses sessions seront révoquées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deactivate.isPending}
              onClick={() => deactivateTarget && deactivate.mutate(deactivateTarget.id)}
            >
              Désactiver
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function UserSessionsDialog({
  user,
  canRevoke,
  onOpenChange,
}: {
  user: AdminUser | null;
  canRevoke: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [revokeTarget, setRevokeTarget] = useState<AdminUserSession | "ALL" | null>(null);
  const queryKey = ["admin", "users", user?.id, "sessions"] as const;
  const sessions = useQuery({
    queryKey,
    queryFn: () => adminApi.userSessions(user!.id),
    enabled: Boolean(user),
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!user) setRevokeTarget(null);
  }, [user]);

  const revoke = useMutation({
    mutationFn: async () => {
      if (!user || !revokeTarget) return;
      if (revokeTarget === "ALL") {
        await adminApi.revokeAllUserSessions(user.id);
      } else {
        await adminApi.revokeUserSession(user.id, revokeTarget.id);
      }
    },
    onSuccess: async () => {
      setRevokeTarget(null);
      await queryClient.invalidateQueries({ queryKey });
      toast.success("Session(s) révoquée(s)");
    },
    onError: showError,
  });

  return (
    <>
      <Dialog open={Boolean(user)} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Appareils connectés</DialogTitle>
            <DialogDescription>
              Sessions actives de {user?.fullName}. Une session révoquée devra se reconnecter.
            </DialogDescription>
          </DialogHeader>

          <div className="grid max-h-[55vh] gap-2 overflow-y-auto pr-1">
            {sessions.isLoading ? (
              <div className="grid min-h-32 place-items-center text-sm text-muted-foreground">
                Chargement des appareils...
              </div>
            ) : sessions.isError ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                Impossible de charger les sessions actives.
              </div>
            ) : sessions.data?.length ? (
              sessions.data.map((session) => {
                const DeviceIcon = sessionDeviceIcon(session.deviceType);
                return (
                  <div key={session.id} className="flex items-center gap-3 rounded-md border bg-card p-3">
                    <div className="grid size-10 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                      <DeviceIcon className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{session.deviceName || "Appareil inconnu"}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {[session.ipAddress || "IP inconnue", `Activité ${formatDateTime(session.lastActivityAt)}`].join(" · ")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Connecté depuis le {formatDateTime(session.createdAt)}
                      </div>
                    </div>
                    {canRevoke ? (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive hover:text-destructive"
                        aria-label={`Révoquer ${session.deviceName || "la session"}`}
                        onClick={() => setRevokeTarget(session)}
                      >
                        <X className="size-4" />
                      </Button>
                    ) : null}
                  </div>
                );
              })
            ) : (
              <div className="grid min-h-32 place-items-center rounded-md border border-dashed text-sm text-muted-foreground">
                Aucune session active
              </div>
            )}
          </div>

          <DialogFooter className="sm:justify-between">
            {canRevoke && (sessions.data?.length ?? 0) > 0 ? (
              <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setRevokeTarget("ALL")}>
                <Trash2 className="size-4" />
                Révoquer toutes
              </Button>
            ) : <span />}
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(revokeTarget)} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {revokeTarget === "ALL" ? "Révoquer toutes les sessions ?" : "Révoquer cette session ?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {revokeTarget === "ALL"
                ? `Tous les appareils de ${user?.fullName ?? "cet utilisateur"} devront se reconnecter.`
                : "Cet appareil perdra immédiatement sa session de renouvellement."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={revoke.isPending}
              onClick={() => revoke.mutate()}
            >
              Révoquer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function sessionDeviceIcon(deviceType?: string | null) {
  switch (deviceType?.toUpperCase()) {
    case "MOBILE":
      return Smartphone;
    case "TABLET":
      return Tablet;
    case "DESKTOP":
      return Laptop;
    default:
      return Monitor;
  }
}

function RolesPanel({
  roles,
  permissions,
  agencies,
  canManage,
  onChanged,
}: {
  roles: AdminRole[];
  permissions: AdminPermission[];
  agencies: AdminAgency[];
  canManage: boolean;
  onChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<AdminRole | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<UpsertAdminRoleRequest>(emptyRole(agencies[0]?.id));
  const groupedPermissions = useMemo(() => groupPermissions(permissions), [permissions]);

  useEffect(() => {
    if (!dialogOpen) return;
    setForm(editing ? roleToForm(editing) : emptyRole(agencies[0]?.id));
  }, [agencies, dialogOpen, editing]);

  const save = useMutation({
    mutationFn: () => editing ? adminApi.updateRole(editing.id, form) : adminApi.createRole(form),
    onSuccess: async () => {
      setDialogOpen(false);
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ["admin", "roles"] });
      onChanged();
      toast.success("Role enregistré");
    },
    onError: showError,
  });

  const remove = useMutation({
    mutationFn: (id: string) => adminApi.deleteRole(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "roles"] });
      onChanged();
      toast.success("Role supprimé");
    },
    onError: showError,
  });

  return (
    <div className="grid gap-4 rounded-lg border bg-card p-4">
      <div className="flex justify-end">
        <Button disabled={!canManage} onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="size-4" />
          Ajouter rôle
        </Button>
      </div>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Role</TableHead>
              <TableHead>Agence</TableHead>
              <TableHead>Permissions</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="w-20 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.map((role) => (
              <TableRow key={role.id}>
                <TableCell>
                  <div className="font-medium">{role.nom}</div>
                  <div className="text-xs text-muted-foreground">{role.code}</div>
                </TableCell>
                <TableCell>{role.agenceNom ?? "Global"}</TableCell>
                <TableCell>{role.permissionCodes.length} permission(s)</TableCell>
                <TableCell><Badge variant={role.systemRole ? "default" : "outline"}>{role.systemRole ? "Système" : "Custom"}</Badge></TableCell>
                <TableCell className="text-right">
                  <TableRowActions
                    label={`Actions ${role.nom}`}
                    actions={[
                      {
                        label: "Modifier",
                        icon: Edit,
                        disabled: !canManage,
                        onSelect: () => { setEditing(role); setDialogOpen(true); },
                      },
                      {
                        label: "Supprimer",
                        icon: Trash2,
                        destructive: true,
                        disabled: !canManage || role.systemRole,
                        onSelect: () => remove.mutate(role.id),
                      },
                    ]}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier rôle" : "Ajouter rôle"}</DialogTitle>
            <DialogDescription>Les permissions déterminent les modules visibles et les actions autorisées.</DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[70vh] gap-4 overflow-y-auto pr-1">
            <div className="grid gap-3 sm:grid-cols-2">
              <LabeledInput label="Code" value={form.code} onChange={(value) => setForm({ ...form, code: value })} />
              <LabeledInput label="Nom" value={form.nom} onChange={(value) => setForm({ ...form, nom: value })} />
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">Agence</span>
                <Select value={form.agenceId ?? ""} disabled={agencies.length <= 1} onValueChange={(value) => setForm({ ...form, agenceId: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {agencies.map((agence) => <SelectItem key={agence.id} value={agence.id}>{agence.nom}</SelectItem>)}
                  </SelectContent>
                </Select>
              </label>
              <label className="grid gap-1.5 text-sm sm:col-span-2">
                <span className="font-medium">Description</span>
                <Textarea value={form.description ?? ""} onChange={(event) => setForm({ ...form, description: event.target.value })} />
              </label>
            </div>

            <div className="grid gap-3">
              {groupedPermissions.map(([module, items]) => (
                <div key={module} className="rounded-md border p-3">
                  <div className="mb-2 text-sm font-semibold uppercase text-muted-foreground">{module}</div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((permission) => (
                      <label key={permission.id} className="flex items-start gap-2 rounded-md border px-3 py-2 text-sm">
                        <Checkbox
                          checked={form.permissionIds.includes(permission.id)}
                          onCheckedChange={(checked) => {
                            const ids = new Set(form.permissionIds);
                            if (checked) ids.add(permission.id);
                            else ids.delete(permission.id);
                            setForm({ ...form, permissionIds: Array.from(ids) });
                          }}
                        />
                        <span>
                          <span className="block font-medium">{permission.nom}</span>
                          <span className="block text-xs text-muted-foreground">{permission.code}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AgenciesPanel({ agencies, canManage, onChanged }: { agencies: AdminAgency[]; canManage: boolean; onChanged: () => void }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<AdminAgency | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<UpsertAdminAgencyRequest>(emptyAgency());
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);

  useEffect(() => {
    if (!dialogOpen) return;
    setForm(editing ? agencyToForm(editing) : emptyAgency());
    setLogoFile(null);
    setRemoveLogo(false);
  }, [dialogOpen, editing]);

  const save = useMutation({
    mutationFn: async () => {
      const agence = editing
        ? await adminApi.updateAgency(editing.id, form)
        : await adminApi.createAgency(form);
      try {
        if (logoFile) {
          return await adminApi.uploadAgencyLogo(agence.id, logoFile);
        }
        if (editing && removeLogo && editing.logoDisponible) {
          return await adminApi.deleteAgencyLogo(agence.id);
        }
        return agence;
      } catch (error) {
        setEditing(agence);
        await queryClient.invalidateQueries({ queryKey: ["admin", "agencies"] });
        throw error;
      }
    },
    onSuccess: async () => {
      setDialogOpen(false);
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ["admin", "agencies"] });
      onChanged();
      toast.success("Agence enregistrée");
    },
    onError: showError,
  });

  return (
    <div className="grid gap-4 rounded-lg border bg-card p-4">
      <div className="flex justify-end">
        <Button disabled={!canManage} onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="size-4" />
          Ajouter agence
        </Button>
      </div>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agence</TableHead>
              <TableHead>Ville</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="w-20 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agencies.map((agence) => (
              <TableRow key={agence.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <AgencyLogoImage agency={agence} className="size-11 rounded border bg-white object-contain p-1" />
                    <div>
                      <div className="font-medium">{agence.nom}</div>
                      <div className="text-xs text-muted-foreground">{agence.code}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>{agence.ville ?? "-"}</TableCell>
                <TableCell>
                  <div>{agence.telephone ?? "-"}</div>
                  <div className="text-xs text-muted-foreground">{agence.email ?? "-"}</div>
                </TableCell>
                <TableCell><Badge variant={agence.statut === "ACTIVE" ? "default" : "outline"}>{agence.statut}</Badge></TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon-sm" disabled={!canManage} onClick={() => { setEditing(agence); setDialogOpen(true); }} aria-label={`Modifier ${agence.nom}`}>
                    <Edit className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier agence" : "Ajouter agence"}</DialogTitle>
            <DialogDescription>Les agences portent les utilisateurs, rôles agence et données de production.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-[220px_minmax(0,1fr)]">
            <AgencyLogoField
              agency={editing}
              file={logoFile}
              removed={removeLogo}
              onFile={(file) => {
                setLogoFile(file);
                setRemoveLogo(false);
              }}
              onRemove={() => {
                setLogoFile(null);
                setRemoveLogo(true);
              }}
            />
            <div className="grid gap-3 sm:grid-cols-2">
            <LabeledInput label="Code" value={form.code} onChange={(value) => setForm({ ...form, code: value })} />
            <LabeledInput label="Nom" value={form.nom} onChange={(value) => setForm({ ...form, nom: value })} />
            <LabeledInput label="Ville" value={form.ville ?? ""} onChange={(value) => setForm({ ...form, ville: value })} />
            <LabeledInput label="Téléphone" value={form.telephone ?? ""} onChange={(value) => setForm({ ...form, telephone: value })} />
            <LabeledInput label="Fax" value={form.fax ?? ""} onChange={(value) => setForm({ ...form, fax: value })} />
            <LabeledInput label="Email" value={form.email ?? ""} onChange={(value) => setForm({ ...form, email: value })} />
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Statut</span>
              <Select value={form.statut} onValueChange={(value) => setForm({ ...form, statut: value as AdminAgency["statut"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="SUSPENDED">Suspendue</SelectItem>
                  <SelectItem value="ARCHIVED">Archivée</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className="grid gap-1.5 text-sm sm:col-span-2">
              <span className="font-medium">Adresse</span>
              <Textarea value={form.adresse ?? ""} onChange={(event) => setForm({ ...form, adresse: event.target.value })} />
            </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AgencyLogoField({
  agency,
  file,
  removed,
  onFile,
  onRemove,
}: {
  agency: AdminAgency | null;
  file: File | null;
  removed: boolean;
  onFile: (file: File) => void;
  onRemove: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [localUrl, setLocalUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setLocalUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setLocalUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const selectFile = (selected?: File) => {
    if (!selected) return;
    if (!["image/png", "image/jpeg"].includes(selected.type)) {
      toast.error("Le logo doit être au format PNG ou JPEG");
      return;
    }
    if (selected.size > 4 * 1024 * 1024) {
      toast.error("Le logo ne doit pas dépasser 4 Mo");
      return;
    }
    onFile(selected);
  };

  return (
    <div className="grid content-start gap-2">
      <span className="text-sm font-medium">Logo de l’agence</span>
      <label
        className={`grid min-h-52 cursor-pointer place-items-center rounded-md border border-dashed p-4 text-center transition-colors ${
          dragging ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
        }`}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          selectFile(event.dataTransfer.files[0]);
        }}
      >
        <input
          type="file"
          accept="image/png,image/jpeg"
          className="sr-only"
          onChange={(event) => {
            selectFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        {localUrl ? (
          <img src={localUrl} alt="Aperçu du logo" className="max-h-36 max-w-full object-contain" />
        ) : agency && agency.logoDisponible && !removed ? (
          <AgencyLogoImage agency={agency} className="max-h-36 max-w-full object-contain" />
        ) : (
          <div className="grid justify-items-center gap-2 text-muted-foreground">
            <ImageIcon className="size-10" />
            <span className="text-sm font-medium text-foreground">Déposer le logo ici</span>
            <span className="text-xs">PNG ou JPEG, 4 Mo maximum</span>
          </div>
        )}
        <span className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-primary">
          <Upload className="size-3.5" />
          Choisir un fichier
        </span>
      </label>
      {(file || (agency?.logoDisponible && !removed)) ? (
        <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={onRemove}>
          <Trash2 className="size-4" />
          Supprimer le logo
        </Button>
      ) : null}
    </div>
  );
}

function AgencyLogoImage({ agency, className }: { agency: AdminAgency; className?: string }) {
  const logo = useQuery({
    queryKey: ["admin", "agencies", agency.id, "logo"],
    queryFn: () => adminApi.agencyLogo(agency.id),
    enabled: agency.logoDisponible,
    staleTime: 5 * 60_000,
  });
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!agency.logoDisponible || !logo.data) {
      setUrl(null);
      return;
    }
    const nextUrl = URL.createObjectURL(logo.data);
    setUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [agency.logoDisponible, logo.data]);

  if (!agency.logoDisponible || !url) {
    return (
      <span className={`grid place-items-center bg-muted text-muted-foreground ${className ?? ""}`}>
        <ImageIcon className="size-5" />
      </span>
    );
  }
  return <img src={url} alt={`Logo ${agency.nom}`} className={className} />;
}

function ResetPasswordDialog({ user, onOpenChange, onChanged }: { user: AdminUser | null; onOpenChange: (open: boolean) => void; onChanged: () => void }) {
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (user) setPassword("");
  }, [user]);

  const reset = useMutation({
    mutationFn: () => user ? adminApi.resetUserPassword(user.id, password) : Promise.resolve(),
    onSuccess: () => {
      onOpenChange(false);
      onChanged();
      toast.success("Mot de passe réinitialisé");
    },
    onError: showError,
  });

  return (
    <Dialog open={Boolean(user)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Réinitialiser le mot de passe</DialogTitle>
          <DialogDescription>{user?.fullName}</DialogDescription>
        </DialogHeader>
        <LabeledInput label="Nouveau mot de passe" type="password" value={password} onChange={setPassword} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={() => reset.mutate()} disabled={reset.isPending || password.length < 8}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LabeledInput({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function emptyUser(agenceId?: string, roleId?: string): UpsertAdminUserRequest {
  return { agenceId, roleId: roleId ?? "", email: "", password: "", prenom: "", nom: "", telephone: "", actif: true };
}

function userToForm(user: AdminUser): UpsertAdminUserRequest {
  return {
    agenceId: user.agenceId ?? undefined,
    roleId: user.roleId ?? "",
    email: user.email,
    prenom: user.prenom,
    nom: user.nom,
    telephone: user.telephone ?? "",
    actif: user.actif,
  };
}

function emptyRole(agenceId?: string): UpsertAdminRoleRequest {
  return { agenceId, code: "", nom: "", description: "", systemRole: false, permissionIds: [] };
}

function roleToForm(role: AdminRole): UpsertAdminRoleRequest {
  return {
    agenceId: role.agenceId ?? undefined,
    code: role.code,
    nom: role.nom,
    description: role.description ?? "",
    systemRole: role.systemRole,
    permissionIds: role.permissionIds ?? [],
  };
}

function emptyAgency(): UpsertAdminAgencyRequest {
  return { code: "", nom: "", adresse: "", ville: "", telephone: "", fax: "", email: "", statut: "ACTIVE" };
}

function agencyToForm(agence: AdminAgency): UpsertAdminAgencyRequest {
  return {
    code: agence.code,
    nom: agence.nom,
    adresse: agence.adresse ?? "",
    ville: agence.ville ?? "",
    telephone: agence.telephone ?? "",
    fax: agence.fax ?? "",
    email: agence.email ?? "",
    statut: agence.statut,
  };
}

function groupPermissions(permissions: AdminPermission[]) {
  const groups = new Map<string, AdminPermission[]>();
  permissions.forEach((permission) => {
    const module = permission.module || "Autres";
    groups.set(module, [...(groups.get(module) ?? []), permission]);
  });
  return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function showError(error: unknown) {
  toast.error(error instanceof Error ? error.message : "Opération impossible");
}
