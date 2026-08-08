import { useState, type ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Car, FileText, FileTextIcon, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { contractApi } from "../api/contracts";
import { referenceApi } from "../api/references";
import { ProductionFormSkeleton } from "../components/ProductionFormSkeleton";
import { moneyAmount, numberOrZero, roundMoney, text } from "../utils/format";
import type { AssistanceContrat, ClientResponse, ContratSummary, ReferenceOption } from "../types";
import type { jsPDF as JsPDF } from "jspdf";

type Garantie = NonNullable<ContratSummary["garanties"]>[number];
type Vehicule = NonNullable<ContratSummary["vehicules"]>[number];
type Remorque = NonNullable<ContratSummary["remorques"]>[number];
type Mouvement = NonNullable<ContratSummary["mouvements"]>[number];

type DisplayGarantie = {
  garantie: Garantie;
  depth: 0 | 1;
};

const VEHICLE_GUARANTEE_DISPLAY_ORDER = [
  "RC",
  "DR",
  "I",
  "V",
  "VOR",
  "BG",
  "BOR",
  "BTP",
  "DC",
  "DV",
  "RVE",
  "RF",
  "PF",
] as const;

const VEHICLE_GUARANTEE_PARENT_BY_CODE: Record<string, string> = {
  VOR: "V",
  BOR: "BG",
  BTP: "BG",
  RVE: "DV",
  RF: "DV",
};

export default function ContratShowPage() {
  const { contratId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const mouvementId = searchParams.get("mouvementId");
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const contratQuery = useQuery({
    queryKey: ["contrat", contratId, mouvementId],
    queryFn: () => contractApi.getContrat(contratId, { mouvementId }),
    enabled: Boolean(contratId),
  });
  const compagniesQuery = useQuery({
    queryKey: ["referentiel", "compagnies-assurance", "contrat-show"],
    queryFn: () => referenceApi.list("compagnies-assurance"),
  });
  const conventionsQuery = useQuery({
    queryKey: ["referentiel", "conventions", "contrat-show"],
    queryFn: () => referenceApi.list("conventions"),
  });

  if (contratQuery.isLoading) {
    return <ProductionFormSkeleton variant="contract" />;
  }

  if (!contratQuery.data) {
    return <Card><CardContent className="p-8 text-center text-muted-foreground">Dossier introuvable.</CardContent></Card>;
  }

  const contrat = contratQuery.data;
  const dossier = contrat.numeroDossier ?? contrat.numeroContrat ?? `#${contrat.id}`;
  const souscripteur = clientByRole(contrat, "SOUSCRIPTEUR");
  const proprietaire = clientByRole(contrat, "PROPRIETAIRE") ?? souscripteur;
  const conducteur = clientByRole(contrat, "CONDUCTEUR")
    ?? (proprietaire?.conducteurHabituel ? proprietaire : null);
  const compagnie = optionLabel(compagniesQuery.data, contrat.compagnieAssuranceId);
  const convention = optionLabel(conventionsQuery.data, contrat.conventionId);
  const selectedMouvement = mouvementId ? contrat.mouvements?.find((mouvement) => String(mouvement.id) === String(mouvementId)) : null;
  const isVehicleReplacement = String(selectedMouvement?.code ?? "").toUpperCase() === "CHV_M";
  const showGuaranteePrimes = contrat.typeContrat !== "PARTICULIER" || Boolean(contrat.saisiePrimeNette);
  const selectedActNumber = selectedMouvement?.numeroMouvement ?? "1";
  const pdfName = `fiche-${sanitizeFilename(dossier)}${selectedMouvement ? `-acte-${selectedActNumber}` : ""}.pdf`;
  const openPdf = async () => {
    if (generatingPdf) return;
    const previewWindow = contrat.typeContrat === "FLOTTE" ? window.open("about:blank", "_blank") : null;
    if (contrat.typeContrat === "FLOTTE" && !previewWindow) return;
    setGeneratingPdf(true);
    try {
      if (contrat.typeContrat === "FLOTTE") {
        const blob = await contractApi.downloadFlottePolicyPdf(contratId, mouvementId);
        const url = URL.createObjectURL(blob);
        previewWindow!.location.href = url;
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
        return;
      }
      await openContratPdf({
        contrat,
        dossier,
        souscripteur,
        proprietaire,
        conducteur,
        compagnie,
        convention,
        mouvement: selectedMouvement,
        filename: pdfName,
      });
    } catch (error) {
      previewWindow?.close();
      toast.error(error instanceof Error ? error.message : "Génération du PDF impossible");
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
          <Badge className="bg-emerald-600">{statusLabel(selectedMouvement?.statut ?? contrat.statut)}</Badge>
          <Button type="button" onClick={openPdf} disabled={generatingPdf}>
            <FileTextIcon className="size-4" />
            {generatingPdf ? "Génération..." : "Ouvrir PDF"}
          </Button>
        </div>
      </div>

      {contrat.typeContrat === "FLOTTE" ? (
        <FlottePolicySheet
          contrat={contrat}
          dossier={dossier}
          souscripteur={souscripteur}
          mouvement={selectedMouvement}
        />
      ) : (
      <div className="mx-auto min-h-[297mm] w-full max-w-[210mm] border bg-white p-3 text-[11px] leading-snug text-slate-950 shadow-sm sm:p-4 lg:p-[9mm] print:min-h-0 print:max-w-none print:border-0 print:p-0 print:shadow-none">
        <header className="border-b-2 border-slate-900 pb-2">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[9px] font-bold uppercase text-emerald-700">Fiche synthèse</p>
              <h1 className="mt-0.5 text-lg font-bold">Dossier N° {dossier}</h1>
              <p className="text-[10px] text-slate-600">{productLabel(contrat)} · Automobile</p>
            </div>
            <div className="text-right text-sm">
              <p className="font-semibold">{text(contrat.numeroPolice)}</p>
              <p className="text-slate-600">Police N°</p>
            </div>
          </div>
        </header>

        <main className="mt-2 grid gap-2">
          <Section title="Contrat" icon={<FileText className="size-4" />}>
            <InfoGrid
              items={[
                ["Nature", selectedMouvement?.libelle ?? latestEvent(contrat)],
                ["Produit", productLabel(contrat)],
                ["Compagnie", compagnie],
                ...(contrat.typeContrat === "CONVENTION" ? [["Convention", convention] as [string, ReactNode]] : []),
                ["N° attestation", firstAttestation(contrat)],
                ["Date d'effet", formatDate(selectedMouvement?.dateEffet ?? contrat.dateEffet)],
                ["Date d'échéance", formatDate(selectedMouvement?.dateEcheance ?? contrat.dateEcheance)],
                ["Fractionnement", text(contrat.fractionnement)],
                ...(souscripteur?.groupe?.libelle
                  ? [["Groupe client", souscripteur.groupe.libelle] as [string, ReactNode]]
                  : []),
                ...(!isSubscriberPayer(contrat, souscripteur)
                  ? [["Payeur des primes", contrat.payeurPrimeNom ?? payerTypeLabel(contrat.typePayeurPrime)] as [string, ReactNode]]
                  : []),
                ...(contrat.modeFacturation === "CONSOLIDEE_GROUPE"
                  ? [["Facturation", billingModeLabel(contrat.modeFacturation)] as [string, ReactNode]]
                  : []),
                ...(contrat.modeReglement
                  ? [["Mode de règlement", contractPaymentModeLabel(contrat.modeReglement)] as [string, ReactNode]]
                  : []),
                ...(contrat.numeroBonCommande
                  ? [["N° bon de commande", contrat.numeroBonCommande] as [string, ReactNode]]
                  : []),
                ...(contrat.montantBulletin != null
                  ? [["Montant du bulletin", moneyAmount(contrat.montantBulletin)] as [string, ReactNode]]
                  : []),
              ]}
            />
          </Section>

          <Section title="Informations Client" icon={<UserRound className="size-4" />}>
            <PartiesGrid
              souscripteur={souscripteur}
              proprietaire={proprietaire}
              conducteur={conducteur}
            />
          </Section>

          {(contrat.vehicules ?? []).map((vehicule, index) => (
            <VehicleSection
              key={vehicule.vehiculeId ?? index}
              contrat={contrat}
              vehicule={vehicule}
              index={index}
              replacementSnapshot={isVehicleReplacement}
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

          <PersonnesSection garanties={personneGaranties(contrat)} showPrimes={showGuaranteePrimes} />
          <AssistancesSection assistances={contrat.assistances ?? []} />
          <QuittanceSection
            contrat={contrat}
            movementLabel={selectedMouvement?.libelle}
            differential={isVehicleReplacement}
          />
        </main>
      </div>
      )}
    </div>
  );
}

function FlottePolicySheet({
  contrat,
  dossier,
  souscripteur,
  mouvement,
}: {
  contrat: ContratSummary;
  dossier: string;
  souscripteur?: ClientResponse | null;
  mouvement?: Mouvement | null;
}) {
  const vehicles = contrat.vehicules ?? [];
  const trailers = contrat.remorques ?? [];
  const targets = [
    ...vehicles.map((item, index) => ({ kind: "VEHICULE" as const, index, item })),
    ...trailers.map((item, index) => ({ kind: "REMORQUE" as const, index, item })),
  ];
  const vehicleGuarantees = (contrat.garanties ?? []).filter((garantie) => String(garantie.typeGarantie ?? "").toUpperCase() !== "PERSONNE");
  const guaranteeCodes = flotteGuaranteeCodes(vehicleGuarantees);
  const hasDcCapital = vehicleGuarantees.some((garantie) => String(garantie.code ?? "").toUpperCase() === "DC");
  const assistances = contrat.assistances ?? [];
  const showAssistance = assistances.length > 0;
  const totals = contrat.quittanceGenerale;
  const insuranceTotal = totals?.primeTotale ?? totals?.lignes?.find((ligne) => ligne.globale)?.primeTotale;
  const assistanceTotal = assistances.reduce((sum, item) => sum + Number(item.primeTotale ?? 0), 0);
  const totalAmount = Number(insuranceTotal ?? 0) + assistanceTotal;
  const targetSummaries = contrat.targetSummaries ?? contrat.quittanceGenerale?.targetSummaries ?? [];
  const actLabel = mouvement?.libelle ?? latestEvent(contrat);
  const actNumber = mouvement?.numeroMouvement ?? "1";
  const subscriberPays = isSubscriberPayer(contrat, souscripteur);

  return (
    <div className="w-full overflow-x-auto">
      <div className="mx-auto min-h-[210mm] w-[297mm] border bg-white p-[4mm] text-[11px] leading-tight text-slate-950 shadow-sm">
        <div className="mx-auto w-[470px] border border-slate-900 bg-slate-100 px-3 py-2 text-center text-slate-900">
          <div className="text-lg font-bold uppercase tracking-wide">Police flotte automobile</div>
          <div className="text-sm font-semibold">ACTE N {actNumber} : {text(actLabel)}</div>
        </div>

        <div className="mt-3 grid grid-cols-[1fr_360px] border border-slate-300">
          <div className="space-y-1 p-2">
            <div><span className="font-bold text-blue-950">Assure : </span>{clientName(souscripteur)}</div>
            <div><span className="font-bold text-blue-950">Adresse : </span>{text(souscripteur?.adresse)}{souscripteur?.ville ? `, ${souscripteur.ville}` : ""}</div>
            <div>
              {!subscriberPays ? (
                <>
                  <span className="font-bold text-blue-950">Payeur : </span>
                  {contrat.payeurPrimeNom ?? payerTypeLabel(contrat.typePayeurPrime)}
                </>
              ) : null}
              <span className={subscriberPays ? "font-bold text-blue-950" : "ml-3 font-bold text-blue-950"}>Facturation : </span>
              {billingModeLabel(contrat.modeFacturation)}
            </div>
          </div>
          <div className="space-y-1 p-2 text-right">
            <div className="font-bold text-blue-950">Police N {text(contrat.numeroPolice)}</div>
            <div>Date d'effet {formatDate(mouvement?.dateEffet ?? contrat.dateEffet)} Date d'expiration {formatDate(mouvement?.dateEcheance ?? contrat.dateEcheance)}</div>
          </div>
        </div>

        <div className="mt-2 flex items-end justify-between">
          <h2 className="text-sm font-bold">I. Le tarif</h2>
          <div className="text-[10px] font-semibold text-blue-950">{dossier}</div>
        </div>

        <table className="mt-2 w-full border-collapse text-[11px]">
          <thead>
            <tr className="bg-slate-100 text-center font-bold text-blue-950">
              <th className="border border-slate-700 px-1 py-1" rowSpan={2}>Usage</th>
              <th className="border border-slate-700 px-1 py-1" rowSpan={2}>Marque</th>
              <th className="border border-slate-700 px-1 py-1" rowSpan={2}>N<br />d'immatric</th>
              <th className="border border-slate-700 px-1 py-1" rowSpan={2}>N°<br />attestation</th>
              <th className="border border-slate-700 px-1 py-1" rowSpan={2}>Date de<br />MC</th>
              <th className="border border-slate-700 px-1 py-1" rowSpan={2}>PF/PTC</th>
              <th className="border border-slate-700 px-1 py-1" rowSpan={2}>ENERGIE</th>
              <th className="border border-slate-700 px-1 py-1" colSpan={hasDcCapital ? 4 : 3}>VALEURS</th>
              <th className="border border-slate-700 px-1 py-1" colSpan={guaranteeCodes.length + (showAssistance ? 2 : 0)}>GARANTIES A ASSURER</th>
              <th className="border border-slate-700 px-1 py-1" rowSpan={2}>Montant total</th>
            </tr>
            <tr className="bg-slate-100 text-center font-bold text-blue-950">
              <th className="border border-slate-700 px-1 py-1">Valeur a<br />Neuf</th>
              <th className="border border-slate-700 px-1 py-1">Valeur<br />Venale</th>
              <th className="border border-slate-700 px-1 py-1">Valeur des<br />glaces</th>
              {hasDcCapital ? <th className="border border-slate-700 px-1 py-1">Capital<br />DC</th> : null}
              {guaranteeCodes.map((code) => <th key={code} className="border border-slate-700 px-1 py-1">{code}</th>)}
              {showAssistance ? <th className="border border-slate-700 bg-amber-50 px-1 py-1">ASSISTANCE</th> : null}
              {showAssistance ? <th className="border border-slate-700 bg-amber-50 px-1 py-1">PRIME<br />TTC</th> : null}
            </tr>
          </thead>
          <tbody>
            {targets.map((target) => {
              const isVehicle = target.kind === "VEHICULE";
              const targetId = isVehicle ? target.item.vehiculeId : target.item.remorqueId;
              const garanties = vehicleGuarantees.filter((garantie) => isVehicle
                ? String(garantie.vehiculeId ?? "") === String(targetId)
                : String(garantie.remorqueId ?? "") === String(targetId));
              const summary = targetSummaries.find((item) => isVehicle
                ? item.kind === "VEHICULE" && item.vehiculeIndex === target.index
                : item.kind === "REMORQUE" && item.remorqueIndex === target.index);
              const dateMiseEnCirculation = isVehicle ? target.item.datePremiereCirculation : target.item.dateMiseEnCirculation;
              const pfOuPtc = isVehicle ? target.item.puissanceFiscale ?? target.item.ptc : target.item.ptc;
              const carburant = isVehicle ? target.item.carburant : null;
              const valeurNeuf = isVehicle ? target.item.valeurNeuf : null;
              const valeurVenale = isVehicle ? target.item.valeurVenale : target.item.valeurAssuree;
              const valeurGlace = isVehicle ? target.item.valeurGlace : null;
              const targetAssistancePrime = isVehicle ? assistancePrime(assistances, target.item.vehiculeId) : 0;
              const targetTotal = Number(summary?.primeTotale ?? summary?.primeNette ?? 0) + targetAssistancePrime;
              return (
                <tr key={`${target.kind}-${targetId ?? target.index}`} className="align-middle">
                  <td className="border border-slate-700 px-1 py-1">{text(target.item.usageCode)}</td>
                  <td className="border border-slate-700 px-1 py-1">{text(target.item.marque)}</td>
                  <td className="border border-slate-700 px-1 py-1 text-center">{text(target.item.immatriculation)}</td>
                  <td className="border border-slate-700 px-1 py-1 text-center">{text(target.item.numeroAttestation)}</td>
                  <td className="border border-slate-700 px-1 py-1 text-center">{formatDate(dateMiseEnCirculation)}</td>
                  <td className="border border-slate-700 px-1 py-1 text-center">{text(pfOuPtc)}</td>
                  <td className="border border-slate-700 px-1 py-1 text-center uppercase">{text(carburant)}</td>
                  <td className="border border-slate-700 px-1 py-1 text-right">{amountNoCurrency(valeurNeuf)}</td>
                  <td className="border border-slate-700 px-1 py-1 text-right">{amountNoCurrency(valeurVenale)}</td>
                  <td className="border border-slate-700 px-1 py-1 text-right">{amountNoCurrency(valeurGlace)}</td>
                  {hasDcCapital ? <td className="border border-slate-700 px-1 py-1 text-right">{capitalForCode(garanties, "DC")}</td> : null}
                  {guaranteeCodes.map((code) => (
                    <td key={code} className="border border-slate-700 bg-emerald-50 px-1 py-1 text-center font-bold">
                      {flotteGuaranteeCell(garanties, code)}
                    </td>
                  ))}
                  {showAssistance ? <td className="border border-slate-700 bg-amber-50 px-1 py-1 text-center">{isVehicle ? assistanceCell(assistances, target.item.vehiculeId) : ""}</td> : null}
                  {showAssistance ? <td className="border border-slate-700 bg-amber-50 px-1 py-1 text-right">{targetAssistancePrime ? moneyAmount(targetAssistancePrime) : ""}</td> : null}
                  <td className="border border-slate-700 px-1 py-1 text-right font-semibold">{moneyAmount(targetTotal)}</td>
                </tr>
              );
            })}
            <tr className="font-bold">
              <td className="border border-slate-700 px-1 py-1 text-center" colSpan={7 + 3 + (hasDcCapital ? 1 : 0) + guaranteeCodes.length + (showAssistance ? 2 : 0)}>TOTAL</td>
              <td className="border border-slate-700 px-1 py-1 text-right">{moneyAmount(totalAmount)}</td>
            </tr>
          </tbody>
        </table>

        <div className="mt-2 text-[9px] text-blue-950">
          {guaranteeCodes.map((code) => `${code}: ${guaranteeFullLabel(vehicleGuarantees, code)}`).join("  |  ")}
        </div>

        <FlotteFranchiseTable vehicles={vehicles} garanties={vehicleGuarantees} />
        <FlotteQuittanceTable contrat={contrat} assistances={assistances} />
      </div>
    </div>
  );
}

function VehicleSection({
  contrat,
  vehicule,
  index,
  replacementSnapshot = false,
}: {
  contrat: ContratSummary;
  vehicule: Vehicule;
  index: number;
  replacementSnapshot?: boolean;
}) {
  const garanties = (contrat.garanties ?? []).filter((garantie) => String(garantie.vehiculeId ?? "") === String(vehicule.vehiculeId));
  const hasGaranties = garanties.some((garantie) => String(garantie.typeGarantie ?? "").toUpperCase() !== "PERSONNE");
  return (
    <>
      <Section
        title={(contrat.vehicules?.length ?? 0) > 1 ? `Informations Véhicule ${index + 1}` : "Informations Véhicule"}
        icon={<Car className="size-4" />}
      >
        <InfoGrid
          items={[
            ["Usage", [vehicule.usageCode, vehicule.usageLibelle].filter(Boolean).join(" - ")],
            ["Marque", text(vehicule.marque)],
            ["Immatriculation", text(vehicule.immatriculation)],
            ["Date de MC", formatDate(vehicule.datePremiereCirculation)],
            ["Carburant", text(vehicule.carburant)],
            [vehicule.cylindree ? "Cylindrée" : "Puissance fiscale", text(vehicule.cylindree ?? vehicule.puissanceFiscale)],
            ["Carrosserie", text(vehicule.carrosserie)],
            ["Nombre de places", text(vehicule.nombrePlaces)],
            ["CRM", text(vehicule.crm)],
            ["Valeur à neuf", formatOptionalAmount(vehicule.valeurNeuf)],
            ["Valeur vénale", formatOptionalAmount(vehicule.valeurVenale)],
            ["Valeur glaces", formatOptionalAmount(vehicule.valeurGlace)],
          ]}
        />
      </Section>
      {hasGaranties ? (
        <Section title={(contrat.vehicules?.length ?? 0) > 1 ? `Les Garanties assurées ${index + 1}` : "Les Garanties assurées"}>
          <GarantiesTable
            garanties={garanties}
            primeLabel={replacementSnapshot ? "Prime différentielle" : "Prime nette"}
            showPrimes={contrat.typeContrat !== "PARTICULIER" || Boolean(contrat.saisiePrimeNette)}
          />
        </Section>
      ) : null}
    </>
  );
}

function RemorqueSection({ contrat, remorque, index }: { contrat: ContratSummary; remorque: Remorque; index: number }) {
  const garanties = (contrat.garanties ?? []).filter((garantie) => String(garantie.remorqueId ?? "") === String(remorque.remorqueId));
  const hasGaranties = garanties.some((garantie) => String(garantie.typeGarantie ?? "").toUpperCase() !== "PERSONNE");
  return (
    <>
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
      </Section>
      {hasGaranties ? (
        <Section title={(contrat.remorques?.length ?? 0) > 1 ? `Garanties remorque ${index + 1}` : "Garanties remorque"}>
          <GarantiesTable
            garanties={garanties}
            showPrimes={contrat.typeContrat !== "PARTICULIER" || Boolean(contrat.saisiePrimeNette)}
          />
        </Section>
      ) : null}
    </>
  );
}

function PersonnesSection({ garanties, showPrimes }: { garanties: Garantie[]; showPrimes: boolean }) {
  if (!garanties.length) return null;
  return (
    <Section title="Les Garanties des Personnes">
      <Table className="text-[10px] [&_td]:px-2 [&_td]:py-1 [&_th]:h-6 [&_th]:px-2 [&_th]:text-[9px] [&_th]:uppercase">
        <TableHeader>
          <TableRow className="bg-slate-100">
            <TableHead>Garantie</TableHead>
            <TableHead className="text-right">Décès</TableHead>
            <TableHead className="text-right">Invalidité</TableHead>
            <TableHead className="text-right">Frais médicaux</TableHead>
            <TableHead className="text-right">Prime nette</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {garanties.map((garantie) => (
            <TableRow key={garantie.contratGarantieId}>
              <TableCell className="font-medium">{garantieName(garantie)}</TableCell>
              <TableCell className="text-right">{amountOrDash(garantie.montantDeces)}</TableCell>
              <TableCell className="text-right">{amountOrDash(garantie.montantInvalidite)}</TableCell>
              <TableCell className="text-right">{amountOrDash(garantie.montantFraisMedicaux)}</TableCell>
              <TableCell className="text-right font-semibold">{showPrimes ? moneyAmount(garantie.prime) : "-"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Section>
  );
}

function AssistancesSection({ assistances }: { assistances: AssistanceContrat[] }) {
  if (!assistances.length) return null;
  return (
    <Section title="Assistance">
      <Table className="text-[10px] [&_td]:px-2 [&_td]:py-1 [&_th]:h-6 [&_th]:px-2 [&_th]:text-[9px] [&_th]:uppercase">
        <TableHeader>
          <TableRow className="bg-slate-100">
            <TableHead>N° contrat</TableHead>
            <TableHead>Compagnie</TableHead>
            <TableHead>Produit</TableHead>
            <TableHead>Période</TableHead>
            <TableHead className="text-right">Prime TTC</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assistances.map((assistance) => (
            <TableRow key={assistance.id}>
              <TableCell className="font-medium">{text(assistance.numeroContratOuQuittance)}</TableCell>
              <TableCell>{text(assistance.compagnieAssistanceLibelle)}</TableCell>
              <TableCell>{text(assistance.produit)}</TableCell>
              <TableCell>{formatDate(assistance.dateEffet)} au {formatDate(assistance.dateEcheance)}</TableCell>
              <TableCell className="text-right font-semibold">{moneyAmount(assistance.primeTotale)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Section>
  );
}

function GarantiesTable({
  garanties,
  primeLabel = "Prime nette",
  showPrimes,
}: {
  garanties: Garantie[];
  primeLabel?: string;
  showPrimes: boolean;
}) {
  const vehiculeGaranties = garanties.filter((garantie) => String(garantie.typeGarantie ?? "").toUpperCase() !== "PERSONNE");
  if (!vehiculeGaranties.length) return null;
  const displayGaranties = vehicleGuaranteesForDisplay(vehiculeGaranties);
  return (
    <div className="overflow-hidden">
      <Table className="text-[10px]">
        <TableHeader>
          <TableRow className="bg-slate-100">
            <TableHead className="h-6 px-2 text-[9px] uppercase">Les Garanties du Véhicule</TableHead>
            <TableHead className="h-6 px-2 text-right text-[9px] uppercase">Valeur assurée</TableHead>
            <TableHead className="h-6 px-2 text-[9px] uppercase">Franchise</TableHead>
            <TableHead className="h-6 px-2 text-right text-[9px] uppercase">{primeLabel}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayGaranties.map(({ garantie, depth }) => (
            <TableRow key={garantie.contratGarantieId}>
              <TableCell className="px-2 py-0.5 font-medium">
                <span className={depth === 1 ? "inline-flex items-center gap-1 pl-5" : undefined}>
                  {depth === 1 ? <span aria-hidden="true">*</span> : null}
                  {garantieName(garantie)}
                </span>
              </TableCell>
              <TableCell className="px-2 py-0.5 text-right">{formatOptionalAmount(garantie.capital ?? garantie.valeurAssuree)}</TableCell>
              <TableCell className="px-2 py-0.5">{franchiseLabel(garantie)}</TableCell>
              <TableCell className="px-2 py-0.5 text-right font-semibold">{showPrimes ? moneyAmount(garantie.prime) : "-"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function QuittanceSection({
  contrat,
  movementLabel,
  differential = false,
}: {
  contrat: ContratSummary;
  movementLabel?: string | null;
  differential?: boolean;
}) {
  const rows = financialSummaryRows(contrat);
  if (!rows.length) return null;
  return (
    <Section title={movementLabel
      ? `${differential ? "Quittance différentielle" : "Quittance"} - ${movementLabel}`
      : "Quittance générale"}>
      <Table className="text-[10px] [&_td]:px-2 [&_td]:py-1 [&_th]:h-6 [&_th]:px-2 [&_th]:text-[9px] [&_th]:uppercase">
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
          {rows.map((row) => (
            <TableRow key={row.key} className={row.emphasized ? "font-bold" : ""}>
              <TableCell>{row.label}</TableCell>
              <TableCell className="text-right">{moneyAmount(row.primeNette)}</TableCell>
              <TableCell className="text-right">{moneyAmount(row.taxe)}</TableCell>
              <TableCell className="text-right">{moneyAmount(row.taxeParafiscale)}</TableCell>
              <TableCell className="text-right">{moneyAmount(row.accessoire)}</TableCell>
              <TableCell className="text-right">{moneyAmount(row.cnpac)}</TableCell>
              <TableCell className="text-right">{moneyAmount(row.primeTotale)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Section>
  );
}

function financialSummaryRows(contrat: ContratSummary) {
  const lignes = (contrat.quittanceGenerale?.lignes ?? []).filter((ligne) => {
    const categorie = String(ligne.categorie ?? "").toUpperCase();
    return categorie !== "CORPOREL" || personneGaranties(contrat).length > 0;
  });
  const assistance = (contrat.assistances ?? []).reduce(
    (total, item) => ({
      primeNette: roundMoney(total.primeNette + numberOrZero(item.primeNette)),
      primeTotale: roundMoney(total.primeTotale + numberOrZero(item.primeTotale)),
    }),
    { primeNette: 0, primeTotale: 0 },
  );
  const hasAssistance = assistance.primeTotale !== 0;
  const rows = lignes.map((ligne) => ({
    key: `${ligne.categorie}-${ligne.ordre}`,
    label: ligne.globale
      ? (hasAssistance ? "Total automobile" : "Total général")
      : String(ligne.categorie ?? "").toUpperCase() === "CORPOREL" ? "PTA" : text(ligne.categorie),
    primeNette: numberOrZero(ligne.primeNette),
    taxe: numberOrZero(ligne.taxe),
    taxeParafiscale: numberOrZero(ligne.taxeParafiscale),
    accessoire: numberOrZero(ligne.accessoire),
    cnpac: numberOrZero(ligne.cnpac),
    primeTotale: numberOrZero(ligne.primeTotale),
    emphasized: Boolean(ligne.globale),
  }));
  if (!hasAssistance) return rows;

  const assistanceTax = roundMoney(assistance.primeTotale - assistance.primeNette);
  rows.push({
    key: "assistance",
    label: "ASSISTANCE",
    primeNette: assistance.primeNette,
    taxe: assistanceTax,
    taxeParafiscale: 0,
    accessoire: 0,
    cnpac: 0,
    primeTotale: assistance.primeTotale,
    emphasized: false,
  });
  const insurance = lignes.find((ligne) => ligne.globale) ?? contrat.quittanceGenerale;
  rows.push({
    key: "total-general",
    label: "Total général",
    primeNette: roundMoney(numberOrZero(insurance?.primeNette) + assistance.primeNette),
    taxe: roundMoney(numberOrZero(insurance?.taxe) + assistanceTax),
    taxeParafiscale: numberOrZero(insurance?.taxeParafiscale),
    accessoire: numberOrZero(insurance?.accessoire),
    cnpac: numberOrZero(insurance?.cnpac),
    primeTotale: roundMoney(numberOrZero(insurance?.primeTotale) + assistance.primeTotale),
    emphasized: true,
  });
  return rows;
}

function Section({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <section className="overflow-hidden border border-slate-200">
      <div className="flex items-center gap-1.5 border-l-2 border-emerald-600 bg-slate-100 px-2 py-1.5 text-[10px] font-bold uppercase text-slate-900">
        {icon}
        {title}
      </div>
      <div className="px-2 py-1">{children}</div>
    </section>
  );
}

function InfoGrid({ items }: { items: [string, ReactNode][] }) {
  return (
    <div className="grid gap-x-3 sm:grid-cols-3 md:grid-cols-5">
      {items.map(([label, value]) => (
        <div key={label} className="flex min-w-0 flex-col border-b border-dashed border-slate-200 py-1">
          <span className="text-[8px] font-bold uppercase leading-tight text-slate-500">{label}</span>
          <span className="mt-0.5 min-w-0 break-words text-[10px] font-semibold leading-tight text-slate-950">{isBlankNode(value) ? "-" : value}</span>
        </div>
      ))}
    </div>
  );
}

function PartiesGrid({
  souscripteur,
  proprietaire,
  conducteur,
}: {
  souscripteur?: ClientResponse | null;
  proprietaire?: ClientResponse | null;
  conducteur?: ClientResponse | null;
}) {
  const parties = groupContractParties(souscripteur, proprietaire, conducteur);
  return (
    <div className={`grid border border-slate-200 ${parties.length === 2 ? "md:grid-cols-2" : parties.length >= 3 ? "md:grid-cols-3" : ""}`}>
      {parties.map((party) => (
        <PartyColumn
          key={`${party.roles.join("-")}-${party.client?.id ?? "empty"}`}
          roles={party.roles}
          client={party.client}
          expanded={parties.length === 1}
        />
      ))}
    </div>
  );
}

function PartyColumn({
  roles,
  client,
  expanded = false,
}: {
  roles: string[];
  client?: ClientResponse | null;
  expanded?: boolean;
}) {
  return (
    <div className="min-w-0 border-b border-slate-200 p-2 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0">
      <p className="text-[9px] font-bold uppercase text-emerald-700">{roles.join(" · ")}</p>
      <div className={expanded ? "mt-1 grid items-start gap-x-4 gap-y-1 text-[10px] text-slate-700 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_2fr_1fr]" : "mt-1 space-y-0.5 text-[10px] text-slate-700"}>
        <p className="font-bold text-slate-950">{clientName(client)}</p>
        <p>{clientIdentity(client)}</p>
        <p>{text(client?.adresse)}{client?.ville ? `, ${client.ville}` : ""}</p>
        <p>Tél: {text(client?.telephone ?? client?.telephones?.find((tel) => tel.principal)?.numero)}</p>
      </div>
    </div>
  );
}

function FlotteFranchiseTable({ vehicles, garanties }: { vehicles: Vehicule[]; garanties: Garantie[] }) {
  const usages = Array.from(new Map(vehicles.map((vehicule) => [vehicule.usageCode ?? vehicule.usageLibelle ?? "-", vehicule.usageCode ?? vehicule.usageLibelle ?? "-"])).values());
  const rows = flotteFranchiseRows(vehicles, garanties, usages);
  if (!rows.length) return null;
  return (
    <>
      <h2 className="mt-2 text-sm font-bold">II. Les franchises</h2>
      <table className="mt-1 w-auto border-collapse text-[11px]">
        <thead>
          <tr className="bg-slate-100 text-center font-bold text-blue-950">
            <th className="border border-slate-700 px-2 py-1">Garanties</th>
            {usages.map((usage) => <th key={usage} className="border border-slate-700 px-3 py-1">Usage {usage}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.code}>
              <td className="border border-slate-700 px-2 py-1 font-bold">{row.code}</td>
              {usages.map((usage) => <td key={usage} className="border border-slate-700 px-2 py-1">{row.byUsage[usage] ?? "-"}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function FlotteQuittanceTable({ contrat, assistances }: { contrat: ContratSummary; assistances: AssistanceContrat[] }) {
  const lignes = contrat.quittanceGenerale?.lignes?.filter((ligne) => ligne.globale || moneyAmount(ligne.primeTotale) !== "0,00") ?? [];
  if (!lignes.length) return null;
  const assistanceNet = assistances.reduce((sum, item) => sum + Number(item.primeNette ?? 0), 0);
  const assistanceTtc = assistances.reduce((sum, item) => sum + Number(item.primeTotale ?? 0), 0);
  const assistanceTax = Math.max(0, assistanceTtc - assistanceNet);
  const detailLines = lignes.filter((ligne) => !ligne.globale);
  const total = lignes.find((ligne) => ligne.globale);
  return (
    <>
      <h2 className="mt-2 text-sm font-bold">III. Quittance</h2>
      <table className="mt-1 w-full border-collapse text-[11px]">
        <thead>
          <tr className="bg-slate-100 text-center font-bold text-blue-950">
            <th className="border border-slate-700 px-2 py-1 text-left">Catégorie</th>
            <th className="border border-slate-700 px-2 py-1">Prime nette</th>
            <th className="border border-slate-700 px-2 py-1">Taxes</th>
            <th className="border border-slate-700 px-2 py-1">TPF</th>
            <th className="border border-slate-700 px-2 py-1">ACC</th>
            <th className="border border-slate-700 px-2 py-1">CNPAC</th>
            <th className="border border-slate-700 px-2 py-1">Total</th>
          </tr>
        </thead>
        <tbody>
          {detailLines.map((ligne) => (
            <tr key={`${ligne.categorie}-${ligne.ordre}`}>
              <td className="border border-slate-700 px-2 py-1">{ligne.categorie}</td>
              <td className="border border-slate-700 px-2 py-1 text-right">{moneyAmount(ligne.primeNette)}</td>
              <td className="border border-slate-700 px-2 py-1 text-right">{moneyAmount(ligne.taxe)}</td>
              <td className="border border-slate-700 px-2 py-1 text-right">{moneyAmount(ligne.taxeParafiscale)}</td>
              <td className="border border-slate-700 px-2 py-1 text-right">{moneyAmount(ligne.accessoire)}</td>
              <td className="border border-slate-700 px-2 py-1 text-right">{moneyAmount(ligne.cnpac)}</td>
              <td className="border border-slate-700 px-2 py-1 text-right">{moneyAmount(ligne.primeTotale)}</td>
            </tr>
          ))}
          {assistanceTtc ? (
            <tr>
              <td className="border border-slate-700 px-2 py-1">ASSISTANCE</td>
              <td className="border border-slate-700 px-2 py-1 text-right">{moneyAmount(assistanceNet)}</td>
              <td className="border border-slate-700 px-2 py-1 text-right">{moneyAmount(assistanceTax)}</td>
              <td className="border border-slate-700 px-2 py-1 text-right">0,00</td>
              <td className="border border-slate-700 px-2 py-1 text-right">0,00</td>
              <td className="border border-slate-700 px-2 py-1 text-right">0,00</td>
              <td className="border border-slate-700 px-2 py-1 text-right">{moneyAmount(assistanceTtc)}</td>
            </tr>
          ) : null}
          {total ? (
            <tr className="font-bold">
              <td className="border border-slate-700 px-2 py-1">TOTAL</td>
              <td className="border border-slate-700 px-2 py-1 text-right">{moneyAmount(Number(total.primeNette ?? 0) + assistanceNet)}</td>
              <td className="border border-slate-700 px-2 py-1 text-right">{moneyAmount(Number(total.taxe ?? 0) + assistanceTax)}</td>
              <td className="border border-slate-700 px-2 py-1 text-right">{moneyAmount(total.taxeParafiscale)}</td>
              <td className="border border-slate-700 px-2 py-1 text-right">{moneyAmount(total.accessoire)}</td>
              <td className="border border-slate-700 px-2 py-1 text-right">{moneyAmount(total.cnpac)}</td>
              <td className="border border-slate-700 px-2 py-1 text-right">{moneyAmount(Number(total.primeTotale ?? 0) + assistanceTtc)}</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </>
  );
}

function flotteGuaranteeCodes(garanties: Garantie[]) {
  const preferred = ["RC", "DR", "V", "I", "BG", "DC", "RF", "DV", "RVE", "BOR", "BTP", "VOR"];
  const present = new Set(garanties.map((garantie) => String(garantie.code ?? "").toUpperCase()).filter(Boolean));
  const ordered = preferred.filter((code) => present.has(code));
  const extra = Array.from(present).filter((code) => !preferred.includes(code)).sort();
  return [...ordered, ...extra];
}

function flotteGuaranteeCell(garanties: Garantie[], code: string) {
  const garantie = garanties.find((item) => String(item.code ?? "").toUpperCase() === code);
  if (!garantie) return "";
  if (code === "DV" && Number(garantie.tauxFranchise) > 0) return `FR${compactNumber(Number(garantie.tauxFranchise))}%`;
  return "X";
}

function guaranteeFullLabel(garanties: Garantie[], code: string) {
  return text(garanties.find((garantie) => String(garantie.code ?? "").toUpperCase() === code)?.libelle);
}

function capitalForCode(garanties: Garantie[], code: string) {
  const garantie = garanties.find((item) => String(item.code ?? "").toUpperCase() === code);
  return amountNoCurrency(garantie?.capital ?? garantie?.valeurAssuree);
}

function assistanceCell(assistances: AssistanceContrat[], vehiculeId?: string | null) {
  const assistance = assistances.find((item) => String(item.vehiculeId ?? "") === String(vehiculeId ?? ""));
  return assistance?.produit ?? "";
}

function assistancePrime(assistances: AssistanceContrat[], vehiculeId?: string | null) {
  return assistances
    .filter((item) => String(item.vehiculeId ?? "") === String(vehiculeId ?? ""))
    .reduce((sum, item) => sum + Number(item.primeTotale ?? 0), 0);
}

function flotteFranchiseRows(vehicles: Vehicule[], garanties: Garantie[], usages: string[]) {
  const rows = new Map<string, { code: string; byUsage: Record<string, string> }>();
  for (const code of flotteGuaranteeCodes(garanties)) {
    const garantiesForCode = garanties.filter((garantie) =>
      String(garantie.code ?? "").toUpperCase() === code && hasPositiveFranchise(garantie)
    );
    if (!garantiesForCode.length) continue;
    const row = { code, byUsage: {} as Record<string, string> };
    for (const usage of usages) {
      const vehicleIds = new Set(vehicles.filter((vehicule) => (vehicule.usageCode ?? vehicule.usageLibelle ?? "-") === usage).map((vehicule) => String(vehicule.vehiculeId)));
      const garantie = garantiesForCode.find((item) => vehicleIds.has(String(item.vehiculeId ?? "")));
      row.byUsage[usage] = garantie ? franchiseLabel(garantie) : "-";
    }
    rows.set(code, row);
  }
  return Array.from(rows.values());
}

function amountNoCurrency(value?: number | null) {
  return value == null ? "" : moneyAmount(value);
}

function clientByRole(contrat: ContratSummary, role: string) {
  return contrat.clients?.find((item) => item.role === role)?.client ?? null;
}

function sameClientIdentity(left?: ClientResponse | null, right?: ClientResponse | null) {
  if (!left || !right) return false;
  return String(left.id ?? "") === String(right.id ?? "") && Boolean(left.id);
}

function groupContractParties(
  souscripteur?: ClientResponse | null,
  proprietaire?: ClientResponse | null,
  conducteur?: ClientResponse | null,
) {
  const groups: Array<{ client: ClientResponse; roles: string[] }> = [];
  const candidates = [
    { role: "Souscripteur", client: souscripteur },
    { role: "Propriétaire", client: proprietaire },
    { role: "Conducteur", client: conducteur },
  ];
  for (const candidate of candidates) {
    if (!candidate.client) continue;
    const existing = groups.find((group) => sameClientIdentity(group.client, candidate.client));
    if (existing) {
      existing.roles.push(candidate.role);
    } else {
      groups.push({ client: candidate.client, roles: [candidate.role] });
    }
  }
  return groups;
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

function productLabel(contrat: ContratSummary) {
  if (contrat.typeContrat === "CONVENTION") return "Convention";
  if (contrat.typeContrat === "FLOTTE") return "Flotte";
  return "Mono";
}

function payerTypeLabel(type?: ContratSummary["typePayeurPrime"]) {
  switch (type) {
    case "TRESORERIE_GROUPE":
      return "Trésorerie du groupe";
    case "MEMBRE_GROUPE":
      return "Membre du groupe";
    case "TIERS_MANDATE":
      return "Autre personne";
    default:
      return "Souscripteur";
  }
}

function isSubscriberPayer(contrat: ContratSummary, souscripteur?: ClientResponse | null) {
  if (!contrat.typePayeurPrime || contrat.typePayeurPrime === "SOUSCRIPTEUR") return true;
  if (contrat.payeurPrimeClientId == null || souscripteur?.id == null) return false;
  return String(contrat.payeurPrimeClientId) === String(souscripteur.id);
}

function billingModeLabel(mode?: ContratSummary["modeFacturation"]) {
  return mode === "CONSOLIDEE_GROUPE" ? "Consolidée au groupe" : "Directe au payeur";
}

function contractPaymentModeLabel(mode?: string | null) {
  if (mode === "facture") return "Règlement facture";
  if (mode === "bureau") return "Règlement bureau";
  return text(mode);
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

function garantieName(garantie: Garantie) {
  return text(garantie.libelle ?? garantie.code);
}

function vehicleGuaranteesForDisplay(garanties: Garantie[]): DisplayGarantie[] {
  const entries = garanties.map((garantie, originalIndex) => ({
    garantie,
    code: String(garantie.code ?? "").trim().toUpperCase(),
    originalIndex,
  }));
  const selectedCodes = new Set(entries.map((entry) => entry.code).filter(Boolean));
  const orderByCode = new Map<string, number>(
    VEHICLE_GUARANTEE_DISPLAY_ORDER.map((code, index) => [code, index]),
  );
  const ordered = [...entries].sort((left, right) => {
    const leftOrder = orderByCode.get(left.code) ?? VEHICLE_GUARANTEE_DISPLAY_ORDER.length + left.originalIndex;
    const rightOrder = orderByCode.get(right.code) ?? VEHICLE_GUARANTEE_DISPLAY_ORDER.length + right.originalIndex;
    return leftOrder - rightOrder || left.originalIndex - right.originalIndex;
  });

  return ordered.map(({ garantie, code }) => ({
    garantie,
    depth: selectedCodes.has(VEHICLE_GUARANTEE_PARENT_BY_CODE[code]) ? 1 : 0,
  }));
}

function franchiseLabel(garantie: Garantie) {
  const taux = Number(garantie.tauxFranchise) > 0 ? `${compactNumber(Number(garantie.tauxFranchise))} %` : null;
  const min = Number(garantie.franchiseMinimale) > 0 ? `min ${compactNumber(Number(garantie.franchiseMinimale))} DH` : null;
  return [taux, min].filter(Boolean).join(" avec ") || "-";
}

function hasPositiveFranchise(garantie: Garantie) {
  return Number(garantie.tauxFranchise) > 0 || Number(garantie.franchiseMinimale) > 0;
}

function compactNumber(value: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 4 }).format(value);
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
  conducteur?: ClientResponse | null;
  compagnie: string;
  convention: string;
  mouvement?: Mouvement | null;
  filename: string;
}) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const ctx: PdfContext = {
    pdf,
    x: 9,
    y: 10,
    width: 192,
    pageHeight: 297,
  };

  pdf.setProperties({ title: params.filename.replace(/\.pdf$/i, "") });
  const showGuaranteePrimes = params.contrat.typeContrat !== "PARTICULIER"
    || Boolean(params.contrat.saisiePrimeNette);
  drawPdfHeader(ctx, params);
  drawPdfSection(ctx, "CONTRAT", () => {
    drawPdfInfoGrid(ctx, [
      ["Nature", params.mouvement?.libelle ?? latestEvent(params.contrat)],
      ["Produit", productLabel(params.contrat)],
      ["Compagnie", params.compagnie],
      ...(params.contrat.typeContrat === "CONVENTION" ? [["Convention", params.convention] as [string, string]] : []),
      ["N° attestation", firstAttestation(params.contrat)],
      ["Date d'effet", formatDate(params.mouvement?.dateEffet ?? params.contrat.dateEffet)],
      ["Date d'échéance", formatDate(params.mouvement?.dateEcheance ?? params.contrat.dateEcheance)],
      ["Fractionnement", text(params.contrat.fractionnement)],
    ]);
  });

  drawPdfSection(ctx, "INFORMATIONS CLIENT", () => {
    drawPdfParties(ctx, params.souscripteur, params.proprietaire, params.conducteur);
  });

  for (const [index, vehicule] of (params.contrat.vehicules ?? []).entries()) {
    const vehicleTitle = (params.contrat.vehicules?.length ?? 0) > 1
      ? `INFORMATIONS VÉHICULE ${index + 1}`
      : "INFORMATIONS VÉHICULE";
    drawPdfSection(ctx, vehicleTitle, () => {
      drawPdfInfoGrid(ctx, [
        ["Usage", [vehicule.usageCode, vehicule.usageLibelle].filter(Boolean).join(" - ")],
        ["Marque", text(vehicule.marque)],
        ["Immatriculation", text(vehicule.immatriculation)],
        ["Carburant", text(vehicule.carburant)],
        [vehicule.cylindree ? "Cylindrée" : "Puissance fiscale", text(vehicule.cylindree ?? vehicule.puissanceFiscale)],
        ["Date de MC", formatDate(vehicule.datePremiereCirculation)],
        ["Carrosserie", text(vehicule.carrosserie)],
        ["Nombre de places", text(vehicule.nombrePlaces)],
        ["CRM", text(vehicule.crm)],
        ["Valeur à neuf", formatOptionalAmount(vehicule.valeurNeuf)],
        ["Valeur vénale", formatOptionalAmount(vehicule.valeurVenale)],
        ["Valeur glaces", formatOptionalAmount(vehicule.valeurGlace)],
      ]);
    });
    const garanties = (params.contrat.garanties ?? []).filter((garantie) => String(garantie.vehiculeId ?? "") === String(vehicule.vehiculeId));
    if (garanties.some((garantie) => String(garantie.typeGarantie ?? "").toUpperCase() !== "PERSONNE")) {
      const title = (params.contrat.vehicules?.length ?? 0) > 1
        ? `LES GARANTIES ASSURÉES ${index + 1}`
        : "LES GARANTIES ASSURÉES";
      drawPdfSection(ctx, title, () => {
        drawPdfGaranties(
          ctx,
          garanties,
          String(params.mouvement?.code ?? "").toUpperCase() === "CHV_M" ? "Prime différentielle" : "Prime nette",
          showGuaranteePrimes,
        );
      });
    }
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
    });
    const garanties = (params.contrat.garanties ?? []).filter((garantie) => String(garantie.remorqueId ?? "") === String(remorque.remorqueId));
    if (garanties.some((garantie) => String(garantie.typeGarantie ?? "").toUpperCase() !== "PERSONNE")) {
      const title = (params.contrat.remorques?.length ?? 0) > 1 ? `GARANTIES REMORQUE ${index + 1}` : "GARANTIES REMORQUE";
      drawPdfSection(ctx, title, () => {
        drawPdfGaranties(ctx, garanties, "Prime nette", showGuaranteePrimes);
      });
    }
  }

  const personnes = personneGaranties(params.contrat);
  if (personnes.length) {
    drawPdfSection(ctx, "LES GARANTIES DES PERSONNES", () => drawPdfPersonnes(ctx, personnes, showGuaranteePrimes));
  }

  const assistances = params.contrat.assistances ?? [];
  if (assistances.length) {
    drawPdfSection(ctx, "ASSISTANCE", () => drawPdfAssistances(ctx, assistances));
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
  pdf.setFontSize(6.5);
  pdf.setTextColor(4, 120, 87);
  pdf.text("FICHE SYNTHÈSE", ctx.x, ctx.y);
  ctx.y += 5;
  pdf.setTextColor(2, 6, 23);
  pdf.setFontSize(12);
  pdf.text(pdfSafe(`Dossier N° ${params.dossier}`), ctx.x, ctx.y);
  pdf.setFontSize(7);
  pdf.text(pdfSafe(text(params.contrat.numeroPolice)), ctx.x + ctx.width, ctx.y - 1, { align: "right" });
  ctx.y += 4.5;
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(71, 85, 105);
  pdf.text(pdfSafe(`${productLabel(params.contrat)} · Automobile`), ctx.x, ctx.y);
  pdf.text("Police N°", ctx.x + ctx.width, ctx.y, { align: "right" });
  ctx.y += 5;
  pdf.setDrawColor(15, 23, 42);
  pdf.setLineWidth(0.5);
  pdf.line(ctx.x, ctx.y, ctx.x + ctx.width, ctx.y);
  ctx.y += 3;
}

function drawPdfSection(ctx: PdfContext, title: string, draw: () => void) {
  ensurePdfSpace(ctx, 12);
  const { pdf } = ctx;
  pdf.setFillColor(255, 255, 255);
  pdf.setDrawColor(203, 213, 225);
  pdf.rect(ctx.x, ctx.y, ctx.width, 5, "FD");
  pdf.setFillColor(5, 150, 105);
  pdf.rect(ctx.x, ctx.y, 0.8, 5, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(6.5);
  pdf.setTextColor(2, 6, 23);
  pdf.text(pdfSafe(title), ctx.x + 3, ctx.y + 3.5);
  ctx.y += 6;
  draw();
  pdf.setDrawColor(226, 232, 240);
  pdf.line(ctx.x, ctx.y, ctx.x + ctx.width, ctx.y);
  ctx.y += 2;
}

function drawPdfInfoGrid(ctx: PdfContext, items: [string, ReactNode][]) {
  const columnCount = 5;
  const columnGap = 2;
  const columnWidth = (ctx.width - 6 - columnGap * (columnCount - 1)) / columnCount;
  for (let index = 0; index < items.length; index += columnCount) {
    const row = items.slice(index, index + columnCount);
    const wrapped = row.map(([, value]) => wrapPdfText(ctx, valueToPdfText(value), columnWidth));
    const rowHeight = Math.max(7, 4.5 + Math.max(...wrapped.map((lines) => lines.length)) * 2.3);
    ensurePdfSpace(ctx, rowHeight);
    row.forEach(([label], columnIndex) => {
      drawPdfInfoCell(
        ctx,
        label,
        wrapped[columnIndex],
        ctx.x + 3 + columnIndex * (columnWidth + columnGap),
        ctx.y,
        columnWidth,
        rowHeight,
      );
    });
    ctx.y += rowHeight;
  }
}

function drawPdfInfoCell(ctx: PdfContext, label: string, lines: string[], x: number, y: number, width: number, height: number) {
  ctx.pdf.setDrawColor(226, 232, 240);
  ctx.pdf.line(x, y + height - 1, x + width, y + height - 1);
  ctx.pdf.setFont("helvetica", "bold");
  ctx.pdf.setFontSize(5.5);
  ctx.pdf.setTextColor(100, 116, 139);
  ctx.pdf.text(pdfSafe(label.toUpperCase()), x, y + 2.5, { maxWidth: width });
  ctx.pdf.setFontSize(6.3);
  ctx.pdf.setTextColor(2, 6, 23);
  ctx.pdf.text(lines.length ? lines : ["-"], x, y + 5.3, { maxWidth: width });
}

function drawPdfParties(
  ctx: PdfContext,
  souscripteur?: ClientResponse | null,
  proprietaire?: ClientResponse | null,
  conducteur?: ClientResponse | null,
) {
  const parties = groupContractParties(souscripteur, proprietaire, conducteur);
  if (!parties.length) return;
  const availableWidth = ctx.width - 6;
  const startX = ctx.x + 3;
  const startY = ctx.y;

  if (parties.length === 1) {
    const party = parties[0];
    const details = [
      clientName(party.client),
      clientIdentity(party.client),
      `${text(party.client.adresse)}${party.client.ville ? `, ${party.client.ville}` : ""}`,
      `Tél: ${text(party.client.telephone ?? party.client.telephones?.find((tel) => tel.principal)?.numero)}`,
    ];
    const widths = [0.2, 0.22, 0.4, 0.18].map((ratio) => availableWidth * ratio);
    const wrapped = details.map((detail, index) => wrapPdfText(ctx, detail, widths[index] - 4));
    const height = Math.max(11, 6 + Math.max(...wrapped.map((lines) => lines.length)) * 2.8);
    ensurePdfSpace(ctx, height);
    ctx.pdf.setDrawColor(203, 213, 225);
    ctx.pdf.rect(startX, startY, availableWidth, height, "S");
    ctx.pdf.setFont("helvetica", "bold");
    ctx.pdf.setFontSize(5.8);
    ctx.pdf.setTextColor(4, 120, 87);
    ctx.pdf.text(pdfSafe(party.roles.join(" · ").toUpperCase()), startX + 2, startY + 3.5);
    let x = startX + 2;
    wrapped.forEach((lines, index) => {
      ctx.pdf.setFont("helvetica", index === 0 ? "bold" : "normal");
      ctx.pdf.setFontSize(index === 0 ? 7 : 6);
      ctx.pdf.setTextColor(30, 41, 59);
      ctx.pdf.text(lines, x, startY + 7, { maxWidth: widths[index] - 4 });
      x += widths[index];
    });
    ctx.y = startY + height;
    return;
  }

  const width = availableWidth / parties.length;
  const content = parties.map((party) => [
    clientName(party.client),
    clientIdentity(party.client),
    `${text(party.client.adresse)}${party.client.ville ? `, ${party.client.ville}` : ""}`,
    `Tél: ${text(party.client.telephone ?? party.client.telephones?.find((tel) => tel.principal)?.numero)}`,
  ].map((line) => wrapPdfText(ctx, line, width - 5)));
  const maxLines = Math.max(...content.map((lines) => lines.reduce((total, line) => total + line.length, 0)));
  const height = Math.max(14, 7 + maxLines * 2.8);
  ensurePdfSpace(ctx, height);

  parties.forEach((party, index) => {
    const x = startX + index * width;
    ctx.pdf.setDrawColor(203, 213, 225);
    ctx.pdf.rect(x, startY, width, height, "S");
    ctx.pdf.setFont("helvetica", "bold");
    ctx.pdf.setFontSize(5.8);
    ctx.pdf.setTextColor(4, 120, 87);
    ctx.pdf.text(pdfSafe(party.roles.join(" · ").toUpperCase()), x + 2, startY + 3.5);
    let y = startY + 7;
    content[index].forEach((lines, lineIndex) => {
      ctx.pdf.setFont("helvetica", lineIndex === 0 ? "bold" : "normal");
      ctx.pdf.setFontSize(lineIndex === 0 ? 7 : 6);
      ctx.pdf.setTextColor(30, 41, 59);
      ctx.pdf.text(lines, x + 2, y, { maxWidth: width - 4 });
      y += lines.length * 2.8;
    });
  });
  ctx.y = startY + height;
}

function drawPdfGaranties(
  ctx: PdfContext,
  garanties: Garantie[],
  primeLabel = "Prime nette",
  showPrimes = true,
) {
  const vehiculeGaranties = garanties.filter((garantie) => String(garantie.typeGarantie ?? "").toUpperCase() !== "PERSONNE");
  if (!vehiculeGaranties.length) return;
  const displayGaranties = vehicleGuaranteesForDisplay(vehiculeGaranties);
  drawPdfTable(ctx, ["Les Garanties du Véhicule", "Valeur assurée", "Franchise", primeLabel], displayGaranties.map(({ garantie, depth }) => [
    `${depth === 1 ? "* " : ""}${garantieName(garantie)}`,
    formatOptionalAmount(garantie.capital ?? garantie.valeurAssuree),
    franchiseLabel(garantie),
    showPrimes ? moneyAmount(garantie.prime) : "-",
  ]), [68, 36, 48, 28], {
    alignments: ["left", "center", "center", "right"],
    firstColumnIndents: displayGaranties.map(({ depth }) => depth === 1 ? 5 : 0),
  });
}

function drawPdfPersonnes(ctx: PdfContext, garanties: Garantie[], showPrimes: boolean) {
  drawPdfTable(ctx, ["Garantie", "Décès", "Invalidité", "Frais médicaux", "Prime nette"], garanties.map((garantie) => [
    garantieName(garantie),
    amountOrDash(garantie.montantDeces),
    amountOrDash(garantie.montantInvalidite),
    amountOrDash(garantie.montantFraisMedicaux),
    showPrimes ? moneyAmount(garantie.prime) : "-",
  ]), [60, 30, 30, 34, 26]);
}

function drawPdfAssistances(ctx: PdfContext, assistances: AssistanceContrat[]) {
  drawPdfTable(ctx, ["N° contrat", "Compagnie", "Produit", "Période", "Prime TTC"], assistances.map((assistance) => [
    text(assistance.numeroContratOuQuittance),
    text(assistance.compagnieAssistanceLibelle),
    text(assistance.produit),
    `${formatDate(assistance.dateEffet)} au ${formatDate(assistance.dateEcheance)}`,
    moneyAmount(assistance.primeTotale),
  ]), [28, 43, 43, 42, 24]);
}

function drawPdfQuittance(ctx: PdfContext, contrat: ContratSummary) {
  const rows = financialSummaryRows(contrat);
  drawPdfTable(ctx, ["Catégorie", "P. nette", "Taxes", "TPF", "Accessoires", "CNPAC", "Total"], rows.map((row) => [
    row.label,
    moneyAmount(row.primeNette),
    moneyAmount(row.taxe),
    moneyAmount(row.taxeParafiscale),
    moneyAmount(row.accessoire),
    moneyAmount(row.cnpac),
    moneyAmount(row.primeTotale),
  ]), [28, 27, 27, 22, 30, 24, 22], {
    emphasizedRows: new Set(rows.flatMap((row, index) => row.emphasized ? [index] : [])),
  });
}

function drawPdfTable(
  ctx: PdfContext,
  headers: string[],
  rows: string[][],
  widths: number[],
  options: {
    emphasizedRows?: Set<number>;
    alignments?: Array<"left" | "center" | "right">;
    firstColumnIndents?: number[];
  } = {},
) {
  if (!rows.length) return;
  const tableX = ctx.x + 3;
  const tableWidth = ctx.width - 6;
  const totalWidth = widths.reduce((sum, width) => sum + width, 0);
  const actualWidths = widths.map((width) => (width / totalWidth) * tableWidth);
  const headerHeight = 5;
  ensurePdfSpace(ctx, headerHeight * 2);
  ctx.pdf.setFillColor(255, 255, 255);
  ctx.pdf.setDrawColor(203, 213, 225);
  ctx.pdf.rect(tableX, ctx.y, tableWidth, headerHeight, "FD");
  let cursorX = tableX + 1.5;
  ctx.pdf.setFont("helvetica", "bold");
  ctx.pdf.setFontSize(6);
  ctx.pdf.setTextColor(51, 65, 85);
  headers.forEach((header, index) => {
    const align = options.alignments?.[index] ?? (index === 0 ? "left" : "right");
    const textX = pdfCellTextX(cursorX, actualWidths[index], align);
    ctx.pdf.text(pdfSafe(header), textX, ctx.y + 3.4, { align, maxWidth: actualWidths[index] - 3 });
    cursorX += actualWidths[index];
  });
  ctx.y += headerHeight;

  for (const [rowIndex, row] of rows.entries()) {
    const firstColumnIndent = options.firstColumnIndents?.[rowIndex] ?? 0;
    const wrapped = row.map((cell, index) => wrapPdfText(
      ctx,
      cell,
      actualWidths[index] - 3 - (index === 0 ? firstColumnIndent : 0),
    ));
    const rowHeight = Math.max(4.8, 2 + Math.max(...wrapped.map((lines) => lines.length)) * 2.5);
    ensurePdfSpace(ctx, rowHeight + 1);
    cursorX = tableX + 1.5;
    ctx.pdf.setDrawColor(226, 232, 240);
    ctx.pdf.line(tableX, ctx.y, tableX + tableWidth, ctx.y);
    row.forEach((_cell, index) => {
      const isLast = index === row.length - 1;
      const emphasized = options.emphasizedRows?.has(rowIndex) ?? false;
      ctx.pdf.setFont("helvetica", emphasized || isLast ? "bold" : "normal");
      ctx.pdf.setFontSize(6.3);
      ctx.pdf.setTextColor(2, 6, 23);
      const align = options.alignments?.[index] ?? (index === 0 ? "left" : "right");
      const textX = pdfCellTextX(cursorX, actualWidths[index], align)
        + (index === 0 && align === "left" ? firstColumnIndent : 0);
      ctx.pdf.text(wrapped[index], textX, ctx.y + 3.2, { align, maxWidth: actualWidths[index] - 3 });
      cursorX += actualWidths[index];
    });
    ctx.y += rowHeight;
  }
  ctx.pdf.line(tableX, ctx.y, tableX + tableWidth, ctx.y);
  ctx.y += 1;
}

function pdfCellTextX(
  cursorX: number,
  width: number,
  align: "left" | "center" | "right",
) {
  if (align === "center") return cursorX + width / 2 - 0.75;
  if (align === "right") return cursorX + width - 2;
  return cursorX;
}

function ensurePdfSpace(ctx: PdfContext, needed: number) {
  if (ctx.y + needed <= ctx.pageHeight - 12) return;
  ctx.pdf.addPage();
  ctx.y = 10;
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
    .replace(/·/g, "-")
    .replace(/[–—]/g, "-");
}

function sanitizeFilename(value: string) {
  return value.replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "dossier";
}
