import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { LivraisonAttestation } from "../types";

type Props = {
  livraison: LivraisonAttestation | null;
  onClose: () => void;
};

export function AttestationDeliveryDetailsDialog({ livraison, onClose }: Props) {
  return (
    <Dialog open={Boolean(livraison)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
        {livraison ? (
          <>
            <DialogHeader>
              <DialogTitle>Détail de la livraison</DialogTitle>
              <DialogDescription>
                {livraison.referenceCommande ?? livraison.referenceBl ?? livraison.id} · {livraison.compagnieAssuranceNom}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-4">
              <Summary label="Demandé" value={livraison.quantiteDemandee} />
              <Summary label="Reçu" value={livraison.quantiteRecue} />
              <div className="rounded-md border bg-muted/20 p-3">
                <div className="text-xs font-medium uppercase text-muted-foreground">Statut</div>
                <div className="mt-1">
                  <Badge variant={statusVariant(livraison.statut)}>{statusLabel(livraison.statut)}</Badge>
                </div>
              </div>
              <div className="rounded-md border bg-muted/20 p-3">
                <div className="text-xs font-medium uppercase text-muted-foreground">Date</div>
                <div className="mt-1 text-lg font-semibold">
                  {formatDate(livraison.source === "COMMANDE" ? livraison.dateDemande : livraison.dateReception)}
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <div className="rounded-md border">
                <div className="border-b bg-muted/30 px-4 py-3 font-medium">Usages concernés</div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usage</TableHead>
                      <TableHead className="text-right">Demandé</TableHead>
                      <TableHead className="text-right">Reçu</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {livraison.lignes.map((ligne) => (
                      <TableRow key={ligne.id}>
                        <TableCell>
                          <div className="font-medium">{ligne.groupeUsageAttestationCode}</div>
                          <div className="text-xs text-muted-foreground">{ligne.groupeUsageAttestationLibelle}</div>
                        </TableCell>
                        <TableCell className="text-right">{ligne.quantiteDemandee}</TableCell>
                        <TableCell className="text-right font-medium">{ligne.quantiteRecue}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="rounded-md border">
                <div className="border-b bg-muted/30 px-4 py-3 font-medium">Lots et plages</div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usage</TableHead>
                      <TableHead>Préfixe</TableHead>
                      <TableHead>Plage</TableHead>
                      <TableHead className="text-right">Quantité</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {livraison.lots.map((lot) => (
                      <TableRow key={lot.id}>
                        <TableCell className="font-medium">{lot.groupeUsageAttestationCode}</TableCell>
                        <TableCell>{lot.prefixe}</TableCell>
                        <TableCell>{lot.numeroDebut} - {lot.numeroFin}</TableCell>
                        <TableCell className="text-right">{lot.quantite}</TableCell>
                      </TableRow>
                    ))}
                    {livraison.lots.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-20 text-center text-sm text-muted-foreground">
                          Aucun lot reçu.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Fermer</Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{new Intl.NumberFormat("fr-FR").format(value)}</div>
    </div>
  );
}

function statusVariant(statut: LivraisonAttestation["statut"]): BadgeProps["variant"] {
  if (statut === "VALIDEE") return "success";
  if (statut === "RECEPTION_COMPLETE") return "info";
  if (statut === "RECEPTION_PARTIELLE") return "warning";
  if (statut === "REFUSEE") return "destructive";
  return "outline";
}

function statusLabel(statut: LivraisonAttestation["statut"]) {
  return {
    DEMANDEE: "Demandée",
    REFUSEE: "Refusée",
    RECEPTION_PARTIELLE: "Réception partielle",
    RECEPTION_COMPLETE: "Réception complète",
    VALIDEE: "Validée",
  }[statut];
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}
