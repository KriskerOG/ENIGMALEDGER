import { env } from "../env";
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

export interface UexTradeRoutesResult {
  originTerminal?: UexTerminal;
  routes: TradeRouteRecord[];
}

const uexRouteCache = new Map<string, CachedUexRoutes>();

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

  [trimmed, withoutStation, afterDash].forEach((candidate) => {
    if (candidate) {
      queries.add(candidate);
    }
  });

  return Array.from(queries);
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

async function fetchOriginTerminal(origin: string): Promise<UexTerminal | undefined> {
  for (const query of buildTerminalQueries(origin)) {
    const terminalResponse = await fetchUexResource<UexTerminal[]>("terminals", { name: query });
    const originTerminal = pickOriginTerminal(asArray(terminalResponse.data), origin);

    if (originTerminal) {
      return originTerminal;
    }
  }

  return undefined;
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

  return {
    id: `uex-route-${route.id}`,
    commodity: route.commodity_name,
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
    destinationLocation: destinationTrail || undefined,
    buyTerminal: route.origin_terminal_name ?? route.origin_terminal_code ?? "Unknown buy terminal",
    sellTerminal: destinationTrail
      ? `${route.destination_terminal_name ?? route.destination_terminal_code ?? "Unknown sell terminal"} (${destinationTrail})`
      : (route.destination_terminal_name ?? route.destination_terminal_code ?? "Unknown sell terminal"),
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
