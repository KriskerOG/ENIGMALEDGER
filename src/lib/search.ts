import { mockRecords } from "./mock-data";
import type { SearchInput, SearchRecord } from "./types";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 50;

export function normalizeSearchText(value: string | number | null | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    .normalize("NFKD");
}

function buildSearchDocument(record: SearchRecord): string {
  return [
    record.type,
    record.name,
    record.nameZh,
    record.manufacturer,
    record.categoryLabel,
    record.summary,
    record.source.sourceName,
    record.source.gameVersion,
    ...record.tags,
    ...Object.values(record.stats)
  ]
    .map(normalizeSearchText)
    .join(" ");
}

function scoreRecord(record: SearchRecord, query: string): number {
  if (!query) {
    return 1;
  }

  const name = normalizeSearchText(record.name);
  const nameZh = normalizeSearchText(record.nameZh);
  const document = buildSearchDocument(record);

  if (name === query || nameZh === query) {
    return 100;
  }

  if (name.startsWith(query) || nameZh.startsWith(query)) {
    return 80;
  }

  if (name.includes(query) || nameZh.includes(query)) {
    return 60;
  }

  return document.includes(query) ? 20 : 0;
}

export function searchRecords(input: SearchInput, sourceRecords: SearchRecord[] = mockRecords): SearchRecord[] {
  const query = normalizeSearchText(input.query);
  const type = input.type ?? "all";
  const freshness = input.freshness ?? "all";
  const limit = Math.min(Math.max(input.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);

  return sourceRecords
    .map((record) => ({ record, score: scoreRecord(record, query) }))
    .filter(({ record, score }) => {
      const matchesQuery = query ? score > 0 : true;
      const matchesType = type === "all" || record.type === type;
      const matchesFreshness = freshness === "all" || record.source.freshness === freshness;
      return matchesQuery && matchesType && matchesFreshness;
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.record.name.localeCompare(right.record.name);
    })
    .slice(0, limit)
    .map(({ record }) => record);
}
