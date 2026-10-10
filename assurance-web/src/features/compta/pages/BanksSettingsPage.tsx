import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Landmark, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { TableRowsSkeleton } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
import type { BankReference, UpsertBankReferenceRequest } from "../types";

type BankDraft = Omit<BankReference, "id" | "aliases"> & {
  id?: string;
  aliasesText: string;
};

export default function BanksSettingsPage() {
  const queryClient = useQueryClient();
  const canManage = useAuthStore((state) => state.user?.permissions ?? [])
    .includes("tresorerie:manage");
  const [draft, setDraft] = useState<BankDraft>();
  const banks = useQuery({
    queryKey: ["compta", "banks", "administration"],
    queryFn: () => comptaApi.banks(true),
  });
  const saveBank = useMutation({
    mutationFn: (value: BankDraft) => {
      const request: UpsertBankReferenceRequest = {
        code: value.code.trim(),
        libelle: value.libelle.trim(),
        aliases: value.aliasesText.split(",")
          .map((alias) => alias.trim())
          .filter(Boolean),
        actif: value.actif,
        ordre: value.ordre,
      };
      return value.id
        ? comptaApi.updateBank(value.id, request)
        : comptaApi.createBank(request);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["compta", "banks"] });
      setDraft(undefined);
      toast.success("Banque enregistrée");
    },
    onError: (error) => toast.error(
      error instanceof Error ? error.message : "Enregistrement impossible"
    ),
  });

  function startCreate() {
    setDraft({
      code: "",
      libelle: "",
      aliasesText: "",
      actif: true,
      ordre: 100,
    });
  }

  function startEdit(bank: BankReference) {
    const { aliases, ...fields } = bank;
    setDraft({
      ...fields,
      aliasesText: aliases.join(", "),
    });
  }

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-orange-700 dark:text-orange-400">
            Paramètres comptables
          </p>
          <h1 className="text-xl font-semibold">Banques</h1>
          <p className="text-sm text-muted-foreground">
            Référentiel utilisé pour identifier la banque d’origine des moyens de règlement.
          </p>
        </div>
        {canManage ? (
          <Button type="button" onClick={startCreate} disabled={Boolean(draft)}>
            <Plus className="size-4" />
            Ajouter une banque
          </Button>
        ) : null}
      </header>

      {draft ? (
        <section className="grid gap-4 rounded-md border bg-muted/20 p-4 md:grid-cols-2">
          <Field label="Code" required>
            <Input
              value={draft.code}
              maxLength={60}
              onChange={(event) => setDraft({ ...draft, code: event.target.value })}
            />
          </Field>
          <Field label="Nom" required>
            <Input
              value={draft.libelle}
              maxLength={160}
              onChange={(event) => setDraft({ ...draft, libelle: event.target.value })}
            />
          </Field>
          <Field label="Alias de recherche">
            <Input
              value={draft.aliasesText}
              placeholder="BP, BCP, CPM"
              onChange={(event) => setDraft({ ...draft, aliasesText: event.target.value })}
            />
          </Field>
          <Field label="Ordre">
            <Input
              type="number"
              min={0}
              value={draft.ordre}
              onChange={(event) => setDraft({
                ...draft,
                ordre: Math.max(Number(event.target.value) || 0, 0),
              })}
            />
          </Field>
          <label className="flex cursor-pointer items-center gap-3 text-sm font-medium md:col-span-2">
            <Switch
              checked={draft.actif}
              onCheckedChange={(checked) => setDraft({ ...draft, actif: checked })}
            />
            Banque active
          </label>
          <div className="flex justify-end gap-2 md:col-span-2">
            <Button type="button" variant="outline" onClick={() => setDraft(undefined)}>
              Annuler
            </Button>
            <Button
              type="button"
              disabled={!draft.code.trim() || !draft.libelle.trim() || saveBank.isPending}
              onClick={() => saveBank.mutate(draft)}
            >
              {saveBank.isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader className="bg-orange-600 text-white">
            <TableRow className="hover:bg-orange-600">
              <TableHead className="text-white">Banque</TableHead>
              <TableHead className="text-white">Alias</TableHead>
              <TableHead className="w-28 text-white">Statut</TableHead>
              <TableHead className="w-20 text-right text-white">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {banks.isLoading ? <TableRowsSkeleton rows={7} colSpan={4} /> : null}
            {(banks.data ?? []).map((bank) => (
              <TableRow key={bank.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300">
                      <Landmark className="size-4" />
                    </span>
                    <div>
                      <p className="font-medium">{bank.libelle}</p>
                      <p className="text-xs text-muted-foreground">{bank.code}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {bank.aliases.length ? bank.aliases.join(", ") : "-"}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{bank.actif ? "Active" : "Inactive"}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  {canManage ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      title="Modifier la banque"
                      onClick={() => startEdit(bank)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!banks.isLoading && !banks.data?.length ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Aucune banque configurée.
          </p>
        ) : null}
      </section>
    </div>
  );
}

function Field({ label, required, children }: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      <span>{label}{required ? <span className="text-destructive"> *</span> : null}</span>
      {children}
    </label>
  );
}
