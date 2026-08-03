import { CheckCircle2, ClipboardList, Eye, PackagePlus, Truck } from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { LivraisonAttestation } from "../types";
import type { LivraisonSource } from "./AttestationDeliveryCreateDialog";

type Props = {
  source: LivraisonSource;
  rows: LivraisonAttestation[];
  loading?: boolean;
  selectedLivraisonId: string;
  validationPending: boolean;
  onView: (livraison: LivraisonAttestation) => void;
  onReceive: (livraison: LivraisonAttestation) => void;
  onValidate: (livraisonId: string) => void;
};

export function AttestationDeliveryTable({
  source,
  rows,
  loading = false,
  selectedLivraisonId,
  validationPending,
  onView,
  onReceive,
  onValidate,
}: Props) {
  const isDirectReception = source === "RECEPTION_DIRECTE";
  const columnCount = isDirectReception ? 5 : 7;

  return (
    <Card className="border-border/70 shadow-none">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          {source === "COMMANDE" ? <ClipboardList className="size-4" /> : <Truck className="size-4" />}
          {source === "COMMANDE" ? "Commandes" : "Réceptions"}
        </CardTitle>
        <Badge variant="outline">{rows.length}</Badge>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader className="bg-emerald-700 text-white [&_th]:text-white">
            <TableRow className="hover:bg-emerald-700">
              <TableHead>Référence</TableHead>
              <TableHead>Compagnie</TableHead>
              <TableHead>Usages</TableHead>
              {isDirectReception ? (
                <TableHead>Date de réception</TableHead>
              ) : (
                <>
                  <TableHead className="text-right">Lots</TableHead>
                  <TableHead>Reçu</TableHead>
                  <TableHead>Statut</TableHead>
                </>
              )}
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columnCount} className="h-24 text-center text-sm text-muted-foreground">
                  {source === "COMMANDE" ? "Chargement des commandes..." : "Chargement des réceptions..."}
                </TableCell>
              </TableRow>
            ) : rows.map((livraison) => (
              <TableRow key={livraison.id} className={selectedLivraisonId === livraison.id ? "bg-muted/50" : undefined}>
                <TableCell className="min-w-52 align-top">
                  <div className="font-medium">
                    {isDirectReception
                      ? livraison.referenceBl ?? livraison.referenceCommande ?? livraison.id
                      : livraison.referenceCommande ?? livraison.referenceBl ?? livraison.id}
                  </div>
                  {!isDirectReception ? (
                    <div className="mt-1 text-xs text-muted-foreground">{formatDate(livraison.dateDemande)}</div>
                  ) : null}
                </TableCell>
                <TableCell className="align-top">{livraison.compagnieAssuranceNom}</TableCell>
                <TableCell className="align-top">
                  <div className="flex max-w-xl flex-wrap gap-1.5">
                    {livraison.lignes.map((ligne) => (
                      <Badge key={ligne.id} variant="secondary">
                        {ligne.groupeUsageAttestationCode}{" "}
                        {isDirectReception
                          ? `· ${ligne.quantiteRecue}`
                          : `${ligne.quantiteRecue}/${ligne.quantiteDemandee}`}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                {isDirectReception ? (
                  <TableCell className="align-top">{formatDate(livraison.dateReception)}</TableCell>
                ) : (
                  <>
                    <TableCell className="text-right align-top">{livraison.lots.length}</TableCell>
                    <TableCell className="align-top">
                      {livraison.quantiteRecue}/{livraison.quantiteDemandee}
                    </TableCell>
                    <TableCell className="align-top">
                      <Badge variant={statusVariant(livraison.statut)}>{statusLabel(livraison.statut)}</Badge>
                    </TableCell>
                  </>
                )}
                <TableCell className="text-right align-top">
                  <div className="flex justify-end gap-2">
                    <Button type="button" size="icon" variant="ghost" onClick={() => onView(livraison)} aria-label="Voir le détail">
                      <Eye className="size-4" />
                    </Button>
                    {source === "COMMANDE" && !livraison.validee && livraison.quantiteRecue < livraison.quantiteDemandee ? (
                      <Button type="button" size="sm" variant="outline" onClick={() => onReceive(livraison)}>
                        <PackagePlus className="size-4" />
                        Réceptionner
                      </Button>
                    ) : null}
                    {source === "COMMANDE" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={livraison.validee || livraison.lots.length === 0 || validationPending}
                        onClick={() => onValidate(livraison.id)}
                      >
                        <CheckCircle2 className="size-4" />
                        Valider
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!loading && rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columnCount} className="h-24 text-center text-sm text-muted-foreground">
                  Aucun élément.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
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
