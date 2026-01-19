export type SearchableProduct = {
  name?: string;
  description?: string;
  category?: string;
  tags?: string[];
  aliases?: string[];
  nameTranslations?: Record<string, string>;
  searchTokens?: string[];
};

const diacriticsRegex = /[\u0300-\u036f]/g;
const nonWordRegex = /[^0-9a-z\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]+/g;

export const normalizeSearchText = (value: string): string => {
  if (!value) return '';
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(diacriticsRegex, '')
    .replace(nonWordRegex, ' ')
    .trim();
};

const splitTokens = (value: string): string[] => {
  const normalized = normalizeSearchText(value);
  return normalized ? normalized.split(/\s+/).filter(Boolean) : [];
};

const addTokens = (set: Set<string>, value?: string) => {
  if (!value) return;
  const normalized = normalizeSearchText(value);
  if (normalized) set.add(normalized);
  splitTokens(value).forEach((token) => set.add(token));
};

const addArrayTokens = (set: Set<string>, values?: string[]) => {
  if (!Array.isArray(values)) return;
  values.forEach((value) => addTokens(set, value));
};

const addTranslationTokens = (set: Set<string>, translations?: Record<string, string>) => {
  if (!translations) return;
  Object.values(translations).forEach((value) => addTokens(set, value));
};

export const buildProductSearchTokens = (product: SearchableProduct): string[] => {
  const tokens = new Set<string>();
  addTokens(tokens, product.name);
  addTokens(tokens, product.description);
  addTokens(tokens, product.category);
  addArrayTokens(tokens, product.tags);
  addArrayTokens(tokens, product.aliases);
  addTranslationTokens(tokens, product.nameTranslations);
  return Array.from(tokens);
};

export const matchesProductSearch = (product: SearchableProduct, rawTerm: string): boolean => {
  const normalizedQuery = normalizeSearchText(rawTerm);
  if (!normalizedQuery) return true;
  const termTokens = Array.from(new Set([...splitTokens(rawTerm), normalizedQuery]));
  const sourceTokens = Array.isArray(product.searchTokens) && product.searchTokens.length
    ? product.searchTokens
    : buildProductSearchTokens(product);
  const haystack = sourceTokens.map((token) => normalizeSearchText(token)).filter(Boolean);
  if (!haystack.length) return false;
  return termTokens.every((token) => haystack.some((candidate) => candidate.includes(token)));
};
