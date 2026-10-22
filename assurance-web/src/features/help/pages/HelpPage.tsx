import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  Calculator,
  CircleAlert,
  Download,
  ExternalLink,
  LayoutDashboard,
  LifeBuoy,
  Search,
  Settings,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/store/auth-store";
import { guideModules, GUIDE_UPDATED_AT, GUIDE_VERSION } from "../guide-content";
import { downloadGuidePdf } from "../guide-pdf";
import { accessibleGuideModules, findContextualGuideTopic, searchGuideModules } from "../guide-utils";
import type { GuideModule, GuideTopic } from "../types";

const moduleIcons = {
  dashboard: LayoutDashboard,
  production: BadgeCheck,
  sinistre: LifeBuoy,
  companies: Building2,
  crm: Users,
  compta: Calculator,
  admin: Settings,
} as const;

const moduleAccent = {
  dashboard: "text-blue-700 border-blue-600",
  production: "text-emerald-700 border-emerald-600",
  sinistre: "text-sky-700 border-sky-700",
  companies: "text-amber-700 border-amber-600",
  crm: "text-blue-700 border-blue-600",
  compta: "text-orange-700 border-orange-600",
  admin: "text-fuchsia-700 border-fuchsia-700",
} as const;

export default function HelpPage() {
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);
  const accessibleModules = useMemo(
    () => accessibleGuideModules(guideModules, permissions),
    [permissions],
  );
  const visibleModules = useMemo(
    () => searchGuideModules(accessibleModules, query),
    [accessibleModules, query],
  );
  const allTopics = accessibleModules.flatMap((module) => module.topics);
  const requestedTopic = allTopics.find((topic) => topic.id === searchParams.get("section"));
  const contextualTopic = findContextualGuideTopic(accessibleModules, searchParams.get("from") ?? "");
  const visibleTopics = visibleModules.flatMap((module) => module.topics);
  const topic = (query.trim() ? visibleTopics.find((item) => item.id === requestedTopic?.id) ?? visibleTopics[0] : requestedTopic ?? contextualTopic ?? allTopics[0]) ?? null;
  const activeModule = topic ? accessibleModules.find((module) => module.topics.some((item) => item.id === topic.id)) ?? null : null;

  const selectTopic = (nextTopic: GuideTopic) => {
    const nextModule = accessibleModules.find((module) => module.topics.some((item) => item.id === nextTopic.id));
    setSearchParams({ module: nextModule?.id ?? "", section: nextTopic.id });
  };

  const exportPdf = async () => {
    setPdfLoading(true);
    try {
      await downloadGuidePdf(accessibleModules);
      toast.success("Guide PDF téléchargé");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Génération du PDF impossible");
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="grid min-w-0 gap-4">
      <header className="flex flex-col gap-3 border-b pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-emerald-700">Centre d’aide</p>
          <h1 className="text-2xl font-semibold">Guide d’utilisation</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Procédures, boutons, prérequis et résolution des erreurs par module.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Version {GUIDE_VERSION} · {GUIDE_UPDATED_AT}</span>
          <Button type="button" variant="outline" disabled={pdfLoading || !accessibleModules.length} onClick={() => void exportPdf()}>
            <Download className="size-4" />
            {pdfLoading ? "Génération..." : "Télécharger le PDF"}
          </Button>
        </div>
      </header>

      <div className="relative max-w-2xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher une fonctionnalité, un bouton ou une erreur"
          className="pl-9"
        />
      </div>

      {!visibleModules.length ? (
        <div className="grid min-h-64 place-items-center rounded-md border text-sm text-muted-foreground">
          Aucun sujet accessible ne correspond à cette recherche.
        </div>
      ) : (
        <div className="grid min-w-0 overflow-hidden rounded-md border bg-card lg:grid-cols-[290px_minmax(0,1fr)]">
          <aside className="max-h-[calc(100vh-13rem)] overflow-y-auto border-b bg-muted/20 p-2 lg:border-b-0 lg:border-r" aria-label="Sommaire du guide">
            {visibleModules.map((module) => (
              <GuideModuleNavigation
                key={module.id}
                module={module}
                selectedTopicId={topic?.id}
                onSelect={selectTopic}
              />
            ))}
          </aside>
          <main className="min-w-0 p-4 sm:p-6 lg:p-8">
            {topic && activeModule ? <GuideArticle module={activeModule} topic={topic} /> : null}
          </main>
        </div>
      )}
    </div>
  );
}

function GuideModuleNavigation({
  module,
  selectedTopicId,
  onSelect,
}: {
  module: GuideModule;
  selectedTopicId?: string;
  onSelect: (topic: GuideTopic) => void;
}) {
  const Icon = moduleIcons[module.id];
  return (
    <section className="mb-2 last:mb-0">
      <div className={`flex items-center gap-2 border-l-2 px-3 py-2 text-sm font-semibold ${moduleAccent[module.id]}`}>
        <Icon className="size-4" />
        {module.title}
      </div>
      <div className="grid gap-0.5 py-1">
        {module.topics.map((topic) => (
          <button
            key={topic.id}
            type="button"
            className={`min-h-9 rounded px-3 py-2 text-left text-sm transition-colors ${selectedTopicId === topic.id ? "bg-background font-medium text-foreground shadow-sm" : "text-muted-foreground hover:bg-background/70 hover:text-foreground"}`}
            onClick={() => onSelect(topic)}
          >
            {topic.title}
          </button>
        ))}
      </div>
    </section>
  );
}

function GuideArticle({ module, topic }: { module: GuideModule; topic: GuideTopic }) {
  return (
    <article className="mx-auto max-w-4xl">
      <div className="border-b pb-4">
        <p className={`text-sm font-semibold ${moduleAccent[module.id].split(" ")[0]}`}>{module.title}</p>
        <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">{topic.title}</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{topic.summary}</p>
          </div>
          {topic.route ? (
            <Button asChild variant="outline" size="sm" className="shrink-0">
              <Link to={topic.route}>
                <ExternalLink className="size-4" />
                Ouvrir l’écran
              </Link>
            </Button>
          ) : null}
        </div>
        {topic.permissions?.length ? (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs font-medium text-muted-foreground">Permissions requises :</span>
            {topic.permissions.map((permission) => <Badge key={permission} variant="outline">{permission}</Badge>)}
          </div>
        ) : null}
      </div>

      {topic.prerequisites?.length ? (
        <GuideSection title="Prérequis">
          <ul className="grid gap-2 text-sm leading-6">
            {topic.prerequisites.map((item) => <li key={item}>- {item}</li>)}
          </ul>
        </GuideSection>
      ) : null}

      <GuideSection title="Procédure">
        <ol className="grid gap-4">
          {topic.steps.map((step, index) => (
            <li key={`${step.title}-${index}`} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3">
              <span className="grid size-8 place-items-center rounded-full border bg-muted/30 text-sm font-semibold">{index + 1}</span>
              <div className="min-w-0 pt-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-semibold">{step.title}</h4>
                  {step.action ? <Badge variant="secondary">{step.action}</Badge> : null}
                </div>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </GuideSection>

      {topic.results?.length ? (
        <GuideSection title="Résultat">
          <ul className="grid gap-2 text-sm leading-6">
            {topic.results.map((item) => <li key={item}>- {item}</li>)}
          </ul>
        </GuideSection>
      ) : null}

      {topic.warnings?.length ? (
        <GuideSection title="Points d’attention">
          <div className="grid gap-2">
            {topic.warnings.map((warning) => (
              <div key={warning} className="flex gap-3 border-l-2 border-amber-500 bg-amber-500/10 px-3 py-2 text-sm leading-6">
                <AlertTriangle className="mt-1 size-4 shrink-0 text-amber-700" />
                <span>{warning}</span>
              </div>
            ))}
          </div>
        </GuideSection>
      ) : null}

      {topic.errors?.length ? (
        <GuideSection title="Erreurs et solutions">
          <div className="divide-y rounded-md border">
            {topic.errors.map((error) => (
              <div key={error.message} className="grid gap-1 px-3 py-3 sm:grid-cols-[minmax(180px,0.8fr)_minmax(0,1.5fr)] sm:gap-4">
                <div className="flex gap-2 text-sm font-medium text-red-700">
                  <CircleAlert className="mt-0.5 size-4 shrink-0" />
                  {error.message}
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{error.resolution}</p>
              </div>
            ))}
          </div>
        </GuideSection>
      ) : null}
    </article>
  );
}

function GuideSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b py-5 last:border-b-0">
      <h3 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}
