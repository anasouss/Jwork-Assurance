import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit, KeyRound, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
  UpsertAdminAgencyRequest,
  UpsertAdminRoleRequest,
  UpsertAdminUserRequest,
} from "../types";

const GLOBAL_AGENCY = "__global__";

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
      statut: "ACTIVE",
    }] : [];
  }, [agencies.data, canViewAgencies, user?.agenceId, user?.agenceName]);

  return (
    <div className="grid gap-5">
      <div>
        <p className="text-sm font-semibold text-fuchsia-700 dark:text-fuchsia-400">Admin</p>
        <h1 className="text-xl font-semibold tracking-tight">Administration</h1>
        <p className="text-sm text-muted-foreground">Utilisateurs, profils, permissions et agences.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <SummaryCard label="Utilisateurs" value={users.data?.length ?? 0} />
        <SummaryCard label="Profils" value={roles.data?.length ?? 0} />
        <SummaryCard label="Permissions" value={permissionsQuery.data?.length ?? 0} />
      </div>

      <Tabs defaultValue="users" className="grid gap-4">
        <TabsList className="w-fit">
          <TabsTrigger value="users">Utilisateurs</TabsTrigger>
          <TabsTrigger value="roles">Profils & permissions</TabsTrigger>
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
            canUseGlobal={permissions.includes("config:manage")}
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

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="shadow-none">
      <CardContent className="flex items-center justify-between p-4">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="text-xl font-semibold">{value}</div>
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
  const [form, setForm] = useState<UpsertAdminUserRequest>(emptyUser(agencies[0]?.id, roles[0]?.id));
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!dialogOpen) return;
    setForm(editing ? userToForm(editing) : emptyUser(agencies[0]?.id, roles[0]?.id));
  }, [agencies, dialogOpen, editing, roles]);

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
              <TableHead>Profil</TableHead>
              <TableHead>Téléphone</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Dernière connexion</TableHead>
              <TableHead className="w-36" />
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
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" disabled={!canManage} onClick={() => { setEditing(item); setDialogOpen(true); }}>
                      <Edit className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" disabled={!canManage} onClick={() => setPasswordTarget(item)}>
                      <KeyRound className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" disabled={!canManage || item.id === currentUserId || !item.actif} onClick={() => deactivate.mutate(item.id)}>
                      <Trash2 className="size-4 text-red-500" />
                    </Button>
                  </div>
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
            <DialogDescription>Associez l'utilisateur à une agence et un profil.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <LabeledInput label="Prénom" value={form.prenom} onChange={(value) => setForm({ ...form, prenom: value })} />
            <LabeledInput label="Nom" value={form.nom} onChange={(value) => setForm({ ...form, nom: value })} />
            <LabeledInput label="Email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} />
            <LabeledInput label="Téléphone" value={form.telephone ?? ""} onChange={(value) => setForm({ ...form, telephone: value })} />
            <LabeledInput label={editing ? "Nouveau mot de passe" : "Mot de passe"} type="password" value={form.password ?? ""} onChange={(value) => setForm({ ...form, password: value })} />
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Agence</span>
              <Select value={form.agenceId ?? ""} onValueChange={(value) => setForm({ ...form, agenceId: value })}>
                <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>{agencies.map((agence) => <SelectItem key={agence.id} value={agence.id}>{agence.nom}</SelectItem>)}</SelectContent>
              </Select>
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Profil</span>
              <Select value={form.roleId} onValueChange={(value) => setForm({ ...form, roleId: value })}>
                <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>{roles.map((role) => <SelectItem key={role.id} value={role.id}>{role.nom}</SelectItem>)}</SelectContent>
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
    </div>
  );
}

function RolesPanel({
  roles,
  permissions,
  agencies,
  canManage,
  canUseGlobal,
  onChanged,
}: {
  roles: AdminRole[];
  permissions: AdminPermission[];
  agencies: AdminAgency[];
  canManage: boolean;
  canUseGlobal: boolean;
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
      toast.success("Profil enregistré");
    },
    onError: showError,
  });

  const remove = useMutation({
    mutationFn: (id: string) => adminApi.deleteRole(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "roles"] });
      onChanged();
      toast.success("Profil supprimé");
    },
    onError: showError,
  });

  return (
    <div className="grid gap-4 rounded-lg border bg-card p-4">
      <div className="flex justify-end">
        <Button disabled={!canManage} onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="size-4" />
          Ajouter profil
        </Button>
      </div>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Profil</TableHead>
              <TableHead>Agence</TableHead>
              <TableHead>Permissions</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="w-28" />
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
                <TableCell><Badge variant={role.profilSysteme ? "default" : "outline"}>{role.profilSysteme ? "Système" : "Custom"}</Badge></TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" disabled={!canManage} onClick={() => { setEditing(role); setDialogOpen(true); }}>
                      <Edit className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" disabled={!canManage || role.profilSysteme} onClick={() => remove.mutate(role.id)}>
                      <Trash2 className="size-4 text-red-500" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier profil" : "Ajouter profil"}</DialogTitle>
            <DialogDescription>Les permissions déterminent les modules visibles et les actions autorisées.</DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[70vh] gap-4 overflow-y-auto pr-1">
            <div className="grid gap-3 sm:grid-cols-2">
              <LabeledInput label="Code" value={form.code} onChange={(value) => setForm({ ...form, code: value })} />
              <LabeledInput label="Nom" value={form.nom} onChange={(value) => setForm({ ...form, nom: value })} />
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">Agence</span>
                <Select value={form.agenceId ?? GLOBAL_AGENCY} disabled={!canUseGlobal && agencies.length <= 1} onValueChange={(value) => setForm({ ...form, agenceId: value === GLOBAL_AGENCY ? undefined : value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {canUseGlobal ? <SelectItem value={GLOBAL_AGENCY}>Global</SelectItem> : null}
                    {agencies.map((agence) => <SelectItem key={agence.id} value={agence.id}>{agence.nom}</SelectItem>)}
                  </SelectContent>
                </Select>
              </label>
              <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <Checkbox checked={form.profilSysteme} disabled={!canUseGlobal} onCheckedChange={(checked) => setForm({ ...form, profilSysteme: Boolean(checked) })} />
                Profil système
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

  useEffect(() => {
    if (!dialogOpen) return;
    setForm(editing ? agencyToForm(editing) : emptyAgency());
  }, [dialogOpen, editing]);

  const save = useMutation({
    mutationFn: () => editing ? adminApi.updateAgency(editing.id, form) : adminApi.createAgency(form),
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
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {agencies.map((agence) => (
              <TableRow key={agence.id}>
                <TableCell>
                  <div className="font-medium">{agence.nom}</div>
                  <div className="text-xs text-muted-foreground">{agence.code}</div>
                </TableCell>
                <TableCell>{agence.ville ?? "-"}</TableCell>
                <TableCell>
                  <div>{agence.telephone ?? "-"}</div>
                  <div className="text-xs text-muted-foreground">{agence.email ?? "-"}</div>
                </TableCell>
                <TableCell><Badge variant={agence.statut === "ACTIVE" ? "default" : "outline"}>{agence.statut}</Badge></TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" disabled={!canManage} onClick={() => { setEditing(agence); setDialogOpen(true); }}>
                    <Edit className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier agence" : "Ajouter agence"}</DialogTitle>
            <DialogDescription>Les agences portent les utilisateurs, profils agence et données de production.</DialogDescription>
          </DialogHeader>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
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
  return { agenceId, code: "", nom: "", description: "", profilSysteme: false, permissionIds: [] };
}

function roleToForm(role: AdminRole): UpsertAdminRoleRequest {
  return {
    agenceId: role.agenceId ?? undefined,
    code: role.code,
    nom: role.nom,
    description: role.description ?? "",
    profilSysteme: role.profilSysteme,
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
