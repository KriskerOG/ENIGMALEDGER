import { env } from "../env";
import {
  findLocalizationAliases,
  localizationAliases,
  normalizeLocalizationAliasText,
  type LocalizationAlias
} from "../generated/localization-aliases";
import type { FreshnessStatus, TradeRouteInput, TradeRouteRecord } from "../types";
import { fetchJson } from "./http";

const UEX_API_BASE_URL = "https://api.uexcorp.uk/2.0";
const UEX_ROUTE_CACHE_TTL_MS = 15 * 60 * 1000;

const allowedResources = new Set([
  "commodities",
  "commodities_prices",
  "commodities_routes",
  "terminals",
  "tradeports",
  "planets",
  "moons",
  "space_stations"
]);

export interface UexResponse<T> {
  status?: string;
  code?: number;
  http_code?: number;
  message?: string;
  data?: T;
}

interface UexTerminal {
  id: number;
  name?: string | null;
  fullname?: string | null;
  nickname?: string | null;
  displayname?: string | null;
  code?: string | null;
  type?: string | null;
  is_available?: number | boolean | null;
  is_available_live?: number | boolean | null;
  is_visible?: number | boolean | null;
  game_version?: string | null;
  date_modified?: number | null;
}

export interface UexTradeLocationSuggestion {
  id: number;
  name: string;
  nameZh?: string;
  displayName: string;
  displayNameZh?: string;
  code?: string;
  type?: string;
}

interface UexCommodityRoute {
  id: number;
  code?: string | null;
  price_origin?: number | string | null;
  price_destination?: number | string | null;
  price_margin?: number | string | null;
  price_roi?: number | string | null;
  scu_origin?: number | string | null;
  scu_destination?: number | string | null;
  scu_reachable?: number | string | null;
  score?: number | string | null;
  distance?: number | string | null;
  date_added?: number | string | null;
  commodity_name?: string | null;
  commodity_slug?: string | null;
  id_terminal_origin?: number | string | null;
  id_terminal_destination?: number | string | null;
  origin_star_system_name?: string | null;
  origin_planet_name?: string | null;
  origin_orbit_name?: string | null;
  origin_terminal_name?: string | null;
  origin_terminal_code?: string | null;
  origin_terminal_slug?: string | null;
  destination_star_system_name?: string | null;
  destination_planet_name?: string | null;
  destination_orbit_name?: string | null;
  destination_terminal_name?: string | null;
  destination_terminal_code?: string | null;
  destination_terminal_slug?: string | null;
  destination_faction_name?: string | null;
  game_version_origin?: string | null;
  game_version_destination?: string | null;
  container_sizes_origin?: string | null;
  container_sizes_destination?: string | null;
  is_monitored_origin?: number | boolean | null;
  is_monitored_destination?: number | boolean | null;
  has_loading_dock_origin?: number | boolean | null;
  has_loading_dock_destination?: number | boolean | null;
  has_docking_port_origin?: number | boolean | null;
  has_docking_port_destination?: number | boolean | null;
  has_freight_elevator_origin?: number | boolean | null;
  has_freight_elevator_destination?: number | boolean | null;
  is_space_station_origin?: number | boolean | null;
  is_space_station_destination?: number | boolean | null;
  is_on_ground_origin?: number | boolean | null;
  is_on_ground_destination?: number | boolean | null;
}

interface CachedUexRoutes {
  expiresAt: number;
  originTerminal?: UexTerminal;
  routes: TradeRouteRecord[];
}

interface CachedUexTerminals {
  expiresAt: number;
  terminals: UexTerminal[];
}

export interface UexTradeRoutesResult {
  originTerminal?: UexTerminal;
  routes: TradeRouteRecord[];
}

const uexRouteCache = new Map<string, CachedUexRoutes>();
let uexTerminalCache: CachedUexTerminals | undefined;

const manualTradeQueryAliasPairs: Array<[string, string[]]> = [
  ["特蕾莎", ["Port Tressler"]],
  ["特蕾莎空间站", ["Port Tressler"]],
  ["特雷莎", ["Port Tressler"]],
  ["特雷莎空间站", ["Port Tressler"]],
  ["特雷斯勒", ["Port Tressler"]],
  ["特雷斯勒空间站", ["Port Tressler"]],
  ["炽天使", ["Seraphim Station"]],
  ["炽天使空间站", ["Seraphim Station"]],
  ["地球网关", ["Terra Gateway"]],
  ["泰拉网关", ["Terra Gateway"]]
];

const manualEnglishToChinesePairs: Array<[string, string]> = [
  ["Admin", "Admin"],
  ["Stanton", "斯坦顿"],
  ["Pyro", "派罗"],
  ["Nyx", "尼克斯"],
  ["Crusader", "十字军"],
  ["Hurston", "赫斯顿"],
  ["ArcCorp", "弧光星"],
  ["MicroTech", "微科星"],
  ["Terra Gateway", "泰拉网关"],
  ["Terra Gateway (Stanton)", "泰拉网关（斯坦顿）"],
  ["Terra Gateway (Stanton system)", "泰拉网关（斯坦顿星系）"],
  ["Port Tressler", "特雷斯勒空间站"],
  ["Seraphim", "炽天使"],
  ["Seraphim Station", "炽天使空间站"],
  ["New Babbage", "新巴贝奇"],
  ["Lorville", "洛维尔"],
  ["Area 18", "18 区"],
  ["Area18", "18 区"],
  ["Levski", "列夫斯基"],
  ["Delamar", "戴玛尔"],
  ["Bloom", "盛放星"]
];

export async function fetchUexResource<T>(
  resource: string,
  params: Record<string, string | number | boolean | undefined> = {}
): Promise<UexResponse<T>> {
  if (!allowedResources.has(resource)) {
    throw new Error(`UEX resource is not allowed: ${resource}`);
  }

  const headers: Record<string, string> = {
    "x-client-version": env.UEX_CLIENT_VERSION
  };

  if (env.UEX_API_TOKEN) {
    headers.authorization = `Bearer ${env.UEX_API_TOKEN}`;
  }

  return fetchJson<UexResponse<T>>(`${UEX_API_BASE_URL}/${resource}`, {
    searchParams: params,
    headers
  });
}

function normalizeName(value: string | null | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeTradeAliasText(value: string | number | null | undefined): string {
  return normalizeLocalizationAliasText(value).replace(/\s+/g, " ").trim();
}

function getManualTradeQueryAliases(query: string | undefined): string[] {
  const normalizedQuery = normalizeTradeAliasText(query);

  if (!normalizedQuery) {
    return [];
  }

  const explicitAliases = manualTradeQueryAliasPairs.find(([alias]) => normalizeTradeAliasText(alias) === normalizedQuery)?.[1] ?? [];
  const englishAlias = manualEnglishToChinesePairs.find(
    ([english, chinese]) => normalizeTradeAliasText(english) === normalizedQuery || normalizeTradeAliasText(chinese) === normalizedQuery
  )?.[0];

  return uniqueStrings([...explicitAliases, englishAlias]);
}

function getManualEnglishToChinese(value: string | undefined): string | undefined {
  const normalizedValue = normalizeTradeAliasText(value);

  if (!normalizedValue) {
    return undefined;
  }

  return manualEnglishToChinesePairs.find(([english]) => normalizeTradeAliasText(english) === normalizedValue)?.[1];
}

function getLooseLocationQueryVariants(query: string | undefined): string[] {
  const trimmed = String(query ?? "").trim();

  if (!trimmed) {
    return [];
  }

  const titleCase = trimmed
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/(\s+|-)/)
    .map((part) => (/^[a-z]+$/i.test(part) ? `${part.slice(0, 1).toUpperCase()}${part.slice(1).toLowerCase()}` : part))
    .join("");

  return uniqueStrings([
    titleCase,
    trimmed.replace(/([a-z])([A-Z])/g, "$1 $2"),
    trimmed.replace(/\b(port)(tressler)\b/gi, "$1 $2"),
    trimmed.replace(/\b(terra|stanton|pyro|nyx)(gateway)\b/gi, "$1 $2"),
    trimmed.replace(/\b(area)(18)\b/gi, "$1 $2")
  ]).filter((candidate) => normalizeTradeAliasText(candidate) !== normalizeTradeAliasText(trimmed));
}

function hasCjk(value: string | undefined): boolean {
  return /[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/u.test(String(value ?? ""));
}

function levenshteinDistance(left: string, right: string): number {
  const a = Array.from(left);
  const b = Array.from(right);
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = new Array<number>(b.length + 1).fill(0);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;

    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }

    for (let j = 0; j <= b.length; j += 1) {
      previous[j] = current[j];
    }
  }

  return previous[b.length];
}

function scoreTradeAlias(alias: LocalizationAlias, purpose: "location" | "commodity" | "any" = "any"): number {
  const key = `${alias.key} ${alias.packageId} ${alias.kind}`.toLowerCase();
  let score = 0;

  if (alias.packageId === "paratranz_terms") {
    score += 8;
  }

  if (purpose === "location") {
    if (/location|stanton|pyro|nyx|transfer|landing|outpost|station|terminal|spaceport/.test(key)) {
      score += 30;
    }
  } else if (purpose === "commodity") {
    if (/commodit|mineral|resource|harvestable|cargo|goods|item_commodities/.test(key)) {
      score += 30;
    }
  } else if (/location|stanton|pyro|nyx|commodit|mineral|resource|terminal|station|spaceport/.test(key)) {
    score += 15;
  }

  if (alias.en.length <= 48) {
    score += 6;
  }

  if (alias.zh.length <= 18) {
    score += 10;
  } else if (alias.zh.length > 32) {
    score -= 18;
  }

  if (/[\n\r]|https?:\/\//.test(alias.zh)) {
    score -= 30;
  }

  return score;
}

function getFuzzyTradeAliases(query: string, purpose: "location" | "commodity" | "any", limit = 8): LocalizationAlias[] {
  const normalizedQuery = normalizeTradeAliasText(query);

  if (!hasCjk(normalizedQuery) || Array.from(normalizedQuery).length < 2) {
    return [];
  }

  return localizationAliases
    .map((alias) => {
      const zh = normalizeTradeAliasText(alias.zh);

      if (!zh || !hasCjk(zh)) {
        return { alias, score: 0 };
      }

      const distance = levenshteinDistance(normalizedQuery, zh);
      const firstCharBonus = Array.from(normalizedQuery)[0] === Array.from(zh)[0] ? 16 : 0;
      const fuzzyScore = distance <= 3 ? 44 - distance * 8 + firstCharBonus : 0;

      return { alias, score: fuzzyScore ? fuzzyScore + scoreTradeAlias(alias, purpose) : 0 };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.alias.zh.length - right.alias.zh.length)
    .slice(0, limit)
    .map((item) => item.alias);
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const trimmed = String(value ?? "").trim();
    const key = normalizeTradeAliasText(trimmed);

    if (!trimmed || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(trimmed);
  }

  return result;
}

export function getTradeQueryCandidates(
  query: string | undefined,
  purpose: "location" | "commodity" | "any" = "any",
  limit = 8
): string[] {
  const trimmed = String(query ?? "").trim();

  if (!trimmed) {
    return [];
  }

  const aliases = [
    ...findLocalizationAliases(trimmed, limit * 2),
    ...getFuzzyTradeAliases(trimmed, purpose, limit)
  ]
    .map((alias) => ({ alias, score: scoreTradeAlias(alias, purpose) }))
    .sort((left, right) => right.score - left.score || left.alias.en.length - right.alias.en.length)
    .map((item) => item.alias);
  const manualAliases = getManualTradeQueryAliases(trimmed);
  const looseLocationVariants = purpose === "location" ? getLooseLocationQueryVariants(trimmed) : [];

  return uniqueStrings([...manualAliases, trimmed, ...looseLocationVariants, ...aliases.map((alias) => alias.en)]).slice(0, limit);
}

export function resolveTradeQuery(query: string | undefined, purpose: "location" | "commodity" | "any" = "any"): string {
  return getTradeQueryCandidates(query, purpose, 2)[0] ?? String(query ?? "").trim();
}

function getBestAliasZhForEnglish(value: string | undefined, purpose: "location" | "commodity" | "any" = "any"): string | undefined {
  const normalizedValue = normalizeTradeAliasText(value);

  if (!normalizedValue) {
    return undefined;
  }

  const manual = getManualEnglishToChinese(value);

  if (manual) {
    return manual;
  }

  const best = localizationAliases
    .filter((alias) => normalizeTradeAliasText(alias.en) === normalizedValue)
    .map((alias) => ({ alias, score: scoreTradeAlias(alias, purpose) }))
    .sort((left, right) => right.score - left.score || left.alias.zh.length - right.alias.zh.length)[0]?.alias;

  return best?.zh;
}

function localizeCompositeName(value: string | undefined, purpose: "location" | "commodity" | "any" = "any"): string | undefined {
  const original = String(value ?? "").trim();

  if (!original) {
    return undefined;
  }

  const exact = getBestAliasZhForEnglish(original, purpose);

  if (exact) {
    return exact;
  }

  if (original.includes(" - ")) {
    const parts = original.split(" - ");
    const localizedParts = parts.map((part) => getBestAliasZhForEnglish(part, purpose) ?? part);
    const localized = localizedParts.join(" - ");

    return localized === original ? undefined : localized;
  }

  return undefined;
}

function localizeLocationTrail(value: string | undefined): string | undefined {
  const original = String(value ?? "").trim();

  if (!original) {
    return undefined;
  }

  const localized = original
    .split("/")
    .map((part) => {
      const trimmed = part.trim();
      return getBestAliasZhForEnglish(trimmed, "location") ?? trimmed;
    })
    .join(" / ");

  return localized === original ? undefined : localized;
}

function asNumber(value: number | string | null | undefined): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function isEnabled(value: number | boolean | null | undefined): boolean {
  return value === undefined || value === null || value === true || value === 1;
}

function asArray<T>(value: T | T[] | undefined): T[] {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function buildTerminalQueries(origin: string): string[] {
  const queries = new Set<string>();
  const trimmed = origin.trim();
  const withoutStation = trimmed.replace(/\bstation\b/gi, "").replace(/\s+/g, " ").trim();
  const afterDash = trimmed.split("-").at(-1)?.trim();

  [trimmed, withoutStation, afterDash, ...getLooseLocationQueryVariants(trimmed), ...getTradeQueryCandidates(trimmed, "location")].forEach((candidate) => {
    if (candidate) {
      queries.add(candidate);
    }
  });

  return Array.from(queries);
}

function mapTerminalToLocationSuggestion(terminal: UexTerminal): UexTradeLocationSuggestion | undefined {
  const name = terminal.name ?? terminal.fullname ?? terminal.displayname ?? terminal.nickname ?? terminal.code;
  const displayName = terminal.displayname ?? terminal.fullname ?? terminal.name ?? terminal.nickname ?? terminal.code;

  if (!terminal.id || !name || !displayName) {
    return undefined;
  }

  return {
    id: terminal.id,
    name,
    nameZh: localizeCompositeName(name, "location"),
    displayName,
    displayNameZh: localizeCompositeName(displayName, "location"),
    code: terminal.code ?? undefined,
    type: terminal.type ?? undefined
  };
}

function toIsoDateFromUnixSeconds(value: number | string | null | undefined): string | undefined {
  const seconds = asNumber(value);

  if (seconds <= 0) {
    return undefined;
  }

  const date = new Date(seconds * 1000);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString().slice(0, 10);
}

function getFreshness(sourceUpdatedAt: string | undefined): FreshnessStatus {
  if (!sourceUpdatedAt) {
    return "unknown";
  }

  const timestamp = new Date(sourceUpdatedAt).getTime();

  if (Number.isNaN(timestamp)) {
    return "unknown";
  }

  const ageDays = (Date.now() - timestamp) / 86_400_000;

  if (ageDays <= 7) {
    return "fresh";
  }

  if (ageDays <= 30) {
    return "recent";
  }

  return "stale";
}

function pickOriginTerminal(terminals: UexTerminal[], origin: string): UexTerminal | undefined {
  const normalizedOrigin = normalizeName(origin);
  const commodityTerminals = terminals.filter(
    (terminal) =>
      terminal.type === "commodity" &&
      isEnabled(terminal.is_available) &&
      isEnabled(terminal.is_available_live) &&
      isEnabled(terminal.is_visible)
  );

  if (!commodityTerminals.length) {
    return undefined;
  }

  return (
    commodityTerminals.find((terminal) =>
      [terminal.displayname, terminal.name, terminal.fullname, terminal.nickname, terminal.code].some(
        (candidate) => normalizeName(candidate) === normalizedOrigin
      )
    ) ??
    commodityTerminals.find((terminal) =>
      [terminal.displayname, terminal.name, terminal.fullname, terminal.nickname, terminal.code].some((candidate) =>
        normalizeName(candidate).includes(normalizedOrigin)
      )
    ) ??
    commodityTerminals[0]
  );
}

function scoreTerminalMatch(terminal: UexTerminal, query: string): number {
  const normalizedQuery = normalizeName(resolveTradeQuery(query, "location") || query);
  const compactQuery = normalizedQuery.replace(/\s+/g, "");
  const candidates = [terminal.displayname, terminal.name, terminal.fullname, terminal.nickname, terminal.code]
    .map((candidate) => normalizeName(candidate))
    .filter(Boolean);
  let score = terminal.type === "commodity" ? 8 : 0;

  for (const candidate of candidates) {
    const compactCandidate = candidate.replace(/\s+/g, "");

    if (candidate === normalizedQuery || compactCandidate === compactQuery) {
      score = Math.max(score, 100);
    } else if (candidate.includes(normalizedQuery) || compactCandidate.includes(compactQuery)) {
      score = Math.max(score, 72 - Math.max(0, candidate.length - normalizedQuery.length));
    } else if (normalizedQuery.includes(candidate)) {
      score = Math.max(score, 44);
    }
  }

  return score;
}

function pickFuzzyTerminal(terminals: UexTerminal[], query: string): UexTerminal | undefined {
  return terminals
    .filter(
      (terminal) =>
        terminal.type === "commodity" &&
        isEnabled(terminal.is_available) &&
        isEnabled(terminal.is_available_live) &&
        isEnabled(terminal.is_visible)
    )
    .map((terminal) => ({ terminal, score: scoreTerminalMatch(terminal, query) }))
    .filter((item) => item.score >= 40)
    .sort((left, right) => right.score - left.score || String(left.terminal.displayname ?? left.terminal.name).localeCompare(String(right.terminal.displayname ?? right.terminal.name)))[0]?.terminal;
}

async function fetchAllUexTerminals(refresh = false): Promise<UexTerminal[]> {
  if (!refresh && uexTerminalCache && uexTerminalCache.expiresAt > Date.now()) {
    return uexTerminalCache.terminals;
  }

  const terminalResponse = await fetchUexResource<UexTerminal[]>("terminals");
  const terminals = asArray(terminalResponse.data);

  uexTerminalCache = {
    expiresAt: Date.now() + UEX_ROUTE_CACHE_TTL_MS,
    terminals
  };

  return terminals;
}

async function fetchOriginTerminal(origin: string): Promise<UexTerminal | undefined> {
  for (const query of buildTerminalQueries(origin)) {
    const terminalResponse = await fetchUexResource<UexTerminal[]>("terminals", { name: query });
    const originTerminal = pickOriginTerminal(asArray(terminalResponse.data), origin);

    if (originTerminal) {
      return originTerminal;
    }
  }

  return pickFuzzyTerminal(await fetchAllUexTerminals(), origin);
}

export async function fetchUexTradeLocationSuggestions(
  query: string | undefined,
  limit = 20
): Promise<UexTradeLocationSuggestion[]> {
  const queries = getTradeQueryCandidates(query, "location", 8);
  const terminalResponses = await Promise.allSettled(
    queries.map((name) => fetchUexResource<UexTerminal[]>("terminals", { name }))
  );
  const suggestions = terminalResponses
    .filter((response): response is PromiseFulfilledResult<UexResponse<UexTerminal[]>> => response.status === "fulfilled")
    .flatMap((response) => asArray(response.value.data))
    .filter(
      (terminal) =>
        isEnabled(terminal.is_available) &&
        isEnabled(terminal.is_available_live) &&
        isEnabled(terminal.is_visible)
    )
    .map(mapTerminalToLocationSuggestion)
    .filter((suggestion): suggestion is UexTradeLocationSuggestion => Boolean(suggestion));
  const fuzzySuggestion = query ? mapTerminalToLocationSuggestion(pickFuzzyTerminal(await fetchAllUexTerminals(), query) ?? ({} as UexTerminal)) : undefined;
  const seen = new Set<string>();

  return [...(fuzzySuggestion ? [fuzzySuggestion] : []), ...suggestions]
    .sort((left, right) => {
      const typeScore = (value: UexTradeLocationSuggestion) => (value.type === "commodity" ? 0 : 1);
      return typeScore(left) - typeScore(right) || left.displayName.localeCompare(right.displayName);
    })
    .filter((suggestion) => {
      const key = `${suggestion.id}:${normalizeTradeAliasText(suggestion.displayName)}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .slice(0, Math.max(1, Math.min(limit, 50)));
}

async function fetchRoutesForTerminalId(
  terminalId: number,
  cacheLabel: string,
  refresh = false
): Promise<UexTradeRoutesResult> {
  const cacheKey = `id:${terminalId}`;
  const cached = uexRouteCache.get(cacheKey);

  if (!refresh && cached && cached.expiresAt > Date.now()) {
    return {
      originTerminal: cached.originTerminal,
      routes: cached.routes
    };
  }

  const routeResponse = await fetchUexResource<UexCommodityRoute[]>("commodities_routes", {
    id_terminal_origin: terminalId
  });
  const fetchedAt = new Date().toISOString();
  const routes = asArray(routeResponse.data)
    .map((route) => mapUexRouteToTradeRoute(route, fetchedAt))
    .filter((route): route is TradeRouteRecord => Boolean(route));
  const originTerminal: UexTerminal = {
    id: terminalId,
    name: cacheLabel,
    displayname: cacheLabel,
    type: "commodity"
  };

  uexRouteCache.set(cacheKey, {
    expiresAt: Date.now() + UEX_ROUTE_CACHE_TTL_MS,
    originTerminal,
    routes
  });

  return {
    originTerminal,
    routes
  };
}

function buildLocationTrail(system?: string | null, planet?: string | null, orbit?: string | null): string {
  return [system, planet ?? orbit].filter(Boolean).join(" / ");
}

function parseContainerSizes(value: string | null | undefined): number[] {
  return String(value ?? "")
    .split(",")
    .map((size) => Number(size.trim()))
    .filter((size) => Number.isInteger(size) && size > 0);
}

function intersectContainerSizes(left: number[], right: number[]): number[] {
  if (!left.length) {
    return right;
  }

  if (!right.length) {
    return left;
  }

  return left.filter((size) => right.includes(size));
}

function getRouteRisk(route: UexCommodityRoute): TradeRouteRecord["risk"] {
  const faction = normalizeName(route.destination_faction_name);

  if (
    !isEnabled(route.is_monitored_destination) ||
    faction.includes("dusters") ||
    faction.includes("nine tails") ||
    faction.includes("rough ready") ||
    faction.includes("people s alliance")
  ) {
    return "High";
  }

  if (route.destination_star_system_name && route.origin_star_system_name !== route.destination_star_system_name) {
    return "Medium";
  }

  if (!isEnabled(route.has_loading_dock_destination) && !isEnabled(route.has_docking_port_destination)) {
    return "Medium";
  }

  return "Low";
}

function mapUexRouteToTradeRoute(route: UexCommodityRoute, fetchedAt: string): TradeRouteRecord | undefined {
  const buyPrice = asNumber(route.price_origin);
  const sellPrice = asNumber(route.price_destination);
  const availableScu = Math.floor(asNumber(route.scu_reachable) || asNumber(route.scu_origin));

  if (!route.commodity_name || buyPrice <= 0 || sellPrice <= buyPrice || availableScu <= 0) {
    return undefined;
  }

  const destinationTrail = buildLocationTrail(
    route.destination_star_system_name,
    route.destination_planet_name,
    route.destination_orbit_name
  );
  const originTrail = buildLocationTrail(route.origin_star_system_name, route.origin_planet_name, route.origin_orbit_name);
  const originContainerSizes = parseContainerSizes(route.container_sizes_origin);
  const destinationContainerSizes = parseContainerSizes(route.container_sizes_destination);
  const sourceUpdatedAt = toIsoDateFromUnixSeconds(route.date_added);
  const gameVersion = [route.game_version_origin, route.game_version_destination].filter(Boolean).join(" / ");
  const buyTerminal = route.origin_terminal_name ?? route.origin_terminal_code ?? "Unknown buy terminal";
  const sellTerminalName = route.destination_terminal_name ?? route.destination_terminal_code ?? "Unknown sell terminal";
  const sellTerminal = destinationTrail ? `${sellTerminalName} (${destinationTrail})` : sellTerminalName;

  return {
    id: `uex-route-${route.id}`,
    commodity: route.commodity_name,
    commodityZh: localizeCompositeName(route.commodity_name, "commodity"),
    origin: route.origin_terminal_name ?? "Unknown origin",
    originTerminalId: asNumber(route.id_terminal_origin) || undefined,
    destinationTerminalId: asNumber(route.id_terminal_destination) || undefined,
    originTerminalCode: route.origin_terminal_code ?? undefined,
    destinationTerminalCode: route.destination_terminal_code ?? undefined,
    originTerminalName: route.origin_terminal_name ?? undefined,
    destinationTerminalName: route.destination_terminal_name ?? undefined,
    originTerminalSlug: route.origin_terminal_slug ?? undefined,
    destinationTerminalSlug: route.destination_terminal_slug ?? undefined,
    originLocation: originTrail || undefined,
    originLocationZh: localizeLocationTrail(originTrail),
    destinationLocation: destinationTrail || undefined,
    destinationLocationZh: localizeLocationTrail(destinationTrail),
    buyTerminal,
    buyTerminalZh: localizeCompositeName(buyTerminal, "location"),
    sellTerminal,
    sellTerminalZh: destinationTrail
      ? `${localizeCompositeName(sellTerminalName, "location") ?? sellTerminalName} (${localizeLocationTrail(destinationTrail) ?? destinationTrail})`
      : localizeCompositeName(sellTerminalName, "location"),
    buyPrice,
    sellPrice,
    availableScu,
    distanceGm: asNumber(route.distance) || undefined,
    marginPercent: asNumber(route.price_roi) || undefined,
    routeCode: route.code ?? undefined,
    score: asNumber(route.score) || undefined,
    containerSizes: intersectContainerSizes(originContainerSizes, destinationContainerSizes),
    originContainerSizes,
    destinationContainerSizes,
    originIsGround: route.is_on_ground_origin === true || route.is_on_ground_origin === 1,
    destinationIsGround: route.is_on_ground_destination === true || route.is_on_ground_destination === 1,
    originIsSpaceStation: route.is_space_station_origin === true || route.is_space_station_origin === 1,
    destinationIsSpaceStation: route.is_space_station_destination === true || route.is_space_station_destination === 1,
    originHasFreightElevator: route.has_freight_elevator_origin === true || route.has_freight_elevator_origin === 1,
    destinationHasFreightElevator: route.has_freight_elevator_destination === true || route.has_freight_elevator_destination === 1,
    originHasDockingPort: route.has_docking_port_origin === true || route.has_docking_port_origin === 1,
    destinationHasDockingPort: route.has_docking_port_destination === true || route.has_docking_port_destination === 1,
    risk: getRouteRisk(route),
    source: {
      sourceName: "UEX Corp API",
      sourceUrl: route.commodity_slug
        ? `https://uexcorp.space/commodities/info/name/${route.commodity_slug}`
        : "https://uexcorp.space/api/documentation/id/get_commodities_routes/",
      sourceRecordId: String(route.id),
      gameVersion: gameVersion || undefined,
      fetchedAt,
      sourceUpdatedAt,
      freshness: getFreshness(sourceUpdatedAt)
    }
  };
}

export async function fetchUexTradeRoutes(
  input: Pick<TradeRouteInput, "origin"> & { refresh?: boolean }
): Promise<UexTradeRoutesResult> {
  const origin = input.origin?.trim() || "Seraphim Station";
  const cacheKey = normalizeName(origin);
  const cached = uexRouteCache.get(cacheKey);

  if (!input.refresh && cached && cached.expiresAt > Date.now()) {
    return {
      originTerminal: cached.originTerminal,
      routes: cached.routes
    };
  }

  const originTerminal = await fetchOriginTerminal(origin);

  if (!originTerminal) {
    throw new Error(`UEX terminal not found for origin: ${origin}`);
  }

  const routeResponse = await fetchUexResource<UexCommodityRoute[]>("commodities_routes", {
    id_terminal_origin: originTerminal.id
  });
  const fetchedAt = new Date().toISOString();
  const routes = asArray(routeResponse.data)
    .map((route) => mapUexRouteToTradeRoute(route, fetchedAt))
    .filter((route): route is TradeRouteRecord => Boolean(route));

  uexRouteCache.set(cacheKey, {
    expiresAt: Date.now() + UEX_ROUTE_CACHE_TTL_MS,
    originTerminal,
    routes
  });

  return {
    originTerminal,
    routes
  };
}

export async function fetchUexTradeRoutesByTerminalId(
  terminalId: number,
  label: string,
  refresh = false
): Promise<UexTradeRoutesResult> {
  return fetchRoutesForTerminalId(terminalId, label, refresh);
}
