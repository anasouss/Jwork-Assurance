import type { RefObject } from "react";
import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AdminPermission } from "../types";
import { permissionPrerequisites } from "../permission-details";

type Props = {
  permission?: AdminPermission;
  catalogue: AdminPermission[];
  onClose: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
};

export function PermissionDetailsDialog({ permission, catalogue, onClose, triggerRef }: Props) {
  const prerequisites = permission ? permissionPrerequisites(permission, catalogue) : [];
  const prerequisiteCodes = new Set(prerequisites.map(item => item.code));
  const resource = permission?.resource ?? permission?.code.split(":")[0];
  const notGranted = catalogue.filter(item => (item.resource ?? item.code.split(":")[0]) === resource
    && item.code !== permission?.code && !prerequisiteCodes.has(item.code));
  const details = permission?.details;

  return <Dialog open={Boolean(permission)} onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="flex max-h-[85dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
      onCloseAutoFocus={event => { event.preventDefault(); triggerRef.current?.focus(); }}>
      <DialogHeader className="shrink-0 border-b p-5 pr-12 text-left">
        <DialogTitle className="flex items-start gap-2 text-lg leading-6"><Info className="mt-0.5 size-5 shrink-0 text-primary" />
          <span className="min-w-0 break-words">{permission?.resourceLabel ?? resource} : {permission?.actionLabel ?? permission?.nom}</span>
        </DialogTitle>
        <DialogDescription>Détail de l'autorisation et de ses limites.</DialogDescription>
        {permission?.sensitive && <Badge variant="outline" className="mt-2 w-fit">Action sensible</Badge>}
      </DialogHeader>
      <div className="min-h-0 space-y-5 overflow-y-auto p-5 text-sm leading-6">
        <section className="space-y-1" aria-labelledby="permission-location"><h3 id="permission-location" className="font-semibold">Où intervient cette permission ?</h3>
          <p className="break-words text-muted-foreground">{details?.page ?? permission?.resourceLabel ?? "Rubrique non précisée"}</p>
        </section>
        <section className="space-y-1" aria-labelledby="permission-allows"><h3 id="permission-allows" className="font-semibold">Ce qu'elle permet</h3>
          <p>{details?.allows ?? permission?.description ?? "Le détail de cette permission n'est pas encore disponible."}</p>
        </section>
        <section className="space-y-1" aria-labelledby="permission-excludes"><h3 id="permission-excludes" className="font-semibold">Ce qu'elle n'accorde pas automatiquement</h3>
          {notGranted.length > 0 ? <ul className="list-disc space-y-1 pl-5">{notGranted.map(item => <li key={item.code}>{item.actionLabel ?? item.nom}</li>)}</ul>
            : <p className="text-muted-foreground">Aucune autre autorisation indépendante n'est accordée par cette permission.</p>}
          <p className="text-muted-foreground">Ces droits peuvent être accordés séparément dans le rôle. Les autorisations des autres rubriques restent distinctes, sauf les prérequis ci-dessous.</p>
        </section>
        <section className="space-y-1" aria-labelledby="permission-requires"><h3 id="permission-requires" className="font-semibold">Permissions nécessaires</h3>
          {prerequisites.length > 0 ? <><ul className="list-disc space-y-1 pl-5">{prerequisites.map(item => <li key={item.code}>{item.label}</li>)}</ul>
            <p className="text-muted-foreground">Ces prérequis sont ajoutés à la sélection avec cette permission.</p></>
            : <p className="text-muted-foreground">Aucun prérequis de permission supplémentaire déclaré.</p>}
        </section>
        {details && <section className="space-y-1" aria-labelledby="permission-restrictions"><h3 id="permission-restrictions" className="font-semibold">Conditions et limites</h3>
          <ul className="list-disc space-y-2 pl-5">{details.restrictions.map(restriction => <li key={restriction}>{restriction}</li>)}</ul>
        </section>}
        {details?.example && <section className="space-y-1 border-t pt-4" aria-labelledby="permission-example"><h3 id="permission-example" className="font-semibold">Exemple concret</h3><p>{details.example}</p></section>}
        {permission?.assignable === false && <p className="border-t pt-4 text-muted-foreground">Vous pouvez consulter cette explication, mais vous n'êtes pas autorisé à attribuer cette permission.</p>}
        <p className="break-all text-xs text-muted-foreground">Code : <code>{permission?.code}</code></p>
      </div>
      <DialogFooter className="shrink-0 border-t px-5 py-3"><Button type="button" variant="outline" onClick={onClose}>Fermer</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
