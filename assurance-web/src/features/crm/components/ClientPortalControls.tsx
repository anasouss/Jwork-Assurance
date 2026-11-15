import { useId, useState, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { Eye, EyeOff, Loader2, RefreshCw } from "lucide-react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ServerPagination } from "@/components/shared/server-pagination";
import type { ClientResponse, PageMetadata } from "@/features/production/types";
import { portalApi, type PortalAccount } from "../client-portal-api";
import { defaultPortalIdentifier, portalPasswordError } from "../client-portal-form";

export function PortalFeedback({ pending, error, retry }: { pending?: boolean; error?: Error | null; retry: () => void }) {
  if (pending) return <div role="status" className="flex min-h-20 items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
    <Loader2 className="size-4 animate-spin" />Chargement...
  </div>;
  if (error) return <div role="alert" className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm text-destructive">
    <p className="min-w-0 break-words">{error.message}</p>
    <Button variant="outline" size="sm" onClick={retry}><RefreshCw className="size-4" />Réessayer</Button>
  </div>;
  return null;
}

export function PortalPager({ metadata, pending, onChange }: { metadata?: PageMetadata; pending?: boolean; onChange: (page: number) => void }) {
  return metadata ? <ServerPagination className="border-t px-3 py-3" page={metadata.number}
    totalPages={metadata.totalPages} totalElements={metadata.totalElements} loading={pending} onPageChange={onChange} /> : null;
}

export function PortalField({ id, label, required, children }: { id: string; label: string; required?: boolean; children: ReactNode }) {
  return <div className="grid min-w-0 gap-1.5">
    <Label htmlFor={id}>{label}{required && <span aria-hidden="true" className="ml-1 text-destructive">*</span>}</Label>
    {children}
  </div>;
}

export function PortalConfirm({ title, description, pending, error, onClose, onConfirm, destructive = true }: {
  title: string; description: string; pending: boolean; error?: Error | null;
  onClose: () => void; onConfirm: () => void; destructive?: boolean;
}) {
  return <Dialog open onOpenChange={open => { if (!open && !pending) onClose(); }}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
      {error && <p role="alert" className="break-words text-sm text-destructive">{error.message}</p>}
      <DialogFooter>
        <Button variant="outline" disabled={pending} onClick={onClose}>Annuler</Button>
        <Button variant={destructive ? "destructive" : "default"} disabled={pending} onClick={onConfirm}>
          {pending && <Loader2 className="size-4 animate-spin" />}Confirmer
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}

function PasswordField({ id, label, value, onChange, disabled }: {
  id: string; label: string; value: string; onChange: (value: string) => void; disabled: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return <PortalField id={id} label={label} required>
    <div className="relative">
      <Input id={id} type={visible ? "text" : "password"} value={value} onChange={e => onChange(e.target.value)}
        autoComplete="new-password" required minLength={12} maxLength={72} disabled={disabled} className="pr-11" />
      <Button type="button" variant="ghost" size="icon-sm" className="absolute right-1 top-1/2 -translate-y-1/2"
        disabled={disabled} onClick={() => setVisible(!visible)}
        title={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </Button>
    </div>
  </PortalField>;
}

export function PortalPasswordDialog({ client, account, onClose, onChanged }: {
  client: ClientResponse; account?: PortalAccount; onClose: () => void; onChanged: () => Promise<void>;
}) {
  const uid = useId();
  const [identifier, setIdentifier] = useState(() => defaultPortalIdentifier(client));
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [validation, setValidation] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => account ? portalApi.password(account.id, password) : portalApi.create(client.id, identifier.trim(), password),
    gcTime: 0,
    onSuccess: async () => {
      setPassword(""); setConfirmation("");
      onClose();
      toast.success(account ? "Mot de passe réinitialisé" : "Compte client créé");
      await onChanged();
    },
  });
  return <Dialog open onOpenChange={open => { if (!open && !save.isPending) onClose(); }}>
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{account ? "Réinitialiser le mot de passe" : "Créer le compte client"}</DialogTitle>
        <DialogDescription>{client.nomAffichage || client.raisonSociale || [client.prenom, client.nom].filter(Boolean).join(" ")}</DialogDescription>
      </DialogHeader>
      <form className="grid gap-4" onSubmit={event => {
        event.preventDefault();
        const error = portalPasswordError(password, confirmation);
        setValidation(error);
        if (!error) save.mutate();
      }}>
        {account ? <dl className="text-sm"><dt className="text-muted-foreground">Identifiant</dt><dd className="break-all font-medium">{account.identifiant}</dd></dl>
          : <PortalField id={uid + "-login"} label="Identifiant CIN / RC" required>
            <Input id={uid + "-login"} value={identifier} onChange={e => setIdentifier(e.target.value)}
              autoComplete="off" maxLength={120} required disabled={save.isPending} />
          </PortalField>}
        <PasswordField id={uid + "-password"} label={account ? "Nouveau mot de passe temporaire" : "Mot de passe temporaire"}
          value={password} onChange={value => { setPassword(value); setValidation(null); }} disabled={save.isPending} />
        <PasswordField id={uid + "-confirmation"} label="Confirmer le mot de passe"
          value={confirmation} onChange={value => { setConfirmation(value); setValidation(null); }} disabled={save.isPending} />
        {(validation || save.error) && <p role="alert" className="break-words text-sm text-destructive">{validation || save.error?.message}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={save.isPending} onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={save.isPending || (!account && !identifier.trim())}>
            {save.isPending && <Loader2 className="size-4 animate-spin" />}{account ? "Réinitialiser" : "Créer le compte"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
