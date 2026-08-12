import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { clientApi } from "@/features/production/api/clients";
import type { OrigineCommerciale, TypeOrigineCommerciale } from "@/features/production/types";

type OriginDraft = Omit<OrigineCommerciale, "id"> & { id?: string };

const originTypeLabels: Record<TypeOrigineCommerciale, string> = {
  PASSAGE_AGENCE: "Passage en agence",
  COLLABORATEUR: "Équipe de l’agence",
  CLIENT: "Client recommandant",
  PARTENAIRE: "Partenaire",
  CAMPAGNE: "Campagne",
  SITE_WEB: "Site web",
  RESEAUX_SOCIAUX: "Réseaux sociaux",
  AUTRE: "Autre",
};

export default function CommercialOriginsSettingsPage() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<OriginDraft>();
  const optionsQuery = useQuery({
    queryKey: ["crm", "acquisition-options"],
    queryFn: clientApi.acquisitionOptions,
    staleTime: 60_000,
  });
  const saveMutation = useMutation({
    mutationFn: (origin: OriginDraft) => {
      const request = {
        code: origin.code.trim(),
        libelle: origin.libelle.trim(),
        type: origin.type,
        actif: origin.actif,
        ordre: origin.ordre,
      };
      return origin.id
        ? clientApi.updateOrigin(origin.id, request)
        : clientApi.createOrigin(request);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["crm", "acquisition-options"] });
      setDraft(undefined);
      toast.success("Origine commerciale enregistrée");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Enregistrement impossible"),
  });

  const startCreate = () => setDraft({
    code: "",
    libelle: "",
    type: "PARTENAIRE",
    actif: true,
    ordre: 100,
  });

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">Paramètres CRM</p>
          <h1 className="text-xl font-semibold tracking-tight">Origines commerciales</h1>
          <p className="text-sm text-muted-foreground">
            Gérez les canaux, partenaires et campagnes utilisés pour attribuer l’acquisition des clients.
          </p>
        </div>
        <Button type="button" onClick={startCreate} disabled={Boolean(draft)}>
          <Plus className="size-4" />
          Ajouter une origine
        </Button>
      </header>

      {draft ? (
        <section className="grid gap-4 rounded-md border bg-muted/20 p-4 sm:grid-cols-2">
          <Field label="Code" required>
            <Input
              value={draft.code}
              maxLength={60}
              onChange={(event) => setDraft({ ...draft, code: event.target.value })}
            />
          </Field>
          <Field label="Libellé" required>
            <Input
              value={draft.libelle}
              maxLength={160}
              onChange={(event) => setDraft({ ...draft, libelle: event.target.value })}
            />
          </Field>
          <Field label="Type" required>
            <Select
              value={draft.type}
              onValueChange={(value) => setDraft({ ...draft, type: value as TypeOrigineCommerciale })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.entries(originTypeLabels) as [TypeOrigineCommerciale, string][]).map(([value, text]) => (
                  <SelectItem key={value} value={value}>{text}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Ordre">
            <Input
              type="number"
              min={0}
              value={draft.ordre}
              onChange={(event) => setDraft({ ...draft, ordre: Math.max(Number(event.target.value) || 0, 0) })}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <Checkbox
              checked={draft.actif}
              onCheckedChange={(checked) => setDraft({ ...draft, actif: checked === true })}
            />
            Origine active
          </label>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => setDraft(undefined)}>Annuler</Button>
            <Button
              type="button"
              disabled={!draft.code.trim() || !draft.libelle.trim() || saveMutation.isPending}
              onClick={() => saveMutation.mutate(draft)}
            >
              {saveMutation.isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader className="bg-blue-600 text-white">
            <TableRow className="hover:bg-blue-600">
              <TableHead className="text-white">Origine</TableHead>
              <TableHead className="text-white">Type</TableHead>
              <TableHead className="w-28 text-white">Statut</TableHead>
              <TableHead className="w-16 text-right text-white">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(optionsQuery.data?.origines ?? []).map((origin) => (
              <TableRow key={origin.id}>
                <TableCell>
                  <p className="font-medium">{origin.libelle}</p>
                  <p className="text-xs text-muted-foreground">{origin.code}</p>
                </TableCell>
                <TableCell>{originTypeLabels[origin.type]}</TableCell>
                <TableCell>
                  <Badge variant="outline">{origin.actif ? "Active" : "Inactive"}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    title="Modifier l’origine"
                    onClick={() => setDraft({ ...origin })}
                  >
                    <Pencil className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {optionsQuery.isLoading ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Chargement des origines...</p>
        ) : null}
        {!optionsQuery.isLoading && !optionsQuery.data?.origines.length ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Aucune origine configurée.</p>
        ) : null}
      </section>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      <span>{label}{required ? <span className="text-destructive"> *</span> : null}</span>
      {children}
    </label>
  );
}
