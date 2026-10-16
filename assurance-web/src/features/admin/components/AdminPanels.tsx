import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  ChevronDown,
  ClipboardCopy,
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
  Smartphone,
  Tablet,
  Trash2,
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
import { ServerPagination, TableRowsSkeleton } from "@/components/shared";
import { TableRowActions } from "@/components/shared/table-row-actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toDateOnly } from "@/features/production/date";
import { adminApi } from "../api";
import { AgencyImageUploadField } from "./AgencyImageUploadField";
import type {
  AdminAgency,
  AdminAuditEvent,
  AdminAuditOperation,
  AdminPermission,
  AdminRole,
  AdminUser,
  AdminUserSession,
  UpsertAdminAgencyRequest,
  UpsertAdminRoleRequest,
  UpsertAdminUserRequest,
  UpsertPlatformAdminRequest,
} from "../types";

const ADMIN_TABLE_HEADER_CLASS = "bg-fuchsia-700 text-white [&_th]:text-white [&_tr:hover]:bg-fuchsia-700";

export function UsersPanel({
  users,
  loading,
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
  loading: boolean;
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
          <TableHeader className={ADMIN_TABLE_HEADER_CLASS}>
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
            {loading ? (
              <TableRowsSkeleton rows={6} colSpan={7} />
            ) : filtered.length ? filtered.map((item) => (
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
            )) : (
              <TableRow>
                <TableCell colSpan={7} className="h-28 text-center text-muted-foreground">
                  Aucun utilisateur trouvé
                </TableCell>
              </TableRow>
            )}
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

export function PlatformAdminsPanel({
  users,
  loading,
  currentUserId,
  onChanged,
}: {
  users: AdminUser[];
  loading: boolean;
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
          <TableHeader className={ADMIN_TABLE_HEADER_CLASS}>
            <TableRow>
              <TableHead>Administrateur</TableHead>
              <TableHead>Téléphone</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Dernière connexion</TableHead>
              <TableHead className="w-20 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRowsSkeleton rows={6} colSpan={5} />
            ) : filtered.length ? filtered.map((item) => (
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

export function AuditPanel() {
  const [draftFilters, setDraftFilters] = useState<AuditFilters>(EMPTY_AUDIT_FILTERS);
  const [filters, setFilters] = useState<AuditFilters>(EMPTY_AUDIT_FILTERS);
  const [page, setPage] = useState(0);
  const [selectedOperation, setSelectedOperation] = useState<AuditOperation | null>(null);
  const operationsQuery = useQuery({
    queryKey: ["admin", "audit", filters, page],
    queryFn: () => adminApi.auditOperations({
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
  const operations = useMemo(
    () => (operationsQuery.data?.items ?? []).map(toAuditOperation),
    [operationsQuery.data?.items],
  );

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
              {AUDIT_ENTITY_GROUPS.map((group) => (
                <SelectGroup key={group.label}>
                  <SelectLabel>{group.label}</SelectLabel>
                  {group.types.map((entityType) => (
                    <SelectItem key={entityType} value={entityType}>{auditEntityTypeLabel(entityType)}</SelectItem>
                  ))}
                </SelectGroup>
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
          <TableHeader className={ADMIN_TABLE_HEADER_CLASS}>
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
            {operationsQuery.isLoading ? (
              <TableRowsSkeleton rows={8} colSpan={6} />
            ) : operations.map((operation) => (
              <TableRow key={operation.key}>
                <TableCell className="whitespace-nowrap">{formatAuditDateTime(operation.occurredAt)}</TableCell>
                <TableCell>
                  <div className="font-medium">{operation.actorName || auditActorLabel(operation.actorType)}</div>
                  {operation.actorEmail && operation.actorEmail !== operation.actorName ? (
                    <div className="text-xs text-muted-foreground">{operation.actorEmail}</div>
                  ) : null}
                </TableCell>
                <TableCell><Badge variant={auditActionVariant(operation.action)}>{auditActionLabel(operation.action)}</Badge></TableCell>
                <TableCell>
                  <div className="font-medium">{auditOperationEntityLabel(operation)}</div>
                  <div className="text-xs text-muted-foreground">{auditOperationReference(operation)}</div>
                </TableCell>
                <TableCell className="max-w-md">{auditOperationSummary(operation)}</TableCell>
                <TableCell className="text-right">
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={`Voir le détail de l'opération ${operation.key}`} onClick={() => setSelectedOperation(operation)}>
                    <Eye className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!operationsQuery.isLoading && !(operationsQuery.data?.items.length ?? 0) ? (
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
        page={operationsQuery.data?.page.number ?? page}
        totalPages={operationsQuery.data?.page.totalPages ?? 1}
        totalElements={operationsQuery.data?.page.totalElements}
        loading={operationsQuery.isFetching}
        onPageChange={setPage}
      />

      <AuditOperationDialog operation={selectedOperation} onOpenChange={(open) => { if (!open) setSelectedOperation(null); }} />
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

type AuditOperation = {
  key: string;
  requestId?: string | null;
  occurredAt: string;
  actorName?: string | null;
  actorEmail?: string | null;
  actorType: AdminAuditEvent["actorType"];
  action: AdminAuditEvent["action"];
  primary: AdminAuditEvent;
  events: AdminAuditEvent[];
};

type AuditBusinessItem = {
  key: string;
  event: AdminAuditEvent;
  rawEvents: AdminAuditEvent[];
};

type AuditTimelineEntry =
  | { kind: "item"; key: string; item: AuditBusinessItem }
  | { kind: "document-lines"; key: string; items: AuditBusinessItem[] };

const EMPTY_AUDIT_FILTERS: AuditFilters = {
  search: "",
  action: AUDIT_ALL,
  entityType: AUDIT_ALL,
  dateFrom: "",
  dateTo: "",
};

const AUDIT_OPERATION_ROOT_TYPES = [
  "Contrat",
  "AvenantDraft",
  "MouvementContrat",
  "Sinistre",
  "ReglementClient",
  "DocumentClient",
  "BordereauRemise",
  "BordereauCompagnie",
  "ReglementCompagnie",
  "CompteTresorerie",
  "Utilisateur",
  "Agence",
] as const;

function toAuditOperation(group: AdminAuditOperation): AuditOperation {
  const primary = [...group.events].sort((left, right) => {
    const score = auditOperationPrimaryScore(left, group.events) - auditOperationPrimaryScore(right, group.events);
    return score || Date.parse(right.occurredAt) - Date.parse(left.occurredAt);
  })[0];
  const latest = [...group.events].sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt))[0];
  return {
    key: group.key,
    requestId: latest.requestId,
    occurredAt: latest.occurredAt,
    actorName: latest.actorName,
    actorEmail: latest.actorEmail,
    actorType: latest.actorType,
    action: primary.action,
    primary,
    events: group.events,
  };
}

function auditOperationPrimaryScore(event: AdminAuditEvent, operationEvents: AdminAuditEvent[]) {
  const isContractCreation = operationEvents.some((item) => item.entityType === "Contrat" && item.action === "CREATED");
  if (!isContractCreation && event.entityType === "MouvementContrat") {
    return event.action === "CREATED" ? -30 : event.action === "UPDATED" ? -29 : -28;
  }
  if (!isContractCreation && event.entityType === "AvenantDraft") {
    return event.action === "CREATED" ? -20 : event.action === "UPDATED" ? -19 : -18;
  }
  const rootIndex = AUDIT_OPERATION_ROOT_TYPES.indexOf(event.entityType as (typeof AUDIT_OPERATION_ROOT_TYPES)[number]);
  const entityScore = rootIndex >= 0 ? rootIndex : AUDIT_OPERATION_ROOT_TYPES.length + 10;
  const actionScore = event.action === "CREATED" ? 0 : event.action === "DELETED" ? 1 : 2;
  return entityScore * 10 + actionScore;
}

function auditOperationSummary(operation: AuditOperation) {
  if (operation.events.length === 1) return auditEventSummary(operation.primary);
  const businessItems = groupAuditBusinessItems(operation);
  if (isInvoiceCreatedFromPayment(operation)) {
    const lineCount = businessItems.filter((item) => item.event.entityType === "LigneDocumentClient").length;
    const transferredCount = businessItems.filter((item) => isTransferredDirectAllocation(item.event, operation)).length;
    const total = auditSnapshot(operation.primary).totalDocument;
    return [
      "Facture créée depuis un règlement",
      `${lineCount} ligne${lineCount > 1 ? "s" : ""}`,
      transferredCount ? `${transferredCount} affectation${transferredCount > 1 ? "s" : ""} transférée${transferredCount > 1 ? "s" : ""}` : null,
      typeof total === "number" ? formatAuditFieldValue("totalDocument", total) : null,
    ].filter((part): part is string => Boolean(part)).join(" · ");
  }
  if (operation.primary.entityType === "DocumentClient") {
    const kind = auditDocumentKind(operation.primary);
    const lineCount = businessItems.filter((item) => item.event.entityType === "LigneDocumentClient").length;
    const total = auditSnapshot(operation.primary).totalDocument;
    return [
      `${kind} ${operation.action === "CREATED" ? "créé" : operation.action === "DELETED" ? "supprimé" : "modifié"}`,
      lineCount ? `${lineCount} ligne${lineCount > 1 ? "s" : ""}` : null,
      typeof total === "number" ? formatAuditFieldValue("totalDocument", total) : null,
    ].filter((part): part is string => Boolean(part)).join(" · ");
  }
  if (isAvenantMovement(operation.primary)) {
    const type = auditMovementTypeLabel(operation.primary);
    return type ? `Avenant · ${type}` : "Avenant enregistré";
  }
  if (operation.primary.entityType === "Contrat" && operation.action === "CREATED") {
    return auditContractCreationSummary(operation, businessItems);
  }
  const relatedCount = businessItems.length - 1;
  return relatedCount > 0
    ? `${auditEventSummary(operation.primary)} · ${relatedCount} élément${relatedCount > 1 ? "s" : ""} lié${relatedCount > 1 ? "s" : ""}`
    : auditEventSummary(operation.primary);
}

function groupAuditBusinessItems(operation: AuditOperation): AuditBusinessItem[] {
  const groups = new Map<string, AdminAuditEvent[]>();
  [...operation.events].sort(compareAuditEventsAscending).forEach((event) => {
    const key = event.entityId ? `${event.entityType}:${event.entityId}` : `event:${event.id}`;
    groups.set(key, [...(groups.get(key) ?? []), event]);
  });
  return Array.from(groups, ([key, rawEvents]) => ({
    key,
    rawEvents,
    event: mergeAuditEvents(rawEvents),
  })).sort((left, right) => compareAuditEventsAscending(left.event, right.event));
}

function mergeAuditEvents(events: AdminAuditEvent[]): AdminAuditEvent {
  const ordered = [...events].sort(compareAuditEventsAscending);
  const first = ordered[0];
  const last = ordered[ordered.length - 1];
  const beforeData: Record<string, unknown> = {};
  const afterData: Record<string, unknown> = {};
  ordered.forEach((event) => {
    Object.entries(event.beforeData ?? {}).forEach(([field, value]) => {
      if (!(field in beforeData)) beforeData[field] = value;
    });
    Object.assign(afterData, event.afterData ?? {});
  });
  const action = ordered.some((event) => event.action === "CREATED")
    ? "CREATED"
    : last.action === "DELETED" ? "DELETED" : "UPDATED";
  return {
    ...first,
    action,
    occurredAt: first.occurredAt,
    beforeData: action === "CREATED" ? null : beforeData,
    afterData: action === "DELETED" ? null : afterData,
  };
}

function compareAuditEventsAscending(left: AdminAuditEvent, right: AdminAuditEvent) {
  const dateOrder = Date.parse(left.occurredAt) - Date.parse(right.occurredAt);
  return dateOrder || left.id.localeCompare(right.id, "fr", { numeric: true });
}

function auditContractCreationSummary(operation: AuditOperation, items = groupAuditBusinessItems(operation)) {
  const vehicles = items.filter((item) => item.event.entityType === "Vehicule").length;
  const trailers = items.filter((item) => item.event.entityType === "Remorque").length;
  const guarantees = items.filter((item) => item.event.entityType === "ContratGarantie").length;
  const parts = [
    vehicles ? `${vehicles} véhicule${vehicles > 1 ? "s" : ""}` : null,
    trailers ? `${trailers} remorque${trailers > 1 ? "s" : ""}` : null,
    guarantees ? `${guarantees} garantie${guarantees > 1 ? "s" : ""}` : null,
  ].filter((part): part is string => Boolean(part));
  return parts.length ? `Contrat créé avec ${parts.join(", ")}` : "Contrat créé";
}

function auditOperationEntityLabel(operation: AuditOperation) {
  if (isInvoiceCreatedFromPayment(operation)) return "Facture client";
  if (operation.primary.entityType === "DocumentClient") return auditDocumentKind(operation.primary);
  return isAvenantMovement(operation.primary)
    ? "Avenant"
    : auditEntityTypeLabel(operation.primary.entityType);
}

function auditOperationReference(operation: AuditOperation) {
  if (!isAvenantMovement(operation.primary)) return auditEntityReference(operation.primary);
  const movementType = auditMovementTypeLabel(operation.primary);
  const movementReference = auditEntityReference(operation.primary);
  return movementType ? `${movementType} · ${movementReference}` : movementReference;
}

const AUDIT_ENTITY_GROUPS = [
  { label: "Administration", types: ["Agence", "Utilisateur", "Role", "ParametreApplication"] },
  { label: "CRM", types: ["Client", "ClientTelephone", "GroupeClient", "GroupeClientMembre", "AcquisitionClient", "OrigineCommerciale", "ConditionPaiementClient"] },
  { label: "Production", types: ["Contrat", "ContratClient", "Vehicule", "Remorque", "ContratGarantie", "AssistanceContrat", "MouvementContrat", "MouvementVehicule", "MouvementRemorque", "MouvementGarantie", "AvenantDraft", "Quittance", "LigneQuittance", "ElementFacturable", "ElementFacturableCible", "CarteVerte", "PieceJointe"] },
  { label: "Tarification et référentiels", types: ["CompagnieAssurance", "CompagnieAssistance", "CompagnieGarantie", "ContactCompagnie", "BrancheAssurance", "Convention", "CategorieClient", "Usage", "Carburant", "Marque", "Carrosserie", "CategorieTransport", "SousClasse", "Garantie", "GroupeExclusionGarantie", "GroupeUsageAttestation", "GrilleTarifaire", "LigneGrilleTarifaire", "TarifUsage", "AjustementTarifUsage", "LigneAjustementTarifUsage", "CapitalResponsabiliteCivile", "FormuleGarantiePersonne", "ProduitAssistance", "TarifProduitAssistance", "RegleFiscale", "ApplicationRegleFiscaleQuittance", "TypeMouvementContrat", "TypePieceJointe", "Ville"] },
  { label: "Sinistres", types: ["Sinistre", "SinistreCouverture", "SinistreGarantie", "SinistrePartie", "SinistreDocument", "SinistreEvenement", "ProvisionSinistre", "SinistreOperation", "MissionExpertise", "ExpertSinistre", "GarageSinistre", "ExigenceDocumentSinistre"] },
  { label: "Comptabilité clients", types: ["DocumentClient", "LigneDocumentClient", "EcheanceFacturationConvention", "ReglementClient", "InstrumentReglementClient", "AffectationReglementClient"] },
  { label: "Comptabilité compagnies", types: ["AffectationQuittanceCompagnie", "RegleAffectationQuittance", "BordereauCompagnie", "LigneBordereauCompagnie", "ReglementCompagnie", "InstrumentReglementCompagnie", "AffectationReglementCompagnie"] },
  { label: "Trésorerie", types: ["Banque", "CompteTresorerie", "AffectationCompteTresorerie", "SessionCaisse", "MouvementTresorerie", "OperationTresorerie", "BordereauRemise", "LigneBordereauRemise", "ImportReleveBancaire", "LigneReleveBancaire", "ProfilImportReleveBancaire", "RapprochementBancaire"] },
  { label: "Stock d’attestations", types: ["AttestationStock", "LotAttestation", "LivraisonAttestation", "LigneLivraisonAttestation", "MouvementStockAttestation", "SeuilStockAttestation"] },
] as const;

function auditActionLabel(action: AdminAuditEvent["action"]) {
  return ({ CREATED: "Création", UPDATED: "Modification", DELETED: "Suppression" })[action] ?? action;
}

function auditActionVariant(action: AdminAuditEvent["action"]): "success" | "info" | "red" {
  if (action === "CREATED") return "success";
  if (action === "DELETED") return "red";
  return "info";
}

function AuditOperationDialog({ operation, onOpenChange }: { operation: AuditOperation | null; onOpenChange: (open: boolean) => void }) {
  const [technicalOpen, setTechnicalOpen] = useState(false);
  const businessItems = useMemo(() => operation ? groupAuditBusinessItems(operation) : [], [operation]);
  const timelineEntries = useMemo(() => groupAuditTimelineEntries(businessItems), [businessItems]);
  const entityUrl = operation ? auditEntityUrl(operation.primary) : null;
  useEffect(() => {
    setTechnicalOpen(false);
  }, [operation?.key]);
  return (
    <Dialog open={Boolean(operation)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-4xl">
        {operation ? (
          <>
            <DialogHeader>
              <DialogTitle>{auditOperationTitle(operation)}</DialogTitle>
              <DialogDescription>
                {formatAuditDateTime(operation.occurredAt)} par {operation.actorName || auditActorLabel(operation.actorType)}
                {operation.actorEmail && operation.actorEmail !== operation.actorName ? ` · ${operation.actorEmail}` : ""}
              </DialogDescription>
            </DialogHeader>
            <div className="grid max-h-[65vh] gap-4 overflow-y-auto pr-1">
              <div className="rounded-md border-l-4 border-l-amber-500 bg-amber-500/10 px-3 py-2">
                <div className="font-medium text-foreground">{auditOperationDescription(operation, businessItems)}</div>
                <div className="text-sm text-muted-foreground">Les étapes ci-dessous sont présentées dans leur ordre d’enregistrement.</div>
              </div>
              <section className="grid gap-2" aria-labelledby="audit-operation-timeline">
                <h3 id="audit-operation-timeline" className="text-sm font-semibold">Déroulement de l’opération</h3>
                <div className="border-y">
                  {timelineEntries.map((entry, index) => entry.kind === "document-lines" ? (
                    <AuditDocumentLinesTimelineItem
                      key={entry.key}
                      items={entry.items}
                      index={index}
                    />
                  ) : (
                    <AuditTimelineItem
                      key={entry.key}
                      item={entry.item}
                      operation={operation}
                      index={index}
                      defaultOpen={entry.item.event.entityType === operation.primary.entityType && entry.item.event.entityId === operation.primary.entityId}
                    />
                  ))}
                </div>
              </section>
              <Collapsible open={technicalOpen} onOpenChange={setTechnicalOpen} className="rounded-md border bg-muted/20">
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="ghost" className="w-full justify-between rounded-md px-3">
                    Informations techniques
                    <ChevronDown className={`size-4 transition-transform ${technicalOpen ? "rotate-180" : ""}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="border-t px-3 py-3">
                  <dl className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-2">
                    <div><dt className="font-medium text-foreground">Source</dt><dd>{auditSourceLabel(operation.primary.source)}</dd></div>
                    <div><dt className="font-medium text-foreground">ID utilisateur</dt><dd>{operation.primary.actorUserId || "-"}</dd></div>
                    <div><dt className="font-medium text-foreground">Éléments métier</dt><dd>{businessItems.length}</dd></div>
                    <div><dt className="font-medium text-foreground">Événements techniques</dt><dd>{operation.events.length}</dd></div>
                    <div className="sm:col-span-2">
                      <dt className="font-medium text-foreground">Identifiant de requête</dt>
                      <dd className="mt-1 flex items-center gap-2">
                        <span className="min-w-0 break-all font-mono">{operation.requestId || "-"}</span>
                        {operation.requestId ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            title="Copier l’identifiant"
                            aria-label="Copier l’identifiant de requête"
                            onClick={() => void navigator.clipboard
                              .writeText(operation.requestId ?? "")
                              .then(() => toast.success("Identifiant copié"))}
                          >
                            <ClipboardCopy className="size-4" />
                          </Button>
                        ) : null}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-3 border-t pt-3">
                    <div className="mb-2 text-xs font-medium text-foreground">Trace brute, dans l’ordre</div>
                    <ol className="grid gap-1 text-xs text-muted-foreground">
                      {[...operation.events].sort(compareAuditEventsAscending).map((event, index) => (
                        <li key={event.id} className="grid grid-cols-[2rem_auto_1fr_auto] items-center gap-2">
                          <span>{index + 1}.</span>
                          <Badge variant={auditActionVariant(event.action)}>{auditActionLabel(event.action)}</Badge>
                          <span>{auditEntityTypeLabel(event.entityType)} {auditEntityReference(event)}</span>
                          <span className="font-mono">#{event.id}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
              {entityUrl ? (
                <Button asChild>
                  <Link to={entityUrl} onClick={() => onOpenChange(false)}>
                    <ExternalLink className="size-4" />
                    {auditOpenActionLabel(operation.primary)}
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

function groupAuditTimelineEntries(items: AuditBusinessItem[]): AuditTimelineEntry[] {
  const documentLines = items.filter((item) => item.event.entityType === "LigneDocumentClient");
  if (!documentLines.length) {
    return items.map((item) => ({ kind: "item", key: item.key, item }));
  }
  const groups = new Map<string, AuditBusinessItem[]>();
  documentLines.forEach((item) => {
    const key = auditDocumentLineGroupKey(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  });
  const emitted = new Set<string>();
  return items.flatMap((item): AuditTimelineEntry[] => {
    if (item.event.entityType === "LigneDocumentClient") {
      const key = auditDocumentLineGroupKey(item);
      if (emitted.has(key)) return [];
      emitted.add(key);
      return [{ kind: "document-lines", key, items: groups.get(key) ?? [item] }];
    }
    return [{ kind: "item", key: item.key, item }];
  });
}

function auditDocumentLineGroupKey(item: AuditBusinessItem) {
  const document = auditSnapshot(item.event).document;
  const documentId = document && typeof document === "object" && !Array.isArray(document)
    ? String((document as { id?: unknown }).id ?? "unknown")
    : "unknown";
  return `document-lines:${documentId}`;
}

function AuditDocumentLinesTimelineItem({
  items,
  index,
}: {
  items: AuditBusinessItem[];
  index: number;
}) {
  const [open, setOpen] = useState(false);
  const document = auditReferenceLabel(auditSnapshot(items[0].event).document);
  const total = items.reduce((sum, item) => {
    const amount = auditSnapshot(item.event).montantTtc;
    return sum + (typeof amount === "number" ? amount : 0);
  }, 0);
  const hasAmounts = items.some((item) => typeof auditSnapshot(item.event).montantTtc === "number");
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-b last:border-b-0">
      <CollapsibleTrigger asChild>
        <button type="button" className="grid w-full grid-cols-[2rem_1fr_auto] items-center gap-3 px-2 py-3 text-left hover:bg-muted/50">
          <span className="flex size-7 items-center justify-center rounded-full border bg-background text-xs font-semibold">{index + 1}</span>
          <span className="grid min-w-0 gap-1">
            <span className="flex flex-wrap items-center gap-2">
              <Badge variant="success">Ajout</Badge>
              <span className="font-medium">
                {items.length} ligne{items.length > 1 ? "s" : ""} ajoutée{items.length > 1 ? "s" : ""}
                {document ? ` à ${document}` : " au document"}
              </span>
            </span>
            <span className="text-xs text-muted-foreground">
              {hasAmounts ? `Total des lignes · ${formatAuditFieldValue("montantTtc", total)}` : "Détail des éléments facturés"}
            </span>
          </span>
          <ChevronDown className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pb-3 pl-[3.25rem] pr-2">
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader className={ADMIN_TABLE_HEADER_CLASS}>
              <TableRow>
                <TableHead className="w-20">Ligne</TableHead>
                <TableHead>Quittance</TableHead>
                <TableHead>Nature</TableHead>
                <TableHead className="text-right">Montant TTC</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, itemIndex) => {
                const snapshot = auditSnapshot(item.event);
                const order = typeof snapshot.ordre === "number" ? snapshot.ordre : itemIndex + 1;
                const quittance = typeof snapshot.numeroQuittance === "string" && snapshot.numeroQuittance.trim()
                  ? snapshot.numeroQuittance.trim()
                  : "-";
                const movement = typeof snapshot.mouvement === "string" && snapshot.mouvement.trim()
                  ? snapshot.mouvement.trim()
                  : "-";
                return (
                  <TableRow key={item.key}>
                    <TableCell className="font-medium">{order}</TableCell>
                    <TableCell>{quittance}</TableCell>
                    <TableCell>{movement}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatAuditFieldValue("montantTtc", snapshot.montantTtc)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function AuditTimelineItem({
  item,
  operation,
  index,
  defaultOpen,
}: {
  item: AuditBusinessItem;
  operation: AuditOperation;
  index: number;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [showAllFields, setShowAllFields] = useState(false);
  const fields = auditChangedFields(item.event);
  const visibleFields = showAllFields ? fields : fields.slice(0, 8);
  useEffect(() => {
    setOpen(defaultOpen);
    setShowAllFields(false);
  }, [defaultOpen, item.key]);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-b last:border-b-0">
      <CollapsibleTrigger asChild>
        <button type="button" className="grid w-full grid-cols-[2rem_1fr_auto] items-center gap-3 px-2 py-3 text-left hover:bg-muted/50">
          <span className="flex size-7 items-center justify-center rounded-full border bg-background text-xs font-semibold">{index + 1}</span>
          <span className="grid min-w-0 gap-1">
            <span className="flex flex-wrap items-center gap-2">
              <Badge variant={auditActionVariant(item.event.action)}>{auditTimelineActionLabel(item.event, operation)}</Badge>
              <span className="font-medium">
                {auditTimelineObjectLabel(item.event, operation)}
              </span>
            </span>
            <span className="text-xs text-muted-foreground">{auditBusinessItemSummary(item, operation)}</span>
          </span>
          <ChevronDown className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pb-3 pl-[3.25rem] pr-2">
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader className={ADMIN_TABLE_HEADER_CLASS}>
              <TableRow>
                <TableHead>Champ</TableHead>
                <TableHead>Avant</TableHead>
                <TableHead>Après</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleFields.map((field) => (
                <TableRow key={field}>
                  <TableCell className="font-medium">{auditFieldLabel(field)}</TableCell>
                  <TableCell className="max-w-72 break-words text-muted-foreground">{formatAuditFieldValue(field, item.event.beforeData?.[field], item.event.entityType)}</TableCell>
                  <TableCell className="max-w-72 break-words">{formatAuditFieldValue(field, item.event.afterData?.[field], item.event.entityType)}</TableCell>
                </TableRow>
              ))}
              {!fields.length ? (
                <TableRow><TableCell colSpan={3} className="py-6 text-center text-muted-foreground">Aucune différence enregistrée.</TableCell></TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
        {fields.length > 8 ? (
          <Button type="button" variant="ghost" size="sm" className="mt-1" onClick={() => setShowAllFields((current) => !current)}>
            {showAllFields ? "Réduire les champs" : `Afficher ${fields.length - 8} autre${fields.length - 8 > 1 ? "s" : ""} champ${fields.length - 8 > 1 ? "s" : ""}`}
          </Button>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  );
}

function auditOperationTitle(operation: AuditOperation) {
  if (isInvoiceCreatedFromPayment(operation)) {
    return `Création de la facture · ${auditEntityReference(operation.primary)}`;
  }
  if (operation.primary.entityType === "DocumentClient") {
    const action = operation.action === "CREATED" ? "Création" : operation.action === "DELETED" ? "Suppression" : "Modification";
    return `${action} ${auditDocumentKind(operation.primary, true)} · ${auditEntityReference(operation.primary)}`;
  }
  if (operation.primary.entityType === "Contrat" && operation.action === "CREATED") {
    return `Création du contrat · ${auditEntityReference(operation.primary)}`;
  }
  if (isAvenantMovement(operation.primary)) {
    const action = operation.action === "CREATED" ? "Création" : operation.action === "DELETED" ? "Suppression" : "Modification";
    return `${action} de l’avenant · ${auditMovementTypeLabel(operation.primary) ?? auditEntityReference(operation.primary)}`;
  }
  return `${auditActionLabel(operation.action)} · ${auditOperationEntityLabel(operation)} ${auditOperationReference(operation)}`;
}

function auditOperationDescription(operation: AuditOperation, items: AuditBusinessItem[]) {
  if (isInvoiceCreatedFromPayment(operation)) {
    const lines = items.filter((item) => item.event.entityType === "LigneDocumentClient");
    const replacedAllocations = items.filter((item) => isTransferredDirectAllocation(item.event, operation));
    const paidQuittances = items.filter((item) => isQuittanceMarkedPaid(item.event, operation));
    const total = auditSnapshot(operation.primary).totalDocument;
    const parts = [
      `${lines.length} ligne${lines.length > 1 ? "s" : ""} facturée${lines.length > 1 ? "s" : ""}`,
      replacedAllocations.length
        ? `${replacedAllocations.length} affectation${replacedAllocations.length > 1 ? "s" : ""} directe${replacedAllocations.length > 1 ? "s" : ""} transférée${replacedAllocations.length > 1 ? "s" : ""}`
        : null,
      paidQuittances.length
        ? `${paidQuittances.length} quittance${paidQuittances.length > 1 ? "s" : ""} marquée${paidQuittances.length > 1 ? "s" : ""} comme payée${paidQuittances.length > 1 ? "s" : ""}`
        : null,
    ].filter((part): part is string => Boolean(part));
    const amount = typeof total === "number" ? ` pour ${formatAuditFieldValue("totalDocument", total)}` : "";
    return `Facture ${auditEntityReference(operation.primary)} créée depuis un règlement${amount} · ${parts.join(" · ")}.`;
  }
  if (operation.primary.entityType === "DocumentClient") {
    const kind = auditDocumentKind(operation.primary);
    const lineCount = items.filter((item) => item.event.entityType === "LigneDocumentClient").length;
    const total = auditSnapshot(operation.primary).totalDocument;
    const action = operation.action === "CREATED" ? "créé" : operation.action === "DELETED" ? "supprimé" : "modifié";
    const amount = typeof total === "number" ? ` · total ${formatAuditFieldValue("totalDocument", total)}` : "";
    return `${kind} ${auditEntityReference(operation.primary)} ${action} · ${lineCount} ligne${lineCount > 1 ? "s" : ""}${amount}.`;
  }
  if (operation.primary.entityType === "Contrat" && operation.action === "CREATED") {
    const summary = auditContractCreationSummary(operation, items).replace(/^Contrat créé/, "");
    return `Contrat ${auditEntityReference(operation.primary)} créé${summary}.`;
  }
  if (isAvenantMovement(operation.primary)) {
    const contract = auditParentContract(operation.primary);
    const type = auditMovementTypeLabel(operation.primary);
    return `Avenant${type ? ` « ${type} »` : ""} ${operation.action === "DELETED" ? "supprimé" : operation.action === "UPDATED" ? "modifié" : "enregistré"}${contract ? ` sur le contrat ${contract.label}` : ""}.`;
  }
  const reference = auditOperationReference(operation);
  return `${auditOperationEntityLabel(operation)}${reference ? ` ${reference}` : ""} · ${auditEventSummary(operation.primary)}.`;
}

function auditBusinessItemSummary(item: AuditBusinessItem, operation: AuditOperation) {
  const snapshot = auditSnapshot(item.event);
  if (item.event.entityType === "LigneDocumentClient") {
    const movement = typeof snapshot.mouvement === "string" ? snapshot.mouvement.trim() : "";
    const amount = snapshot.montantTtc;
    return [
      "Élément ajouté au document",
      movement || null,
      typeof amount === "number" ? formatAuditFieldValue("montantTtc", amount) : null,
    ].filter((part): part is string => Boolean(part)).join(" · ");
  }
  if (isTransferredDirectAllocation(item.event, operation)) {
    const invoice = operation.events.find((event) => event.entityType === "DocumentClient" && event.action === "CREATED");
    const amount = snapshot.montant;
    return [
      `Affectation directe transférée vers la facture ${invoice ? auditEntityReference(invoice) : ""}`.trim(),
      typeof amount === "number" ? formatAuditFieldValue("montant", amount) : null,
    ].filter((part): part is string => Boolean(part)).join(" · ");
  }
  if (item.event.entityType === "AffectationReglementClient" && item.event.action === "CREATED" && snapshot.documentClient) {
    const amount = snapshot.montant;
    return [
      "Règlement affecté au nouveau document",
      typeof amount === "number" ? formatAuditFieldValue("montant", amount) : null,
    ].filter((part): part is string => Boolean(part)).join(" · ");
  }
  if (isQuittanceMarkedPaid(item.event, operation)) {
    return "Statut recalculé automatiquement après l’affectation du règlement";
  }
  if (item.event.entityType === "ContratGarantie") {
    const target = auditGuaranteeTarget(snapshot);
    const automatic = isAutomaticRcGuarantee(item.event);
    const assignment = `${automatic ? "Affectée automatiquement" : "Ajoutée"} à ${target}`;
    return snapshot.prime == null
      ? `${assignment} · prime non calculée à cette étape`
      : `${assignment} · prime nette ${formatAuditFieldValue("prime", snapshot.prime)}`;
  }
  if (item.rawEvents.length > 1 && item.event.action === "CREATED") {
    return "Création et configuration initiale";
  }
  return auditEventSummary(item.event);
}

function isAutomaticRcGuarantee(event: AdminAuditEvent) {
  if (event.entityType !== "ContratGarantie") return false;
  const guarantee = auditReferenceLabel(auditSnapshot(event).garantie);
  return Boolean(guarantee && /^RC(?:\s|[-·]|$)/i.test(guarantee));
}

function auditTimelineActionLabel(event: AdminAuditEvent, operation: AuditOperation) {
  if (isTransferredDirectAllocation(event, operation)) return "Transfert";
  if (isQuittanceMarkedPaid(event, operation)) return "Mise à jour automatique";
  if (event.entityType === "LigneDocumentClient" && event.action === "CREATED") return "Ajout";
  const isAddedContractElement = event.action === "CREATED"
    && ["ContratClient", "ContratGarantie", "Vehicule", "Remorque", "AssistanceContrat"].includes(event.entityType);
  if (isAddedContractElement) return "Ajout";
  if (event.action === "DELETED" && ["ContratGarantie", "Vehicule", "Remorque", "AssistanceContrat"].includes(event.entityType)) {
    return "Retrait";
  }
  return auditActionLabel(event.action);
}

function auditTimelineObjectLabel(event: AdminAuditEvent, operation: AuditOperation) {
  const snapshot = auditSnapshot(event);
  if (event.entityType === "LigneDocumentClient") {
    const documentKind = auditDocumentKind(operation.primary).toLocaleLowerCase("fr");
    const order = typeof snapshot.ordre === "number" ? `Ligne ${snapshot.ordre}` : `Ligne de ${documentKind}`;
    const reference = typeof snapshot.numeroQuittance === "string" && snapshot.numeroQuittance.trim()
      ? ` · quittance ${snapshot.numeroQuittance.trim()}`
      : "";
    return `${order}${reference}`;
  }
  if (isTransferredDirectAllocation(event, operation)) {
    const instrument = auditReferenceLabel(snapshot.instrument);
    return instrument ? `Ancienne affectation · ${instrument}` : "Ancienne affectation directe";
  }
  if (event.entityType === "AffectationReglementClient" && event.action === "CREATED" && snapshot.documentClient) {
    const document = auditReferenceLabel(snapshot.documentClient);
    return document ? `Affectation à ${document}` : "Affectation à la facture";
  }
  if (event.entityType === "ContratGarantie") {
    return auditReferenceLabel(snapshot.garantie) ?? "Garantie";
  }
  const reference = auditEntityReference(event);
  return `${auditEntityTypeLabel(event.entityType)}${reference ? ` ${reference}` : ""}`;
}

function isInvoiceCreatedFromPayment(operation: AuditOperation) {
  return operation.events.some((event) => event.entityType === "DocumentClient" && event.action === "CREATED")
    && operation.events.some((event) => event.entityType === "LigneDocumentClient" && event.action === "CREATED")
    && operation.events.some((event) => event.entityType === "AffectationReglementClient");
}

function auditDocumentKind(event: AdminAuditEvent, withArticle = false) {
  const type = auditSnapshot(event).typeDocument;
  const label = type === "FACTURE" ? "Facture" : type === "RELEVE" ? "Relevé" : "Document client";
  if (!withArticle) return label;
  return label === "Facture" ? "de la facture" : label === "Relevé" ? "du relevé" : "du document client";
}

function isTransferredDirectAllocation(event: AdminAuditEvent, operation: AuditOperation) {
  return isInvoiceCreatedFromPayment(operation)
    && event.entityType === "AffectationReglementClient"
    && event.action === "UPDATED"
    && event.afterData?.statut === "ANNULEE"
    && event.beforeData?.statut !== "ANNULEE";
}

function isQuittanceMarkedPaid(event: AdminAuditEvent, operation: AuditOperation) {
  return isInvoiceCreatedFromPayment(operation)
    && event.entityType === "Quittance"
    && event.action === "UPDATED"
    && event.beforeData?.payee === false
    && event.afterData?.payee === true;
}

function auditChangedFields(event: AdminAuditEvent) {
  return Array.from(new Set([
    ...Object.keys(event.beforeData ?? {}),
    ...Object.keys(event.afterData ?? {}),
  ])).sort((left, right) => {
    const priority = auditFieldPriority(left) - auditFieldPriority(right);
    return priority || auditFieldLabel(left).localeCompare(auditFieldLabel(right), "fr");
  });
}

function auditEventSummary(event: AdminAuditEvent) {
  const fields = auditChangedFields(event);
  const parent = auditParentContract(event);
  if (isLegacyContractCountEvent(event, fields)) {
    return "Mise à jour du parc · ancienne trace technique";
  }
  if (event.entityType === "Vehicule" || event.entityType === "Remorque") {
    const object = event.entityType === "Vehicule" ? "Véhicule" : "Remorque";
    const action = auditTargetAction(event);
    return parent?.label ? `${object} ${action} · contrat ${parent.label}` : `${object} ${action}`;
  }
  if (event.entityType === "ContratGarantie") {
    const snapshot = auditSnapshot(event);
    const target = auditGuaranteeTarget(snapshot);
    if (event.action === "CREATED") {
      return parent?.label
        ? `Ajoutée à ${target} · contrat ${parent.label}`
        : `Ajoutée à ${target}`;
    }
    if (event.action === "DELETED") {
      return parent?.label
        ? `Retirée de ${target} · contrat ${parent.label}`
        : `Retirée de ${target}`;
    }
  }
  if (event.entityType === "AjustementTarifUsage" && event.action === "CREATED") {
    const snapshot = event.afterData ?? {};
    const direction = formatAuditValue(snapshot.sens).toLocaleLowerCase("fr");
    const value = formatAuditValue(snapshot.valeur);
    const unit = snapshot.typeCalcul === "POURCENTAGE" ? " %" : "";
    const start = formatAuditValue(snapshot.dateDebut);
    return `${direction.charAt(0).toUpperCase()}${direction.slice(1)} de ${value}${unit} · effet ${start}`;
  }
  if (event.action === "CREATED") return `${fields.length} champ(s) enregistré(s)`;
  if (event.action === "DELETED") return "Enregistrement supprimé";
  if (!fields.length) return "Modification enregistrée";
  const labels = fields.slice(0, 2).map(auditFieldLabel);
  return fields.length > 2 ? `${labels.join(", ")} +${fields.length - 2}` : labels.join(", ");
}

function auditEntityReference(event: AdminAuditEvent) {
  const snapshot = auditSnapshot(event);
  if (event.entityType === "Utilisateur") {
    const fullName = [snapshot.prenom, snapshot.nom]
      .filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
      .join(" ");
    if (fullName) return fullName;
    if (typeof snapshot.email === "string" && snapshot.email.trim()) return snapshot.email.trim();
  }
  if (event.entityType === "Role") {
    const roleName = typeof snapshot.nom === "string" ? snapshot.nom.trim() : "";
    const roleCode = typeof snapshot.code === "string" ? snapshot.code.trim() : "";
    if (roleCode && roleName) return `${roleCode} · ${roleName}`;
    if (roleCode || roleName) return roleCode || roleName;
  }
  if (event.entityType === "ContratGarantie") {
    const guarantee = auditReferenceLabel(snapshot.garantie) ?? "Garantie";
    return `${guarantee} · ${auditGuaranteeTarget(snapshot)}`;
  }
  if (event.entityType === "Vehicule" || event.entityType === "Remorque") {
    const registration = snapshot.immatriculation;
    return typeof registration === "string" && registration.trim()
      ? registration.trim()
      : event.entityId ? `#${event.entityId}` : "";
  }
  if (event.entityType === "AjustementTarifUsage") {
    const direction = formatAuditValue(snapshot.sens);
    const value = formatAuditValue(snapshot.valeur);
    const unit = snapshot.typeCalcul === "POURCENTAGE" ? " %" : "";
    const start = formatAuditValue(snapshot.dateDebut);
    return `${direction} ${value}${unit} · ${start}`;
  }
  const identifierCandidates = [
    "numero",
    "numeroSinistre",
    "numeroDossier",
    "numeroPolice",
    "numeroMouvement",
    "numeroQuittance",
    "numeroContratOuQuittance",
    "referenceInstrument",
    "referenceSource",
    "numeroDocument",
    "numeroBordereau",
    "immatriculation",
    "numeroAttestation",
    "reference",
    "codeClient",
    "code",
  ];
  for (const key of identifierCandidates) {
    const value = snapshot[key];
    if (typeof value === "string" && value.trim()) return `n° ${value.trim()}`;
  }
  const labelCandidates = [
    "raisonSociale",
    "code",
    "libelle",
    "nom",
    "produit",
    "nomFichier",
  ];
  for (const key of labelCandidates) {
    const value = snapshot[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  const relationCandidates = [
    "garantie",
    "contrat",
    "sinistre",
    "reglement",
    "instrument",
    "document",
    "bordereau",
    "compteTresorerie",
  ];
  for (const key of relationCandidates) {
    const value = snapshot[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return formatAuditValue(value);
    }
  }
  return event.entityId ? `#${event.entityId}` : "";
}

function auditEntityTypeLabel(entityType: string) {
  const normalizedType = normalizeAuditEntityType(entityType);
  return ({
    Agence: "Agence",
    Banque: "Banque",
    BrancheAssurance: "Branche d’assurance",
    CategorieClient: "Catégorie client",
    Client: "Client",
    CompagnieAssistance: "Compagnie d’assistance",
    CompagnieAssurance: "Compagnie d’assurance",
    Convention: "Convention",
    Contrat: "Contrat",
    ContratClient: "Lien client-contrat",
    ContratGarantie: "Garantie du contrat",
    AssistanceContrat: "Assistance du contrat",
    MouvementContrat: "Mouvement du contrat",
    MouvementVehicule: "Mouvement de véhicule",
    MouvementRemorque: "Mouvement de remorque",
    MouvementGarantie: "Mouvement de garantie",
    Quittance: "Quittance",
    LigneQuittance: "Ligne de quittance",
    ElementFacturable: "Élément facturable",
    ElementFacturableCible: "Cible de facturation",
    CarteVerte: "Carte verte",
    PieceJointe: "Pièce jointe",
    AvenantDraft: "Brouillon d’avenant",
    Garantie: "Garantie",
    CompagnieGarantie: "Garantie de compagnie",
    ContactCompagnie: "Contact compagnie",
    CapitalResponsabiliteCivile: "Capital de responsabilité civile",
    FormuleGarantiePersonne: "Formule de garantie personne",
    GroupeExclusionGarantie: "Groupe d’exclusion de garanties",
    GroupeUsageAttestation: "Groupe d’usage d’attestations",
    GrilleTarifaire: "Grille tarifaire",
    LigneGrilleTarifaire: "Ligne de grille tarifaire",
    TarifUsage: "Tarif d’usage",
    LigneAjustementTarifUsage: "Ligne d’ajustement tarifaire",
    ProduitAssistance: "Produit d’assistance",
    TarifProduitAssistance: "Tarif d’assistance",
    GroupeClient: "Groupe client",
    GroupeClientMembre: "Membre du groupe client",
    ClientTelephone: "Téléphone client",
    AcquisitionClient: "Acquisition commerciale",
    OrigineCommerciale: "Origine commerciale",
    Marque: "Marque",
    Carrosserie: "Carrosserie",
    Carburant: "Carburant",
    CategorieTransport: "Catégorie de transport",
    SousClasse: "Sous-classe",
    Usage: "Usage",
    Utilisateur: "Utilisateur",
    Role: "Rôle",
    Ville: "Ville",
    Sinistre: "Sinistre",
    DocumentClient: "Document client",
    LigneDocumentClient: "Ligne de document client",
    EcheanceFacturationConvention: "Échéance de facturation",
    ReglementClient: "Règlement client",
    InstrumentReglementClient: "Moyen de règlement client",
    AffectationReglementClient: "Affectation de règlement client",
    BordereauCompagnie: "Bordereau compagnie",
    LigneBordereauCompagnie: "Ligne de bordereau compagnie",
    ReglementCompagnie: "Règlement compagnie",
    InstrumentReglementCompagnie: "Moyen de règlement compagnie",
    AffectationReglementCompagnie: "Affectation de règlement compagnie",
    AffectationQuittanceCompagnie: "Affectation de quittance compagnie",
    CompteTresorerie: "Compte de trésorerie",
    MouvementTresorerie: "Mouvement de trésorerie",
    OperationTresorerie: "Opération de trésorerie",
    BordereauRemise: "Bordereau bancaire",
    LigneBordereauRemise: "Ligne de bordereau bancaire",
    RapprochementBancaire: "Rapprochement bancaire",
    ImportReleveBancaire: "Import de relevé bancaire",
    LigneReleveBancaire: "Ligne de relevé bancaire",
    ProfilImportReleveBancaire: "Profil d’import bancaire",
    SessionCaisse: "Session de caisse",
    AffectationCompteTresorerie: "Affectation de compte",
    ConditionPaiementClient: "Condition de paiement",
    AjustementTarifUsage: "Ajustement tarifaire",
    ProvisionSinistre: "Provision de sinistre",
    SinistreOperation: "Opération de sinistre",
    SinistrePartie: "Partie impliquée",
    SinistreGarantie: "Garantie du sinistre",
    SinistreCouverture: "Couverture du sinistre",
    SinistreDocument: "Document du sinistre",
    SinistreEvenement: "Événement du sinistre",
    MissionExpertise: "Mission d’expertise",
    ExpertSinistre: "Expert",
    GarageSinistre: "Garage",
    AttestationStock: "Attestation en stock",
    LotAttestation: "Lot d’attestations",
    LivraisonAttestation: "Livraison d’attestations",
    LigneLivraisonAttestation: "Ligne de livraison d’attestations",
    MouvementStockAttestation: "Mouvement de stock d’attestations",
    SeuilStockAttestation: "Seuil de stock d’attestations",
    RegleFiscale: "Règle fiscale",
    ParametreApplication: "Paramètre d’application",
    TypePieceJointe: "Type de pièce jointe",
    TypeMouvementContrat: "Type de mouvement de contrat",
    ApplicationRegleFiscaleQuittance: "Application de règle fiscale",
    RegleAffectationQuittance: "Règle d’affectation de quittance",
    ExigenceDocumentSinistre: "Exigence documentaire de sinistre",
    Vehicule: "Véhicule",
    Remorque: "Remorque",
  } as Record<string, string>)[normalizedType] ?? splitAuditIdentifier(normalizedType);
}

function auditFieldLabel(field: string) {
  return ({
    actif: "Actif",
    agence: "Agence",
    role: "Rôle",
    permissions: "Permissions",
    aliases: "Alias",
    usages: "Usages autorisés",
    carrosseries: "Carrosseries autorisées",
    carburants: "Carburants autorisés",
    compagniesRestreintes: "Compagnies autorisées",
    modesAutorises: "Modes de tarification autorisés",
    modesTarificationMultiple: "Modes de tarification multiple",
    sourcesValeurAutorisees: "Sources de valeur autorisées",
    typesContratAutorises: "Types de contrat autorisés",
    prenom: "Prénom",
    nom: "Nom",
    email: "E-mail",
    telephone: "Téléphone",
    password: "Mot de passe",
    description: "Description",
    systemRole: "Rôle système",
    client: "Client",
    statut: "Statut",
    brancheAssurance: "Branche d’assurance",
    dateEffet: "Date d’effet",
    dateEcheance: "Date d’échéance",
    dateSinistre: "Date du sinistre",
    dateDeclaration: "Date de déclaration",
    dateDebut: "Date de début",
    datePremiereCirculation: "Date de première mise en circulation",
    dateMiseEnCirculation: "Date de mise en circulation",
    dateExpirationCarteGrise: "Expiration de la carte grise",
    numeroDossier: "N° dossier",
    numeroPolice: "N° police",
    numeroSinistre: "N° sinistre",
    numeroAttestation: "N° attestation",
    numeroRemorque: "N° remorque",
    immatriculation: "Immatriculation",
    immatriculationProvisoire: "Immatriculation provisoire",
    contrat: "Contrat",
    compagnieAssurance: "Compagnie d’assurance",
    convention: "Convention",
    categorieClient: "Catégorie client",
    grilleTarifaire: "Grille tarifaire",
    payeurPrime: "Payeur de la prime",
    groupeFacturation: "Groupe de facturation",
    typeVehicule: "Type de véhicule",
    usage: "Usage",
    marque: "Marque",
    marqueRemorque: "Marque de remorque",
    carrosserie: "Carrosserie",
    categorieTransport: "Catégorie de transport",
    carburant: "Carburant",
    puissanceFiscale: "Puissance fiscale",
    nombrePlaces: "Nombre de places",
    cylindree: "Cylindrée",
    sousClasse: "Sous-classe",
    ptc: "PTC",
    crm: "CRM",
    coefficientProrata: "Coefficient de prorata",
    assistance: "Assistance",
    crmPartage: "CRM partagé",
    crmPartageValeur: "Valeur du CRM partagé",
    fractionnement: "Fractionnement",
    modeFacturation: "Mode de facturation",
    modeSaisieGaranties: "Mode de saisie des garanties",
    modeSelectionne: "Mode de tarification",
    sourceValeurSelectionnee: "Source de la valeur assurée",
    periodicite: "Périodicité",
    prospection: "Prospection",
    renouvele: "Renouvelé",
    saisiePrimeNette: "Saisie de la prime nette",
    typeContrat: "Type de contrat",
    typePayeurPrime: "Payeur de la prime",
    typeRenouvellement: "Type de renouvellement",
    valeurVenale: "Valeur vénale",
    valeurNeuf: "Valeur à neuf",
    valeurGlace: "Valeur des glaces",
    valeurAssuree: "Valeur assurée",
    organismeCredit: "Organisme de crédit",
    nomOrganismeCredit: "Nom de l’organisme de crédit",
    montantCredit: "Montant du crédit",
    dateFinCredit: "Fin du crédit",
    motif: "Motif",
    sens: "Sens",
    typeCalcul: "Type de calcul",
    typeOperation: "Type d’opération",
    valeur: "Valeur",
    nombreVehicules: "Nombre de véhicules",
    nombreRemorques: "Nombre de remorques",
    montant: "Montant",
    montantTtc: "Montant TTC",
    montantTotal: "Montant total",
    montantNonAffecte: "Montant non affecté",
    totalDebit: "Total débit",
    totalCredit: "Total crédit",
    totalDocument: "Total du document",
    debit: "Débit",
    credit: "Crédit",
    primeNette: "Prime nette",
    taxes: "Taxes",
    accessoires: "Accessoires",
    ordre: "N° de ligne",
    typeDocument: "Type de document",
    documentClient: "Document client",
    elementFacturable: "Élément facturable",
    instrument: "Moyen de règlement",
    payee: "Payée",
    capital: "Capital assuré",
    taux: "Taux",
    prime: "Prime nette",
    tauxFranchise: "Taux de franchise",
    franchiseMinimale: "Franchise minimale",
    primeTtc: "Prime TTC",
    notes: "Notes",
    commentaire: "Commentaire",
    circonstances: "Circonstances",
    logoCheminStockage: "Fichier du logo",
    logoTypeMime: "Format du logo",
    logoNomFichier: "Nom du logo",
    signatureCheminStockage: "Fichier de signature",
    signatureTypeMime: "Format de signature",
    signatureNomFichier: "Nom de la signature",
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
  if (typeof value === "number") {
    return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 6 }).format(value);
  }
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split("-");
      return `${day}/${month}/${year}`;
    }
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return formatDateTime(value);
    if (AUDIT_VALUE_LABELS[value]) return AUDIT_VALUE_LABELS[value];
    if (/^[A-Z][A-Z0-9_]*$/.test(value)) return splitAuditIdentifier(value);
    return value;
  }
  if (Array.isArray(value)) return value.map(formatAuditValue).join(", ") || "-";
  if (typeof value === "object") {
    const reference = value as { type?: unknown; id?: unknown; label?: unknown };
    if (typeof reference.type === "string" && reference.id != null) {
      if (typeof reference.label === "string" && reference.label.trim()) {
        return `${reference.label.trim()} (${auditEntityTypeLabel(reference.type)} #${String(reference.id)})`;
      }
      return `${auditEntityTypeLabel(reference.type)} #${String(reference.id)}`;
    }
    return JSON.stringify(value);
  }
  return String(value);
}

function formatAuditFieldValue(field: string, value: unknown, entityType?: string) {
  if (field === "statut" && entityType === "BordereauRemise" && typeof value === "string") {
    return ({
      BROUILLON: "Provisoire",
      DEPOSE: "Remis à la banque",
      PARTIELLEMENT_TRAITE: "Partiellement traité",
      CLOTURE: "Clôturé",
      ANNULE: "Annulé",
    } as Record<string, string>)[value] ?? formatAuditValue(value);
  }
  if (["prime", "capital", "franchiseMinimale", "montant", "montantTotal", "montantNonAffecte", "montantTtc", "primeTtc", "primeNette", "taxes", "accessoires", "debit", "credit", "totalDebit", "totalCredit", "totalDocument"].includes(field)
      && typeof value === "number") {
    return `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} MAD`;
  }
  return formatAuditValue(value);
}

function auditEntityUrl(event: AdminAuditEvent) {
  const parentContract = auditParentContract(event);
  if (parentContract?.id) {
    return `/app/production/contrats/${parentContract.id}`;
  }
  if (!event.entityId || event.action === "DELETED") return null;
  return ({
    Agence: `/app/admin/agences`,
    Utilisateur: `/app/admin/utilisateurs`,
    Role: `/app/admin/roles/${event.entityId}`,
    Contrat: `/app/production/contrats/${event.entityId}`,
    Sinistre: `/app/sinistre/dossiers/${event.entityId}`,
    BordereauCompagnie: `/app/compta/bordereaux-compagnies/${event.entityId}`,
    CompteTresorerie: `/app/compta/tresorerie/comptes/${event.entityId}`,
  } as Record<string, string>)[event.entityType] ?? null;
}

function isLegacyContractCountEvent(event: AdminAuditEvent, fields: string[]) {
  return event.entityType === "Contrat"
    && event.action === "UPDATED"
    && fields.length > 0
    && fields.every((field) => field === "nombreVehicules" || field === "nombreRemorques");
}

function auditTargetAction(event: AdminAuditEvent) {
  const feminineSuffix = event.entityType === "Remorque" ? "e" : "";
  if (event.action === "CREATED") return `ajouté${feminineSuffix}`;
  if (event.action === "DELETED") return `supprimé${feminineSuffix}`;
  if (event.beforeData?.actif === true && event.afterData?.actif === false) {
    return `retiré${feminineSuffix}`;
  }
  if (event.beforeData?.actif === false && event.afterData?.actif === true) {
    return `réactivé${feminineSuffix}`;
  }
  return `modifié${feminineSuffix}`;
}

function normalizeAuditEntityType(entityType: string) {
  return entityType.split("$")[0]?.replace(/_\$\$_hibernate_proxy.*$/i, "") || entityType;
}

function auditFieldPriority(field: string) {
  const priority = [
    "numero",
    "numeroDossier",
    "numeroPolice",
    "numeroSinistre",
    "immatriculation",
    "statut",
    "contrat",
    "garantie",
    "vehicule",
    "remorque",
    "prime",
    "taux",
    "capital",
    "tauxFranchise",
    "franchiseMinimale",
    "client",
    "compagnieAssurance",
    "dateEffet",
    "dateEcheance",
    "dateOperation",
    "montant",
    "montantTotal",
    "montantTtc",
  ];
  const index = priority.indexOf(field);
  return index < 0 ? priority.length : index;
}

function auditParentContract(event: AdminAuditEvent) {
  const snapshot = auditSnapshot(event);
  const contract = snapshot.contrat;
  if (!contract || typeof contract !== "object" || Array.isArray(contract)) return null;
  const reference = contract as { type?: unknown; id?: unknown; label?: unknown };
  if (reference.type !== "Contrat" || reference.id == null) return null;
  return {
    id: String(reference.id),
    label: typeof reference.label === "string" && reference.label.trim()
      ? reference.label.trim()
      : `#${String(reference.id)}`,
  };
}

function auditSnapshot(event: AdminAuditEvent) {
  return { ...(event.beforeData ?? {}), ...(event.afterData ?? {}) };
}

function isAvenantMovement(event: AdminAuditEvent) {
  if (event.entityType !== "MouvementContrat") return false;
  const reference = auditReferenceLabel(auditSnapshot(event).typeMouvement);
  if (!reference) return false;
  const code = reference.split(/\s+(?:-|·)\s+/, 1)[0]?.trim().toUpperCase();
  return Boolean(code && code !== "AN" && code !== "REN");
}

function auditMovementTypeLabel(event: AdminAuditEvent) {
  const reference = auditReferenceLabel(auditSnapshot(event).typeMouvement);
  if (!reference) return null;
  const [, ...labelParts] = reference.split(/\s+(?:-|·)\s+/);
  return labelParts.join(" - ").trim() || reference;
}

function auditReferenceLabel(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const reference = value as { id?: unknown; label?: unknown };
  return typeof reference.label === "string" && reference.label.trim()
    ? reference.label.trim()
    : reference.id != null ? `#${String(reference.id)}` : null;
}

function auditGuaranteeTarget(snapshot: Record<string, unknown>) {
  const vehicle = auditReferenceLabel(snapshot.vehicule);
  if (vehicle) return `véhicule ${vehicle}`;
  const trailer = auditReferenceLabel(snapshot.remorque);
  if (trailer) return `remorque ${trailer}`;
  const client = auditReferenceLabel(snapshot.client);
  if (client) return `assuré ${client}`;
  return "le contrat";
}

function auditOpenActionLabel(event: AdminAuditEvent) {
  return event.entityType === "Contrat" || auditParentContract(event)
    ? "Voir le contrat"
    : "Voir l’objet";
}

const AUDIT_VALUE_LABELS: Record<string, string> = {
  "[REDACTED]": "Valeur masquée",
  HAUSSE: "Hausse",
  BAISSE: "Baisse",
  POURCENTAGE: "Pourcentage",
  MONTANT_FIXE: "Montant fixe",
  AJUSTEMENT: "Ajustement tarifaire",
  ACTIVE: "Actif",
  ACTIF: "Actif",
  INACTIVE: "Inactif",
  INACTIF: "Inactif",
  AUTOMOBILE: "Automobile",
  REMORQUE: "Remorque",
  DRAFT: "Brouillon",
  SUSPENDED: "Suspendu",
  CANCELLED: "Résilié",
  EXPIRED: "Expiré",
  RENEWED: "Renouvelé",
  PARTICULIER: "Particulier",
  CONVENTION: "Convention",
  FLOTTE: "Flotte",
  MENSUEL: "Mensuel",
  TRIMESTRIEL: "Trimestriel",
  SEMESTRIEL: "Semestriel",
  ANNUEL: "Annuel",
  DIRECTE: "Directe",
  CONSOLIDEE_GROUPE: "Consolidée par groupe",
  MANUELLE: "Manuelle",
  MANUELLE_AVEC_PRIME_NETTE: "Manuelle avec prime nette",
  AUTOMATIQUE_GRILLE: "Automatique selon la grille",
  SOUSCRIPTEUR: "Souscripteur",
  TRESORERIE_GROUPE: "Trésorerie du groupe",
  MEMBRE_GROUPE: "Membre du groupe",
  TIERS_MANDATE: "Tiers mandaté",
  EMIS: "Émis",
  REMPLACE: "Remplacé",
  FACTURE: "Facture",
  RELEVE: "Relevé",
  ANNULE: "Annulé",
  VALIDE: "Validé",
  BROUILLON: "Brouillon",
  DECLARE: "Déclaré",
  DOSSIER_INCOMPLET: "Dossier incomplet",
  TRANSMIS_COMPAGNIE: "Transmis à la compagnie",
  EXPERTISE: "En expertise",
  EN_ATTENTE_REGLEMENT: "En attente de règlement",
  PARTIELLEMENT_REGLE: "Partiellement réglé",
  REGLE: "Réglé",
  CLOTURE: "Clôturé",
  REJETE: "Rejeté",
  ROUVERT: "Rouvert",
  CAISSE: "Caisse",
  BANQUE: "Banque",
  INDIVIDUELLE: "Individuelle",
  CENTRALE: "Centrale",
  TRANSMIS: "Transmis",
  DEPOSE: "Déposé",
  PARTIELLEMENT_TRAITE: "Partiellement traité",
  CONFIRMEE: "Confirmée",
  ANNULEE: "Annulée",
  OUVERTE: "Ouverte",
  CLOTUREE: "Clôturée",
  SUGGERE: "Suggéré",
  SELECTIONNE: "Sélectionné",
  ENTREE: "Entrée",
  SORTIE: "Sortie",
};

function auditActorLabel(actorType: AdminAuditEvent["actorType"]) {
  return ({ USER: "Utilisateur", SYSTEM: "Système", IMPORT: "Import" })[actorType];
}

function auditSourceLabel(source?: string | null) {
  return ({ API: "Application", IMPORT: "Import", SYSTEM: "Système" } as Record<string, string>)[source ?? ""] ?? source ?? "-";
}

export function RolesPanel({
  roles,
  loading,
  permissions,
  agencies,
  canManage,
  roleId,
  onChanged,
}: {
  roles: AdminRole[];
  loading: boolean;
  permissions: AdminPermission[];
  agencies: AdminAgency[];
  canManage: boolean;
  roleId?: string;
  onChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const editing = roleId && roleId !== "new" ? roles.find((role) => role.id === roleId) ?? null : null;
  const editorOpen = Boolean(roleId);
  const [permissionModule, setPermissionModule] = useState("");
  const [form, setForm] = useState<UpsertAdminRoleRequest>(emptyRole(agencies[0]?.id));
  const groupedPermissions = useMemo(() => groupPermissions(permissions), [permissions]);

  useEffect(() => {
    if (!editorOpen || (roleId !== "new" && !editing)) return;
    const next = editing ? roleToForm(editing) : emptyRole(agencies[0]?.id);
    setForm({
      ...next,
      permissionIds: includePermissionDependencies(next.permissionIds, permissions),
    });
    setPermissionModule(groupedPermissions[0]?.[0] ?? "");
  }, [agencies, editing, editorOpen, groupedPermissions, permissions, roleId]);

  const save = useMutation({
    mutationFn: () => editing ? adminApi.updateRole(editing.id, form) : adminApi.createRole(form),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "roles"] });
      onChanged();
      toast.success("Role enregistré");
      navigate("/app/admin/roles");
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

  if (editorOpen && !canManage) {
    return <Navigate to="/app/admin/roles" replace />;
  }

  if (editorOpen && roleId !== "new" && !editing) {
    if (loading) {
      return <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">Chargement du rôle...</div>;
    }
    return (
      <div className="grid gap-4 rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold">Rôle introuvable</h2>
        <p className="text-sm text-muted-foreground">Ce rôle n’existe pas ou n’est pas accessible dans ce périmètre.</p>
        <Button className="w-fit" variant="outline" onClick={() => navigate("/app/admin/roles")}>Retour aux rôles</Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 rounded-lg border bg-card p-4">
      {!editorOpen ? <>
      <div className="flex justify-end">
        <Button disabled={!canManage} onClick={() => navigate("/app/admin/roles/new")}>
          <Plus className="size-4" />
          Ajouter rôle
        </Button>
      </div>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader className={ADMIN_TABLE_HEADER_CLASS}>
            <TableRow>
              <TableHead>Rôle</TableHead>
              <TableHead>Agence</TableHead>
              <TableHead>Permissions</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="w-20 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRowsSkeleton rows={5} colSpan={5} />
            ) : roles.length ? roles.map((role) => (
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
                        onSelect: () => navigate(`/app/admin/roles/${role.id}`),
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
            )) : (
              <TableRow>
                <TableCell colSpan={5} className="h-28 text-center text-muted-foreground">
                  Aucun rôle trouvé
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      </> : (
        <div className="grid gap-5">
          <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">{editing ? "Modifier le rôle" : "Ajouter un rôle"}</h2>
              <p className="text-sm text-muted-foreground">Les permissions déterminent les modules visibles et les actions autorisées.</p>
            </div>
            <Button variant="outline" onClick={() => navigate("/app/admin/roles")}>Retour aux rôles</Button>
          </div>
          <div className="grid gap-5">
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
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => navigate("/app/admin/roles")}>Annuler</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>Enregistrer</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AgenciesPanel({
  agencies,
  loading,
  canManage,
  canCreate,
  canEditPlatformFields,
  onChanged,
}: {
  agencies: AdminAgency[];
  loading: boolean;
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
          <TableHeader className={ADMIN_TABLE_HEADER_CLASS}>
            <TableRow>
              <TableHead>Agence</TableHead>
              <TableHead>Ville</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="w-20 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRowsSkeleton rows={5} colSpan={5} />
            ) : agencies.length ? agencies.map((agence) => (
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
            )) : (
              <TableRow>
                <TableCell colSpan={5} className="h-28 text-center text-muted-foreground">
                  Aucune agence trouvée
                </TableCell>
              </TableRow>
            )}
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

function formatAuditDateTime(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "medium" }).format(new Date(value));
}

function showError(error: unknown) {
  toast.error(error instanceof Error ? error.message : "Opération impossible");
}
