import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Boxes, CheckCircle2, PackagePlus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { productionApi } from "../api";
import { toDateOnly } from "../date";
import type { LivraisonAttestation, ReferenceOption } from "../types";

type LivraisonSource = "COMMANDE" | "RECEPTION_DIRECTE";

const today = () => new Date().toISOString().slice(0, 10);

const emptyCreateForm = {
  compagnieAssuranceId: "",
  source: "COMMANDE" as LivraisonSource,
  dateDemande: today(),
  dateReception: today(),
  referenceBl: "",
  groupeUsageAttestationCode: "",
  quantiteDemandee: "1",
  numeroDebut: "",
  numeroFin: "",
  commentaireDecision: "",
};

const emptyLotForm = {
  livraisonId: "",
  groupeUsageAttestationCode: "",
  quantite: "1",
  numeroDebut: "",
  numeroFin: "",
};

export default function AttestationStockPage() {
  const queryClient = useQueryClient();
  const [source, setSource] = useState<LivraisonSource>("COMMANDE");
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [lotForm, setLotForm] = useState(emptyLotForm);

  const compagnies = useQuery({
    queryKey: ["referentiel", "compagnies-assurance"],
    queryFn: () => productionApi.referentiel("compagnies-assurance"),
  });
  const groupes = useQuery({
    queryKey: ["referentiel", "groupes-usage-attestation"],
    queryFn: () => productionApi.referentiel("groupes-usage-attestation"),
  });
  const livraisons = useQuery({
    queryKey: ["livraisons-attestations", source],
    queryFn: () => productionApi.listLivraisonsAttestation(source),
  });

  const rows = livraisons.data ?? [];
  const selectedLivraison = useMemo(
    () => rows.find((item) => item.id === lotForm.livraisonId),
    [rows, lotForm.livraisonId]
  );
  const groupeOptions = groupes.data ?? [];

  const createLivraison = useMutation({
    mutationFn: productionApi.createLivraisonAttestation,
    onSuccess: async (livraison) => {
      toast.success("Livraison d'attestations créée");
      setSource(livraison.source);
      setCreateForm(emptyCreateForm);
      setLotForm((current) => ({ ...current, livraisonId: livraison.id }));
      await queryClient.invalidateQueries({ queryKey: ["livraisons-attestations"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Création impossible"),
  });

  const addLot = useMutation({
    mutationFn: () =>
      productionApi.addLotAttestation(lotForm.livraisonId, {
        groupeUsageAttestationCode: lotForm.groupeUsageAttestationCode,
        quantite: toPositiveInteger(lotForm.quantite) ?? rangeQuantity(lotForm.numeroDebut, lotForm.numeroFin),
        numeroDebut: lotForm.numeroDebut,
        numeroFin: lotForm.numeroFin,
      }),
    onSuccess: async () => {
      toast.success("Lot ajouté");
      setLotForm((current) => ({
        ...emptyLotForm,
        livraisonId: current.livraisonId,
        groupeUsageAttestationCode: current.groupeUsageAttestationCode,
      }));
      await queryClient.invalidateQueries({ queryKey: ["livraisons-attestations"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Ajout du lot impossible"),
  });

  const validateLivraison = useMutation({
    mutationFn: productionApi.validateLivraisonAttestation,
    onSuccess: async () => {
      toast.success("Livraison validée");
      await queryClient.invalidateQueries({ queryKey: ["livraisons-attestations"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Validation impossible"),
  });

  function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const quantite = toPositiveInteger(createForm.quantiteDemandee) ?? rangeQuantity(createForm.numeroDebut, createForm.numeroFin);
    if (!createForm.compagnieAssuranceId || !createForm.groupeUsageAttestationCode || !quantite) {
      toast.error("Compagnie, groupe et quantité sont obligatoires");
      return;
    }
    if (createForm.source === "RECEPTION_DIRECTE" && (!createForm.numeroDebut || !createForm.numeroFin)) {
      toast.error("Les bornes du lot sont obligatoires pour une réception directe");
      return;
    }
    createLivraison.mutate({
      compagnieAssuranceId: createForm.compagnieAssuranceId,
      source: createForm.source,
      dateDemande: createForm.source === "COMMANDE" ? createForm.dateDemande : undefined,
      dateReception: createForm.source === "RECEPTION_DIRECTE" ? createForm.dateReception : undefined,
      referenceBl: valueOrUndefined(createForm.referenceBl),
      commentaireDecision: valueOrUndefined(createForm.commentaireDecision),
      lignes: [
        {
          groupeUsageAttestationCode: createForm.groupeUsageAttestationCode,
          quantiteDemandee: quantite,
          numeroDebut: createForm.source === "RECEPTION_DIRECTE" ? createForm.numeroDebut : undefined,
          numeroFin: createForm.source === "RECEPTION_DIRECTE" ? createForm.numeroFin : undefined,
        },
      ],
    });
  }

  function submitLot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lotForm.livraisonId || !lotForm.groupeUsageAttestationCode || !lotForm.numeroDebut || !lotForm.numeroFin) {
      toast.error("Livraison, groupe et bornes du lot sont obligatoires");
      return;
    }
    addLot.mutate();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Stock des attestations</h1>
          <p className="text-sm text-muted-foreground">
            Commandes, réceptions, lots et validation avant consommation pendant la production.
          </p>
        </div>
        <Select value={source} onValueChange={(value) => setSource(value as LivraisonSource)}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="COMMANDE">Commandes</SelectItem>
            <SelectItem value="RECEPTION_DIRECTE">Réceptions directes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card className="border-border/70 shadow-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Boxes className="size-4" />
              Livraisons
            </CardTitle>
            <Badge variant="outline">{rows.length}</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Référence</TableHead>
                  <TableHead>Compagnie</TableHead>
                  <TableHead>Groupes</TableHead>
                  <TableHead>Reçu</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((livraison) => (
                  <TableRow key={livraison.id} className={lotForm.livraisonId === livraison.id ? "bg-muted/50" : undefined}>
                    <TableCell className="min-w-52 align-top">
                      <button
                        type="button"
                        className="text-left font-medium hover:underline"
                        onClick={() => setLotForm((current) => ({ ...current, livraisonId: livraison.id }))}
                      >
                        {livraison.referenceCommande ?? livraison.referenceBl ?? livraison.id}
                      </button>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {livraison.source === "COMMANDE" ? livraison.dateDemande : livraison.dateReception}
                      </div>
                    </TableCell>
                    <TableCell className="align-top">{livraison.compagnieAssuranceNom}</TableCell>
                    <TableCell className="align-top">
                      <div className="flex flex-wrap gap-1.5">
                        {livraison.lignes.map((ligne) => (
                          <Badge key={ligne.id} variant="secondary">
                            {ligne.groupeUsageAttestationCode} {ligne.quantiteRecue}/{ligne.quantiteDemandee}
                          </Badge>
                        ))}
                      </div>
                      {livraison.lots.length > 0 ? (
                        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                          {livraison.lots.map((lot) => (
                            <div key={lot.id}>
                              {lot.groupeUsageAttestationCode}: {lot.prefixe}
                              {lot.numeroDebut}-{lot.numeroFin} ({lot.quantite})
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="align-top">
                      {livraison.quantiteRecue}/{livraison.quantiteDemandee}
                    </TableCell>
                    <TableCell className="align-top">
                      <Badge variant={statusVariant(livraison.statut)}>{statusLabel(livraison.statut)}</Badge>
                    </TableCell>
                    <TableCell className="text-right align-top">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={livraison.validee || livraison.lots.length === 0 || validateLivraison.isPending}
                        onClick={() => validateLivraison.mutate(livraison.id)}
                      >
                        <CheckCircle2 className="size-4" />
                        Valider
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">
                      Aucune livraison pour ce filtre.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-border/70 shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Plus className="size-4" />
                Nouvelle livraison
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={submitCreate}>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <Field label="Compagnie">
                    <Select
                      value={createForm.compagnieAssuranceId}
                      onValueChange={(value) => setCreateForm((current) => ({ ...current, compagnieAssuranceId: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        {(compagnies.data ?? []).map((compagnie) => (
                          <SelectItem key={compagnie.id} value={compagnie.id}>
                            {compagnie.libelle}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Source">
                    <Select
                      value={createForm.source}
                      onValueChange={(value) => setCreateForm((current) => ({ ...current, source: value as LivraisonSource }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="COMMANDE">Commande</SelectItem>
                        <SelectItem value="RECEPTION_DIRECTE">Réception directe</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Groupe usage">
                    <GroupSelect
                      value={createForm.groupeUsageAttestationCode}
                      groupes={groupeOptions}
                      onChange={(value) => setCreateForm((current) => ({ ...current, groupeUsageAttestationCode: value }))}
                    />
                  </Field>
                  <Field label="Quantité">
                    <Input
                      inputMode="numeric"
                      value={createForm.quantiteDemandee}
                      onChange={(event) => setCreateForm((current) => ({ ...current, quantiteDemandee: event.target.value }))}
                    />
                  </Field>
                  {createForm.source === "COMMANDE" ? (
                    <Field label="Date demande">
                      <DatePicker
                        date={createForm.dateDemande}
                        onSelect={(date) => setCreateForm((current) => ({ ...current, dateDemande: toDateOnly(date) ?? "" }))}
                      />
                    </Field>
                  ) : (
                    <Field label="Date réception">
                      <DatePicker
                        date={createForm.dateReception}
                        onSelect={(date) => setCreateForm((current) => ({ ...current, dateReception: toDateOnly(date) ?? "" }))}
                      />
                    </Field>
                  )}
                  <Field label="Référence BL">
                    <Input
                      value={createForm.referenceBl}
                      onChange={(event) => setCreateForm((current) => ({ ...current, referenceBl: event.target.value }))}
                    />
                  </Field>
                  {createForm.source === "RECEPTION_DIRECTE" ? (
                    <>
                      <Field label="N° début">
                        <Input
                          inputMode="numeric"
                          value={createForm.numeroDebut}
                          onChange={(event) => setCreateForm((current) => ({ ...current, numeroDebut: event.target.value }))}
                        />
                      </Field>
                      <Field label="N° fin">
                        <Input
                          inputMode="numeric"
                          value={createForm.numeroFin}
                          onChange={(event) => setCreateForm((current) => ({ ...current, numeroFin: event.target.value }))}
                        />
                      </Field>
                    </>
                  ) : null}
                </div>
                <Field label="Commentaire">
                  <Textarea
                    value={createForm.commentaireDecision}
                    onChange={(event) => setCreateForm((current) => ({ ...current, commentaireDecision: event.target.value }))}
                  />
                </Field>
                <Button type="submit" className="w-full" disabled={createLivraison.isPending}>
                  <Plus className="size-4" />
                  Créer
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <PackagePlus className="size-4" />
                Ajouter un lot
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={submitLot}>
                <Field label="Livraison">
                  <Select
                    value={lotForm.livraisonId}
                    onValueChange={(value) => setLotForm((current) => ({ ...current, livraisonId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      {rows
                        .filter((livraison) => !livraison.validee)
                        .map((livraison) => (
                          <SelectItem key={livraison.id} value={livraison.id}>
                            {livraison.referenceCommande ?? livraison.referenceBl ?? livraison.id}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </Field>
                {selectedLivraison ? (
                  <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    {selectedLivraison.compagnieAssuranceNom} · {selectedLivraison.quantiteRecue}/{selectedLivraison.quantiteDemandee} reçues
                  </div>
                ) : null}
                <Field label="Groupe usage">
                  <GroupSelect
                    value={lotForm.groupeUsageAttestationCode}
                    groupes={groupeOptions}
                    onChange={(value) => setLotForm((current) => ({ ...current, groupeUsageAttestationCode: value }))}
                  />
                </Field>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Quantité">
                    <Input
                      inputMode="numeric"
                      value={lotForm.quantite}
                      onChange={(event) => setLotForm((current) => ({ ...current, quantite: event.target.value }))}
                    />
                  </Field>
                  <Field label="Début">
                    <Input
                      inputMode="numeric"
                      value={lotForm.numeroDebut}
                      onChange={(event) => setLotForm((current) => ({ ...current, numeroDebut: event.target.value }))}
                    />
                  </Field>
                  <Field label="Fin">
                    <Input
                      inputMode="numeric"
                      value={lotForm.numeroFin}
                      onChange={(event) => setLotForm((current) => ({ ...current, numeroFin: event.target.value }))}
                    />
                  </Field>
                </div>
                <Button type="submit" className="w-full" variant="secondary" disabled={addLot.isPending}>
                  <PackagePlus className="size-4" />
                  Ajouter lot
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function GroupSelect({
  value,
  groupes,
  onChange,
}: {
  value: string;
  groupes: ReferenceOption[];
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Sélectionner" />
      </SelectTrigger>
      <SelectContent>
        {groupes.map((groupe) => (
          <SelectItem key={groupe.id} value={groupe.code ?? groupe.id}>
            {groupe.code} · {groupe.libelle}
            {typeof groupe.restrictionCompagnie === "string" ? ` (${groupe.restrictionCompagnie})` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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

function toPositiveInteger(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function rangeQuantity(numeroDebut: string, numeroFin: string) {
  const debut = Number.parseInt(numeroDebut, 10);
  const fin = Number.parseInt(numeroFin, 10);
  if (!Number.isFinite(debut) || !Number.isFinite(fin) || fin < debut) {
    return undefined;
  }
  return fin - debut + 1;
}

function valueOrUndefined(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
