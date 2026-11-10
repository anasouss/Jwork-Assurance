import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Eye, FileText, RotateCcw, Search } from "lucide-react";
import { FilterField, ServerPagination, TableRowsSkeleton } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { permissionRequirementForPath, satisfiesPermissionRequirement } from "@/lib/authorization";
import { toDateOnly } from "@/features/production/date";
import { adminApi } from "../api";
import { activityActions, activityKeys, activityModules, getBusinessActivity, searchBusinessActivities,
  type ActivityFilters, type ActivityReference, type BusinessActivity } from "../business-activity";
import { useAdminAccess } from "./admin-access";
import { accountingSummaryFields, activityActionVariants, activityChangeSections, guaranteeSummaryFields, groupActivityReferences,
  type ActivityChangeGroup } from "../business-activity-presentation";

type Filters = { search: string; module: string; action: string; actor: string; from: string; to: string };
const emptyFilters: Filters = { search: "", module: "ALL", action: "ALL", actor: "ALL", from: "", to: "" };
const primaryReferenceTypes = new Set(["CONTRAT", "CLIENT", "GROUPE_CLIENT", "REGLEMENT_CLIENT", "SINISTRE"]);

function recordPath(reference: ActivityReference) {
  const id = encodeURIComponent(reference.id);
  switch (reference.type) {
    case "CONTRAT": return `/app/production/contrats/${id}`;
    case "REGLEMENT_CLIENT": return `/app/compta/reglements/${id}`;
    case "BORDEREAU_BANCAIRE": return `/app/compta/tresorerie/bordereaux-remise/${id}`;
    case "BORDEREAU_COMPAGNIE": return `/app/compta/bordereaux-compagnies/${id}`;
    case "SINISTRE": return `/app/sinistre/dossiers/${id}`;
    default: return null;
  }
}

function dateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : new Intl.DateTimeFormat("fr-MA", {
    dateStyle: "short", timeStyle: "short",
  }).format(date);
}

function contextReferences(event: BusinessActivity) {
  const priority = ["SINISTRE", "REGLEMENT_CLIENT", "REGLEMENT_COMPAGNIE", "CONTRAT", "CLIENT", "GROUPE_CLIENT", "BORDEREAU_BANCAIRE", "BORDEREAU_COMPAGNIE"];
  return groupActivityReferences(event).flatMap(group => group.references).filter(reference => priority.includes(reference.type))
    .sort((first, second) => priority.indexOf(first.type) - priority.indexOf(second.type)).slice(0, 2);
}

function ActionBadge({ action }: Pick<BusinessActivity, "action">) {
  return <Badge variant={activityActionVariants[action]} className="rounded border-transparent shadow-none">
    {activityActions[action]}
  </Badge>;
}

function ActivityChanges({ changes, module, subject }: Pick<BusinessActivity, "changes" | "module" | "subject">) {
  const sections = activityChangeSections(changes, module, subject.type);
  return <section aria-label="Informations de l’opération" className="space-y-1">
    <h3 className="mb-3 text-sm font-semibold">Informations de l’opération</h3>
    {sections.length === 0 && <p className="text-sm text-muted-foreground">Aucune information complémentaire enregistrée.</p>}
    {sections.map((section, index) => {
      const count = section.groups.reduce((total, group) => total + group.changes.length, 0);
      return <details key={section.title} open={index === 0 || section.kind !== "fields" || sections.length <= 3} className="group/section border-t">
      <summary className="flex cursor-pointer list-none items-center gap-3 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-transform group-open/section:rotate-180 motion-reduce:transition-none" />
        <span className="min-w-0 flex-1 break-words font-semibold">{section.title}</span>
        <span className="shrink-0 text-xs text-muted-foreground">{section.kind === "documentLines" || section.kind === "allocations" || section.kind === "receiptLines"
          ? `${section.groups.length} ${section.kind === "allocations" ? (section.groups.length === 1 ? "affectation" : "affectations") : (section.groups.length === 1 ? "ligne" : "lignes")}`
          : `${count} ${count === 1 ? "information" : "informations"}`}</span>
      </summary>
      {section.kind === "receiptLines"
        ? <ReceiptChangesTable groups={section.groups} />
        : section.kind === "documentLines" || section.kind === "allocations"
        ? <AccountingChangesTable groups={section.groups} allocations={section.kind === "allocations"} />
        : section.kind === "vehicle" || section.kind === "person" || section.kind === "guarantees"
        ? <GuaranteeChangesTable groups={section.groups} person={section.kind === "person"} />
        : section.kind === "quittance"
        ? <QuittanceChangesTable groups={section.groups} />
        : section.groups.map(group => <div key={group.title}>
          <ChangeFieldsTable group={group} />
        </div>)}
    </details>;
    })}
  </section>;
}

function QuittanceChangesTable({ groups }: { groups: ActivityChangeGroup[] }) {
  const columns = ["Prime nette", "Taxes", "TPF", "Accessoires", "CNPAC", "Montant TTC"];
  const categories = groups.filter(group => group.title !== "Quittance");
  const total = groups.find(group => group.title === "Quittance");
  const additionalFields = (group: ActivityChangeGroup) => group.changes.filter(change => !columns.includes(change.label));
  const hasDetails = groups.some(group => additionalFields(group).length > 0);
  const renderRow = (group: ActivityChangeGroup, isTotal = false) => <tr key={group.title} className={`border-t align-top ${isTotal ? "bg-muted/50 font-semibold" : ""}`}>
    <th scope="row" className="min-w-32 px-3 py-3 text-left font-semibold">{isTotal ? "Total" : group.title.slice("Quittance - ".length)}</th>
    {columns.map(label => <td key={label} className={`whitespace-nowrap px-3 py-3 text-right tabular-nums ${label === "Montant TTC" ? "font-semibold" : ""}`}>
      <GuaranteeChangeValue change={group.changes.find(change => change.label === label)} />
    </td>)}
    {hasDetails && <td className="min-w-32 px-3 py-3">{additionalFields(group).length > 0 ? <details>
      <summary className="cursor-pointer text-xs font-medium text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-sky-300">Voir les détails</summary>
      <dl className="mt-3 space-y-3">{additionalFields(group).map(change => <div key={change.label} className="max-w-56 break-words">
        <dt className="mb-1 text-xs font-normal text-muted-foreground">{change.label}</dt>
        <dd className="whitespace-pre-wrap font-normal"><GuaranteeChangeValue change={change} /></dd>
      </div>)}</dl>
    </details> : <span className="text-muted-foreground">-</span>}</td>}
  </tr>;
  return <div className="mb-4 overflow-x-auto rounded-md border">
    <table className="w-full min-w-[960px] text-sm">
      <thead className="bg-fuchsia-50 text-left text-fuchsia-950 dark:bg-fuchsia-950/40 dark:text-fuchsia-100"><tr>
        <th scope="col" className="px-3 py-2 font-medium">Catégorie</th>
        {columns.map(label => <th scope="col" key={label} className="px-3 py-2 text-right font-medium">{label}</th>)}
        {hasDetails && <th scope="col" className="px-3 py-2 font-medium">Détails</th>}
      </tr></thead>
      <tbody>{categories.map(group => renderRow(group))}</tbody>
      {total && <tfoot>{renderRow(total, true)}</tfoot>}
    </table>
  </div>;
}

function ReceiptChangesTable({ groups }: { groups: ActivityChangeGroup[] }) {
  return <div className="mb-4 overflow-x-auto rounded-md border">
    <table className="w-full min-w-[600px] text-sm">
      <thead className="bg-fuchsia-50 text-left text-fuchsia-950 dark:bg-fuchsia-950/40 dark:text-fuchsia-100"><tr>
        {["Type", "N° police / contrat", "Compagnie", "Montant", "Détails"].map(heading =>
          <th key={heading} scope="col" className={`px-3 py-2 font-medium ${heading === "Montant" ? "text-right" : ""}`}>{heading}</th>)}
      </tr></thead>
      <tbody>{groups.map(group => {
        const field = (label: string) => group.changes.find(change => change.label === label);
        // Older receipts stored the reference and company in one description; keep it intact.
        const reference = field("Reference") ?? field("Description");
        const type = field("Type");
        const company = field("Compagnie");
        const amount = field("Montant");
        const summary = new Set([type, reference, company, amount]);
        const additional = group.changes.filter(change => !summary.has(change));
        return <tr key={group.title} className="border-t align-top">
          <td className="px-3 py-2.5">{type?.beforeValue == null && type?.afterValue != null
            ? <Badge variant={type.afterValue === "Assistance" ? "info" : "gray"} className="rounded border-transparent shadow-none">{type.afterValue}</Badge>
            : <GuaranteeChangeValue change={type} />}</td>
          <th scope="row" className="max-w-56 whitespace-pre-wrap break-words px-3 py-2.5 text-left font-medium"><GuaranteeChangeValue change={reference} /></th>
          <td className="max-w-48 whitespace-pre-wrap break-words px-3 py-2.5"><GuaranteeChangeValue change={company} /></td>
          <td className="whitespace-nowrap px-3 py-2.5 text-right font-medium tabular-nums"><GuaranteeChangeValue change={amount} /></td>
          <td className="min-w-28 px-3 py-2.5">{additional.length > 0 ? <details>
            <summary className="cursor-pointer text-xs font-medium text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-sky-300">Voir les détails</summary>
            <dl className="mt-3 space-y-3">{additional.map(change => <div key={change.label} className="max-w-56 break-words">
              <dt className="mb-1 text-xs text-muted-foreground">{change.label}</dt>
              <dd className="whitespace-pre-wrap"><GuaranteeChangeValue change={change} /></dd>
            </div>)}</dl>
          </details> : <span className="text-muted-foreground">-</span>}</td>
        </tr>;
      })}</tbody>
    </table>
  </div>;
}

function AccountingChangesTable({ groups, allocations }: { groups: ActivityChangeGroup[]; allocations: boolean }) {
  const headings = allocations ? ["Moyen de paiement", "Écriture", "Document", "Montant", "Statut"] : ["Dossier", "Police", "Libellé", "Montant TTC"];
  return <div className="mb-4 overflow-x-auto rounded-md border">
    <table className="w-full min-w-[700px] text-sm">
      <thead className="bg-fuchsia-50 text-left text-fuchsia-950 dark:bg-fuchsia-950/40 dark:text-fuchsia-100"><tr>
        <th scope="col" className="px-3 py-2 font-medium">{allocations ? "Règlement / Affectation" : "Ligne"}</th>
        {headings.map((heading, index) => <th scope="col" key={heading} className={`px-3 py-2 font-medium ${index === 3 ? "text-right" : ""}`}>{heading}</th>)}
        <th scope="col" className="px-3 py-2 font-medium">Détails</th>
      </tr></thead>
      <tbody>{groups.map(group => {
        const { summary, additional } = accountingSummaryFields(group, allocations);
        const allocation = allocations ? group.title.match(/^(?:(.*) - )?(Moyen(?: \d+)?) - (Affectation \d+)$/) : null;
        return <tr key={group.title} className="border-t align-top">
          <th scope="row" className="min-w-32 max-w-48 break-words px-3 py-2.5 text-left font-medium">{allocation ? <>
            {allocation[1] && <div>{allocation[1]}</div>}<div className="text-xs text-muted-foreground">{allocation[3]}</div>
          </> : group.title}</th>
          {summary.map((change, index) => <td key={index} className={`px-3 py-2.5 tabular-nums ${index === 3 ? "whitespace-nowrap text-right" : "max-w-56 whitespace-pre-wrap break-words"}`}>{allocations && index === 0 && !change && allocation
            ? <div>{allocation[2]}<div className="mt-1 text-xs text-muted-foreground">Référence non enregistrée</div></div>
            : <GuaranteeChangeValue change={change} />}</td>)}
          <td className="min-w-28 px-3 py-2.5">{additional.length > 0 ? <details>
            <summary className="cursor-pointer text-xs font-medium text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-sky-300">Voir les détails</summary>
            <dl className="mt-3 space-y-3">{additional.map((change, index) => <div key={index} className="max-w-64 break-words">
              <dt className="mb-1 text-xs text-muted-foreground">{change.label}</dt>
              <dd className="whitespace-pre-wrap"><GuaranteeChangeValue change={change} /></dd>
            </div>)}</dl>
          </details> : <span className="text-muted-foreground">-</span>}</td>
        </tr>;
      })}</tbody>
    </table>
  </div>;
}

function ChangeFieldsTable({ group }: { group: ActivityChangeGroup }) {
  return <div className="mb-4 overflow-x-auto rounded-md border">
    <table className="w-full min-w-[360px] table-fixed text-sm">
      <thead className="bg-fuchsia-50 text-left text-fuchsia-950 dark:bg-fuchsia-950/40 dark:text-fuchsia-100"><tr>
        <th scope="col" className="w-2/5 px-3 py-2 font-medium">Information</th>
        {group.mode === "compared" ? <>
          <th scope="col" className="px-3 py-2 font-medium">Avant</th>
          <th scope="col" className="px-3 py-2 font-medium">Après</th>
        </> : <th scope="col" className="px-3 py-2 font-medium">{group.mode === "removed" ? "Valeur précédente" : "Valeur enregistrée"}</th>}
      </tr></thead>
      <tbody>{group.changes.map((change, changeIndex) => <tr key={changeIndex} className="border-t align-top">
        <th scope="row" className="break-words px-3 py-2.5 text-left font-medium">{change.label}</th>
        {group.mode === "compared" ? <>
          <td className="whitespace-pre-wrap break-words px-3 py-2.5 text-muted-foreground">{change.beforeValue ?? "-"}</td>
          <td className="whitespace-pre-wrap break-words bg-emerald-50/60 px-3 py-2.5 dark:bg-emerald-950/20">{change.afterValue ?? "-"}</td>
        </> : <td className="whitespace-pre-wrap break-words px-3 py-2.5">{(group.mode === "removed" ? change.beforeValue : change.afterValue) ?? "-"}</td>}
      </tr>)}</tbody>
    </table>
  </div>;
}

function GuaranteeChangeValue({ change }: { change?: BusinessActivity["changes"][number] }) {
  if (!change) return <span className="text-muted-foreground">-</span>;
  if (change.beforeValue == null) return <span>{change.afterValue ?? "-"}</span>;
  if (change.afterValue == null) return <div><span className="text-xs text-red-700 dark:text-red-300">Retiré : </span>{change.beforeValue}</div>;
  return <div className="space-y-1">
    <div className="text-xs text-muted-foreground">Avant : {change.beforeValue}</div>
    <div><span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Après : </span>{change.afterValue}</div>
  </div>;
}

function GuaranteeChangesTable({ groups, person }: { groups: ActivityChangeGroup[]; person: boolean }) {
  const headings = person ? ["Décès", "Invalidité", "Frais médicaux", "Prime"] : ["Valeur assurée / Capital", "Franchise (%)", "Minimum franchise", "Prime"];
  return <div className="mb-4 overflow-x-auto rounded-md border">
    <table className="w-full min-w-[860px] text-sm">
      <thead className="bg-fuchsia-50 text-left text-fuchsia-950 dark:bg-fuchsia-950/40 dark:text-fuchsia-100"><tr>
        <th scope="col" className="px-3 py-2 font-medium">Garantie / Cible</th>
        {headings.map(heading => <th scope="col" key={heading} className="px-3 py-2 text-right font-medium">{heading}</th>)}
        <th scope="col" className="px-3 py-2 font-medium">Détails</th>
      </tr></thead>
      <tbody>{groups.map(group => {
        const { summary, additional } = guaranteeSummaryFields(group, person);
        return <tr key={group.title} className="border-t align-top">
          <th scope="row" className="max-w-56 break-words px-3 py-3 text-left font-medium"><GuaranteeRowLabel group={group} /></th>
          {summary.map((change, index) => <td key={index} className="whitespace-nowrap px-3 py-3 text-right tabular-nums"><GuaranteeChangeValue change={change} /></td>)}
          <td className="min-w-36 px-3 py-3">{additional.length > 0 ? <details className="group/guarantee">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-medium text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-sky-300 [&::-webkit-details-marker]:hidden">
              <ChevronDown aria-hidden="true" className="size-3.5 shrink-0 group-open/guarantee:rotate-180" />{additional.length} {additional.length === 1 ? "détail" : "détails"}
            </summary>
            <dl className="mt-3 space-y-3">{additional.map((change, index) => <div key={index} className="max-w-64 break-words">
              <dt className="mb-1 text-xs text-muted-foreground">{change.label}</dt>
              <dd className="whitespace-pre-wrap"><GuaranteeChangeValue change={change} /></dd>
            </div>)}</dl>
          </details> : <span className="text-muted-foreground">-</span>}</td>
        </tr>;
      })}</tbody>
    </table>
  </div>;
}

function GuaranteeRowLabel({ group }: { group: ActivityChangeGroup }) {
  const coverage = group.changes.find(change => change.label === "Couverture");
  const code = (coverage?.afterValue ?? coverage?.beforeValue)?.trim();
  const separator = group.title.lastIndexOf(" (");
  if (!code || separator < 0 || !group.title.endsWith(")")) return <>{group.title}</>;
  const name = group.title.slice(0, separator);
  if (code === name) return <>{group.title}</>;
  const target = group.title.slice(separator + 2, -1);
  return <Tooltip>
    <TooltipTrigger asChild>
      <span tabIndex={0} className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">{code} · {target}</span>
    </TooltipTrigger>
    <TooltipContent className="max-w-72 break-words">{group.title}</TooltipContent>
  </Tooltip>;
}

export default function AdminActivityPage() {
  const access = useAdminAccess();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(emptyFilters);
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(0);
  const scope = `${access.user?.agenceId ?? "platform"}:${access.user?.id ?? ""}`;
  const [selection, setSelection] = useState<{ scope: string; event: BusinessActivity }>();
  const selected = selection?.scope === scope ? selection.event : undefined;
  const params: ActivityFilters = {
    search: filters.search.trim() || undefined,
    module: filters.module === "ALL" ? undefined : filters.module as ActivityFilters["module"],
    action: filters.action === "ALL" ? undefined : filters.action as ActivityFilters["action"],
    actorUserId: filters.actor === "ALL" ? undefined : filters.actor,
    dateFrom: filters.from ? `${filters.from}T00:00:00` : undefined,
    dateTo: filters.to ? `${filters.to}T23:59:59.999999` : undefined,
    page, size: 25,
  };
  const activities = useQuery({ queryKey: activityKeys.list(access.user?.agenceId, params),
    queryFn: () => searchBusinessActivities(params), enabled: access.canViewActivity, refetchOnMount: "always" });
  const operators = useQuery({
    queryKey: ["admin", "activity-operators", access.user?.agenceId ?? "platform", access.user?.id, Boolean(access.user?.platformAdmin)],
    queryFn: async () => {
      const [users, platformAdmins] = await Promise.all([
        adminApi.users(), access.user?.platformAdmin ? adminApi.platformAdmins() : Promise.resolve([]),
      ]);
      return [...new Map([...users, ...platformAdmins].map(user => [user.id, { id: user.id, fullName: user.fullName }])).values()]
        .sort((first, second) => first.fullName.localeCompare(second.fullName, "fr"));
    },
    enabled: access.canViewActivity && access.canViewUsers,
  });
  const activityDetail = useQuery({
    queryKey: activityKeys.detail(access.user?.agenceId, selected?.id),
    queryFn: () => getBusinessActivity(selected!.id),
    enabled: access.canViewActivity && !!selected,
  });
  const detail = activityDetail.data;
  const displayedActivity = detail ?? selected;
  const hasSummaryTable = displayedActivity && activityChangeSections(
    displayedActivity.changes, displayedActivity.module, displayedActivity.subject.type,
  ).some(section => ["vehicle", "person", "guarantees", "quittance", "documentLines", "allocations", "receiptLines"].includes(section.kind));
  const referenceGroups = detail ? groupActivityReferences(detail) : [];
  const primaryReferences = referenceGroups.filter(group => primaryReferenceTypes.has(group.type));
  const supportingReferences = referenceGroups.filter(group => !primaryReferenceTypes.has(group.type));

  if (!access.canViewActivity) return <Navigate to={access.defaultPath} replace />;

  function referenceLabel(reference: ActivityReference, event: BusinessActivity) {
    const path = recordPath(reference);
    const requirement = path ? permissionRequirementForPath(path) : null;
    const sameAgency = Boolean(access.user?.agenceId && access.user.agenceId === event.agenceId);
    const deletedSubject = event.action === "DELETED" && event.subject.type === reference.type && event.subject.id === reference.id;
    return path && sameAgency && !deletedSubject && requirement
      && satisfiesPermissionRequirement(access.user?.permissions ?? [], requirement)
      && (reference.type !== "CONTRAT" || access.user?.permissions.includes("contrat:view"))
      ? <span className="inline-flex max-w-full items-baseline gap-1.5">
          <Link className="min-w-0 break-words text-sky-700 underline-offset-4 hover:underline dark:text-sky-400" to={path}>{reference.label}</Link>
          {reference.type === "CONTRAT" && <Tooltip>
            <TooltipTrigger asChild><Button asChild variant="ghost" size="icon" className="size-6 shrink-0 self-center text-sky-700 dark:text-sky-400">
              <Link to={`${path}/pdf`} target="_blank" rel="noopener noreferrer" aria-label={`Ouvrir le PDF actuel : ${reference.label}`}><FileText className="size-3.5" /></Link>
            </Button></TooltipTrigger>
            <TooltipContent>Ouvrir le PDF actuel dans un nouvel onglet</TooltipContent>
          </Tooltip>}
        </span>
      : <span className="break-words">{reference.label}</span>;
  }

  return <div className="grid min-w-0 gap-4">
    <form className="grid items-end gap-3 border-b pb-4 sm:grid-cols-2 xl:grid-cols-4" onSubmit={event => {
      event.preventDefault(); setPage(0); setFilters(draft);
      void queryClient.invalidateQueries({ queryKey: activityKeys.scope(access.user?.agenceId) });
    }}>
      <FilterField label="Recherche"><Input placeholder="Opération, référence ou opérateur" value={draft.search} onChange={event => setDraft({ ...draft, search: event.target.value })} /></FilterField>
      <FilterField label="Module"><Select value={draft.module} onValueChange={module => setDraft({ ...draft, module })}>
        <SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">Tous les modules</SelectItem>
          {Object.entries(activityModules).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
        </SelectContent></Select></FilterField>
      <FilterField label="Action"><Select value={draft.action} onValueChange={action => setDraft({ ...draft, action })}>
        <SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">Toutes les actions</SelectItem>
          {Object.entries(activityActions).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
        </SelectContent></Select></FilterField>
      {access.canViewUsers && <FilterField label="Opérateur"><Select value={draft.actor} disabled={operators.isPending || operators.isError} onValueChange={actor => setDraft({ ...draft, actor })}>
        <SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">Tous les opérateurs</SelectItem>
          {(operators.data ?? []).map(user => <SelectItem key={user.id} value={user.id}>{user.fullName}</SelectItem>)}
        </SelectContent></Select>
        {operators.isError && <div role="alert" className="mt-1 flex items-center gap-1 text-xs text-destructive">
          Opérateurs indisponibles.
          <Button type="button" variant="ghost" size="icon" className="size-6 shrink-0" title="Recharger les opérateurs" aria-label="Recharger les opérateurs" onClick={() => operators.refetch()}>
            <RotateCcw className="size-3" />
          </Button>
        </div>}
      </FilterField>}
      <FilterField label="Du"><DatePicker date={draft.from || undefined} onSelect={date => setDraft({ ...draft, from: toDateOnly(date) ?? "" })} /></FilterField>
      <FilterField label="Au"><DatePicker date={draft.to || undefined} minDate={draft.from ? new Date(`${draft.from}T00:00:00`) : undefined} onSelect={date => setDraft({ ...draft, to: toDateOnly(date) ?? "" })} /></FilterField>
      <div className="flex gap-2"><Button type="submit" disabled={activities.isFetching}><Search className="size-4" />Rechercher</Button>
        <Button type="button" variant="outline" size="icon" title="Réinitialiser" aria-label="Réinitialiser les filtres" onClick={() => {
          setDraft(emptyFilters); setFilters(emptyFilters); setPage(0);
        }}><RotateCcw className="size-4" /></Button></div>
    </form>
    {activities.isError ? <div role="alert" className="space-y-2 text-sm text-destructive">
      <p>{activities.error instanceof Error ? activities.error.message : "Chargement impossible."}</p>
      <Button type="button" variant="outline" onClick={() => activities.refetch()}>Réessayer</Button>
    </div> : <div className="min-w-0 overflow-x-auto rounded-md border bg-card">
      <table className="w-full min-w-[960px] text-sm">
        <thead className="bg-fuchsia-700 text-left text-white"><tr>
          {["Date", "Opérateur", "Module", "Activité", "Dossier / Référence", "Détails"].map(label => <th scope="col" key={label} className="h-10 whitespace-nowrap px-3 py-2 font-semibold">{label}</th>)}
        </tr></thead>
        <tbody>{activities.isPending ? <TableRowsSkeleton rows={6} colSpan={6} /> : activities.data?.items.length
          ? activities.data.items.map(event => <tr key={event.id} className="border-t align-middle hover:bg-muted/50">
            <td className="whitespace-nowrap px-3 py-2 tabular-nums">{dateTime(event.occurredAt)}</td>
            <td className="px-3 py-2">{event.actorName}</td>
            <td className="px-3 py-2 text-muted-foreground">{activityModules[event.module]}</td>
            <td className="px-3 py-2"><div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="min-w-0 break-words font-medium">{event.title}</p>
              <div className="shrink-0"><ActionBadge action={event.action} /></div>
            </div></td>
            <td className="max-w-sm px-3 py-2"><p className="leading-5">{referenceLabel(event.subject, event)}</p>
              <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs leading-4 text-muted-foreground">
              {contextReferences(event).map(reference => <span key={`${reference.type}-${reference.id}`}>
                  {referenceLabel(reference, event)}
                </span>)}
              </div>
            </td>
            <td className="px-3 py-2"><Button type="button" variant="ghost" size="icon" className="size-8 text-fuchsia-700 dark:text-fuchsia-300" title="Voir les détails" aria-label={`Détails : ${event.title}`} onClick={() => setSelection({ scope, event })}><Eye className="size-4" /></Button></td>
          </tr>) : <tr><td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">Aucune activité ne correspond aux filtres.</td></tr>}
        </tbody>
      </table>
    </div>}
    <ServerPagination page={page} totalPages={activities.data?.page.totalPages ?? 1} totalElements={activities.data?.page.totalElements}
      loading={activities.isFetching} onPageChange={setPage} />
    <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelection(undefined); }}>
      <DialogContent className={`flex max-h-[90svh] flex-col gap-0 overflow-hidden p-0 ${hasSummaryTable
        ? "sm:max-w-[min(1200px,calc(100vw-2rem))]" : "sm:max-w-[min(896px,calc(100vw-2rem))]"}`}>
        <DialogHeader className="shrink-0 border-b px-5 py-5 pr-12 text-left sm:px-6 sm:pr-12">
          <div className="mb-1 flex flex-wrap items-center gap-2">{selected && <ActionBadge action={selected.action} />}
            <span className="text-xs font-medium text-muted-foreground">{selected && activityModules[selected.module]}</span>
          </div>
          <DialogTitle className="break-words text-xl leading-snug">{selected?.title}</DialogTitle>
          <DialogDescription>{selected && `${dateTime(selected.occurredAt)} · ${selected.actorName}`}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
        {activityDetail.isPending && <p role="status" className="py-6 text-sm text-muted-foreground">Chargement des détails...</p>}
        {activityDetail.isError && <div role="alert" className="space-y-3 text-sm text-destructive">
          <p>{activityDetail.error instanceof Error ? activityDetail.error.message : "Chargement impossible."}</p>
          <Button type="button" variant="outline" onClick={() => activityDetail.refetch()}>Réessayer</Button>
        </div>}
        {selected && detail && <div className="space-y-6">
          <dl className="grid gap-4 border-b pb-5 text-sm sm:grid-cols-2">
            <div className="min-w-0"><dt className="mb-1 text-xs text-muted-foreground">Dossier / Référence</dt>
              <dd className="font-medium">{referenceLabel(detail.subject, detail)}</dd></div>
            <div className="min-w-0"><dt className="mb-1 text-xs text-muted-foreground">Depuis la page</dt>
              <dd className="break-words">{detail.surfaceLabel}</dd></div>
            {primaryReferences.map(group =>
              <div key={group.type} className="min-w-0"><dt className="mb-1 text-xs text-muted-foreground">{group.label}</dt>
                <dd className="space-y-1">{group.references.map(reference => <p key={reference.id}>{referenceLabel(reference, detail)}</p>)}</dd>
              </div>)}
          </dl>
          <ActivityChanges changes={detail.changes} module={detail.module} subject={detail.subject} />
          {supportingReferences.length > 0 &&
            <details className="group border-t pt-4">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none" />Références associées
              </summary>
              <dl className="mt-4 grid gap-5 text-sm sm:grid-cols-2">
                {supportingReferences.map(group =>
                  <div key={group.type} className="min-w-0"><dt className="mb-2 font-medium text-muted-foreground">{group.label} <span className="text-xs">({group.references.length})</span></dt>
                    <dd><ul className="space-y-1.5">{group.references.map(reference => <li key={reference.id}>{referenceLabel(reference, detail)}</li>)}</ul></dd>
                  </div>)}
              </dl>
            </details>}
        </div>}
        </div>
        <div className="flex shrink-0 justify-end border-t px-5 py-3 sm:px-6">
          <DialogClose asChild><Button type="button" variant="outline">Fermer</Button></DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  </div>;
}
