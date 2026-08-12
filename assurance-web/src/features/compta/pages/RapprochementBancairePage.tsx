import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  FileSpreadsheet,
  FileSearch,
  Plus,
  RefreshCw,
  Save,
  Settings2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuthStore } from "@/store/auth-store";
import { comptaApi } from "../api";
import type {
  BankStatementImport,
  BankStatementImportConfiguration,
  BankStatementLine,
  PaymentInstrument,
} from "../types";
import { formatTreasuryDate, formatTreasuryMoney, paymentModeLabel } from "./treasury-format";

const EMPTY_CONFIGURATION: BankStatementImportConfiguration = {
  ligneEntete: 1,
  encodage: "UTF-8",
  formatDate: "dd/MM/yyyy",
  separateurDecimal: ",",
  colonnes: {},
  enregistrerProfil: false,
};

const COLUMN_FIELDS = [
  ["dateOperation", "Date opération", true],
  ["dateValeur", "Date valeur", false],
  ["libelle", "Libellé", true],
  ["reference", "Référence", false],
  ["contrepartie", "Contrepartie", false],
  ["debit", "Débit", false],
  ["credit", "Crédit", false],
  ["montant", "Montant unique", false],
  ["sens", "Sens débit/crédit", false],
  ["solde", "Solde", false],
] as const;

type MatchDraft = { instrumentId: string; montant: number };

export default function RapprochementBancairePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const canManage = permissions.includes("tresorerie:manage");
  const [accountId, setAccountId] = useState(searchParams.get("compteId") ?? "");
  const [importId, setImportId] = useState(searchParams.get("importId") ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [profileId, setProfileId] = useState("");
  const [configuration, setConfiguration] = useState(EMPTY_CONFIGURATION);
  const [importOptionsOpen, setImportOptionsOpen] = useState(false);
  const [preview, setPreview] = useState<BankStatementImport | null>(null);
  const [matches, setMatches] = useState<Record<string, MatchDraft[]>>({});
  const [ignoredIds, setIgnoredIds] = useState<Set<string>>(new Set());

  const accounts = useQuery({
    queryKey: ["compta", "treasury-accounts"],
    queryFn: comptaApi.treasuryAccounts,
  });
  const bankAccounts = (accounts.data ?? []).filter((account) => account.typeCompte === "BANQUE");

  useEffect(() => {
    if (!accountId && bankAccounts.length) setAccountId(bankAccounts[0].id);
  }, [accountId, bankAccounts]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (accountId) next.set("compteId", accountId);
    if (importId) next.set("importId", importId);
    setSearchParams(next, { replace: true });
  }, [accountId, importId, setSearchParams]);

  const imports = useQuery({
    queryKey: ["compta", "bank-statements", accountId],
    queryFn: () => comptaApi.bankStatementImports(accountId),
    enabled: Boolean(accountId),
  });
  const profiles = useQuery({
    queryKey: ["compta", "bank-statement-profiles", accountId],
    queryFn: () => comptaApi.bankStatementProfiles(accountId),
    enabled: Boolean(accountId),
  });
  const detail = useQuery({
    queryKey: ["compta", "bank-statement", importId],
    queryFn: () => comptaApi.bankStatementImport(importId),
    enabled: Boolean(importId),
  });
  const pendingInstruments = useQuery({
    queryKey: ["compta", "payment-instruments", "pending"],
    queryFn: comptaApi.pendingPaymentInstruments,
    enabled: Boolean(importId),
  });

  useEffect(() => {
    if (!detail.data) return;
    const nextMatches: Record<string, MatchDraft[]> = {};
    const nextIgnored = new Set<string>();
    detail.data.lignes.forEach((line) => {
      const selected = line.rapprochements.filter((row) => row.statut === "SELECTIONNE");
      if (line.id && selected.length) {
        nextMatches[line.id] = selected.map((row) => ({
          instrumentId: row.instrumentId,
          montant: row.montant,
        }));
      }
      if (line.id && line.statut === "IGNOREE") nextIgnored.add(line.id);
    });
    setMatches(nextMatches);
    setIgnoredIds(nextIgnored);
  }, [detail.data]);

  const previewMutation = useMutation({
    mutationFn: () => {
      if (!file) throw new Error("Sélectionnez un fichier bancaire");
      return comptaApi.previewBankStatement(file, configuration);
    },
    onSuccess: (result) => {
      setPreview(result);
      setConfiguration(result.configuration);
      toast.success("Aperçu généré sans enregistrer le relevé");
    },
    onError: showError,
  });
  const importMutation = useMutation({
    mutationFn: () => {
      if (!file || !accountId) throw new Error("Sélectionnez un compte et un fichier");
      return comptaApi.importBankStatement(accountId, file, configuration, profileId || undefined);
    },
    onSuccess: async (result) => {
      toast.success("Relevé confirmé et enregistré");
      setImportId(result.id ?? "");
      setPreview(null);
      setFile(null);
      setProfileId("");
      setConfiguration(EMPTY_CONFIGURATION);
      setImportOptionsOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["compta", "bank-statements", accountId] });
      await queryClient.invalidateQueries({
        queryKey: ["compta", "bank-statement-profiles", accountId],
      });
    },
    onError: showError,
  });
  const saveMutation = useMutation({
    mutationFn: () => comptaApi.saveBankReconciliations(importId, {
      selections: Object.entries(matches).flatMap(([ligneId, lineMatches]) =>
        lineMatches
          .filter((match) => match.instrumentId && match.montant > 0)
          .map((match) => ({ ligneId, ...match }))
      ),
      lignesIgnorees: [...ignoredIds],
    }),
    onSuccess: async () => {
      toast.success("Correspondances enregistrées");
      await queryClient.invalidateQueries({ queryKey: ["compta", "bank-statement", importId] });
    },
    onError: showError,
  });
  const validateMutation = useMutation({
    mutationFn: async () => {
      await comptaApi.saveBankReconciliations(importId, {
        selections: Object.entries(matches).flatMap(([ligneId, lineMatches]) =>
          lineMatches
            .filter((match) => match.instrumentId && match.montant > 0)
            .map((match) => ({ ligneId, ...match }))
        ),
        lignesIgnorees: [...ignoredIds],
      });
      return comptaApi.validateBankReconciliation(importId);
    },
    onSuccess: async () => {
      toast.success("Rapprochement validé et encaissements confirmés");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["compta", "bank-statement", importId] }),
        queryClient.invalidateQueries({ queryKey: ["compta", "bank-statements", accountId] }),
        queryClient.invalidateQueries({ queryKey: ["compta", "payment-instruments"] }),
        queryClient.invalidateQueries({ queryKey: ["compta", "treasury"] }),
      ]);
    },
    onError: showError,
  });

  const pendingForAccount = useMemo(() => (pendingInstruments.data ?? []).filter(
    (instrument) => !instrument.compteTresorerieId || instrument.compteTresorerieId === accountId
  ), [accountId, pendingInstruments.data]);

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Button variant="link" className="mb-1 h-auto p-0" asChild>
            <Link to="/app/compta/tresorerie/comptes">
              <ArrowLeft className="size-4" /> Caisses et banques
            </Link>
          </Button>
          <div className="text-sm font-medium text-orange-700">Trésorerie</div>
          <h1 className="mt-1 text-xl font-semibold">Rapprochement bancaire</h1>
          <p className="text-sm text-muted-foreground">
            Contrôlez le relevé avant de confirmer les encaissements clients.
          </p>
        </div>
        <div className="grid min-w-72 gap-1.5">
          <Label>Compte bancaire</Label>
          <Select value={accountId} onValueChange={(value) => {
            setAccountId(value);
            setImportId("");
            setProfileId("");
            setConfiguration(EMPTY_CONFIGURATION);
            setFile(null);
            setPreview(null);
            setImportOptionsOpen(false);
          }}>
            <SelectTrigger><SelectValue placeholder="Choisir un compte" /></SelectTrigger>
            <SelectContent>
              {bankAccounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>{account.libelle}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      {canManage && !importId && (
        <section className="grid gap-4 rounded-md border p-4">
          <div>
            <h2 className="font-semibold">Importer un relevé</h2>
            <p className="text-sm text-muted-foreground">
              Sélectionnez le fichier reçu de la banque. La prévisualisation ne sauvegarde rien.
            </p>
          </div>

          <label className="flex min-h-28 cursor-pointer items-center justify-between gap-4 rounded-md border border-dashed px-5 py-4 transition-colors hover:bg-muted/40">
            <Input
              type="file"
              accept=".csv,.xls,.xlsx,.mt940,.sta,.txt"
              className="sr-only"
              onClick={(event) => { event.currentTarget.value = ""; }}
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setPreview(null);
              }}
            />
            <span className="flex min-w-0 items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-md bg-orange-50 text-orange-700">
                <FileSpreadsheet className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  {file?.name ?? "Choisir un relevé bancaire"}
                </span>
                <span className="block text-xs text-muted-foreground">
                  CSV, Excel ou MT940. Le fichier sera d’abord analysé sans être enregistré.
                </span>
              </span>
            </span>
            <span className="shrink-0 text-sm font-medium text-primary">
              {file ? "Remplacer" : "Parcourir"}
            </span>
          </label>

          <div className="flex flex-wrap items-end justify-between gap-3 border-t pt-4">
            <Field label="Configuration d’import">
              <Select value={profileId || "__auto__"} onValueChange={(value) => {
                const nextProfileId = value === "__auto__" ? "" : value;
                setProfileId(nextProfileId);
                const profile = profiles.data?.find((item) => item.id === nextProfileId);
                setConfiguration(profile ? {
                  ...profile.configuration,
                  enregistrerProfil: false,
                  nomProfil: undefined,
                } : EMPTY_CONFIGURATION);
                setPreview(null);
              }}>
                <SelectTrigger className="w-80 max-w-full">
                  <SelectValue placeholder="Détection automatique" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__auto__">Détection automatique</SelectItem>
                  {(profiles.data ?? []).map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>{profile.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="flex flex-wrap gap-2">
              {file ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setFile(null);
                    setPreview(null);
                  }}
                >
                  <X className="size-4" /> Retirer
                </Button>
              ) : null}
              <Button
                onClick={() => previewMutation.mutate()}
                disabled={!file || previewMutation.isPending}
              >
                {previewMutation.isPending
                  ? <RefreshCw className="size-4 animate-spin" />
                  : <FileSearch className="size-4" />}
                Prévisualiser
              </Button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            La détection automatique convient dans la plupart des cas. Une configuration enregistrée
            sert uniquement lorsqu’une banque fournit régulièrement le même modèle de fichier.
          </p>

          <Collapsible open={importOptionsOpen} onOpenChange={setImportOptionsOpen}>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="outline" size="sm">
                <Settings2 className="size-4" />
                Options d’import
                <ChevronDown className={`size-4 transition-transform ${importOptionsOpen ? "rotate-180" : ""}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <div className="grid gap-3 rounded-md bg-muted/30 p-4 md:grid-cols-3">
                <Field label="Ligne d’en-tête">
                  <Input
                    type="number"
                    min={1}
                    value={configuration.ligneEntete}
                    onChange={(event) => updateConfiguration(
                      "ligneEntete",
                      Number(event.target.value)
                    )}
                  />
                </Field>
                <Field label="Format de date">
                  <Input
                    value={configuration.formatDate}
                    onChange={(event) => updateConfiguration("formatDate", event.target.value)}
                  />
                </Field>
                <Field label="Séparateur décimal">
                  <Select
                    value={configuration.separateurDecimal}
                    onValueChange={(value) => updateConfiguration("separateurDecimal", value)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value=",">Virgule</SelectItem>
                      <SelectItem value=".">Point</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {preview && (
            <PreviewWorkspace
              preview={preview}
              configuration={configuration}
              setConfiguration={setConfiguration}
              onRefresh={() => previewMutation.mutate()}
              onConfirm={() => importMutation.mutate()}
              busy={previewMutation.isPending || importMutation.isPending}
            />
          )}
        </section>
      )}

      {!importId && (
        <ImportHistory
          loading={imports.isLoading}
          rows={imports.data?.items ?? []}
          onOpen={(id) => setImportId(id)}
        />
      )}

      {importId && detail.data && (
        <ReconciliationWorkspace
          statement={detail.data}
          instruments={pendingForAccount}
          matches={matches}
          ignoredIds={ignoredIds}
          canManage={canManage}
          busy={saveMutation.isPending || validateMutation.isPending}
          onBack={() => setImportId("")}
          onMatch={(lineId, index, draft) => setMatches((current) => {
            const lineMatches = [...(current[lineId] ?? [])];
            lineMatches[index] = draft;
            return { ...current, [lineId]: lineMatches };
          })}
          onAddMatch={(lineId) => setMatches((current) => ({
            ...current,
            [lineId]: [...(current[lineId] ?? []), { instrumentId: "", montant: 0 }],
          }))}
          onRemoveMatch={(lineId, index) => setMatches((current) => {
            const next = { ...current };
            const lineMatches = (next[lineId] ?? []).filter((_, itemIndex) => itemIndex !== index);
            if (lineMatches.length) next[lineId] = lineMatches;
            else delete next[lineId];
            return next;
          })}
          onIgnore={(lineId, checked) => {
            setIgnoredIds((current) => {
              const next = new Set(current);
              checked ? next.add(lineId) : next.delete(lineId);
              return next;
            });
            if (checked) {
              setMatches((current) => {
                const next = { ...current };
                delete next[lineId];
                return next;
              });
            }
          }}
          onSave={() => saveMutation.mutate()}
          onValidate={() => validateMutation.mutate()}
        />
      )}
    </div>
  );

  function updateConfiguration<K extends keyof BankStatementImportConfiguration>(
    key: K,
    value: BankStatementImportConfiguration[K]
  ) {
    setConfiguration((current) => ({ ...current, [key]: value }));
    setPreview(null);
  }
}

function PreviewWorkspace({
  preview,
  configuration,
  setConfiguration,
  onRefresh,
  onConfirm,
  busy,
}: {
  preview: BankStatementImport;
  configuration: BankStatementImportConfiguration;
  setConfiguration: (value: BankStatementImportConfiguration) => void;
  onRefresh: () => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  const [mappingOpen, setMappingOpen] = useState(!preview.configurationComplete);
  const missingConfigurationName = configuration.enregistrerProfil
    && !configuration.nomProfil?.trim();

  useEffect(() => {
    setMappingOpen(!preview.configurationComplete);
  }, [preview.configurationComplete, preview.entetes]);

  return (
    <div className="grid gap-4 border-t pt-4">
      {preview.format !== "MT940" && (
        <Collapsible open={mappingOpen} onOpenChange={setMappingOpen}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">Correspondance des colonnes</h3>
              <p className="text-xs text-muted-foreground">
                Vérifiez les associations uniquement si la détection automatique est incorrecte.
              </p>
            </div>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="outline" size="sm">
                {mappingOpen ? "Masquer" : "Modifier"}
                <ChevronDown className={`size-4 transition-transform ${mappingOpen ? "rotate-180" : ""}`} />
              </Button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent className="pt-3">
            <div className="grid gap-3 rounded-md bg-muted/30 p-4 md:grid-cols-3 xl:grid-cols-5">
              {COLUMN_FIELDS.map(([key, label, required]) => (
                <Field key={key} label={`${label}${required ? " *" : ""}`}>
                  <Select
                    value={configuration.colonnes[key] ?? "__none__"}
                    onValueChange={(value) => setConfiguration({
                      ...configuration,
                      colonnes: {
                        ...configuration.colonnes,
                        [key]: value === "__none__" ? undefined : value,
                      },
                    })}
                  >
                    <SelectTrigger><SelectValue placeholder="Non associée" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Non associée</SelectItem>
                      {preview.entetes.map((header) => (
                        <SelectItem key={header} value={header}>{header}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
      <div className="grid gap-2 rounded-md border px-4 py-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          <Checkbox
            checked={configuration.enregistrerProfil}
            onCheckedChange={(checked) => setConfiguration({
              ...configuration,
              enregistrerProfil: checked === true,
              nomProfil: checked ? configuration.nomProfil : undefined,
            })}
          />
          Réutiliser cette configuration lors des prochains imports
        </label>
        {configuration.enregistrerProfil && (
          <div className="grid max-w-96 gap-1.5">
            <Label>Nom de la configuration</Label>
            <Input
              value={configuration.nomProfil ?? ""}
              onChange={(event) => setConfiguration({
                ...configuration,
                nomProfil: event.target.value,
              })}
              aria-label="Nom de la configuration d’import"
            />
            {missingConfigurationName ? (
              <span className="text-xs text-destructive">Saisissez un nom avant de confirmer.</span>
            ) : null}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Elle sera enregistrée uniquement lors de la confirmation de l’import.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-4 rounded-md bg-muted/40 px-4 py-3 text-sm">
        <strong>{preview.nombreLignes} opération(s)</strong>
        <span>Débits: {formatTreasuryMoney(preview.totalDebits)}</span>
        <span>Crédits: {formatTreasuryMoney(preview.totalCredits)}</span>
        <Badge variant={preview.configurationComplete ? "default" : "destructive"}>
          {preview.configurationComplete ? "Configuration complète" : "Configuration à compléter"}
        </Badge>
      </div>
      <StatementTable rows={preview.lignes.slice(0, 20)} />
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onRefresh} disabled={busy}>
          <RefreshCw className="size-4" /> Actualiser l’aperçu
        </Button>
        <Button
          onClick={onConfirm}
          disabled={busy || !preview.configurationComplete || missingConfigurationName}
        >
          <Upload className="size-4" /> Confirmer l’import
        </Button>
      </div>
    </div>
  );
}

function ImportHistory({ loading, rows, onOpen }: {
  loading: boolean;
  rows: BankStatementImport[];
  onOpen: (id: string) => void;
}) {
  return (
    <section className="overflow-hidden rounded-md border">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 className="font-semibold">Imports confirmés</h2>
          <p className="text-sm text-muted-foreground">Sources bancaires conservées et état du rapprochement.</p>
        </div>
        <Badge variant="secondary">{rows.length}</Badge>
      </div>
      <Table>
        <TableHeader><TableRow>
          <TableHead>Fichier</TableHead><TableHead>Importé le</TableHead><TableHead>Lignes</TableHead>
          <TableHead className="text-right">Débits</TableHead><TableHead className="text-right">Crédits</TableHead>
          <TableHead>Statut</TableHead><TableHead className="w-24" />
        </TableRow></TableHeader>
        <TableBody>
          {loading && <TableRow><TableCell colSpan={7}>Chargement...</TableCell></TableRow>}
          {!loading && !rows.length && <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">Aucun relevé confirmé.</TableCell></TableRow>}
          {rows.map((row) => <TableRow key={row.id}>
            <TableCell className="font-medium">{row.nomFichier}</TableCell>
            <TableCell>{row.createdAt ? formatTreasuryDate(row.createdAt.slice(0, 10)) : "-"}</TableCell>
            <TableCell>{row.nombreLignes}</TableCell>
            <TableCell className="text-right tabular-nums">{formatTreasuryMoney(row.totalDebits)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatTreasuryMoney(row.totalCredits)}</TableCell>
            <TableCell><StatusBadge status={row.statut} /></TableCell>
            <TableCell><Button size="sm" variant="outline" onClick={() => row.id && onOpen(row.id)}>Ouvrir</Button></TableCell>
          </TableRow>)}
        </TableBody>
      </Table>
    </section>
  );
}

function ReconciliationWorkspace({
  statement, instruments, matches, ignoredIds, canManage, busy,
  onBack, onMatch, onAddMatch, onRemoveMatch, onIgnore, onSave, onValidate,
}: {
  statement: BankStatementImport;
  instruments: PaymentInstrument[];
  matches: Record<string, MatchDraft[]>;
  ignoredIds: Set<string>;
  canManage: boolean;
  busy: boolean;
  onBack: () => void;
  onMatch: (lineId: string, index: number, draft: MatchDraft) => void;
  onAddMatch: (lineId: string) => void;
  onRemoveMatch: (lineId: string, index: number) => void;
  onIgnore: (lineId: string, checked: boolean) => void;
  onSave: () => void;
  onValidate: () => void;
}) {
  const editable = statement.statut === "BROUILLON" && canManage;
  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={onBack} title="Retour aux imports"><ArrowLeft className="size-4" /></Button>
          <div>
            <h2 className="font-semibold">{statement.nomFichier}</h2>
            <p className="text-sm text-muted-foreground">{statement.compteTresorerie} · {statement.nombreLignes} ligne(s)</p>
          </div>
          <StatusBadge status={statement.statut} />
        </div>
        {editable && <div className="flex gap-2">
          <Button variant="outline" onClick={onSave} disabled={busy}><Save className="size-4" /> Enregistrer</Button>
          <Button onClick={onValidate} disabled={busy}><CheckCircle2 className="size-4" /> Valider le rapprochement</Button>
        </div>}
      </div>
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Date</TableHead><TableHead>Opération bancaire</TableHead>
            <TableHead className="text-right">Débit</TableHead><TableHead className="text-right">Crédit</TableHead>
            <TableHead className="min-w-80">Correspondance</TableHead><TableHead className="w-28">Traitement</TableHead>
          </TableRow></TableHeader>
          <TableBody>{statement.lignes.map((line) => {
            const lineId = line.id ?? "";
            const selectedMatches = matches[lineId] ?? [];
            const selectedInstrumentIds = new Set(
              selectedMatches.map((match) => match.instrumentId).filter(Boolean)
            );
            const candidates = mergeCandidates(line, instruments);
            const validated = line.rapprochements.filter((row) => row.statut === "VALIDE");
            return <TableRow key={lineId || line.numeroLigne}>
              <TableCell>{formatTreasuryDate(line.dateOperation)}</TableCell>
              <TableCell>
                <div className="font-medium">{line.libelle}</div>
                <div className="text-xs text-muted-foreground">{line.referenceBancaire || line.contrepartie || "-"}</div>
              </TableCell>
              <TableCell className="text-right tabular-nums">{line.debit ? formatTreasuryMoney(line.debit) : "-"}</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">{line.credit ? formatTreasuryMoney(line.credit) : "-"}</TableCell>
              <TableCell>
                {validated.length ? validated.map((row) => <div key={row.id} className="text-sm">
                  {row.payeur} · {row.numeroReglement} · {formatTreasuryMoney(row.montant)}
                </div>) : line.credit > 0 && editable ? (
                  <div className="grid gap-2">
                    {selectedMatches.map((selected, index) => (
                      <div
                        key={`${lineId}-${index}`}
                        className="grid items-center gap-2 md:grid-cols-[minmax(0,1fr)_8rem_2.25rem]"
                      >
                        <Select
                          value={selected.instrumentId || undefined}
                          onValueChange={(instrumentId) => {
                            const instrument = instruments.find((item) => item.id === instrumentId);
                            const alreadyAllocated = selectedMatches.reduce(
                              (sum, match, itemIndex) => sum + (itemIndex === index ? 0 : match.montant),
                              0
                            );
                            onMatch(lineId, index, {
                              instrumentId,
                              montant: Math.min(
                                Math.max(line.credit - alreadyAllocated, 0),
                                instrument?.montant ?? line.credit
                              ),
                            });
                            onIgnore(lineId, false);
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Choisir un encaissement en attente" />
                          </SelectTrigger>
                          <SelectContent>
                            {candidates.map((candidate) => (
                              <SelectItem
                                key={candidate.id}
                                value={candidate.id}
                                disabled={selectedInstrumentIds.has(candidate.id)
                                  && candidate.id !== selected.instrumentId}
                              >
                                {candidate.payeurNom} · {formatTreasuryMoney(candidate.montant)} · {paymentModeLabel(candidate.mode)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          className="h-9"
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={selected.montant || ""}
                          onChange={(event) => onMatch(lineId, index, {
                            ...selected,
                            montant: Number(event.target.value),
                          })}
                          aria-label="Montant rapproché"
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => onRemoveMatch(lineId, index)}
                          title="Retirer cette correspondance"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-fit"
                      onClick={() => {
                        onAddMatch(lineId);
                        onIgnore(lineId, false);
                      }}
                    >
                      <Plus className="size-4" />
                      {selectedMatches.length ? "Ajouter une correspondance" : "Associer un encaissement"}
                    </Button>
                  </div>
                ) : <span className="text-sm text-muted-foreground">Aucune action comptable</span>}
              </TableCell>
              <TableCell>
                {editable && !validated.length ? <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={ignoredIds.has(lineId)} onCheckedChange={(checked) => {
                    onIgnore(lineId, checked === true);
                  }} /> Ignorer
                </label> : <StatusBadge status={line.statut} />}
              </TableCell>
            </TableRow>;
          })}</TableBody>
        </Table>
      </div>
    </section>
  );
}

function StatementTable({ rows }: { rows: BankStatementLine[] }) {
  return <div className="overflow-hidden rounded-md border"><Table>
    <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Libellé</TableHead>
      <TableHead>Référence</TableHead><TableHead className="text-right">Débit</TableHead>
      <TableHead className="text-right">Crédit</TableHead><TableHead className="text-right">Solde</TableHead>
    </TableRow></TableHeader>
    <TableBody>{rows.map((row) => <TableRow key={row.numeroLigne}>
      <TableCell>{formatTreasuryDate(row.dateOperation)}</TableCell><TableCell>{row.libelle}</TableCell>
      <TableCell>{row.referenceBancaire || "-"}</TableCell>
      <TableCell className="text-right tabular-nums">{row.debit ? formatTreasuryMoney(row.debit) : "-"}</TableCell>
      <TableCell className="text-right tabular-nums">{row.credit ? formatTreasuryMoney(row.credit) : "-"}</TableCell>
      <TableCell className="text-right tabular-nums">{row.solde == null ? "-" : formatTreasuryMoney(row.solde)}</TableCell>
    </TableRow>)}</TableBody>
  </Table></div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="grid gap-1.5"><Label>{label}</Label>{children}</div>;
}

function StatusBadge({ status }: { status?: string }) {
  const label = {
    BROUILLON: "À rapprocher", VALIDE: "Validé", ANNULE: "Annulé",
    NON_RAPPROCHEE: "Non rapprochée", SUGGEREE: "Sélectionnée",
    PARTIELLEMENT_RAPPROCHEE: "Partiel", RAPPROCHEE: "Rapprochée", IGNOREE: "Ignorée",
  }[status ?? ""] ?? status ?? "-";
  return <Badge variant={status === "VALIDE" || status === "RAPPROCHEE" ? "default" : "secondary"}>{label}</Badge>;
}

function mergeCandidates(line: BankStatementLine, instruments: PaymentInstrument[]) {
  const suggestedIds = new Set(line.suggestions.map((item) => item.instrumentId));
  return [...instruments].sort((a, b) => {
    const suggested = Number(suggestedIds.has(b.id)) - Number(suggestedIds.has(a.id));
    return suggested || Math.abs(line.credit - a.montant) - Math.abs(line.credit - b.montant);
  });
}

function showError(error: unknown) {
  toast.error(error instanceof Error ? error.message : "Opération impossible");
}
