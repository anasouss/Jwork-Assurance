import { type FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, KeyRound, Laptop, LogOut, MonitorSmartphone, ShieldCheck, Smartphone, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { getSessionId } from "@/lib/auth";
import { authApi } from "@/lib/api/auth";
import type { AuthSession } from "@/lib/types";
import { useAuthStore } from "@/store/auth-store";

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const { user, logout } = useAuthStore();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [sessionToRevoke, setSessionToRevoke] = useState<AuthSession | null>(null);
  const [revokeOthersOpen, setRevokeOthersOpen] = useState(false);
  const currentSessionId = getSessionId();

  const sessionsQuery = useQuery({
    queryKey: ["auth", "sessions"],
    queryFn: authApi.sessions,
  });

  const passwordMutation = useMutation({
    mutationFn: authApi.changePassword,
    onSuccess: async () => {
      toast.success("Mot de passe modifié");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      await logout();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Mot de passe impossible à modifier");
    },
  });

  const revokeMutation = useMutation({
    mutationFn: authApi.revokeSession,
    onSuccess: async () => {
      toast.success("Session révoquée");
      setSessionToRevoke(null);
      await queryClient.invalidateQueries({ queryKey: ["auth", "sessions"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Session impossible à révoquer");
    },
  });

  const revokeOthersMutation = useMutation({
    mutationFn: authApi.revokeOtherSessions,
    onSuccess: async () => {
      toast.success("Les autres sessions ont été révoquées");
      setRevokeOthersOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["auth", "sessions"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Sessions impossibles à révoquer");
    },
  });

  const fullName = user?.fullName || user?.email || "Utilisateur";
  const initials = initialsFor(fullName);
  const permissionCount = user?.permissions.length ?? 0;
  const sortedSessions = useMemo(() => {
    return [...(sessionsQuery.data ?? [])].sort((a, b) => Number(isCurrentSession(b, currentSessionId)) - Number(isCurrentSession(a, currentSessionId)));
  }, [currentSessionId, sessionsQuery.data]);

  const handlePasswordSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (newPassword.length < 8) {
      toast.error("Le nouveau mot de passe doit contenir au moins 8 caractères");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("La confirmation ne correspond pas au nouveau mot de passe");
      return;
    }
    passwordMutation.mutate({ currentPassword, newPassword });
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-muted/30 p-4 sm:p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <div className="flex flex-col gap-1">
          <div className="text-sm font-semibold text-primary">Compte</div>
          <h1 className="text-2xl font-semibold tracking-tight">Profil utilisateur</h1>
          <p className="text-sm text-muted-foreground">Informations du compte, sécurité et sessions actives.</p>
        </div>

        <Card className="overflow-hidden">
          <div className="flex flex-col gap-5 border-b bg-gradient-to-r from-primary/10 via-amber-50 to-background p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="size-16 border bg-background shadow-sm">
                <AvatarFallback className="bg-primary text-lg font-semibold text-primary-foreground">{initials || <UserRound className="size-6" />}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-xl font-semibold">{fullName}</h2>
                  <Badge variant="success">Actif</Badge>
                </div>
                <div className="text-sm text-muted-foreground">{user?.email}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="outline">{user?.roleName ?? user?.roleCode ?? "Rôle"}</Badge>
                  <Badge variant="outline">{user?.agenceName ?? "Agence"}</Badge>
                </div>
              </div>
            </div>
            <Button variant="outline" onClick={() => void logout()}>
              <LogOut className="size-4" />
              Déconnexion
            </Button>
          </div>

          <CardContent className="grid gap-5 p-5 lg:grid-cols-[1fr_1fr]">
            <section className="rounded-lg border bg-background">
              <div className="p-5">
                <h3 className="font-semibold">Informations du compte</h3>
                <p className="mt-1 text-sm text-muted-foreground">Données de session liées à votre utilisateur.</p>
              </div>
              <div className="grid gap-3 px-5 pb-5">
                <ProfileField label="Email" value={user?.email} />
                <ProfileField label="Rôle" value={user?.roleName ?? user?.roleCode} />
                <ProfileField label="Agence" value={user?.agenceName ?? user?.agenceId} />
                <ProfileField label="Permissions" value={`${permissionCount} permission(s)`} />
              </div>
            </section>

            <section className="rounded-lg border bg-background">
              <div className="p-5">
                <h3 className="flex items-center gap-2 font-semibold">
                  <KeyRound className="size-4" />
                  Sécurité
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">Après modification du mot de passe, une nouvelle connexion sera demandée.</p>
              </div>
              <div className="px-5 pb-5">
                <form className="grid gap-3" onSubmit={handlePasswordSubmit}>
                  <div className="grid gap-1.5">
                    <Label htmlFor="current-password">Mot de passe actuel</Label>
                    <Input id="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="new-password">Nouveau mot de passe</Label>
                    <Input id="new-password" type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
                    <Input id="confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
                  </div>
                  <Button className="mt-2 justify-self-end" disabled={passwordMutation.isPending || currentPassword.length === 0 || newPassword.length < 8 || confirmPassword.length === 0}>
                    Enregistrer
                  </Button>
                </form>
              </div>
            </section>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="grid gap-1.5">
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="size-4" />
                  Sessions actives
                </CardTitle>
                <CardDescription>Révoquez les accès ouverts sur d'autres appareils si nécessaire.</CardDescription>
              </div>
              {sortedSessions.length > 1 ? (
                <Button type="button" variant="outline" size="sm" onClick={() => setRevokeOthersOpen(true)}>
                  <LogOut className="size-4" />
                  Révoquer les autres
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="grid gap-3">
            {sessionsQuery.isLoading ? (
              Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-20 rounded-lg" />)
            ) : sortedSessions.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Aucune session active.</div>
            ) : (
              sortedSessions.map((session) => {
                const current = isCurrentSession(session, currentSessionId);
                return (
                  <div key={session.id} className="flex flex-col gap-3 rounded-lg border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="rounded-lg bg-primary/10 p-2 text-primary">{sessionIcon(session.deviceType)}</div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-semibold">{session.deviceName || session.deviceType || "Appareil inconnu"}</div>
                          {current ? <Badge variant="success">Session actuelle</Badge> : null}
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">{session.ipAddress || "IP non renseignée"}</div>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <CalendarClock className="size-3.5" />
                            Dernière activité: {formatDateTime(session.lastActivityAt)}
                          </span>
                          <span>Créée le {formatDateTime(session.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" disabled={current || revokeMutation.isPending} onClick={() => setSessionToRevoke(session)}>
                      <Trash2 className="size-4 text-red-500" />
                      Révoquer
                    </Button>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={Boolean(sessionToRevoke)} onOpenChange={(open) => !open && setSessionToRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Révoquer cette session ?</AlertDialogTitle>
            <AlertDialogDescription>
              L'accès sera fermé pour {sessionToRevoke?.deviceName || "cet appareil"}. L'utilisateur devra se reconnecter.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={(event) => {
                event.preventDefault();
                if (sessionToRevoke) {
                  revokeMutation.mutate(String(sessionToRevoke.id));
                }
              }}
            >
              Révoquer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={revokeOthersOpen} onOpenChange={setRevokeOthersOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Révoquer toutes les autres sessions ?</AlertDialogTitle>
            <AlertDialogDescription>
              Tous les autres navigateurs et appareils devront se reconnecter. Cette session restera active.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={revokeOthersMutation.isPending}
              onClick={() => revokeOthersMutation.mutate()}
            >
              Révoquer les autres
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ProfileField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium">{value || "-"}</div>
      <Separator className="mt-3" />
    </div>
  );
}

function isCurrentSession(session: AuthSession, currentSessionId: string | null) {
  return session.current || (currentSessionId != null && String(session.id) === currentSessionId);
}

function initialsFor(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function sessionIcon(deviceType?: string | null) {
  const type = (deviceType ?? "").toLowerCase();
  if (type.includes("mobile") || type.includes("phone")) {
    return <Smartphone className="size-5" />;
  }
  if (type.includes("desktop") || type.includes("browser")) {
    return <MonitorSmartphone className="size-5" />;
  }
  return <Laptop className="size-5" />;
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}
