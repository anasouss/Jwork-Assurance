export type GuideStep = {
  title: string;
  description: string;
  action?: string;
};

export type GuideError = {
  message: string;
  resolution: string;
};

export type GuidePath = {
  title: string;
  description: string;
  topicId?: string;
  tone?: "emerald" | "blue" | "amber" | "sky" | "violet";
};

export type GuideTopic = {
  id: string;
  title: string;
  summary: string;
  route?: string;
  routePrefixes?: string[];
  routePatterns?: string[];
  permissions?: string[];
  prerequisites?: string[];
  paths?: GuidePath[];
  steps: GuideStep[];
  results?: string[];
  warnings?: string[];
  errors?: GuideError[];
};

export type GuideModule = {
  id: "dashboard" | "production" | "sinistre" | "companies" | "crm" | "compta" | "admin";
  title: string;
  description: string;
  topics: GuideTopic[];
};
