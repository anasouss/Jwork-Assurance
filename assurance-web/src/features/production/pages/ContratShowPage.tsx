import { useState, type ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Car, FileText, FileTextIcon, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { productionApi } from "../api";
import { formatMoney, moneyAmount, text } from "../utils/format";
import type { ClientResponse, ContratSummary, ReferenceOption } from "../types";
import type { jsPDF as JsPDF } from "jspdf";

type Garantie = NonNullable<ContratSummary["garanties"]>[number];
type Vehicule = NonNullable<ContratSummary["vehicules"]>[number];
type Remorque = NonNullable<ContratSummary["remorques"]>[number];
type Mouvement = NonNullable<ContratSummary["mouvements"]>[number];

export default function ContratShowPage() {
  const { contratId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const mouvementId = searchParams.get("mouvementId");
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const contratQuery = useQuery({
    queryKey: ["contrat", contratId, mouvementId],
    queryFn: () => productionApi.getContrat(contratId, { mouvementId }),
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
  const selectedMouvement = mouvementId ? contrat.mouvements?.find((mouvement) => String(mouvement.id) === String(mouvementId)) : null;
  const pdfName = `fiche-${sanitizeFilename(dossier)}${selectedMouvement?.numeroMouvement ? `-mvt-${selectedMouvement.numeroMouvement}` : ""}.pdf`;
  const openPdf = async () => {
    if (generatingPdf) return;
    setGeneratingPdf(true);
    try {
      await openContratPdf({
        contrat,
        dossier,
        souscripteur,
        proprietaire,
        sameClient,
        compagnie,
        convention,
        mouvement: selectedMouvement,
        filename: pdfName,
      });
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <div className="grid min-w-0 gap-4">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/app/production/contrats"><ArrowLeft className="size-4" />Retour liste</Link>
        </Button>
        <div className="flex items-center gap-2">
          <Badge className="bg-emerald-600">{statusLabel(contrat.statut)}</Badge>
          <Button type="button" onClick={openPdf} disabled={generatingPdf}>
            <FileTextIcon className="size-4" />
            {generatingPdf ? "Génération..." : "Ouvrir PDF"}
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
                ["Nature", selectedMouvement?.libelle ?? latestEvent(contrat)],
                ["Produit", productLabel(contrat)],
                ["Compagnie", compagnie],
                ...(contrat.typeContrat === "CONVENTION" ? [["Convention", convention] as [string, ReactNode]] : []),
                ["N° police", text(contrat.numeroPolice)],
                ["N° attestation", firstAttestation(contrat)],
                ["Date d'effet", formatDate(selectedMouvement?.dateEffet ?? contrat.dateEffet)],
                ["Date d'échéance", formatDate(selectedMouvement?.dateEcheance ?? contrat.dateEcheance)],
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
          <QuittanceSection contrat={contrat} movementLabel={selectedMouvement?.libelle} />
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

function QuittanceSection({ contrat, movementLabel }: { contrat: ContratSummary; movementLabel?: string | null }) {
  const lignes = (contrat.quittanceGenerale?.lignes ?? []).filter((ligne) => {
    const categorie = String(ligne.categorie ?? "").toUpperCase();
    return categorie !== "CORPOREL" || personneGaranties(contrat).length > 0;
  });
  if (!lignes.length) return null;
  return (
    <Section title={movementLabel ? `Quittance - ${movementLabel}` : "Quittance générale"}>
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

async function openContratPdf(params: {
  contrat: ContratSummary;
  dossier: string;
  souscripteur?: ClientResponse | null;
  proprietaire?: ClientResponse | null;
  sameClient: boolean;
  compagnie: string;
  convention: string;
  mouvement?: Mouvement | null;
  filename: string;
}) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const ctx: PdfContext = {
    pdf,
    x: 12,
    y: 14,
    width: 186,
    pageHeight: 297,
  };

  pdf.setProperties({ title: params.filename.replace(/\.pdf$/i, "") });
  drawPdfHeader(ctx, params);
  drawPdfSection(ctx, "CONTRAT", () => {
    drawPdfInfoGrid(ctx, [
      ["Nature", params.mouvement?.libelle ?? latestEvent(params.contrat)],
      ["Produit", productLabel(params.contrat)],
      ["Compagnie", params.compagnie],
      ...(params.contrat.typeContrat === "CONVENTION" ? [["Convention", params.convention] as [string, string]] : []),
      ["N° police", text(params.contrat.numeroPolice)],
      ["N° attestation", firstAttestation(params.contrat)],
      ["Date d'effet", formatDate(params.mouvement?.dateEffet ?? params.contrat.dateEffet)],
      ["Date d'échéance", formatDate(params.mouvement?.dateEcheance ?? params.contrat.dateEcheance)],
      ["Type client", clientTypeLabel(params.souscripteur)],
      ["Fractionnement", text(params.contrat.fractionnement)],
    ]);
  });

  drawPdfSection(ctx, "CLIENTS", () => {
    if (params.sameClient) {
      drawPdfClient(ctx, "Souscripteur et propriétaire", params.souscripteur, ctx.x, ctx.width);
    } else {
      const columnWidth = (ctx.width - 4) / 2;
      const startY = ctx.y;
      drawPdfClient(ctx, "Souscripteur", params.souscripteur, ctx.x, columnWidth);
      const leftHeight = ctx.y;
      ctx.y = startY;
      drawPdfClient(ctx, "Propriétaire", params.proprietaire, ctx.x + columnWidth + 4, columnWidth);
      ctx.y = Math.max(ctx.y, leftHeight);
    }
  });

  for (const [index, vehicule] of (params.contrat.vehicules ?? []).entries()) {
    drawPdfSection(ctx, `VÉHICULE ${index + 1}`, () => {
      drawPdfInfoGrid(ctx, [
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
      ]);
      const garanties = (params.contrat.garanties ?? []).filter((garantie) => String(garantie.vehiculeId ?? "") === String(vehicule.vehiculeId));
      drawPdfGaranties(ctx, garanties);
    });
  }

  for (const [index, remorque] of (params.contrat.remorques ?? []).entries()) {
    drawPdfSection(ctx, `REMORQUE ${index + 1}`, () => {
      drawPdfInfoGrid(ctx, [
        ["Usage", [remorque.usageCode, remorque.usageLibelle].filter(Boolean).join(" - ")],
        ["Marque", text(remorque.marque)],
        ["Immatriculation", text(remorque.immatriculation)],
        ["PTC", text(remorque.ptc)],
        ["Date de MC", formatDate(remorque.dateMiseEnCirculation)],
        ["Valeur assurée", formatOptionalAmount(remorque.valeurAssuree)],
      ]);
      const garanties = (params.contrat.garanties ?? []).filter((garantie) => String(garantie.remorqueId ?? "") === String(remorque.remorqueId));
      drawPdfGaranties(ctx, garanties);
    });
  }

  const personnes = personneGaranties(params.contrat);
  if (personnes.length) {
    drawPdfSection(ctx, "PROTECTION PERSONNES", () => drawPdfPersonnes(ctx, personnes));
  }

  drawPdfSection(ctx, params.mouvement?.libelle ? `QUITTANCE - ${params.mouvement.libelle}` : "QUITTANCE GÉNÉRALE", () => {
    drawPdfQuittance(ctx, params.contrat);
  });

  const blobUrl = URL.createObjectURL(pdf.output("blob"));
  const opened = window.open(blobUrl, "_blank", "noopener,noreferrer");
  if (!opened) {
    pdf.save(params.filename);
    URL.revokeObjectURL(blobUrl);
  } else {
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  }
}

type PdfContext = {
  pdf: JsPDF;
  x: number;
  y: number;
  width: number;
  pageHeight: number;
};

function drawPdfHeader(ctx: PdfContext, params: { contrat: ContratSummary; dossier: string }) {
  const { pdf } = ctx;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(4, 120, 87);
  pdf.text("FICHE SYNTHÈSE", ctx.x, ctx.y);
  ctx.y += 7;
  pdf.setTextColor(2, 6, 23);
  pdf.setFontSize(15);
  pdf.text(pdfSafe(`Dossier N° ${params.dossier}`), ctx.x, ctx.y);
  pdf.setFontSize(9);
  pdf.text(pdfSafe(text(params.contrat.numeroPolice)), ctx.x + ctx.width, ctx.y - 1, { align: "right" });
  ctx.y += 6;
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(71, 85, 105);
  pdf.text(pdfSafe(`${productLabel(params.contrat)} · Automobile`), ctx.x, ctx.y);
  pdf.text("Police N°", ctx.x + ctx.width, ctx.y, { align: "right" });
  ctx.y += 8;
  pdf.setDrawColor(15, 23, 42);
  pdf.setLineWidth(0.5);
  pdf.line(ctx.x, ctx.y, ctx.x + ctx.width, ctx.y);
  ctx.y += 6;
}

function drawPdfSection(ctx: PdfContext, title: string, draw: () => void) {
  ensurePdfSpace(ctx, 22);
  const { pdf } = ctx;
  const startY = ctx.y;
  pdf.setFillColor(241, 245, 249);
  pdf.setDrawColor(226, 232, 240);
  pdf.rect(ctx.x, ctx.y, ctx.width, 9, "FD");
  pdf.setFillColor(5, 150, 105);
  pdf.rect(ctx.x, ctx.y, 1.2, 9, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(2, 6, 23);
  pdf.text(pdfSafe(title), ctx.x + 4, ctx.y + 6);
  ctx.y += 12;
  draw();
  pdf.setDrawColor(226, 232, 240);
  pdf.roundedRect(ctx.x, startY, ctx.width, ctx.y - startY + 2, 1.5, 1.5, "S");
  ctx.y += 7;
}

function drawPdfInfoGrid(ctx: PdfContext, items: [string, ReactNode][]) {
  const columnWidth = ctx.width / 3;
  for (let index = 0; index < items.length; index += 1) {
    const column = index % 3;
    if (column === 0 && index > 0) ctx.y += 8;
    ensurePdfSpace(ctx, 12);
    const x = ctx.x + column * columnWidth + 3;
    const [label, value] = items[index];
    ctx.pdf.setDrawColor(226, 232, 240);
    ctx.pdf.line(x, ctx.y + 5.5, x + columnWidth - 8, ctx.y + 5.5);
    ctx.pdf.setFont("helvetica", "bold");
    ctx.pdf.setFontSize(7);
    ctx.pdf.setTextColor(100, 116, 139);
    ctx.pdf.text(pdfSafe(label.toUpperCase()), x, ctx.y);
    ctx.pdf.setFontSize(8);
    ctx.pdf.setTextColor(2, 6, 23);
    ctx.pdf.text(wrapPdfText(ctx, valueToPdfText(value), columnWidth - 30), x + 23, ctx.y, { maxWidth: columnWidth - 30 });
  }
  ctx.y += 9;
}

function drawPdfClient(ctx: PdfContext, title: string, client: ClientResponse | null | undefined, x: number, width: number) {
  ensurePdfSpace(ctx, 24);
  const startY = ctx.y;
  ctx.pdf.setDrawColor(226, 232, 240);
  ctx.pdf.roundedRect(x, startY, width, 23, 1.5, 1.5, "S");
  ctx.pdf.setFont("helvetica", "bold");
  ctx.pdf.setFontSize(7);
  ctx.pdf.setTextColor(4, 120, 87);
  ctx.pdf.text(pdfSafe(title.toUpperCase()), x + 3, startY + 5);
  ctx.pdf.setFontSize(10);
  ctx.pdf.setTextColor(2, 6, 23);
  ctx.pdf.text(wrapPdfText(ctx, clientName(client), width - 6), x + 3, startY + 11, { maxWidth: width - 6 });
  ctx.pdf.setFont("helvetica", "normal");
  ctx.pdf.setFontSize(7.5);
  ctx.pdf.setTextColor(51, 65, 85);
  ctx.pdf.text(wrapPdfText(ctx, clientIdentity(client), width - 6), x + 3, startY + 16, { maxWidth: width - 6 });
  ctx.pdf.text(wrapPdfText(ctx, `${text(client?.adresse)}${client?.ville ? `, ${client.ville}` : ""}`, width - 6), x + 3, startY + 20, { maxWidth: width - 6 });
  ctx.y = startY + 25;
}

function drawPdfGaranties(ctx: PdfContext, garanties: Garantie[]) {
  const vehiculeGaranties = garanties.filter((garantie) => String(garantie.typeGarantie ?? "").toUpperCase() !== "PERSONNE");
  if (!vehiculeGaranties.length) return;
  drawPdfTable(ctx, ["Garantie assurée", "Valeur assurée", "Taux", "Franchise", "Prime nette"], vehiculeGaranties.map((garantie) => [
    garantieLabel(garantie),
    formatOptionalAmount(garantie.capital ?? garantie.valeurAssuree),
    garantie.taux == null ? "-" : `${moneyAmount(garantie.taux)} %`,
    franchiseLabel(garantie),
    formatMoney(garantie.prime),
  ]), [55, 35, 24, 42, 30]);
}

function drawPdfPersonnes(ctx: PdfContext, garanties: Garantie[]) {
  drawPdfTable(ctx, ["Garantie", "Formule", "Décès", "Invalidité", "Frais médicaux", "Prime nette"], garanties.map((garantie) => [
    garantieLabel(garantie),
    text(garantie.formule),
    amountOrDash(garantie.montantDeces),
    amountOrDash(garantie.montantInvalidite),
    amountOrDash(garantie.montantFraisMedicaux),
    formatMoney(garantie.prime),
  ]), [48, 28, 25, 25, 30, 30]);
}

function drawPdfQuittance(ctx: PdfContext, contrat: ContratSummary) {
  const lignes = (contrat.quittanceGenerale?.lignes ?? []).filter((ligne) => {
    const categorie = String(ligne.categorie ?? "").toUpperCase();
    return categorie !== "CORPOREL" || personneGaranties(contrat).length > 0;
  });
  drawPdfTable(ctx, ["Catégorie", "P. nette", "Taxes", "TPF", "Accessoires", "CNPAC", "Total"], lignes.map((ligne) => [
    ligne.globale ? "Total général" : text(ligne.categorie),
    formatMoney(ligne.primeNette),
    formatMoney(ligne.taxe),
    formatMoney(ligne.taxeParafiscale),
    formatMoney(ligne.accessoire),
    formatMoney(ligne.cnpac),
    formatMoney(ligne.primeTotale),
  ]), [30, 27, 27, 25, 30, 25, 22]);
}

function drawPdfTable(ctx: PdfContext, headers: string[], rows: string[][], widths: number[]) {
  if (!rows.length) return;
  const rowHeight = 8;
  ensurePdfSpace(ctx, rowHeight * 2);
  ctx.pdf.setFillColor(241, 245, 249);
  ctx.pdf.setDrawColor(226, 232, 240);
  ctx.pdf.rect(ctx.x + 3, ctx.y, ctx.width - 6, rowHeight, "FD");
  let cursorX = ctx.x + 4;
  ctx.pdf.setFont("helvetica", "bold");
  ctx.pdf.setFontSize(7);
  ctx.pdf.setTextColor(51, 65, 85);
  headers.forEach((header, index) => {
    ctx.pdf.text(pdfSafe(header), cursorX, ctx.y + 5);
    cursorX += widths[index];
  });
  ctx.y += rowHeight;

  for (const row of rows) {
    ensurePdfSpace(ctx, rowHeight + 3);
    cursorX = ctx.x + 4;
    ctx.pdf.setDrawColor(226, 232, 240);
    ctx.pdf.line(ctx.x + 3, ctx.y, ctx.x + ctx.width - 3, ctx.y);
    row.forEach((cell, index) => {
      const isLast = index === row.length - 1;
      ctx.pdf.setFont("helvetica", isLast ? "bold" : "normal");
      ctx.pdf.setFontSize(7.5);
      ctx.pdf.setTextColor(2, 6, 23);
      const align = index === 0 ? "left" : "right";
      const textX = align === "right" ? cursorX + widths[index] - 2 : cursorX;
      ctx.pdf.text(wrapPdfText(ctx, cell, widths[index] - 4), textX, ctx.y + 5, { align, maxWidth: widths[index] - 4 });
      cursorX += widths[index];
    });
    ctx.y += rowHeight;
  }
  ctx.y += 3;
}

function ensurePdfSpace(ctx: PdfContext, needed: number) {
  if (ctx.y + needed <= ctx.pageHeight - 12) return;
  ctx.pdf.addPage();
  ctx.y = 14;
}

function wrapPdfText(ctx: PdfContext, value: string, width: number) {
  return ctx.pdf.splitTextToSize(pdfSafe(value), width);
}

function valueToPdfText(value: ReactNode) {
  if (typeof value === "string" || typeof value === "number") return String(value);
  return isBlankNode(value) ? "-" : String(value);
}

function pdfSafe(value: string) {
  return String(value ?? "")
    .replace(/\u202f/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/[–—]/g, "-");
}

function sanitizeFilename(value: string) {
  return value.replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "dossier";
}
