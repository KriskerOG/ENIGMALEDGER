import { searchRecordsFromDb } from "./db/search-repository";
import { findLocalizationAliases, type LocalizationAlias } from "./generated/localization-aliases";
import { mockRecords } from "./mock-data";
import { searchRecords } from "./search";
import { searchWikiRecords, searchWikiVehicleRecords } from "./sources/star-citizen-wiki";
import type { SearchInput, SearchProviderResult, SearchRecord, SearchSourceFilter } from "./types";

const CITIZENWIKI_SEARCH_URL = "https://citizenwiki.cn/index.php";
const STAR_CITIZEN_TOOLS_SEARCH_URL = "https://starcitizen.tools/index.php";

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

function buildWikiSearchUrl(baseUrl: string, query: string): string {
  const url = new URL(baseUrl);
  url.searchParams.set("search", query);
  return url.toString();
}

function hasCjkText(value: string): boolean {
  return /[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/u.test(value);
}

function buildSearchEntrySlug(prefix: string, query: string): string {
  const asciiSlug = query
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${prefix}-${asciiSlug || encodeURIComponent(query).replace(/%/g, "").toLowerCase().slice(0, 48)}`;
}

function makeWikiSearchLinkRecords(query: string): SearchRecord[] {
  return [
    {
      id: buildSearchEntrySlug("citizenwiki-search", query),
      type: "reference",
      slug: buildSearchEntrySlug("citizenwiki-search", query),
      name: `CitizenWiki CN: ${query}`,
      nameZh: `中文百科搜索：${query}`,
      categoryLabel: "中文 Wiki",
      summary: `在 CitizenWiki 中文百科中搜索“${query}”。`,
      tags: ["CitizenWiki", "中文百科", "外部搜索"],
      stats: {
        Query: query,
        Language: "zh-CN",
        Source: "CitizenWiki CN"
      },
      source: {
        sourceName: "CitizenWiki CN",
        sourceUrl: buildWikiSearchUrl(CITIZENWIKI_SEARCH_URL, query),
        freshness: "unknown"
      }
    },
    {
      id: buildSearchEntrySlug("scwiki-search", query),
      type: "reference",
      slug: buildSearchEntrySlug("scwiki-search", query),
      name: `SC Wiki: ${query}`,
      nameZh: `英文百科搜索：${query}`,
      categoryLabel: "SC Wiki",
      summary: `在 StarCitizen.tools / Star Citizen Wiki 中搜索“${query}”。`,
      tags: ["StarCitizen.tools", "SC Wiki", "外部搜索"],
      stats: {
        Query: query,
        Language: "en",
        Source: "StarCitizen.tools"
      },
      source: {
        sourceName: "StarCitizen.tools",
        sourceUrl: buildWikiSearchUrl(STAR_CITIZEN_TOOLS_SEARCH_URL, query),
        freshness: "unknown"
      }
    }
  ];
}

function makeLocalizationAliasRecord(alias: LocalizationAlias): SearchRecord {
  return {
    id: `localization-${alias.id}`,
    type: "reference",
    slug: `localization-${alias.id}`,
    name: alias.en,
    nameZh: alias.zh,
    categoryLabel: "汉化别名",
    summary: `来自 SC 汉化数据的中英别名：${alias.zh} -> ${alias.en}。`,
    tags: ["SC 汉化盒子", "汉化索引", alias.zh, alias.en, alias.packageId, alias.key],
    stats: {
      "Chinese Alias": alias.zh,
      "English Alias": alias.en,
      "Localization Key": alias.key,
      Package: alias.packageId
    },
    source: {
      sourceName: "SC Localization Alias",
      sourceRecordId: alias.id,
      freshness: "recent"
    }
  };
}

function dedupeLocalizationAliasesByEnglish(aliases: LocalizationAlias[]): LocalizationAlias[] {
  const seen = new Set<string>();
  const deduped: LocalizationAlias[] = [];

  for (const alias of aliases) {
    const key = normalizeDedupeText(alias.en);

    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(alias);
  }

  return deduped;
}

function makeLocalizationAliasRecords(aliases: LocalizationAlias[], input: SearchInput): SearchRecord[] {
  return dedupeLocalizationAliasesByEnglish(aliases)
    .map(makeLocalizationAliasRecord)
    .filter((record) => matchesFilters(record, input));
}

function getWikiSearchQueries(query: string, aliases: LocalizationAlias[]): string[] {
  const values = [query, ...aliases.map((alias) => alias.en)]
    .map((value) => value.trim())
    .filter((value) => value.length >= 2);

  return Array.from(new Set(values)).slice(0, 5);
}

function shouldAppendWikiSearchLinks(input: AggregateSearchInput, query: string, wikiRecordCount: number): boolean {
  const canShowReference = !input.type || input.type === "all" || input.type === "reference";

  return Boolean(query) && canShowReference && (hasCjkText(query) || wikiRecordCount === 0 || input.type === "reference");
}

export async function aggregateSearch(input: AggregateSearchInput): Promise<SearchProviderResult[]> {
  const providerResults: SearchProviderResult[] = [];
  const query = input.query?.trim() ?? "";
  const localizationAliases =
    (input.source === "all" || input.source === "wiki") && query.length >= 2 ? findLocalizationAliases(query, 10) : [];

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
      const wikiQueries = getWikiSearchQueries(query, localizationAliases);
      const wikiResults = await Promise.allSettled(
        wikiQueries.flatMap((wikiQuery) => [
          searchWikiRecords(wikiQuery),
          shouldSearchVehicles ? searchWikiVehicleRecords(wikiQuery, input.limit ?? 25) : Promise.resolve([])
        ])
      );
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

      if (localizationAliases.length) {
        providerResults.push({
          provider: "localization",
          records: makeLocalizationAliasRecords(localizationAliases, input)
        });
      }

      if (shouldAppendWikiSearchLinks(input, query, wikiRecords.length)) {
        providerResults.push({
          provider: "wiki-links",
          records: makeWikiSearchLinkRecords(query).filter((record) => matchesFilters(record, input))
        });
      }
    } catch (error) {
      providerResults.push({
        provider: "wiki",
        records: [],
        error: error instanceof Error ? error.message : "Wiki search failed."
      });

      if (localizationAliases.length) {
        providerResults.push({
          provider: "localization",
          records: makeLocalizationAliasRecords(localizationAliases, input)
        });
      }

      if (shouldAppendWikiSearchLinks(input, query, 0)) {
        providerResults.push({
          provider: "wiki-links",
          records: makeWikiSearchLinkRecords(query).filter((record) => matchesFilters(record, input))
        });
      }
    }
  } else if ((input.source === "all" || input.source === "wiki") && shouldAppendWikiSearchLinks(input, query, 0)) {
    providerResults.push({
      provider: "wiki-links",
      records: makeWikiSearchLinkRecords(query).filter((record) => matchesFilters(record, input))
    });
  }

  return providerResults;
}

export function flattenProviderResults(results: SearchProviderResult[], limit: number): SearchRecord[] {
  return dedupeRecords(results.flatMap((result) => result.records)).slice(0, limit);
}
