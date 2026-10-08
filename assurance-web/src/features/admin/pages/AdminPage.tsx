import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Building2,
  Edit,
  ExternalLink,
  Eye,
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
import { ServerPagination } from "@/components/shared";
import { TableRowActions } from "@/components/shared/table-row-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
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
import { toDateOnly } from "@/features/production/date";
import { useAuthStore } from "@/store/auth-store";
import { adminApi } from "../api";
import { AgencyImageUploadField } from "../components/AgencyImageUploadField";
import type {
  AdminAgency,
  AdminAuditEvent,
  AdminPermission,
  AdminRole,
  AdminUser,
  AdminUserSession,
  UpsertAdminAgencyRequest,
  UpsertAdminRoleRequest,
  UpsertAdminUserRequest,
  UpsertPlatformAdminRequest,
} from "../types";

export default function AdminPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const permissions = user?.permissions ?? [];
  const canViewUsers = permissions.includes("user:view") || permissions.includes("user:manage") || permissions.includes("config:view") || permissions.includes("config:manage");
  const canViewRoles = permissions.includes("role:view") || permissions.includes("role:manage") || permissions.includes("config:view") || permissions.includes("config:manage");
  const canViewAudit = permissions.includes("audit:view");
  const canManageUsers = permissions.includes("user:manage") || permissions.includes("config:manage");
  const canManageRoles = permissions.includes("role:manage") || permissions.includes("config:manage");
  const canManagePlatformAgencies = permissions.includes("agence:create") || permissions.includes("config:manage");
  const canManageOwnAgency = permissions.includes("agence:manage-self");
  const canManageAgencies = canManagePlatformAgencies || canManageOwnAgency;
  const canViewAgencies = permissions.includes("agence:view") || permissions.includes("config:view");
  const canAccessAgencySettings = canViewAgencies || canManageOwnAgency;
  const isPlatformAdmin = Boolean(user?.platformAdmin);
  const isPlatformMode = isPlatformAdmin && user?.operatingMode === "PLATFORM";
  const defaultTab = canViewUsers ? "users" : canViewRoles ? "roles" : canViewAudit ? "audit" : "agencies";

  const users = useQuery({ queryKey: ["admin", "users"], queryFn: adminApi.users, staleTime: 30_000, enabled: canViewUsers });
  const roles = useQuery({ queryKey: ["admin", "roles"], queryFn: adminApi.roles, staleTime: 30_000, enabled: canViewRoles || canManageUsers });
  const permissionsQuery = useQuery({ queryKey: ["admin", "permissions"], queryFn: adminApi.permissions, staleTime: 60_000, enabled: canViewRoles });
  const agencies = useQuery({
    queryKey: ["admin", "agencies"],
    queryFn: adminApi.agencies,
    staleTime: 60_000,
    enabled: canAccessAgencySettings,
  });
  const platformAdmins = useQuery({
    queryKey: ["admin", "platform-admins"],
    queryFn: adminApi.platformAdmins,
    staleTime: 30_000,
    enabled: isPlatformMode,
  });

  const availableAgencies = useMemo<AdminAgency[]>(() => {
    if (canAccessAgencySettings) {
      return agencies.data ?? [];
    }
    return user?.agenceId ? [{
      id: user.agenceId,
      code: "",
      nom: user.agenceName ?? "Agence",
      logoDisponible: false,
      signatureDisponible: false,
      statut: "ACTIVE",
    }] : [];
  }, [agencies.data, canAccessAgencySettings, user?.agenceId, user?.agenceName]);

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-fuchsia-700 dark:text-fuchsia-400">
          {isPlatformMode ? "Administration de la plateforme" : "Administration d’agence"}
        </p>
        <h1 className="text-2xl font-semibold">Accès et organisation</h1>
        <p className="text-sm text-muted-foreground">
          {isPlatformMode
            ? "Gérez les agences, leurs accès et les administrateurs globaux de la plateforme."
            : "Gérez les comptes de l’agence, leurs rôles et les appareils connectés."}
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {canViewUsers ? <SummaryCard icon={Users} label="Utilisateurs" value={users.data?.length ?? 0} detail={`${users.data?.filter((item) => item.actif).length ?? 0} actifs`} /> : null}
        {canViewRoles ? <SummaryCard icon={ShieldCheck} label="Rôles d’agence" value={roles.data?.length ?? 0} detail={`${permissionsQuery.data?.length ?? 0} permissions disponibles`} /> : null}
        {canAccessAgencySettings ? <SummaryCard icon={Building2} label={isPlatformMode ? "Agences accessibles" : "Agence"} value={availableAgencies.length} detail={isPlatformMode ? "Périmètre plateforme" : user?.agenceName ?? "Agence courante"} /> : null}
        {isPlatformMode ? (
          <SummaryCard
            icon={ShieldCheck}
            label="Administrateurs plateforme"
            value={platformAdmins.data?.length ?? 0}
            detail={`${platformAdmins.data?.filter((item) => item.actif).length ?? 0} actifs`}
          />
        ) : null}
      </div>

      <Tabs defaultValue={defaultTab} className="grid gap-4">
        <TabsList className="w-fit">
          {canViewUsers ? <TabsTrigger value="users">Utilisateurs</TabsTrigger> : null}
          {canViewRoles ? <TabsTrigger value="roles">Rôles & permissions</TabsTrigger> : null}
          {canViewAudit ? <TabsTrigger value="audit">Audit</TabsTrigger> : null}
          {canAccessAgencySettings ? <TabsTrigger value="agencies">{isPlatformMode ? "Agences" : "Mon agence"}</TabsTrigger> : null}
          {isPlatformMode ? <TabsTrigger value="platform-admins">Administrateurs plateforme</TabsTrigger> : null}
        </TabsList>

        {canViewUsers ? <TabsContent value="users">
          <UsersPanel
            users={users.data ?? []}
            roles={roles.data ?? []}
            agencies={availableAgencies}
            canSelectAgency={isPlatformMode}
            currentAgencyId={user?.agenceId ?? undefined}
            currentAgencyName={user?.agenceName ?? undefined}
            canManage={canManageUsers}
            currentUserId={user?.id}
            onChanged={() => queryClient.invalidateQueries({ queryKey: ["admin", "users"] })}
          />
        </TabsContent> : null}

        {canViewRoles ? <TabsContent value="roles">
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
        </TabsContent> : null}

        {canViewAudit ? (
          <TabsContent value="audit">
            <AuditPanel />
          </TabsContent>
        ) : null}

        {canAccessAgencySettings ? (
          <TabsContent value="agencies">
            <AgenciesPanel
              agencies={agencies.data ?? []}
              canManage={canManageAgencies}
              canCreate={isPlatformMode && canManagePlatformAgencies}
              canEditPlatformFields={isPlatformMode && canManagePlatformAgencies}
              onChanged={() => queryClient.invalidateQueries({ queryKey: ["admin", "agencies"] })}
            />
          </TabsContent>
        ) : null}

        {isPlatformMode ? (
          <TabsContent value="platform-admins">
            <PlatformAdminsPanel
              users={platformAdmins.data ?? []}
              currentUserId={user?.id}
              onChanged={() => queryClient.invalidateQueries({ queryKey: ["admin", "platform-admins"] })}
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
  canSelectAgency,
  currentAgencyId,
  currentAgencyName,
  canManage,
  currentUserId,
  onChanged,
}: {
  users: AdminUser[];
  roles: AdminRole[];
  agencies: AdminAgency[];
  canSelectAgency: boolean;
  currentAgencyId?: string;
  currentAgencyName?: string;
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
    const defaultAgencyId = canSelectAgency
      ? agencies[0]?.id
      : currentAgencyId ?? agencies[0]?.id;
    const defaultRoleId = roles.find(
      (role) => String(role.agenceId) === String(defaultAgencyId),
    )?.id;
    setForm(editing ? userToForm(editing) : emptyUser(defaultAgencyId, defaultRoleId));
  }, [agencies, canSelectAgency, currentAgencyId, dialogOpen, editing, roles]);

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
            <DialogDescription>
              {canSelectAgency
                ? "Associez l'utilisateur à une agence et un rôle."
                : `Attribuez un rôle à cet utilisateur${currentAgencyName ? ` dans l’agence ${currentAgencyName}` : " dans l’agence courante"}.`}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <LabeledInput label="Prénom" value={form.prenom} onChange={(value) => setForm({ ...form, prenom: value })} />
            <LabeledInput label="Nom" value={form.nom} onChange={(value) => setForm({ ...form, nom: value })} />
            <LabeledInput label="Email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} />
            <LabeledInput label="Téléphone" value={form.telephone ?? ""} onChange={(value) => setForm({ ...form, telephone: value })} />
            <LabeledInput label={editing ? "Nouveau mot de passe" : "Mot de passe"} type="password" value={form.password ?? ""} onChange={(value) => setForm({ ...form, password: value })} />
            {canSelectAgency ? (
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
            ) : null}
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

function PlatformAdminsPanel({
  users,
  currentUserId,
  onChanged,
}: {
  users: AdminUser[];
  currentUserId?: string;
  onChanged: () => void;
}) {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState<AdminUser | null>(null);
  const [sessionsTarget, setSessionsTarget] = useState<AdminUser | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<AdminUser | null>(null);
  const [form, setForm] = useState<UpsertPlatformAdminRequest>(emptyPlatformAdmin());

  useEffect(() => {
    if (!dialogOpen) return;
    setForm(editing ? platformAdminToForm(editing) : emptyPlatformAdmin());
  }, [dialogOpen, editing]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((item) => !term || [
      item.fullName,
      item.email,
      item.telephone,
    ].some((value) => String(value ?? "").toLowerCase().includes(term)));
  }, [search, users]);

  const save = useMutation({
    mutationFn: () => editing
      ? adminApi.updatePlatformAdmin(editing.id, form)
      : adminApi.createPlatformAdmin(form),
    onSuccess: () => {
      setDialogOpen(false);
      setEditing(null);
      onChanged();
      toast.success("Administrateur plateforme enregistré");
    },
    onError: showError,
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => adminApi.deactivatePlatformAdmin(id),
    onSuccess: () => {
      setDeactivateTarget(null);
      onChanged();
      toast.success("Administrateur plateforme désactivé");
    },
    onError: showError,
  });

  const canSave = Boolean(
    form.prenom.trim()
    && form.nom.trim()
    && form.email.trim()
    && (editing || (form.password?.length ?? 0) >= 8),
  );

  return (
    <div className="grid gap-4 rounded-lg border bg-card p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative md:max-w-md md:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Filtrer les administrateurs plateforme"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="size-4" />
          Ajouter un administrateur
        </Button>
      </div>

      <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
        Ces comptes ont un accès global à la plateforme et ne sont rattachés à aucune agence.
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Administrateur</TableHead>
              <TableHead>Téléphone</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Dernière connexion</TableHead>
              <TableHead className="w-20 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length ? filtered.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <div className="flex items-center gap-2 font-medium">
                    {item.fullName}
                    {item.id === currentUserId ? <Badge variant="outline">Vous</Badge> : null}
                  </div>
                  <div className="text-xs text-muted-foreground">{item.email}</div>
                </TableCell>
                <TableCell>{item.telephone ?? "-"}</TableCell>
                <TableCell>
                  <Badge variant={item.actif ? "default" : "outline"}>{item.actif ? "Actif" : "Inactif"}</Badge>
                </TableCell>
                <TableCell>{formatDateTime(item.lastLogin)}</TableCell>
                <TableCell className="text-right">
                  <TableRowActions
                    label={`Actions ${item.fullName}`}
                    actions={[
                      {
                        label: "Modifier",
                        icon: Edit,
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
                        onSelect: () => setPasswordTarget(item),
                      },
                      {
                        label: "Désactiver",
                        icon: Trash2,
                        destructive: true,
                        disabled: item.id === currentUserId || !item.actif,
                        onSelect: () => setDeactivateTarget(item),
                      },
                    ]}
                  />
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={5} className="h-28 text-center text-muted-foreground">
                  Aucun administrateur plateforme trouvé
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier l’administrateur plateforme" : "Ajouter un administrateur plateforme"}</DialogTitle>
            <DialogDescription>
              Le compte recevra le rôle global Super administrateur sans rattachement à une agence.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <LabeledInput label="Prénom" value={form.prenom} onChange={(value) => setForm({ ...form, prenom: value })} />
            <LabeledInput label="Nom" value={form.nom} onChange={(value) => setForm({ ...form, nom: value })} />
            <LabeledInput label="Email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} />
            <LabeledInput label="Téléphone" value={form.telephone ?? ""} onChange={(value) => setForm({ ...form, telephone: value })} />
            {!editing ? (
              <LabeledInput label="Mot de passe" type="password" value={form.password ?? ""} onChange={(value) => setForm({ ...form, password: value })} />
            ) : null}
            <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <Checkbox
                checked={form.actif}
                disabled={editing?.id === currentUserId}
                onCheckedChange={(checked) => setForm({ ...form, actif: Boolean(checked) })}
              />
              Compte actif
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={() => save.mutate()} disabled={!canSave || save.isPending}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ResetPasswordDialog
        user={passwordTarget}
        scope="platform"
        onOpenChange={(open) => !open && setPasswordTarget(null)}
        onChanged={onChanged}
      />
      <UserSessionsDialog
        user={sessionsTarget}
        scope="platform"
        canRevoke
        onOpenChange={(open) => !open && setSessionsTarget(null)}
      />

      <AlertDialog open={Boolean(deactivateTarget)} onOpenChange={(open) => !open && setDeactivateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Désactiver cet administrateur plateforme ?</AlertDialogTitle>
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
  scope = "agency",
}: {
  user: AdminUser | null;
  canRevoke: boolean;
  onOpenChange: (open: boolean) => void;
  scope?: "agency" | "platform";
}) {
  const queryClient = useQueryClient();
  const [revokeTarget, setRevokeTarget] = useState<AdminUserSession | "ALL" | null>(null);
  const queryKey = ["admin", scope === "platform" ? "platform-admins" : "users", user?.id, "sessions"] as const;
  const sessions = useQuery({
    queryKey,
    queryFn: () => scope === "platform"
      ? adminApi.platformAdminSessions(user!.id)
      : adminApi.userSessions(user!.id),
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
        if (scope === "platform") await adminApi.revokeAllPlatformAdminSessions(user.id);
        else await adminApi.revokeAllUserSessions(user.id);
      } else {
        if (scope === "platform") await adminApi.revokePlatformAdminSession(user.id, revokeTarget.id);
        else await adminApi.revokeUserSession(user.id, revokeTarget.id);
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

function AuditPanel() {
  const [draftFilters, setDraftFilters] = useState<AuditFilters>(EMPTY_AUDIT_FILTERS);
  const [filters, setFilters] = useState<AuditFilters>(EMPTY_AUDIT_FILTERS);
  const [page, setPage] = useState(0);
  const [selectedEvent, setSelectedEvent] = useState<AdminAuditEvent | null>(null);
  const events = useQuery({
    queryKey: ["admin", "audit", filters, page],
    queryFn: () => adminApi.auditEvents({
      search: filters.search.trim() || undefined,
      action: filters.action === AUDIT_ALL ? undefined : filters.action,
      entityType: filters.entityType === AUDIT_ALL ? undefined : filters.entityType,
      dateFrom: filters.dateFrom ? `${filters.dateFrom}T00:00:00` : undefined,
      dateTo: filters.dateTo ? `${filters.dateTo}T23:59:59` : undefined,
      page,
      size: 25,
    }),
    placeholderData: (previous) => previous,
  });

  const applyFilters = () => {
    if (draftFilters.dateFrom && draftFilters.dateTo && draftFilters.dateFrom > draftFilters.dateTo) {
      toast.error("La date de début doit précéder la date de fin");
      return;
    }
    setPage(0);
    setFilters({ ...draftFilters, search: draftFilters.search.trim() });
  };

  const resetFilters = () => {
    setDraftFilters(EMPTY_AUDIT_FILTERS);
    setFilters(EMPTY_AUDIT_FILTERS);
    setPage(0);
  };

  return (
    <div className="grid gap-4 rounded-lg border bg-card p-4">
      <form
        className="grid items-end gap-3 md:grid-cols-2 xl:grid-cols-[minmax(240px,1.4fr)_180px_220px_160px_160px_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          applyFilters();
        }}
      >
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Recherche</span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Utilisateur, référence ou identifiant"
              value={draftFilters.search}
              onChange={(event) => setDraftFilters((current) => ({ ...current, search: event.target.value }))}
            />
          </div>
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Action</span>
          <Select value={draftFilters.action} onValueChange={(action) => setDraftFilters((current) => ({ ...current, action: action as AuditFilters["action"] }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={AUDIT_ALL}>Toutes</SelectItem>
              <SelectItem value="CREATED">Création</SelectItem>
              <SelectItem value="UPDATED">Modification</SelectItem>
              <SelectItem value="DELETED">Suppression</SelectItem>
            </SelectContent>
          </Select>
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Type d’objet</span>
          <Select value={draftFilters.entityType} onValueChange={(entityType) => setDraftFilters((current) => ({ ...current, entityType }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={AUDIT_ALL}>Tous les objets</SelectItem>
              {AUDIT_ENTITY_TYPES.map((entityType) => (
                <SelectItem key={entityType} value={entityType}>{auditEntityTypeLabel(entityType)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Du</span>
          <DatePicker
            date={draftFilters.dateFrom}
            maxDate={draftFilters.dateTo ? new Date(`${draftFilters.dateTo}T00:00:00`) : undefined}
            onSelect={(date) => setDraftFilters((current) => ({ ...current, dateFrom: toDateOnly(date) ?? "" }))}
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Au</span>
          <DatePicker
            date={draftFilters.dateTo}
            minDate={draftFilters.dateFrom ? new Date(`${draftFilters.dateFrom}T00:00:00`) : undefined}
            onSelect={(date) => setDraftFilters((current) => ({ ...current, dateTo: toDateOnly(date) ?? "" }))}
          />
        </label>
        <div className="flex gap-2">
          <Button type="submit">Rechercher</Button>
          <Button type="button" variant="outline" size="icon" title="Réinitialiser" aria-label="Réinitialiser les filtres" onClick={resetFilters}>
            <X className="size-4" />
          </Button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Utilisateur</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Objet</TableHead>
              <TableHead>Résumé</TableHead>
              <TableHead className="w-16 text-right">Détails</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(events.data?.items ?? []).map((event: AdminAuditEvent) => (
              <TableRow key={event.id}>
                <TableCell className="whitespace-nowrap">{formatDateTime(event.occurredAt)}</TableCell>
                <TableCell>
                  <div className="font-medium">{event.actorName || auditActorLabel(event.actorType)}</div>
                  {event.actorEmail && event.actorEmail !== event.actorName ? (
                    <div className="text-xs text-muted-foreground">{event.actorEmail}</div>
                  ) : null}
                </TableCell>
                <TableCell><Badge variant={auditActionVariant(event.action)}>{auditActionLabel(event.action)}</Badge></TableCell>
                <TableCell>
                  <div className="font-medium">{auditEntityTypeLabel(event.entityType)}</div>
                  <div className="text-xs text-muted-foreground">{auditEntityReference(event)}</div>
                </TableCell>
                <TableCell className="max-w-md">{auditEventSummary(event)}</TableCell>
                <TableCell className="text-right">
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={`Voir le détail de l'événement ${event.id}`} onClick={() => setSelectedEvent(event)}>
                    <Eye className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!events.isLoading && !(events.data?.items.length ?? 0) ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Aucun événement d’audit trouvé.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
      <ServerPagination
        page={events.data?.page.number ?? page}
        totalPages={events.data?.page.totalPages ?? 1}
        totalElements={events.data?.page.totalElements}
        loading={events.isFetching}
        onPageChange={setPage}
      />

      <AuditEventDialog event={selectedEvent} onOpenChange={(open) => { if (!open) setSelectedEvent(null); }} />
    </div>
  );
}

const AUDIT_ALL = "__all__";

type AuditFilters = {
  search: string;
  action: typeof AUDIT_ALL | AdminAuditEvent["action"];
  entityType: string;
  dateFrom: string;
  dateTo: string;
};

const EMPTY_AUDIT_FILTERS: AuditFilters = {
  search: "",
  action: AUDIT_ALL,
  entityType: AUDIT_ALL,
  dateFrom: "",
  dateTo: "",
};

const AUDIT_ENTITY_TYPES = [
  "Contrat",
  "Sinistre",
  "DocumentClient",
  "ReglementClient",
  "BordereauCompagnie",
  "ReglementCompagnie",
  "CompteTresorerie",
  "MouvementTresorerie",
  "OperationTresorerie",
  "BordereauRemise",
  "RapprochementBancaire",
  "ImportReleveBancaire",
  "LigneReleveBancaire",
  "ProfilImportReleveBancaire",
  "SessionCaisse",
  "AffectationCompteTresorerie",
  "ConditionPaiementClient",
  "AjustementTarifUsage",
] as const;

function auditActionLabel(action: AdminAuditEvent["action"]) {
  return ({ CREATED: "Création", UPDATED: "Modification", DELETED: "Suppression" })[action] ?? action;
}

function auditActionVariant(action: AdminAuditEvent["action"]): "success" | "info" | "red" {
  if (action === "CREATED") return "success";
  if (action === "DELETED") return "red";
  return "info";
}

function AuditEventDialog({ event, onOpenChange }: { event: AdminAuditEvent | null; onOpenChange: (open: boolean) => void }) {
  const fields = event ? auditChangedFields(event) : [];
  const entityUrl = event ? auditEntityUrl(event) : null;
  return (
    <Dialog open={Boolean(event)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-4xl">
        {event ? (
          <>
            <DialogHeader>
              <DialogTitle>{auditActionLabel(event.action)} · {auditEntityTypeLabel(event.entityType)} {auditEntityReference(event)}</DialogTitle>
              <DialogDescription>
                {formatDateTime(event.occurredAt)} par {event.actorName || auditActorLabel(event.actorType)}
                {event.actorEmail && event.actorEmail !== event.actorName ? ` · ${event.actorEmail}` : ""}
                {event.actorUserId ? ` · ID ${event.actorUserId}` : ""}
              </DialogDescription>
            </DialogHeader>
            <div className="grid max-h-[65vh] gap-4 overflow-y-auto pr-1">
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead>Champ</TableHead>
                      <TableHead>Avant</TableHead>
                      <TableHead>Après</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fields.map((field) => (
                      <TableRow key={field}>
                        <TableCell className="font-medium">{auditFieldLabel(field)}</TableCell>
                        <TableCell className="max-w-72 break-words text-muted-foreground">{formatAuditValue(event.beforeData?.[field])}</TableCell>
                        <TableCell className="max-w-72 break-words">{formatAuditValue(event.afterData?.[field])}</TableCell>
                      </TableRow>
                    ))}
                    {!fields.length ? (
                      <TableRow><TableCell colSpan={3} className="py-8 text-center text-muted-foreground">Aucune différence enregistrée.</TableCell></TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
              <dl className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                <div><dt className="font-medium text-foreground">Source</dt><dd>{auditSourceLabel(event.source)}</dd></div>
                <div><dt className="font-medium text-foreground">Requête</dt><dd className="break-all font-mono">{event.requestId || "-"}</dd></div>
              </dl>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
              {entityUrl ? (
                <Button asChild>
                  <Link to={entityUrl} onClick={() => onOpenChange(false)}>
                    <ExternalLink className="size-4" />
                    Ouvrir l’objet
                  </Link>
                </Button>
              ) : null}
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function auditChangedFields(event: AdminAuditEvent) {
  return Array.from(new Set([
    ...Object.keys(event.beforeData ?? {}),
    ...Object.keys(event.afterData ?? {}),
  ])).sort((left, right) => auditFieldLabel(left).localeCompare(auditFieldLabel(right), "fr"));
}

function auditEventSummary(event: AdminAuditEvent) {
  const fields = auditChangedFields(event);
  if (event.action === "CREATED") return `${fields.length} champ(s) enregistré(s)`;
  if (event.action === "DELETED") return "Enregistrement supprimé";
  if (!fields.length) return "Modification enregistrée";
  const labels = fields.slice(0, 2).map(auditFieldLabel);
  return fields.length > 2 ? `${labels.join(", ")} +${fields.length - 2}` : labels.join(", ");
}

function auditEntityReference(event: AdminAuditEvent) {
  const snapshot = { ...(event.beforeData ?? {}), ...(event.afterData ?? {}) };
  const candidates = [
    "numeroSinistre",
    "numeroDossier",
    "numeroPolice",
    "numeroDocument",
    "numeroBordereau",
    "reference",
    "code",
    "libelle",
    "nom",
  ];
  for (const key of candidates) {
    const value = snapshot[key];
    if (typeof value === "string" && value.trim()) return `n° ${value.trim()}`;
  }
  return event.entityId ? `#${event.entityId}` : "";
}

function auditEntityTypeLabel(entityType: string) {
  return ({
    Contrat: "Contrat",
    Sinistre: "Sinistre",
    DocumentClient: "Document client",
    ReglementClient: "Règlement client",
    BordereauCompagnie: "Bordereau compagnie",
    ReglementCompagnie: "Règlement compagnie",
    CompteTresorerie: "Compte de trésorerie",
    MouvementTresorerie: "Mouvement de trésorerie",
    OperationTresorerie: "Opération de trésorerie",
    BordereauRemise: "Bordereau de remise",
    RapprochementBancaire: "Rapprochement bancaire",
    ImportReleveBancaire: "Import de relevé bancaire",
    LigneReleveBancaire: "Ligne de relevé bancaire",
    ProfilImportReleveBancaire: "Profil d’import bancaire",
    SessionCaisse: "Session de caisse",
    AffectationCompteTresorerie: "Affectation de compte",
    ConditionPaiementClient: "Condition de paiement",
    AjustementTarifUsage: "Ajustement tarifaire",
  } as Record<string, string>)[entityType] ?? splitAuditIdentifier(entityType);
}

function auditFieldLabel(field: string) {
  return ({
    actif: "Actif",
    agence: "Agence",
    client: "Client",
    statut: "Statut",
    dateEffet: "Date d’effet",
    dateEcheance: "Date d’échéance",
    dateSinistre: "Date du sinistre",
    dateDeclaration: "Date de déclaration",
    numeroDossier: "N° dossier",
    numeroPolice: "N° police",
    numeroSinistre: "N° sinistre",
    montant: "Montant",
    montantTtc: "Montant TTC",
    primeTtc: "Prime TTC",
    notes: "Notes",
    commentaire: "Commentaire",
    circonstances: "Circonstances",
  } as Record<string, string>)[field] ?? splitAuditIdentifier(field);
}

function splitAuditIdentifier(value: string) {
  const words = value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1).toLowerCase() : value;
}

function formatAuditValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return "-";
  if (typeof value === "boolean") return value ? "Oui" : "Non";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split("-");
      return `${day}/${month}/${year}`;
    }
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return formatDateTime(value);
    return value;
  }
  if (Array.isArray(value)) return value.map(formatAuditValue).join(", ") || "-";
  if (typeof value === "object") {
    const reference = value as { type?: unknown; id?: unknown };
    if (typeof reference.type === "string" && reference.id != null) {
      return `${auditEntityTypeLabel(reference.type)} #${String(reference.id)}`;
    }
    return JSON.stringify(value);
  }
  return String(value);
}

function auditEntityUrl(event: AdminAuditEvent) {
  if (!event.entityId || event.action === "DELETED") return null;
  return ({
    Contrat: `/app/production/contrats/${event.entityId}`,
    Sinistre: `/app/sinistre/dossiers/${event.entityId}`,
    BordereauCompagnie: `/app/compta/bordereaux-compagnies/${event.entityId}`,
    CompteTresorerie: `/app/compta/tresorerie/comptes/${event.entityId}`,
  } as Record<string, string>)[event.entityType] ?? null;
}

function auditActorLabel(actorType: AdminAuditEvent["actorType"]) {
  return ({ USER: "Utilisateur", SYSTEM: "Système", IMPORT: "Import" })[actorType];
}

function auditSourceLabel(source?: string | null) {
  return ({ API: "Application", IMPORT: "Import", SYSTEM: "Système" } as Record<string, string>)[source ?? ""] ?? source ?? "-";
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
  const [permissionModule, setPermissionModule] = useState("");
  const [form, setForm] = useState<UpsertAdminRoleRequest>(emptyRole(agencies[0]?.id));
  const groupedPermissions = useMemo(() => groupPermissions(permissions), [permissions]);

  useEffect(() => {
    if (!dialogOpen) return;
    const next = editing ? roleToForm(editing) : emptyRole(agencies[0]?.id);
    setForm({
      ...next,
      permissionIds: includePermissionDependencies(next.permissionIds, permissions),
    });
    setPermissionModule(groupedPermissions[0]?.[0] ?? "");
  }, [agencies, dialogOpen, editing, groupedPermissions, permissions]);

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
        <DialogContent className="max-h-[92vh] overflow-hidden sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier rôle" : "Ajouter rôle"}</DialogTitle>
            <DialogDescription>Les permissions déterminent les modules visibles et les actions autorisées.</DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[72vh] gap-5 overflow-y-auto pr-1">
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

            <Tabs
              orientation="vertical"
              value={permissionModule}
              onValueChange={setPermissionModule}
              className="grid min-w-0 items-start gap-3 md:grid-cols-[190px_minmax(0,1fr)]"
            >
              <TabsList className="h-auto w-full items-stretch justify-start">
                {groupedPermissions.map(([module, resources]) => {
                  const modulePermissions = resources.flatMap(([, items]) => items);
                  const selectedCount = modulePermissions.filter((permission) => form.permissionIds.includes(permission.id)).length;
                  return (
                    <TabsTrigger key={module} value={module} className="h-9 w-full justify-between gap-2 px-3">
                      <span className="truncate">{moduleLabel(module)}</span>
                      <span className="text-xs tabular-nums text-muted-foreground">{selectedCount}/{modulePermissions.length}</span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {groupedPermissions.map(([module, resources]) => {
                const modulePermissions = resources.flatMap(([, items]) => items);
                const selectedCount = modulePermissions.filter((permission) => form.permissionIds.includes(permission.id)).length;
                const allSelected = selectedCount === modulePermissions.length && modulePermissions.length > 0;
                return (
                  <TabsContent key={module} value={module} className="grid gap-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-sm font-semibold">{moduleLabel(module)}</h3>
                        <p className="text-xs text-muted-foreground">{selectedCount} autorisation(s) sélectionnée(s)</p>
                      </div>
                      <label className="flex items-center gap-2 text-sm font-medium">
                        <Checkbox
                          checked={allSelected ? true : selectedCount > 0 ? "indeterminate" : false}
                          onCheckedChange={(checked) => setForm((current) => ({
                            ...current,
                            permissionIds: checked === true
                              ? includePermissionDependencies(
                                  [...current.permissionIds, ...modulePermissions.map((permission) => permission.id)],
                                  permissions,
                                )
                              : removePermissionSelection(
                                  current.permissionIds,
                                  modulePermissions.map((permission) => permission.id),
                                  permissions,
                                ),
                          }))}
                        />
                        Tout autoriser
                      </label>
                    </div>

                    <div className="divide-y rounded-md border">
                      {resources.map(([resource, items]) => (
                        <section key={resource} className="grid gap-2 p-3">
                          <div className="text-xs font-semibold uppercase text-muted-foreground">{resourceLabel(resource)}</div>
                          <div className="grid gap-x-5 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
                            {items.map((permission) => (
                              <label key={permission.id} className="flex min-h-8 items-start gap-2 text-sm">
                                <Checkbox
                                  className="mt-0.5"
                                  checked={form.permissionIds.includes(permission.id)}
                                  onCheckedChange={(checked) => setForm((current) => ({
                                    ...current,
                                    permissionIds: updatePermissionSelection(
                                      current.permissionIds,
                                      permission,
                                      checked === true,
                                      permissions,
                                    ),
                                  }))}
                                />
                                <span className="font-medium leading-5">{permission.nom}</span>
                              </label>
                            ))}
                          </div>
                        </section>
                      ))}
                    </div>
                  </TabsContent>
                );
              })}
            </Tabs>
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

function AgenciesPanel({
  agencies,
  canManage,
  canCreate,
  canEditPlatformFields,
  onChanged,
}: {
  agencies: AdminAgency[];
  canManage: boolean;
  canCreate: boolean;
  canEditPlatformFields: boolean;
  onChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<AdminAgency | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<UpsertAdminAgencyRequest>(emptyAgency());
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [removeSignature, setRemoveSignature] = useState(false);

  useEffect(() => {
    if (!dialogOpen) return;
    setForm(editing ? agencyToForm(editing) : emptyAgency());
    setLogoFile(null);
    setRemoveLogo(false);
    setSignatureFile(null);
    setRemoveSignature(false);
  }, [dialogOpen, editing]);

  const save = useMutation({
    mutationFn: async () => {
      let agence = editing
        ? await adminApi.updateAgency(editing.id, form)
        : await adminApi.createAgency(form);
      try {
        if (logoFile) {
          agence = await adminApi.uploadAgencyLogo(agence.id, logoFile);
          setLogoFile(null);
        } else if (editing && removeLogo && editing.logoDisponible) {
          agence = await adminApi.deleteAgencyLogo(agence.id);
          setRemoveLogo(false);
        }
        if (signatureFile) {
          agence = await adminApi.uploadAgencySignature(agence.id, signatureFile);
          setSignatureFile(null);
        } else if (editing && removeSignature && editing.signatureDisponible) {
          agence = await adminApi.deleteAgencySignature(agence.id);
          setRemoveSignature(false);
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
      {canCreate ? <div className="flex justify-end">
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="size-4" />
          Ajouter agence
        </Button>
      </div> : null}
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier agence" : "Ajouter agence"}</DialogTitle>
            <DialogDescription>Les agences portent les utilisateurs, rôles agence et données de production.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-[220px_minmax(0,1fr)]">
            <div className="grid content-start gap-4">
              <AgencyImageUploadField
                label="Logo de l’agence"
                emptyTitle="Déposer le logo ici"
                previewAlt="Aperçu du logo"
                removeLabel="Supprimer le logo"
                available={Boolean(editing?.logoDisponible)}
                file={logoFile}
                removed={removeLogo}
                queryKey={["admin", "agencies", editing?.id, "logo"]}
                loadStoredImage={() => adminApi.agencyLogo(editing?.id as string)}
                onFile={(file) => {
                  setLogoFile(file);
                  setRemoveLogo(false);
                }}
                onRemove={() => {
                  setLogoFile(null);
                  setRemoveLogo(true);
                }}
              />
              <AgencyImageUploadField
                label="Signature et cachet"
                emptyTitle="Déposer la signature ici"
                previewAlt="Aperçu de la signature"
                removeLabel="Supprimer la signature"
                available={Boolean(editing?.signatureDisponible)}
                file={signatureFile}
                removed={removeSignature}
                queryKey={["admin", "agencies", editing?.id, "signature"]}
                loadStoredImage={() => adminApi.agencySignature(editing?.id as string)}
                onFile={(file) => {
                  setSignatureFile(file);
                  setRemoveSignature(false);
                }}
                onRemove={() => {
                  setSignatureFile(null);
                  setRemoveSignature(true);
                }}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
            <LabeledInput label="Code" value={form.code} disabled={Boolean(editing) && !canEditPlatformFields} onChange={(value) => setForm({ ...form, code: value })} />
            <LabeledInput label="Nom" value={form.nom} onChange={(value) => setForm({ ...form, nom: value })} />
            <LabeledInput label="Ville" value={form.ville ?? ""} onChange={(value) => setForm({ ...form, ville: value })} />
            <LabeledInput label="Téléphone" value={form.telephone ?? ""} onChange={(value) => setForm({ ...form, telephone: value })} />
            <LabeledInput label="Fax" value={form.fax ?? ""} onChange={(value) => setForm({ ...form, fax: value })} />
            <LabeledInput label="Email" value={form.email ?? ""} onChange={(value) => setForm({ ...form, email: value })} />
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Statut</span>
              <Select disabled={Boolean(editing) && !canEditPlatformFields} value={form.statut} onValueChange={(value) => setForm({ ...form, statut: value as AdminAgency["statut"] })}>
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
            <div className="sm:col-span-2 border-t pt-3">
              <h3 className="font-medium">Informations légales et bancaires</h3>
              <p className="text-xs text-muted-foreground">Ces informations apparaissent sur les relevés et documents de l’agence.</p>
            </div>
            <LabeledInput label="Identifiant fiscal" value={form.identifiantFiscal ?? ""} onChange={(value) => setForm({ ...form, identifiantFiscal: value })} />
            <LabeledInput label="Patente" value={form.patente ?? ""} onChange={(value) => setForm({ ...form, patente: value })} />
            <LabeledInput label="ICE" value={form.ice ?? ""} onChange={(value) => setForm({ ...form, ice: value })} />
            <LabeledInput label="N° d’agrément" value={form.numeroAgrement ?? ""} onChange={(value) => setForm({ ...form, numeroAgrement: value })} />
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Date d’agrément</span>
              <DatePicker
                date={form.dateAgrement}
                onSelect={(date) => setForm({ ...form, dateAgrement: toDateOnly(date) ?? "" })}
              />
            </label>
            <LabeledInput label="Banque" value={form.banque ?? ""} onChange={(value) => setForm({ ...form, banque: value })} />
            <label className="grid gap-1.5 text-sm sm:col-span-2">
              <span className="font-medium">RIB / N° de compte bancaire</span>
              <Input value={form.rib ?? ""} onChange={(event) => setForm({ ...form, rib: event.target.value })} />
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

function ResetPasswordDialog({
  user,
  onOpenChange,
  onChanged,
  scope = "agency",
}: {
  user: AdminUser | null;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
  scope?: "agency" | "platform";
}) {
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (user) setPassword("");
  }, [user]);

  const reset = useMutation({
    mutationFn: () => user
      ? (scope === "platform"
        ? adminApi.resetPlatformAdminPassword(user.id, password)
        : adminApi.resetUserPassword(user.id, password))
      : Promise.resolve(),
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

function LabeledInput({
  label,
  value,
  onChange,
  type = "text",
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      <Input type={type} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
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

function emptyPlatformAdmin(): UpsertPlatformAdminRequest {
  return { email: "", password: "", prenom: "", nom: "", telephone: "", actif: true };
}

function platformAdminToForm(user: AdminUser): UpsertPlatformAdminRequest {
  return {
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
  return { code: "", nom: "", adresse: "", ville: "", telephone: "", fax: "", email: "", identifiantFiscal: "", patente: "", ice: "", numeroAgrement: "", dateAgrement: "", banque: "", rib: "", statut: "ACTIVE" };
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
    identifiantFiscal: agence.identifiantFiscal ?? "",
    patente: agence.patente ?? "",
    ice: agence.ice ?? "",
    numeroAgrement: agence.numeroAgrement ?? "",
    dateAgrement: agence.dateAgrement ?? "",
    banque: agence.banque ?? "",
    rib: agence.rib ?? "",
    statut: agence.statut,
  };
}

function groupPermissions(permissions: AdminPermission[]) {
  const groups = new Map<string, Map<string, AdminPermission[]>>();
  permissions.forEach((permission) => {
    const module = permission.module || "Autres";
    const resource = permission.code.split(":", 1)[0] || "autres";
    const resources = groups.get(module) ?? new Map<string, AdminPermission[]>();
    resources.set(resource, [...(resources.get(resource) ?? []), permission]);
    groups.set(module, resources);
  });
  return Array.from(groups.entries())
    .sort(([left], [right]) => moduleOrder(left) - moduleOrder(right))
    .map(([module, resources]) => [
      module,
      Array.from(resources.entries())
        .sort(([left], [right]) => resourceLabel(left).localeCompare(resourceLabel(right)))
        .map(([resource, items]) => [
          resource,
          [...items].sort((left, right) => permissionActionOrder(left.code) - permissionActionOrder(right.code)),
        ] as const),
    ] as const);
}

function includePermissionDependencies(permissionIds: string[], permissions: AdminPermission[]) {
  const selected = new Set(permissionIds);
  const byCode = new Map(permissions.map((permission) => [permission.code, permission]));
  let changed = true;
  while (changed) {
    changed = false;
    for (const permission of permissions) {
      if (!selected.has(permission.id)) continue;
      for (const requiredCode of permission.requiredPermissionCodes ?? []) {
        const required = byCode.get(requiredCode);
        if (required && !selected.has(required.id)) {
          selected.add(required.id);
          changed = true;
        }
      }
    }
  }
  return Array.from(selected);
}

function updatePermissionSelection(
  permissionIds: string[],
  permission: AdminPermission,
  checked: boolean,
  permissions: AdminPermission[],
) {
  const selected = new Set(permissionIds);
  if (checked) {
    selected.add(permission.id);
    return includePermissionDependencies(Array.from(selected), permissions);
  }

  return removePermissionSelection(Array.from(selected), [permission.id], permissions);
}

function removePermissionSelection(
  permissionIds: string[],
  removedPermissionIds: string[],
  permissions: AdminPermission[],
) {
  const selected = new Set(permissionIds);
  removedPermissionIds.forEach((id) => selected.delete(id));
  let changed = true;
  while (changed) {
    changed = false;
    for (const candidate of permissions) {
      if (!selected.has(candidate.id)) continue;
      const requirementsSatisfied = (candidate.requiredPermissionCodes ?? []).every((requiredCode) => {
        const required = permissions.find((item) => item.code === requiredCode);
        return !required || selected.has(required.id);
      });
      if (!requirementsSatisfied) {
        selected.delete(candidate.id);
        changed = true;
      }
    }
  }
  return Array.from(selected);
}

function permissionActionOrder(code: string) {
  const action = code.split(":")[1] ?? "";
  const order = ["view", "create", "update", "manage", "draft", "rectify", "renew", "validate", "transmit", "reconcile", "cancel", "delete"];
  const index = order.indexOf(action);
  return index === -1 ? order.length : index;
}

function moduleOrder(module: string) {
  const order = ["production", "companies", "crm", "sinistre", "compta", "administration", "shared"];
  const index = order.indexOf(module);
  return index === -1 ? order.length : index;
}

function moduleLabel(module: string) {
  return ({
    production: "Production",
    companies: "Compagnies",
    crm: "CRM",
    sinistre: "Sinistres",
    compta: "Comptabilité",
    administration: "Administration",
    shared: "Référentiels partagés",
  } as Record<string, string>)[module] ?? module;
}

function resourceLabel(resource: string) {
  return ({
    contrat: "Contrats",
    avenant: "Avenants",
    client: "Clients",
    vehicule: "Véhicules",
    garantie: "Garanties",
    "grille-tarifaire": "Grilles tarifaires",
    quittance: "Quittances",
    "reglement-client": "Règlements clients",
    tresorerie: "Trésorerie",
    "bordereau-compagnie": "Bordereaux compagnies",
    "reglement-compagnie": "Règlements compagnies",
    "regle-fiscale": "Règles fiscales",
    assistance: "Assistance",
    "carte-verte": "Cartes vertes",
    "piece-jointe": "Pièces jointes",
    "attestation-stock": "Stock d’attestations",
    agence: "Agence",
    user: "Utilisateurs",
    role: "Rôles",
    audit: "Audit",
    config: "Configuration",
    referentiel: "Référentiels partagés",
    "contact-compagnie": "Contacts compagnie",
    sinistre: "Dossiers sinistre",
  } as Record<string, string>)[resource] ?? resource;
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function showError(error: unknown) {
  toast.error(error instanceof Error ? error.message : "Opération impossible");
}
