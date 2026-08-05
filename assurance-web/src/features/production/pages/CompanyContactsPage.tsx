import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit, Mail, MessageCircle, Phone, Plus, Power, PowerOff, Search, Star, Users, X } from "lucide-react";
import { toast } from "sonner";
import { ServerPagination, TableRowsSkeleton } from "@/components/shared";
import { TableRowActions } from "@/components/shared/table-row-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuthStore } from "@/store/auth-store";
import { companyContactsApi } from "../api/company-contacts";
import { referenceApi } from "../api/references";
import {
  COMPANY_CONTACT_SERVICES,
  COMPANY_CONTACT_SERVICE_LABELS,
  type CompanyContact,
  type CompanyContactService,
  type UpsertCompanyContactRequest,
} from "../company-contacts/types";
import { CompanyContactDialog } from "../components/company-contacts/CompanyContactDialog";
import { CompanyContactStatusDialog } from "../components/company-contacts/CompanyContactStatusDialog";
import { Field } from "../components/Field";

const PAGE_SIZE = 25;
type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE";
type ContactFilters = { q: string; compagnieId: string; service: string; status: StatusFilter };

export default function CompanyContactsPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const initial = useMemo(() => stateFromParams(searchParams), []);
  const [filters, setFilters] = useState<ContactFilters>(initial.filters);
  const [appliedFilters, setAppliedFilters] = useState<ContactFilters>(initial.filters);
  const [page, setPage] = useState(initial.page);
  const [editing, setEditing] = useState<CompanyContact | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<CompanyContact | null>(null);
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const canManage = permissions.includes("contact-compagnie:manage");

  const companies = useQuery({
    queryKey: ["referentiel", "compagnies-assurance"],
    queryFn: () => referenceApi.list("compagnies-assurance"),
    staleTime: 60_000,
  });
  const listParams = useMemo(() => ({
    q: appliedFilters.q.trim() || undefined,
    compagnieId: appliedFilters.compagnieId === "ALL" ? undefined : appliedFilters.compagnieId,
    service: appliedFilters.service === "ALL" ? undefined : appliedFilters.service as CompanyContactService,
    actif: appliedFilters.status === "ALL" ? undefined : appliedFilters.status === "ACTIVE",
    page,
    size: PAGE_SIZE,
  }), [appliedFilters, page]);
  const contacts = useQuery({
    queryKey: ["company-contacts", listParams],
    queryFn: () => companyContactsApi.list(listParams),
    placeholderData: (previous) => previous,
  });

  const save = useMutation({
    mutationFn: ({ companyId, request }: { companyId: string; request: UpsertCompanyContactRequest }) =>
      editing
        ? companyContactsApi.update(editing.compagnieAssuranceId, editing.id, request)
        : companyContactsApi.create(companyId, request),
    onSuccess: async () => {
      setDialogOpen(false);
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ["company-contacts"] });
      toast.success("Contact compagnie enregistré");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Enregistrement impossible"),
  });
  const updateStatus = useMutation({
    mutationFn: (contact: CompanyContact) =>
      companyContactsApi.updateStatus(contact.compagnieAssuranceId, contact.id, !contact.actif),
    onSuccess: async (contact) => {
      setStatusTarget(null);
      await queryClient.invalidateQueries({ queryKey: ["company-contacts"] });
      toast.success(contact.actif ? "Contact réactivé" : "Contact désactivé");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Modification impossible"),
  });

  function applyFilters(next: ContactFilters) {
    setAppliedFilters(next);
    setPage(0);
    setSearchParams(paramsFromState(next, 0), { replace: true });
  }

  function goToPage(nextPage: number) {
    setPage(nextPage);
    setSearchParams(paramsFromState(appliedFilters, nextPage), { replace: true });
  }

  function reset() {
    const next: ContactFilters = { q: "", compagnieId: "ALL", service: "ALL", status: "ACTIVE" };
    setFilters(next);
    applyFilters(next);
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
            <Link to="/app/companies" className="hover:underline">Compagnies</Link>
          </p>
          <h1 className="text-xl font-semibold tracking-tight">Contacts compagnie</h1>
          <p className="text-sm text-muted-foreground">Interlocuteurs opérationnels connus par votre agence.</p>
        </div>
        {canManage ? (
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="size-4" /> Ajouter un contact
          </Button>
        ) : null}
      </div>

      <Card className="border-border/70 shadow-none">
        <CardContent className="pt-6">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_260px_230px_190px_auto]">
            <Field label="Recherche">
              <Input
                value={filters.q}
                placeholder="Nom, fonction, téléphone ou e-mail"
                onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
                onKeyDown={(event) => { if (event.key === "Enter") applyFilters(filters); }}
              />
            </Field>
            <Field label="Compagnie">
              <Select value={filters.compagnieId} onValueChange={(value) => setFilters((current) => ({ ...current, compagnieId: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Toutes les compagnies</SelectItem>
                  {(companies.data ?? []).map((company) => (
                    <SelectItem key={company.id} value={company.id}>{company.libelle}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Service">
              <Select value={filters.service} onValueChange={(value) => setFilters((current) => ({ ...current, service: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tous les services</SelectItem>
                  {COMPANY_CONTACT_SERVICES.map((service) => (
                    <SelectItem key={service} value={service}>{COMPANY_CONTACT_SERVICE_LABELS[service]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Statut">
              <Select value={filters.status} onValueChange={(value) => setFilters((current) => ({ ...current, status: value as StatusFilter }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tous les statuts</SelectItem>
                  <SelectItem value="ACTIVE">Actifs</SelectItem>
                  <SelectItem value="INACTIVE">Inactifs</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <div className="flex items-end gap-2">
              <Button type="button" size="icon" aria-label="Rechercher" onClick={() => applyFilters(filters)}><Search className="size-4" /></Button>
              <Button type="button" variant="outline" size="icon" aria-label="Réinitialiser" onClick={reset}><X className="size-4" /></Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-none">
        <CardContent className="p-0">
          <div className="overflow-x-auto p-4">
            <div className="min-w-[1120px] overflow-hidden rounded-md border">
              <Table>
                <TableHeader className="bg-amber-600 text-white [&_th]:text-white">
                  <TableRow className="hover:bg-amber-600">
                    <TableHead>Contact</TableHead><TableHead>Compagnie</TableHead><TableHead>Service</TableHead>
                    <TableHead>Téléphones</TableHead><TableHead>E-mail</TableHead><TableHead>Principal</TableHead>
                    <TableHead>Statut</TableHead><TableHead className="w-20 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.isLoading ? <TableRowsSkeleton rows={6} colSpan={8} /> : null}
                  {(contacts.data?.items ?? []).map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell>
                        <div className="font-medium">{fullName(contact)}</div>
                        <div className="text-xs text-muted-foreground">{contact.fonction || "-"}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{contact.compagnieAssuranceNom}</div>
                        <div className="text-xs text-muted-foreground">{contact.compagnieAssuranceCode || "-"}</div>
                      </TableCell>
                      <TableCell>{COMPANY_CONTACT_SERVICE_LABELS[contact.service]}</TableCell>
                      <TableCell>
                        <ContactPhone value={contact.telephoneMobile} mobile whatsapp={contact.whatsapp} />
                        <ContactPhone value={contact.telephoneFixe} extension={contact.posteTelephonique} />
                      </TableCell>
                      <TableCell>
                        {contact.email ? <a className="inline-flex items-center gap-1 text-blue-600 hover:underline" href={`mailto:${contact.email}`}><Mail className="size-3.5" />{contact.email}</a> : "-"}
                      </TableCell>
                      <TableCell>{contact.principal ? <Badge variant="secondary"><Star className="size-3 fill-current" /> Principal</Badge> : "-"}</TableCell>
                      <TableCell><Badge variant={contact.actif ? "default" : "outline"}>{contact.actif ? "Actif" : "Inactif"}</Badge></TableCell>
                      <TableCell className="text-right">
                        {canManage ? (
                          <TableRowActions label={`Actions ${fullName(contact)}`} actions={[
                            { label: "Modifier", icon: Edit, onSelect: () => { setEditing(contact); setDialogOpen(true); } },
                            { label: contact.actif ? "Désactiver" : "Réactiver", icon: contact.actif ? PowerOff : Power, destructive: contact.actif, onSelect: () => setStatusTarget(contact) },
                          ]} />
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!contacts.isLoading && (contacts.data?.items.length ?? 0) === 0 ? (
                    <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground"><Users className="mx-auto mb-2 size-5" />{contacts.isError ? "Les contacts n’ont pas pu être chargés." : "Aucun contact compagnie."}</TableCell></TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </div>
          <ServerPagination
            className="border-t px-4 py-3"
            page={contacts.data?.page.number ?? page}
            totalPages={contacts.data?.page.totalPages ?? 0}
            totalElements={contacts.data?.page.totalElements ?? 0}
            loading={contacts.isFetching}
            onPageChange={goToPage}
          />
        </CardContent>
      </Card>

      <CompanyContactDialog
        open={dialogOpen}
        contact={editing}
        initialCompanyId={appliedFilters.compagnieId === "ALL" ? undefined : appliedFilters.compagnieId}
        companies={companies.data ?? []}
        saving={save.isPending}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditing(null); }}
        onSubmit={(companyId, request) => save.mutate({ companyId, request })}
      />
      <CompanyContactStatusDialog
        contact={statusTarget}
        saving={updateStatus.isPending}
        onOpenChange={(open) => { if (!open) setStatusTarget(null); }}
        onConfirm={() => { if (statusTarget) updateStatus.mutate(statusTarget); }}
      />
    </div>
  );
}

function ContactPhone({ value, extension, mobile, whatsapp }: { value?: string | null; extension?: string | null; mobile?: boolean; whatsapp?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-1.5 text-sm">
      {whatsapp ? <MessageCircle className="size-3.5 text-emerald-600" /> : <Phone className="size-3.5 text-muted-foreground" />}
      <a href={`tel:${value}`} className="hover:underline">{value}</a>
      <span className="text-xs text-muted-foreground">{mobile ? "mobile" : "fixe"}</span>
      {extension ? <span className="text-xs text-muted-foreground">poste {extension}</span> : null}
    </div>
  );
}

function fullName(contact: CompanyContact) {
  return [contact.prenom, contact.nom].filter(Boolean).join(" ");
}

function stateFromParams(params: URLSearchParams) {
  const rawStatus = params.get("statut");
  const status: StatusFilter = rawStatus === "ALL" || rawStatus === "INACTIVE" ? rawStatus : "ACTIVE";
  return {
    filters: {
      q: params.get("q") ?? "",
      compagnieId: params.get("compagnieId") ?? "ALL",
      service: COMPANY_CONTACT_SERVICES.includes(params.get("service") as CompanyContactService) ? params.get("service")! : "ALL",
      status,
    },
    page: Math.max(0, Number.parseInt(params.get("page") ?? "0", 10) || 0),
  };
}

function paramsFromState(filters: ContactFilters, page: number) {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.compagnieId !== "ALL") params.set("compagnieId", filters.compagnieId);
  if (filters.service !== "ALL") params.set("service", filters.service);
  if (filters.status !== "ACTIVE") params.set("statut", filters.status);
  if (page > 0) params.set("page", String(page));
  return params;
}
