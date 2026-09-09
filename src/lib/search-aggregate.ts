import { searchRecordsFromDb } from "./db/search-repository";
import { mockRecords } from "./mock-data";
import { searchRecords } from "./search";
import { searchWikiRecords, searchWikiVehicleRecords } from "./sources/star-citizen-wiki";
import type { SearchInput, SearchProviderResult, SearchRecord, SearchSourceFilter } from "./types";

interface AggregateSearchInput extends SearchInput {
  source: SearchSourceFilter;
}

function dedupeRecords(records: SearchRecord[]): SearchRecord[] {
  const deduped = new Map<string, SearchRecord>();

  for (const record of records) {
    const key = `${record.type}:${normalizeDedupeText(record.name)}`;
    const existing = deduped.get(key);

    if (!existing || recordCompletenessScore(record) > recordCompletenessScore(existing)) {
      deduped.set(key, record);
    }
  }

  return Array.from(deduped.values());
}

function normalizeDedupeText(value: string | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function hasUsefulRecordValue(value: string | number | null | undefined): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  const text = String(value).trim().toLowerCase();
  return Boolean(text) && !["unknown", "n/a", "none", "null", "undefined"].includes(text);
}

function recordCompletenessScore(record: SearchRecord): number {
  const stats = Object.values(record.stats ?? {}).filter(hasUsefulRecordValue).length;
  const cargo = hasUsefulRecordValue(record.stats?.Cargo) ? 12 : 0;
  const manufacturer = record.manufacturer || hasUsefulRecordValue(record.stats?.Manufacturer) ? 6 : 0;
  const summary = record.summary ? Math.min(10, Math.floor(record.summary.length / 40)) : 0;

  return stats + cargo + manufacturer + summary + record.tags.length + (record.source.sourceUrl ? 3 : 0);
}

function matchesFilters(record: SearchRecord, input: SearchInput): boolean {
  const matchesType = !input.type || input.type === "all" || record.type === input.type;
  const matchesFreshness =
    !input.freshness || input.freshness === "all" || record.source.freshness === input.freshness;

  return matchesType && matchesFreshness;
}

export async function aggregateSearch(input: AggregateSearchInput): Promise<SearchProviderResult[]> {
  const providerResults: SearchProviderResult[] = [];
  const query = input.query?.trim() ?? "";

  if (input.source === "all" || input.source === "database") {
    try {
      const dbRecords = await searchRecordsFromDb(input);

      if (dbRecords) {
        providerResults.push({
          provider: "database",
          records: dbRecords
        });
      } else if (input.source === "database") {
        providerResults.push({
          provider: "database",
          records: [],
          error: "DATABASE_URL is not configured."
        });
      }
    } catch (error) {
      providerResults.push({
        provider: "database",
        records: [],
        error: error instanceof Error ? error.message : "Database search failed."
      });
    }
  }

  if (input.source === "local") {
    providerResults.push({
      provider: "local",
      records: searchRecords(input, mockRecords)
    });
  }

  if ((input.source === "all" || input.source === "wiki") && query.length >= 2) {
    try {
      const shouldSearchVehicles = !input.type || input.type === "all" || input.type === "ship" || input.type === "vehicle";
      const wikiResults = await Promise.allSettled([
        searchWikiRecords(query),
        shouldSearchVehicles ? searchWikiVehicleRecords(query, input.limit ?? 25) : Promise.resolve([])
      ]);
      const wikiRecords = dedupeRecords(
        wikiResults.flatMap((result) => (result.status === "fulfilled" ? result.value : []))
      )
        .filter((record) => matchesFilters(record, input))
        .slice(0, input.limit ?? 25);

      const failedWikiResult = wikiResults.find((result) => result.status === "rejected");

      if (!wikiRecords.length && failedWikiResult && wikiResults.every((result) => result.status === "rejected")) {
        throw failedWikiResult.reason;
      }

      providerResults.push({
        provider: "wiki",
        records: wikiRecords
      });
    } catch (error) {
      providerResults.push({
        provider: "wiki",
        records: [],
        error: error instanceof Error ? error.message : "Wiki search failed."
      });
    }
  }

  return providerResults;
}

export function flattenProviderResults(results: SearchProviderResult[], limit: number): SearchRecord[] {
  return dedupeRecords(results.flatMap((result) => result.records)).slice(0, limit);
}
