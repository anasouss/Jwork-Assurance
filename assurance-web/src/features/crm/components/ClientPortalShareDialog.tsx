import { useDeferredValue, useId, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDocumentDate } from "@/features/production/utils/format";
import { portalApi, portalKeys, type PortalAccount, type PortalCandidate, type PortalKind } from "../client-portal-api";
import { PortalFeedback, PortalField, PortalPager } from "./ClientPortalControls";

export function ClientPortalShareDialog({ agency, account, onClose, onChanged }: {
  agency: string; account: PortalAccount; onClose: () => void; onChanged: () => Promise<void>;
}) {
  const uid = useId();
  const permissions = useAuthStore(state => state.user?.permissions ?? []);
  const [kind, setKind] = useState<PortalKind>(permissions.includes("contrat:view") ? "contract" : "claim");
  const [query, setQuery] = useState("");
  const search = useDeferredValue(query.trim());
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<PortalCandidate | null>(null);
  const allowed = permissions.includes(kind === "claim" ? "sinistre:view" : "contrat:view");
  const candidates = useQuery({
    queryKey: portalKeys.candidates(agency, account.id, kind, search, page),
    queryFn: () => portalApi.candidates(account.id, kind, search, page),
    enabled: allowed,
  });
  const ready = search === query.trim();
  const save = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Sélectionnez un dossier.");
      await portalApi.grant(account.id, kind, selected.id);
    },
    onSuccess: async () => { onClose(); toast.success("Dossier partagé"); await onChanged(); },
  });
  return <Dialog open onOpenChange={open => { if (!open && !save.isPending) onClose(); }}>
    <DialogContent className="flex max-h-[90svh] flex-col overflow-hidden sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>Partager un dossier</DialogTitle>
        <DialogDescription>Destinataire : {account.clientNom}</DialogDescription>
      </DialogHeader>
      <form className="flex min-h-0 flex-col gap-4" onSubmit={event => { event.preventDefault(); if (selected) save.mutate(); }}>
        <div className="grid shrink-0 gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
          <PortalField id={uid + "-kind"} label="Dossier" required>
            <Select value={kind} disabled={save.isPending} onValueChange={value => {
              setKind(value as PortalKind); setPage(0); setQuery(""); setSelected(null);
            }}>
              <SelectTrigger id={uid + "-kind"}><SelectValue /></SelectTrigger>
              <SelectContent>
                {permissions.includes("contrat:view") && <SelectItem value="contract">Contrat</SelectItem>}
                {permissions.includes("sinistre:view") && <SelectItem value="claim">Sinistre</SelectItem>}
              </SelectContent>
            </Select>
          </PortalField>
          <PortalField id={uid + "-search"} label={kind === "claim" ? "N° sinistre ou police" : "N° dossier ou police"}>
            <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
              <Input id={uid + "-search"} className="pl-9" value={query} maxLength={120} disabled={save.isPending}
                onChange={e => { setQuery(e.target.value); setPage(0); setSelected(null); }} />
            </div>
          </PortalField>
        </div>
        <div className="min-h-0 overflow-y-auto rounded-md border">
          <PortalFeedback pending={candidates.isPending || !ready} error={ready ? candidates.error : null} retry={() => void candidates.refetch()} />
          {!candidates.isPending && !candidates.isError && ready && <>
            <Table className="min-w-[540px]">
              <TableHeader><TableRow><TableHead className="w-10"><span className="sr-only">Sélection</span></TableHead>
                <TableHead>Référence</TableHead><TableHead>Police</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
              <TableBody>{candidates.data?.items.map(candidate => <TableRow key={candidate.id} data-state={selected?.id === candidate.id ? "selected" : undefined}>
                <TableCell><input type="radio" name={uid + "-dossier"} className="size-4 accent-primary" checked={selected?.id === candidate.id}
                  aria-label={`Sélectionner ${candidate.reference || candidate.numeroPolice || candidate.id}`}
                  disabled={save.isPending} onChange={() => setSelected(candidate)} /></TableCell>
                <TableCell className="font-medium">{candidate.reference || "-"}</TableCell>
                <TableCell>{candidate.numeroPolice || "-"}</TableCell><TableCell className="whitespace-nowrap">{formatDocumentDate(candidate.date)}</TableCell>
              </TableRow>)}
              {!candidates.data?.items.length && <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">Aucun dossier correspondant à ce client.</TableCell></TableRow>}
              </TableBody>
            </Table>
            <PortalPager metadata={candidates.data?.page} pending={candidates.isFetching || save.isPending}
              onChange={next => { setPage(next); setSelected(null); }} />
          </>}
        </div>
        {save.error && <p role="alert" className="break-words text-sm text-destructive">{save.error.message}</p>}
        <DialogFooter className="shrink-0">
          <Button type="button" variant="outline" disabled={save.isPending} onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={!selected || save.isPending || !ready || !allowed}>
            {save.isPending && <Loader2 className="size-4 animate-spin" />}Partager
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
