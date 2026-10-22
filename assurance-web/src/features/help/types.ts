export type GuideStep = {
  title: string;
  description: string;
  action?: string;
};

export type GuideError = {
  message: string;
  resolution: string;
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
