import type { GuideModule, GuideTopic } from "./types";

export function canAccessGuideTopic(topic: GuideTopic, permissions: readonly string[]) {
  return !topic.permissions?.length || topic.permissions.some((permission) => permissions.includes(permission));
}

export function accessibleGuideModules(modules: GuideModule[], permissions: readonly string[]) {
  return modules
    .map((module) => ({
      ...module,
      topics: module.topics.filter((topic) => canAccessGuideTopic(topic, permissions)),
    }))
    .filter((module) => module.topics.length > 0);
}

export function findContextualGuideTopic(modules: GuideModule[], pathname: string) {
  const candidates = modules.flatMap((module) => module.topics).flatMap((topic) => [
    ...(topic.route ? [{ topic, matches: pathname === topic.route, score: 20_000 + topic.route.length }] : []),
    ...(topic.routePatterns ?? []).map((pattern) => ({
      topic,
      matches: routePatternMatches(pattern, pathname),
      score: 10_000 + pattern.replace(/:[^/]+/g, "").length,
    })),
    ...(topic.routePrefixes ?? []).map((prefix) => ({
      topic,
      matches: pathname.startsWith(prefix),
      score: prefix.length,
    })),
  ]);
  return candidates
    .filter(({ matches }) => matches)
    .sort((left, right) => right.score - left.score)[0]?.topic ?? null;
}

export function searchGuideModules(modules: GuideModule[], query: string) {
  const term = normalize(query);
  if (!term) return modules;
  return modules
    .map((module) => ({
      ...module,
      topics: module.topics.filter((topic) => normalize([
        module.title,
        topic.title,
        topic.summary,
        ...(topic.prerequisites ?? []),
        ...topic.steps.flatMap((step) => [step.title, step.description, step.action ?? ""]),
        ...(topic.results ?? []),
        ...(topic.warnings ?? []),
        ...(topic.errors ?? []).flatMap((error) => [error.message, error.resolution]),
      ].join(" ")).includes(term)),
    }))
    .filter((module) => module.topics.length > 0);
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("fr").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function routePatternMatches(pattern: string, pathname: string) {
  const expression = pattern
    .split("/")
    .map((segment) => segment.startsWith(":") ? "[^/]+" : escapeRegExp(segment))
    .join("/");
  return new RegExp(`^${expression}$`).test(pathname);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
