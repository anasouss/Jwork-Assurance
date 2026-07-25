import { Children, Fragment, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, FilePlus2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuthStore } from "@/store/auth-store";
import { productionApi } from "../api";
import type { ContratSummary } from "../types";
import type { ReactNode } from "react";

export default function ContratsPage() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const canCreateContrat = useAuthStore((state) => state.user?.permissions?.includes("contrat:create") ?? false);
  const contrats = useQuery({ queryKey: ["contrats"], queryFn: productionApi.listContrats });

  return (
    <Card className="border-border/70 shadow-none">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Contrats</CardTitle>
        {canCreateContrat ? (
          <Button asChild size="sm">
            <Link to="/app/production/ajouter-dossier">
              <FilePlus2 className="size-4" />
              Ajouter dossier
            </Link>
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>N° dossier</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Assuré</TableHead>
              <TableHead>Produit</TableHead>
              <TableHead>Mouv.</TableHead>
              <TableHead>N° police</TableHead>
              <TableHead>Événement</TableHead>
              <TableHead>Effet</TableHead>
              <TableHead>Échéance</TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(contrats.data ?? []).map((contrat) => {
              const mouvements = sortedMouvements(contrat);
              const dernierMouvement = mouvements[0];
              const isExpanded = Boolean(expanded[contrat.id]);
              return (
                <Fragment key={contrat.id}>
                  <TableRow>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => setExpanded((current) => ({ ...current, [contrat.id]: !isExpanded }))}
                        disabled={mouvements.length === 0 && !hasDetails(contrat)}
                      >
                        {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                      </Button>
                    </TableCell>
                    <TableCell className="font-medium">{contrat.numeroContrat}</TableCell>
                    <TableCell><TypeBadge type={contrat.typeContrat} /></TableCell>
                    <TableCell>{mainClient(contrat)}</TableCell>
                    <TableCell>{productLabel(contrat)}</TableCell>
                    <TableCell>{Math.max(mouvements.length, 1)}</TableCell>
                    <TableCell>{contrat.numeroPolice ?? "-"}</TableCell>
                    <TableCell>
                      <div className="font-medium">{dernierMouvement?.libelle ?? "Affaire nouvelle"}</div>
                      <div className="text-xs text-muted-foreground">{dernierMouvement?.code ?? "AN"}</div>
                    </TableCell>
                    <TableCell>{dernierMouvement?.dateEffet ?? contrat.dateEffet ?? "-"}</TableCell>
                    <TableCell>{dernierMouvement?.dateEcheance ?? contrat.dateEcheance ?? "-"}</TableCell>
                    <TableCell><Badge variant="outline">{statusLabel(contrat, dernierMouvement)}</Badge></TableCell>
                  </TableRow>
                  {isExpanded ? (
                    <TableRow>
                      <TableCell colSpan={11} className="bg-muted/25 p-4">
                        <ContratExpandedDetails contrat={contrat} mouvements={mouvements} />
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ContratExpandedDetails({ contrat, mouvements }: { contrat: ContratSummary; mouvements: NonNullable<ContratSummary["mouvements"]> }) {
  return (
    <div className="grid gap-4">
      <div>
        <div className="mb-2 text-sm font-semibold">Mouvements</div>
        <div className="overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Libellé</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Effet</TableHead>
                <TableHead>Échéance</TableHead>
                <TableHead>Prime totale</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(mouvements.length ? mouvements : [{
                id: contrat.id,
                code: "AN",
                libelle: "Affaire nouvelle",
                categorie: "AFFAIRE_NOUVELLE",
                dateEffet: contrat.dateEffet,
                dateEcheance: contrat.dateEcheance,
                primeTotale: contrat.primeTotale,
                statut: contrat.statut,
              }]).map((mouvement) => (
                <TableRow key={mouvement.id}>
                  <TableCell>{mouvement.code ?? "-"}</TableCell>
                  <TableCell>{mouvement.libelle ?? "-"}</TableCell>
                  <TableCell>{mouvement.categorie ?? "-"}</TableCell>
                  <TableCell>{mouvement.dateEffet ?? "-"}</TableCell>
                  <TableCell>{mouvement.dateEcheance ?? "-"}</TableCell>
                  <TableCell>{money(mouvement.primeTotale)}</TableCell>
                  <TableCell>{mouvement.statut ?? "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <DetailBlock title="Clients" empty="Aucun client">
          {contrat.clients?.map((client) => (
            <div key={`${client.clientId}-${client.role}`} className="rounded-md border p-2">
              <div className="font-medium">{client.nomAffichage}</div>
              <div className="text-xs text-muted-foreground">{client.role}{client.principalPourRole ? " principal" : ""}</div>
            </div>
          ))}
        </DetailBlock>
        <DetailBlock title="Véhicules / remorques" empty="Aucun véhicule">
          {contrat.vehicules?.map((vehicule) => (
            <div key={vehicule.vehiculeId} className="rounded-md border p-2">
              <div className="font-medium">{vehicule.immatriculation ?? "Sans immatriculation"}</div>
              <div className="text-xs text-muted-foreground">{vehicule.usageCode} {vehicule.marque} {vehicule.modele}</div>
            </div>
          ))}
          {contrat.remorques?.map((remorque) => (
            <div key={remorque.remorqueId} className="rounded-md border border-dashed p-2">
              <div className="font-medium">Remorque {remorque.immatriculation ?? ""}</div>
              <div className="text-xs text-muted-foreground">{remorque.usageCode} {remorque.marque} {remorque.modele}</div>
            </div>
          ))}
        </DetailBlock>
        <DetailBlock title="Garanties" empty="Aucune garantie">
          {contrat.garanties?.map((garantie) => (
            <div key={garantie.contratGarantieId} className="rounded-md border p-2">
              <div className="font-medium">{garantie.code ? `${garantie.code} - ` : ""}{garantie.libelle}</div>
              <div className="text-xs text-muted-foreground">
                Prime {money(garantie.prime)} · Capital {money(garantie.capital)}
              </div>
            </div>
          ))}
        </DetailBlock>
      </div>

      {contrat.elementsFacturables?.length ? (
        <div>
          <div className="mb-2 text-sm font-semibold">Quittances / éléments facturables</div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {contrat.elementsFacturables.map((element) => (
              <div key={element.id} className="rounded-md border p-2">
                <div className="font-medium">{element.libelle}</div>
                <div className="text-xs text-muted-foreground">
                  {element.codeMouvement ?? element.nature} · {element.statut} · {money(element.primeTotale)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DetailBlock({ title, empty, children }: { title: string; empty: string; children?: ReactNode }) {
  const hasChildren = Children.count(children) > 0;
  return (
    <div>
      <div className="mb-2 text-sm font-semibold">{title}</div>
      <div className="grid gap-2">{hasChildren ? children : <div className="text-sm text-muted-foreground">{empty}</div>}</div>
    </div>
  );
}

function sortedMouvements(contrat: ContratSummary) {
  return [...(contrat.mouvements ?? [])].sort((a, b) => dateRank(b.dateEffet) - dateRank(a.dateEffet));
}

function dateRank(value?: string | null) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function hasDetails(contrat: ContratSummary) {
  return Boolean(
    contrat.clients?.length ||
    contrat.vehicules?.length ||
    contrat.remorques?.length ||
    contrat.garanties?.length ||
    contrat.elementsFacturables?.length
  );
}

function mainClient(contrat: ContratSummary) {
  return contrat.clients?.find((client) => client.role === "SOUSCRIPTEUR")?.nomAffichage
    ?? contrat.clients?.[0]?.nomAffichage
    ?? "-";
}

function productLabel(contrat: ContratSummary) {
  if (contrat.typeContrat === "PARTICULIER") return "Mono";
  if (contrat.typeContrat === "FLOTTE") return "Flotte";
  return "Convention";
}

function statusLabel(
  contrat: ContratSummary,
  mouvement?: NonNullable<ContratSummary["mouvements"]>[number]
) {
  if (mouvement?.code?.startsWith("RES")) return "Résilié";
  return mouvement?.statut ?? contrat.statut;
}

function TypeBadge({ type }: { type: ContratSummary["typeContrat"] }) {
  const label = type === "PARTICULIER" ? "P" : type === "FLOTTE" ? "F" : "C";
  return <Badge variant="secondary">{label}</Badge>;
}

function money(value?: number | null) {
  if (value == null) return "-";
  return new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD" }).format(value);
}
