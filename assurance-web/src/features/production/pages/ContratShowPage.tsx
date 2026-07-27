import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Car, FileText, Printer, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { productionApi } from "../api";
import { formatMoney, moneyAmount, text } from "../utils/format";
import type { ClientResponse, ContratSummary, ReferenceOption } from "../types";

type Garantie = NonNullable<ContratSummary["garanties"]>[number];
type Vehicule = NonNullable<ContratSummary["vehicules"]>[number];
type Remorque = NonNullable<ContratSummary["remorques"]>[number];

export default function ContratShowPage() {
  const { contratId = "" } = useParams();
  const contratQuery = useQuery({
    queryKey: ["contrat", contratId],
    queryFn: () => productionApi.getContrat(contratId),
    enabled: Boolean(contratId),
  });
  const compagniesQuery = useQuery({
    queryKey: ["referentiel", "compagnies-assurance", "contrat-show"],
    queryFn: () => productionApi.referentiel("compagnies-assurance"),
  });
  const conventionsQuery = useQuery({
    queryKey: ["referentiel", "conventions", "contrat-show"],
    queryFn: () => productionApi.referentiel("conventions"),
  });

  if (contratQuery.isLoading) {
    return <Card><CardContent className="p-8 text-center text-muted-foreground">Chargement du dossier...</CardContent></Card>;
  }

  if (!contratQuery.data) {
    return <Card><CardContent className="p-8 text-center text-muted-foreground">Dossier introuvable.</CardContent></Card>;
  }

  const contrat = contratQuery.data;
  const dossier = contrat.numeroDossier ?? contrat.numeroContrat ?? `#${contrat.id}`;
  const souscripteur = clientByRole(contrat, "SOUSCRIPTEUR");
  const proprietaire = clientByRole(contrat, "PROPRIETAIRE") ?? souscripteur;
  const sameClient = sameClientIdentity(souscripteur, proprietaire);
  const compagnie = optionLabel(compagniesQuery.data, contrat.compagnieAssuranceId);
  const convention = optionLabel(conventionsQuery.data, contrat.conventionId);

  return (
    <div className="grid min-w-0 gap-4">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/app/production/contrats"><ArrowLeft className="size-4" />Retour liste</Link>
        </Button>
        <div className="flex items-center gap-2">
          <Badge className="bg-emerald-600">{statusLabel(contrat.statut)}</Badge>
          <Button type="button" onClick={() => window.print()}>
            <Printer className="size-4" />
            Télécharger PDF
          </Button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[980px] rounded-md border bg-white p-6 text-slate-950 shadow-sm print:max-w-none print:border-0 print:p-0 print:shadow-none">
        <header className="border-b-2 border-slate-900 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Fiche synthèse</p>
              <h1 className="mt-1 text-2xl font-bold">Dossier N° {dossier}</h1>
              <p className="mt-1 text-sm text-slate-600">{productLabel(contrat)} · Automobile</p>
            </div>
            <div className="text-right text-sm">
              <p className="font-semibold">{text(contrat.numeroPolice)}</p>
              <p className="text-slate-600">Police N°</p>
            </div>
          </div>
        </header>

        <main className="mt-5 grid gap-5">
          <Section title="Contrat" icon={<FileText className="size-4" />}>
            <InfoGrid
              items={[
                ["Nature", latestEvent(contrat)],
                ["Produit", productLabel(contrat)],
                ["Compagnie", compagnie],
                ...(contrat.typeContrat === "CONVENTION" ? [["Convention", convention] as [string, ReactNode]] : []),
                ["N° police", text(contrat.numeroPolice)],
                ["N° attestation", firstAttestation(contrat)],
                ["Date d'effet", formatDate(contrat.dateEffet)],
                ["Date d'échéance", formatDate(contrat.dateEcheance)],
                ["Type client", clientTypeLabel(souscripteur)],
                ["Fractionnement", text(contrat.fractionnement)],
              ]}
            />
          </Section>

          <Section title="Clients" icon={<UserRound className="size-4" />}>
            {sameClient ? (
              <ClientCard title="Souscripteur et propriétaire" client={souscripteur} />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                <ClientCard title="Souscripteur" client={souscripteur} />
                <ClientCard title="Propriétaire" client={proprietaire} />
              </div>
            )}
          </Section>

          {(contrat.vehicules ?? []).map((vehicule, index) => (
            <VehicleSection
              key={vehicule.vehiculeId ?? index}
              contrat={contrat}
              vehicule={vehicule}
              index={index}
            />
          ))}

          {(contrat.remorques ?? []).map((remorque, index) => (
            <RemorqueSection
              key={remorque.remorqueId ?? index}
              contrat={contrat}
              remorque={remorque}
              index={index}
            />
          ))}

          <PersonnesSection garanties={personneGaranties(contrat)} />
          <QuittanceSection contrat={contrat} />
        </main>
      </div>
    </div>
  );
}

function VehicleSection({ contrat, vehicule, index }: { contrat: ContratSummary; vehicule: Vehicule; index: number }) {
  const garanties = (contrat.garanties ?? []).filter((garantie) => String(garantie.vehiculeId ?? "") === String(vehicule.vehiculeId));
  return (
    <Section title={`Véhicule ${index + 1}`} icon={<Car className="size-4" />}>
      <InfoGrid
        items={[
          ["Usage", [vehicule.usageCode, vehicule.usageLibelle].filter(Boolean).join(" - ")],
          ["Marque", text(vehicule.marque)],
          ["Immatriculation", text(vehicule.immatriculation)],
          ["Carburant", text(vehicule.carburant)],
          ["Puissance fiscale", text(vehicule.puissanceFiscale)],
          ["Date de MC", formatDate(vehicule.datePremiereCirculation)],
          ["Carrosserie", text(vehicule.carrosserie)],
          ["Nombre de places", text(vehicule.nombrePlaces)],
          ["CRM", text(vehicule.crm)],
          ["Valeur à neuf", formatOptionalAmount(vehicule.valeurNeuf)],
          ["Valeur vénale", formatOptionalAmount(vehicule.valeurVenale)],
          ["Valeur glaces", formatOptionalAmount(vehicule.valeurGlace)],
        ]}
      />
      <GarantiesTable garanties={garanties} />
    </Section>
  );
}

function RemorqueSection({ contrat, remorque, index }: { contrat: ContratSummary; remorque: Remorque; index: number }) {
  const garanties = (contrat.garanties ?? []).filter((garantie) => String(garantie.remorqueId ?? "") === String(remorque.remorqueId));
  return (
    <Section title={`Remorque ${index + 1}`} icon={<Car className="size-4" />}>
      <InfoGrid
        items={[
          ["Usage", [remorque.usageCode, remorque.usageLibelle].filter(Boolean).join(" - ")],
          ["Marque", text(remorque.marque)],
          ["Immatriculation", text(remorque.immatriculation)],
          ["PTC", text(remorque.ptc)],
          ["Date de MC", formatDate(remorque.dateMiseEnCirculation)],
          ["Valeur assurée", formatOptionalAmount(remorque.valeurAssuree)],
        ]}
      />
      <GarantiesTable garanties={garanties} />
    </Section>
  );
}

function PersonnesSection({ garanties }: { garanties: Garantie[] }) {
  if (!garanties.length) return null;
  return (
    <Section title="Protection personnes">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-100">
            <TableHead>Garantie</TableHead>
            <TableHead>Formule</TableHead>
            <TableHead className="text-right">Décès</TableHead>
            <TableHead className="text-right">Invalidité</TableHead>
            <TableHead className="text-right">Frais médicaux</TableHead>
            <TableHead className="text-right">Prime nette</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {garanties.map((garantie) => (
            <TableRow key={garantie.contratGarantieId}>
              <TableCell className="font-medium">{garantieLabel(garantie)}</TableCell>
              <TableCell>{text(garantie.formule)}</TableCell>
              <TableCell className="text-right">{amountOrDash(garantie.montantDeces)}</TableCell>
              <TableCell className="text-right">{amountOrDash(garantie.montantInvalidite)}</TableCell>
              <TableCell className="text-right">{amountOrDash(garantie.montantFraisMedicaux)}</TableCell>
              <TableCell className="text-right font-semibold">{formatMoney(garantie.prime)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Section>
  );
}

function GarantiesTable({ garanties }: { garanties: Garantie[] }) {
  const vehiculeGaranties = garanties.filter((garantie) => String(garantie.typeGarantie ?? "").toUpperCase() !== "PERSONNE");
  if (!vehiculeGaranties.length) return null;
  return (
    <div className="mt-4 overflow-hidden rounded-md border">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-100">
            <TableHead>Garantie assurée</TableHead>
            <TableHead className="text-right">Valeur assurée</TableHead>
            <TableHead className="text-right">Taux</TableHead>
            <TableHead>Franchise</TableHead>
            <TableHead className="text-right">Prime nette</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {vehiculeGaranties.map((garantie) => (
            <TableRow key={garantie.contratGarantieId}>
              <TableCell className="font-medium">{garantieLabel(garantie)}</TableCell>
              <TableCell className="text-right">{formatOptionalAmount(garantie.capital ?? garantie.valeurAssuree)}</TableCell>
              <TableCell className="text-right">{garantie.taux == null ? "-" : `${moneyAmount(garantie.taux)} %`}</TableCell>
              <TableCell>{franchiseLabel(garantie)}</TableCell>
              <TableCell className="text-right font-semibold">{formatMoney(garantie.prime)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function QuittanceSection({ contrat }: { contrat: ContratSummary }) {
  const lignes = (contrat.quittanceGenerale?.lignes ?? []).filter((ligne) => {
    const categorie = String(ligne.categorie ?? "").toUpperCase();
    return categorie !== "CORPOREL" || personneGaranties(contrat).length > 0;
  });
  if (!lignes.length) return null;
  return (
    <Section title="Quittance générale">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-100">
            <TableHead>Catégorie</TableHead>
            <TableHead className="text-right">P. nette</TableHead>
            <TableHead className="text-right">Taxes</TableHead>
            <TableHead className="text-right">TPF</TableHead>
            <TableHead className="text-right">Accessoires</TableHead>
            <TableHead className="text-right">CNPAC</TableHead>
            <TableHead className="text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lignes.map((ligne) => (
            <TableRow key={`${ligne.categorie}-${ligne.ordre}`} className={ligne.globale ? "font-bold" : ""}>
              <TableCell>{ligne.globale ? "Total général" : ligne.categorie}</TableCell>
              <TableCell className="text-right">{formatMoney(ligne.primeNette)}</TableCell>
              <TableCell className="text-right">{formatMoney(ligne.taxe)}</TableCell>
              <TableCell className="text-right">{formatMoney(ligne.taxeParafiscale)}</TableCell>
              <TableCell className="text-right">{formatMoney(ligne.accessoire)}</TableCell>
              <TableCell className="text-right">{formatMoney(ligne.cnpac)}</TableCell>
              <TableCell className="text-right">{formatMoney(ligne.primeTotale)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Section>
  );
}

function Section({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-md border border-slate-200">
      <div className="flex items-center gap-2 border-l-4 border-emerald-600 bg-slate-100 px-3 py-2 text-sm font-bold uppercase text-slate-900">
        {icon}
        {title}
      </div>
      <div className="p-3">{children}</div>
    </section>
  );
}

function InfoGrid({ items }: { items: [string, ReactNode][] }) {
  return (
    <div className="grid gap-x-6 md:grid-cols-3">
      {items.map(([label, value]) => (
        <div key={label} className="grid grid-cols-[110px_1fr] gap-2 border-b border-dashed border-slate-200 py-2 text-xs">
          <span className="font-bold uppercase text-slate-500">{label}</span>
          <span className="font-semibold text-slate-950">{isBlankNode(value) ? "-" : value}</span>
        </div>
      ))}
    </div>
  );
}

function ClientCard({ title, client }: { title: string; client?: ClientResponse | null }) {
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <p className="text-xs font-bold uppercase text-emerald-700">{title}</p>
      <p className="mt-1 text-base font-bold">{clientName(client)}</p>
      <div className="mt-2 grid gap-1 text-xs text-slate-700">
        <p>{clientIdentity(client)}</p>
        <p>{text(client?.adresse)}{client?.ville ? `, ${client.ville}` : ""}</p>
        <p>Tél: {text(client?.telephone ?? client?.telephones?.find((tel) => tel.principal)?.numero)}</p>
      </div>
    </div>
  );
}

function clientByRole(contrat: ContratSummary, role: string) {
  return contrat.clients?.find((item) => item.role === role)?.client ?? null;
}

function sameClientIdentity(left?: ClientResponse | null, right?: ClientResponse | null) {
  if (!left || !right) return false;
  return String(left.id ?? "") === String(right.id ?? "") && Boolean(left.id);
}

function clientName(client?: ClientResponse | null) {
  return text(client?.nomAffichage ?? client?.raisonSociale ?? [client?.prenom, client?.nom].filter(Boolean).join(" "));
}

function clientIdentity(client?: ClientResponse | null) {
  if (!client) return "-";
  if (client.typeClient === "PERSONNE_MORALE") {
    return [client.rc ? `RC ${client.rc}` : null, client.ice ? `ICE ${client.ice}` : null].filter(Boolean).join(" · ") || "-";
  }
  return [client.cin ? `CIN ${client.cin}` : null, client.numeroPermis ? `Permis ${client.numeroPermis}` : null].filter(Boolean).join(" · ") || "-";
}

function clientTypeLabel(client?: ClientResponse | null) {
  if (!client?.typeClient) return "-";
  return client.typeClient === "PERSONNE_MORALE" ? "Personne morale" : "Particulier";
}

function productLabel(contrat: ContratSummary) {
  if (contrat.typeContrat === "CONVENTION") return "Convention";
  if (contrat.typeContrat === "FLOTTE") return "Flotte";
  return "Mono";
}

function latestEvent(contrat: ContratSummary) {
  const latest = [...(contrat.mouvements ?? [])]
    .filter((mouvement) => String(mouvement.statut ?? "").toUpperCase() !== "ANNULE")
    .sort((a, b) => Number(b.id) - Number(a.id))[0];
  return latest?.libelle ?? "Affaire nouvelle";
}

function optionLabel(options: ReferenceOption[] | undefined, id?: string | null) {
  if (!id) return "-";
  return options?.find((option) => String(option.id) === String(id))?.libelle ?? text(id);
}

function isBlankNode(value: ReactNode) {
  return value == null || value === "";
}

function firstAttestation(contrat: ContratSummary) {
  return text(contrat.numeroAttestation ?? contrat.vehicules?.find((item) => item.numeroAttestation)?.numeroAttestation ?? contrat.remorques?.find((item) => item.numeroAttestation)?.numeroAttestation);
}

function personneGaranties(contrat: ContratSummary) {
  return (contrat.garanties ?? []).filter((garantie) => String(garantie.typeGarantie ?? "").toUpperCase() === "PERSONNE");
}

function garantieLabel(garantie: Garantie) {
  return [garantie.code, garantie.libelle].filter(Boolean).join(" - ");
}

function franchiseLabel(garantie: Garantie) {
  const taux = garantie.tauxFranchise == null ? null : `${moneyAmount(garantie.tauxFranchise)} %`;
  const min = garantie.franchiseMinimale == null ? null : `min ${moneyAmount(garantie.franchiseMinimale)} DH`;
  return [taux, min].filter(Boolean).join(" avec ") || "-";
}

function formatOptionalAmount(value?: number | null) {
  return value == null ? "-" : moneyAmount(value);
}

function amountOrDash(value?: number | null) {
  return value == null ? "-" : moneyAmount(value);
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function statusLabel(statut?: string | null) {
  const normalized = String(statut ?? "").toUpperCase();
  if (normalized === "ACTIVE") return "Valide";
  if (normalized === "DRAFT") return "Brouillon";
  if (normalized === "CANCELLED") return "Résilié";
  if (normalized === "RENEWED") return "Renouvelé";
  return text(statut);
}
