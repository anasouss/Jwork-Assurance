import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuthStore } from "@/store/auth-store";
import { fiscalRulesApi, type FiscalRule, type FiscalRuleNature, type UpsertFiscalRule } from "../api/fiscal-rules";
import { FiscalRuleDialog } from "../components/FiscalRuleDialog";

const key = ["fiscal-rules"] as const;

export default function FiscalRulesSettingsPage() {
  const queryClient = useQueryClient();
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const canManage = permissions.includes("regle-fiscale:manage") || permissions.includes("config:manage");
  const [search, setSearch] = useState("");
  const [nature, setNature] = useState<string>("ALL");
  const [status, setStatus] = useState("ACTIVE");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FiscalRule | null>(null);
  const [deactivating, setDeactivating] = useState<FiscalRule | null>(null);

  const rules = useQuery({ queryKey: key, queryFn: fiscalRulesApi.list, staleTime: 60_000 });
  const save = useMutation({
    mutationFn: ({ rule, payload }: { rule: FiscalRule | null; payload: UpsertFiscalRule }) =>
      rule ? fiscalRulesApi.update(rule.id, payload) : fiscalRulesApi.create(payload),
    onSuccess: async () => {
      setDialogOpen(false);
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: key });
      toast.success("Règle fiscale enregistrée");
    },
    onError: showError,
  });
  const deactivate = useMutation({
    mutationFn: fiscalRulesApi.deactivate,
    onSuccess: async () => {
      setDeactivating(null);
      await queryClient.invalidateQueries({ queryKey: key });
      toast.success("Règle fiscale désactivée");
    },
    onError: showError,
  });

  const filteredRules = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("fr");
    return (rules.data ?? []).filter((rule) => {
      if (nature !== "ALL" && rule.nature !== nature) return false;
      if (status === "ACTIVE" && !rule.actif) return false;
      if (status === "INACTIVE" && rule.actif) return false;
      return !term || `${rule.code} ${rule.libelle} ${scopeLabel(rule)}`.toLocaleLowerCase("fr").includes(term);
    });
  }, [nature, rules.data, search, status]);

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Production</p>
          <h1 className="text-xl font-semibold">Règles fiscales</h1>
          <p className="text-sm text-muted-foreground">Taxes, TPF, EVCAT et CNPAC applicables par période et périmètre.</p>
        </div>
        {canManage ? <Button onClick={() => { setEditing(null); setDialogOpen(true); }}><Plus className="size-4" /> Ajouter</Button> : null}
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(240px,1fr)_220px_180px]">
        <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Rechercher une règle" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        <Select value={nature} onValueChange={setNature}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
          <SelectItem value="ALL">Toutes les natures</SelectItem>
          {Object.entries(natureLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
        </SelectContent></Select>
        <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
          <SelectItem value="ACTIVE">Actives</SelectItem><SelectItem value="INACTIVE">Inactives</SelectItem><SelectItem value="ALL">Toutes</SelectItem>
        </SelectContent></Select>
      </div>

      <Card className="border-border/70 shadow-none"><CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-emerald-700 [&_th]:text-white"><TableRow className="hover:bg-emerald-700">
              <TableHead>Règle</TableHead><TableHead>Nature</TableHead><TableHead>Calcul</TableHead>
              <TableHead>Périmètre</TableHead><TableHead>Validité</TableHead><TableHead>Statut</TableHead>
              {canManage ? <TableHead className="w-24 text-right">Actions</TableHead> : null}
            </TableRow></TableHeader>
            <TableBody>
              {rules.isLoading ? <TableRow><TableCell colSpan={canManage ? 7 : 6} className="h-24 text-center text-muted-foreground">Chargement...</TableCell></TableRow> : null}
              {!rules.isLoading && filteredRules.length === 0 ? <TableRow><TableCell colSpan={canManage ? 7 : 6} className="h-24 text-center text-muted-foreground">Aucune règle fiscale</TableCell></TableRow> : null}
              {filteredRules.map((rule) => <TableRow key={rule.id}>
                <TableCell><div className="font-medium">{rule.libelle}</div><div className="text-xs text-muted-foreground">{rule.code}</div></TableCell>
                <TableCell>{natureLabels[rule.nature]}</TableCell>
                <TableCell><div>{valueLabel(rule)}</div><div className="text-xs text-muted-foreground">{baseLabels[rule.baseCalcul]} vers {categoryLabels[rule.categorieResultat]}</div></TableCell>
                <TableCell className="max-w-72 whitespace-normal">{scopeLabel(rule)}</TableCell>
                <TableCell><div>Du {formatDate(rule.dateDebut)}</div><div className="text-xs text-muted-foreground">{rule.dateFin ? `au ${formatDate(rule.dateFin)} exclu` : "Sans date de fin"}</div></TableCell>
                <TableCell><div className="flex flex-wrap gap-1"><Badge variant={rule.actif ? "default" : "secondary"}>{rule.actif ? "Active" : "Inactive"}</Badge>{!rule.applicable ? <Badge variant="outline">Exonération</Badge> : null}</div></TableCell>
                {canManage ? <TableCell className="text-right"><Button variant="ghost" size="icon-sm" title="Modifier" onClick={() => { setEditing(rule); setDialogOpen(true); }}><Edit className="size-4" /></Button>{rule.actif ? <Button variant="ghost" size="icon-sm" title="Désactiver" onClick={() => setDeactivating(rule)}><Trash2 className="size-4 text-red-600" /></Button> : null}</TableCell> : null}
              </TableRow>)}
            </TableBody>
          </Table>
        </div>
      </CardContent></Card>

      <FiscalRuleDialog open={dialogOpen} rule={editing} pending={save.isPending} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditing(null); }} onSubmit={(payload) => save.mutate({ rule: editing, payload })} />
      <AlertDialog open={Boolean(deactivating)} onOpenChange={(open) => { if (!open) setDeactivating(null); }}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Désactiver cette règle ?</AlertDialogTitle><AlertDialogDescription>Elle ne sera plus utilisée pour les nouveaux calculs. Les quittances déjà produites restent inchangées.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700" disabled={deactivate.isPending} onClick={() => deactivating && deactivate.mutate(deactivating.id)}>Désactiver</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function scopeLabel(rule: FiscalRule) {
  const parts = [rule.brancheAssuranceLibelle, rule.compagnieAssuranceLibelle, rule.categorieClientCode ? `Catégorie ${rule.categorieClientCode}` : null,
    rule.typeContrat ? contractLabels[rule.typeContrat] : null,
    rule.garantieCode ? `Garantie ${rule.garantieCode}` : null, rule.typeGarantie ? `Garanties ${rule.typeGarantie === "PERSONNE" ? "personne" : "véhicule"}` : null,
    rule.usageCode ? `Usage ${rule.usageCode}` : null, rule.groupeUsageAttestationCode ? `Groupe ${rule.groupeUsageAttestationCode}` : null].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Général";
}

function valueLabel(rule: FiscalRule) {
  return rule.modeCalcul === "TAUX" ? `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 4 }).format(rule.valeur * 100)} %` : `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(rule.valeur)} MAD`;
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function showError(error: unknown) { toast.error(error instanceof Error ? error.message : "Une erreur est survenue"); }

const natureLabels: Record<FiscalRuleNature, string> = { TAXE_ASSURANCE: "Taxe d’assurance", TPF: "Taxe parafiscale", EVCAT: "EVCAT", CNPAC: "CNPAC" };
const baseLabels = { PRIME_GARANTIE: "Prime de garantie", PRIME_CATEGORIE: "Prime de catégorie", UNITE_ASSUREE: "Unité assurée" } as const;
const categoryLabels = { AUTOMOBILE: "Automobile", CORPOREL: "Corporel", EVCAT: "EVCAT", ASSISTANCE: "Assistance" } as const;
const contractLabels = { PARTICULIER: "Particulier", CONVENTION: "Convention", FLOTTE: "Flotte" } as const;
