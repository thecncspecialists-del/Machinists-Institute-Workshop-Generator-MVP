import catalogItems from "@/data/external-lms-catalog.json";

export const externalLmsProviders = ["electude", "amatrol", "tooling-u"] as const;

export type ExternalLmsProvider = (typeof externalLmsProviders)[number];

export type ExternalLmsCatalogItem = {
  id: string;
  provider: ExternalLmsProvider;
  providerLabel: string;
  title: string;
  catalogId: string;
  description: string;
  url: string;
  duration: string;
  path: string;
  section: string;
  module: string;
  functionalArea: string;
  department: string;
  classId: string;
  language: string;
  level: string;
  lastUpdated: string;
  physicalToolkitId: string;
};

export type ExternalLmsSearchOptions = {
  provider?: ExternalLmsProvider | "all" | "";
  query?: string;
  limit?: number;
};

const typedCatalogItems = catalogItems as ExternalLmsCatalogItem[];
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

function normalizeSearchTerm(value: string) {
  return value.trim().toLowerCase();
}

function normalizeCatalogKeyPart(value: string) {
  return normalizeSearchTerm(value).replace(/\s+/g, " ");
}

function dedupeKey(item: ExternalLmsCatalogItem) {
  return [
    item.provider,
    normalizeCatalogKeyPart(item.catalogId || item.classId || item.module),
    normalizeCatalogKeyPart(item.title)
  ].join("|");
}

function searchableText(item: ExternalLmsCatalogItem) {
  return [
    item.title,
    item.catalogId,
    item.description,
    item.path,
    item.section,
    item.module,
    item.functionalArea,
    item.department,
    item.classId,
    item.language,
    item.level
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function isExternalLmsProvider(value: string): value is ExternalLmsProvider {
  return externalLmsProviders.includes(value as ExternalLmsProvider);
}

export function getExternalLmsCatalogItems() {
  return typedCatalogItems;
}

export function searchExternalLmsCatalog(options: ExternalLmsSearchOptions = {}) {
  const provider = options.provider && options.provider !== "all" ? options.provider : "";
  const query = normalizeSearchTerm(options.query ?? "");
  const limit = Math.min(Math.max(options.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const terms = query.split(/\s+/).filter(Boolean);

  const results: ExternalLmsCatalogItem[] = [];
  const seen = new Set<string>();

  for (const item of typedCatalogItems) {
    if (provider && item.provider !== provider) continue;
    const haystack = terms.length ? searchableText(item) : "";
    if (terms.length && !terms.every((term) => haystack.includes(term))) continue;
    const key = dedupeKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(item);
    if (results.length >= limit) break;
  }

  return {
    items: results,
    limit,
    totalCatalogItems: typedCatalogItems.length
  };
}
