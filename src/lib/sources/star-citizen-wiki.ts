import { computeFreshnessStatus } from "../sync/freshness";
import { cargoShipStats, type CargoShipStatsRecord } from "../generated/cargo-ship-stats";
import type { CargoShipRecord, EntityType, SearchInput, SearchRecord } from "../types";
import { fetchJson } from "./http";

const WIKI_API_BASE_URL = "https://api.star-citizen.wiki";
const WIKI_SHIP_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

interface WikiCollection<T> {
  data?: T[];
  meta?: {
    current_page?: number;
    last_page?: number;
    per_page?: number;
    total?: number;
  };
}

export interface WikiVehicle {
  uuid?: string;
  id?: string | number;
  name?: string;
  game_name?: string;
  slug?: string;
  description?: string | WikiLocalizedText | null;
  game_description?: string | WikiLocalizedText | null;
  type?: string | WikiLocalizedText | WikiNamedType | null;
  manufacturer?: {
    name?: string;
    code?: string;
    link?: string;
  } | string;
  manufacturer_name?: string;
  production_status?: string | WikiLocalizedText | null;
  size?: string | WikiLocalizedText | null;
  focus?: string | WikiLocalizedText | null;
  foci?: Array<string | WikiLocalizedText> | null;
  role?: string | WikiLocalizedText | null;
  career?: string | WikiLocalizedText | null;
  crew?: string | number | { min?: number | null; max?: number | null } | null;
  cargo_capacity?: string | number;
  cargo_grids?: Array<{
    scu?: number | string | null;
    max_scu_box?: number | string | null;
  }> | null;
  cargo_limits?: {
    max_scu_box?: number | string | null;
  } | null;
  images?: Array<{
    thumbnail_url?: string | null;
    original_url?: string | null;
  }> | null;
  is_spaceship?: boolean;
  is_vehicle?: boolean;
  web_url?: string;
  link?: string;
  pledge_url?: string | null;
  version?: string;
  updated_at?: string;
}

interface WikiSearchResponse {
  data?: WikiSearchItem | WikiSearchItem[];
  meta?: {
    processed_at?: string;
    resource?: WikiResourceMeta;
  };
}

interface WikiGroupedSearchResponse {
  data?: WikiSearchGroup | WikiSearchGroup[];
  meta?: {
    processed_at?: string;
  };
}

interface WikiSearchGroup {
  type?: string;
  label?: string;
  results?: WikiSearchItem[];
}

interface WikiLocalizedText {
  en_EN?: string;
  zh_CN?: string;
  de_DE?: string;
  fr_FR?: string;
  [key: string]: string | undefined;
}

interface WikiNamedType {
  name?: string;
  display_name?: string;
  type_name?: string;
  classification?: string;
  [key: string]: unknown;
}

interface WikiResourceMeta {
  type?: string;
  uuid?: string;
  slug?: string;
  api_url?: string;
  web_url?: string;
  version?: string;
}

interface WikiParentRef {
  uuid?: string;
  name?: string;
  type_name?: string;
  slug?: string;
}

export interface WikiSearchItem {
  uuid?: string;
  id?: string | number;
  name?: string;
  game_name?: string;
  slug?: string;
  class_name?: string;
  classification?: string | null;
  classification_label?: string | null;
  category?: string | WikiLocalizedText | WikiNamedType | null;
  category_label?: string | null;
  description?: string | WikiLocalizedText | null;
  game_description?: string | WikiLocalizedText | null;
  manufacturer?: {
    name?: string;
    code?: string;
    link?: string;
  } | string | null;
  type?: string | WikiLocalizedText | WikiNamedType | null;
  type_label?: string | null;
  item_type_label?: string | null;
  sub_type?: string | WikiLocalizedText | WikiNamedType | null;
  sub_type_label?: string | null;
  role?: string | WikiLocalizedText | null;
  career?: string | WikiLocalizedText | null;
  extra_label?: string | null;
  foci?: Array<string | WikiLocalizedText> | null;
  size?: string | number | WikiLocalizedText | null;
  size_class?: number | null;
  grade?: string | null;
  class?: string | null;
  cargo_capacity?: string | number | null;
  mass?: string | number | null;
  is_spaceship?: boolean;
  is_vehicle?: boolean;
  system?: string | null;
  parent?: WikiParentRef | null;
  star?: WikiParentRef | null;
  api_url?: string;
  link?: string;
  web_url?: string;
  updated_at?: string;
  version?: string;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function lastUrlSegment(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  try {
    return new URL(value).pathname.split("/").filter(Boolean).pop();
  } catch {
    return value.split("/").filter(Boolean).pop();
  }
}

function isUuidLike(value: string | undefined): boolean {
  return Boolean(value?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i));
}

function getWikiItemSlug(item: WikiSearchItem, name: string): string {
  const explicitSlug = item.slug?.trim();

  if (explicitSlug) {
    return explicitSlug;
  }

  const webSlug = lastUrlSegment(item.web_url);

  if (webSlug && !isUuidLike(webSlug)) {
    return webSlug;
  }

  const apiSlug = lastUrlSegment(item.api_url ?? item.link);

  if (apiSlug && !isUuidLike(apiSlug)) {
    return apiSlug;
  }

  return slugify(name);
}

function getWikiSourceRecordId(item: WikiSearchItem, name: string, resource?: WikiResourceMeta): string {
  return String(
    resource?.uuid ??
      item.uuid ??
      item.id ??
      item.slug ??
      lastUrlSegment(item.api_url ?? item.link) ??
      lastUrlSegment(item.web_url) ??
      name
  );
}

interface CachedCargoShips {
  expiresAt: number;
  ships: CargoShipRecord[];
}

let cargoShipCache: CachedCargoShips | undefined;

export async function fetchWikiVehicles(page = 1, limit = 100): Promise<WikiCollection<WikiVehicle>> {
  return fetchJson<WikiCollection<WikiVehicle>>(`${WIKI_API_BASE_URL}/api/vehicles`, {
    searchParams: { "page[number]": page, "page[size]": limit },
    timeoutMs: 12_000
  });
}

export async function fetchWikiSearch(query: string): Promise<WikiSearchResponse> {
  return fetchJson<WikiSearchResponse>(`${WIKI_API_BASE_URL}/api/search/${encodeURIComponent(query)}`, {
    timeoutMs: 8_000
  });
}

export async function fetchWikiGroupedSearch(query: string): Promise<WikiGroupedSearchResponse> {
  return fetchJson<WikiGroupedSearchResponse>(`${WIKI_API_BASE_URL}/api/search`, {
    searchParams: { "filter[query]": query },
    timeoutMs: 8_000
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isLocalizedText(value: unknown): value is WikiLocalizedText {
  return isObject(value) && ("en_EN" in value || "zh_CN" in value || "de_DE" in value || "fr_FR" in value);
}

function pickLocalized(
  value: string | number | WikiLocalizedText | null | undefined,
  language: "en" | "zh"
): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (!isLocalizedText(value)) {
    return undefined;
  }

  return language === "zh" ? value.zh_CN ?? value.en_EN : value.en_EN ?? value.zh_CN;
}

function pickWikiValue(
  value: string | number | WikiLocalizedText | WikiNamedType | null | undefined,
  language: "en" | "zh"
): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (!isObject(value)) {
    return undefined;
  }

  const localized = isLocalizedText(value) ? pickLocalized(value, language) : undefined;

  if (localized) {
    return localized;
  }

  const namedValue = value as WikiNamedType;
  const candidate =
    namedValue.display_name ?? namedValue.name ?? namedValue.type_name ?? namedValue.classification;

  return typeof candidate === "string" && candidate.trim() ? candidate : undefined;
}

function pickDescription(item: WikiSearchItem, language: "en" | "zh"): string | undefined {
  return pickLocalized(item.description, language) ?? pickLocalized(item.game_description, language);
}

function getManufacturerName(manufacturer: WikiSearchItem["manufacturer"] | WikiVehicle["manufacturer"]): string | undefined {
  if (!manufacturer) {
    return undefined;
  }

  if (typeof manufacturer === "string") {
    return manufacturer;
  }

  return manufacturer.name;
}

function collectSearchTerms(item: WikiSearchItem, resourceType?: string): string {
  const values = [
    resourceType,
    item.classification,
    item.classification_label,
    item.category,
    item.category_label,
    item.type,
    item.type_label,
    item.item_type_label,
    item.sub_type,
    item.sub_type_label,
    item.role,
    item.career,
    item.extra_label,
    item.class_name,
    item.system,
    item.parent?.name,
    item.parent?.type_name,
    item.star?.name,
    item.web_url,
    item.api_url,
    item.link,
    item.foci?.map((focus) => pickWikiValue(focus, "en")).join(" ")
  ];

  return values
    .map((value) => pickWikiValue(value as string | number | WikiLocalizedText | WikiNamedType | null | undefined, "en"))
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();
}

function normalizeWikiResourceType(value: string | undefined): string | undefined {
  const type = value?.trim().toLowerCase();

  if (!type) {
    return undefined;
  }

  const resourceTypes: Record<string, string> = {
    blueprints: "blueprint",
    commodities: "commodity",
    items: "item",
    locations: "location",
    manufacturers: "manufacturer",
    missions: "mission",
    shops: "shop",
    vehicles: "vehicle"
  };

  return resourceTypes[type] ?? type;
}

function getWikiResourceType(item: WikiSearchItem, resourceType?: string): string | undefined {
  const directType = normalizeWikiResourceType(resourceType);

  if (directType) {
    return directType;
  }

  const path = `${item.web_url ?? ""} ${item.api_url ?? ""} ${item.link ?? ""}`.toLowerCase();

  if (path.includes("/locations/") || path.includes("/api/locations/")) {
    return "location";
  }

  if (path.includes("/vehicles/") || path.includes("/api/vehicles/")) {
    return "vehicle";
  }

  if (path.includes("/items/") || path.includes("/api/items/")) {
    return "item";
  }

  if (path.includes("/commodities/") || path.includes("/api/commodities/")) {
    return "commodity";
  }

  if (path.includes("/manufacturers/") || path.includes("/api/manufacturers/")) {
    return "manufacturer";
  }

  if (path.includes("/shops/") || path.includes("/api/shops/")) {
    return "shop";
  }

  if (path.includes("/blueprints/") || path.includes("/api/blueprints/")) {
    return "blueprint";
  }

  if (path.includes("/missions/") || path.includes("/api/missions/")) {
    return "mission";
  }

  return undefined;
}

function getClassificationLabel(item: WikiSearchItem): string | undefined {
  return (
    item.classification_label ??
    item.classification ??
    pickWikiValue(item.category_label ?? item.category, "en") ??
    (isObject(item.type) ? pickWikiValue((item.type as WikiNamedType).classification, "en") : undefined)
  );
}

function compactStringList(values: Array<string | number | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const text = String(value ?? "").trim();
    const normalized = text.toLowerCase();

    if (!text || ["undefined", "unknown", "none", "null", "n/a"].includes(normalized) || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(text);
  }

  return result;
}

function getWikiCategoryLabel(item: WikiSearchItem, resourceType?: string): string | undefined {
  const wikiResourceType = getWikiResourceType(item, resourceType);
  const itemType = pickWikiValue(item.type_label ?? item.item_type_label ?? item.type, "en");
  const itemRole = pickWikiValue(item.role ?? item.career ?? item.extra_label, "en");
  const classification = getClassificationLabel(item);
  const subType = pickWikiValue(item.sub_type_label ?? item.sub_type, "en");

  if (wikiResourceType === "location") {
    return compactStringList(["Location", itemType ?? classification, item.system, item.parent?.name]).join(" / ");
  }

  if (wikiResourceType === "vehicle") {
    return compactStringList(["Vehicle", itemType ?? itemRole, itemRole]).join(" / ");
  }

  if (wikiResourceType === "item") {
    return compactStringList([classification ?? itemType ?? "Item", subType]).join(" / ");
  }

  if (wikiResourceType === "commodity") {
    return compactStringList(["Commodity", classification ?? itemType]).join(" / ");
  }

  if (wikiResourceType === "manufacturer") {
    return "Manufacturer";
  }

  if (wikiResourceType === "shop") {
    return compactStringList(["Shop", itemType ?? classification, item.extra_label]).join(" / ");
  }

  if (wikiResourceType === "blueprint") {
    return compactStringList(["Blueprint", itemType ?? classification]).join(" / ");
  }

  if (wikiResourceType === "mission") {
    return compactStringList(["Mission", itemType ?? classification, item.extra_label]).join(" / ");
  }

  return compactStringList([classification, itemType, itemRole]).join(" / ") || undefined;
}

function buildWikiSummary(item: WikiSearchItem, categoryLabel: string | undefined): string {
  return compactStringList([
    categoryLabel,
    item.extra_label,
    item.class_name ? `Class ${item.class_name}` : undefined
  ]).join(" · ");
}

function mapWikiSearchType(item: WikiSearchItem, resourceType?: string): EntityType {
  const wikiResourceType = getWikiResourceType(item, resourceType);

  if (wikiResourceType === "location") {
    return "location";
  }

  if (wikiResourceType === "vehicle") {
    return item.is_vehicle && !item.is_spaceship ? "vehicle" : "ship";
  }

  if (wikiResourceType === "commodity") {
    return "commodity";
  }

  if (wikiResourceType === "manufacturer") {
    return "manufacturer";
  }

  if (wikiResourceType === "shop") {
    return "shop";
  }

  if (wikiResourceType === "blueprint" || wikiResourceType === "mission") {
    return "equipment";
  }

  const classification = collectSearchTerms(item, wikiResourceType);

  if (
    classification.includes("station") ||
    classification.includes("landing zone") ||
    classification.includes("city") ||
    classification.includes("planet") ||
    classification.includes("moon") ||
    classification.includes("outpost") ||
    classification.includes("settlement") ||
    classification.includes("lagrange") ||
    classification.includes("location")
  ) {
    return "location";
  }

  if (
    classification.includes("quantum") ||
    classification.includes("drive") ||
    classification.includes("component") ||
    classification.includes("cooler") ||
    classification.includes("shield") ||
    classification.includes("powerplant") ||
    classification.includes("power plant")
  ) {
    return "component";
  }

  if (
    classification.includes("cargo") ||
    classification.includes("commodity") ||
    classification.includes("mineral") ||
    classification.includes("ore")
  ) {
    return "commodity";
  }

  if (classification.includes("weapon")) {
    return "weapon";
  }

  if (classification.includes("armor")) {
    return "armor";
  }

  if (classification.includes("shop") || classification.includes("store") || classification.includes("terminal")) {
    return "shop";
  }

  if (wikiResourceType === "item") {
    return "equipment";
  }

  if (item.is_spaceship || classification.includes("ship")) {
    return "ship";
  }

  if (item.is_vehicle || classification.includes("vehicle")) {
    return "vehicle";
  }

  return "equipment";
}

export function mapWikiSearchItemToRecord(
  item: WikiSearchItem,
  fetchedAt = new Date(),
  resource?: WikiResourceMeta
): SearchRecord | null {
  const name = item.game_name ?? item.name;

  if (!name) {
    return null;
  }

  const zhDescription = pickDescription(item, "zh");
  const manufacturer = getManufacturerName(item.manufacturer);
  const wikiResourceType = getWikiResourceType(item, resource?.type);
  const type = mapWikiSearchType(item, wikiResourceType);
  const itemSize = pickWikiValue(item.size ?? item.size_class, "en");
  const itemType = pickWikiValue(item.type_label ?? item.item_type_label ?? item.type, "en");
  const itemRole = pickWikiValue(item.role ?? item.career ?? item.extra_label, "en");
  const classification = getClassificationLabel(item);
  const subType = pickWikiValue(item.sub_type_label ?? item.sub_type, "en");
  const categoryLabel = getWikiCategoryLabel(item, wikiResourceType);
  const sourceRecordId = getWikiSourceRecordId(item, name, resource);
  const summary = pickDescription(item, "en") ?? buildWikiSummary(item, categoryLabel);
  const slug = getWikiItemSlug(item, name);

  return {
    id: `wiki-search-${sourceRecordId}`,
    type,
    slug: `wiki-${slug}`,
    name,
    nameZh: item.name && item.game_name && item.name !== item.game_name ? item.name : undefined,
    manufacturer,
    categoryLabel,
    summary,
    tags: compactStringList([
      categoryLabel,
      classification,
      itemType,
      itemRole,
      item.system,
      item.parent?.name,
      itemSize ? `size ${itemSize}` : undefined,
      item.grade ? `grade ${item.grade}` : undefined,
      item.class ?? undefined
    ]),
    stats: {
      "Wiki Category": categoryLabel ?? null,
      Resource: wikiResourceType ?? null,
      Manufacturer: manufacturer ?? null,
      Type: itemType ?? null,
      Role: itemRole ?? null,
      Classification: classification ?? null,
      Subtype: subType ?? null,
      Extra: item.extra_label ?? null,
      System: item.system ?? null,
      Parent: item.parent?.name ?? null,
      "Parent Type": item.parent?.type_name ?? null,
      Size: itemSize ?? null,
      Grade: item.grade ?? null,
      Class: item.class ?? null,
      Cargo: item.cargo_capacity ?? null,
      Mass: item.mass ?? null,
      "ZH Description": zhDescription ?? null
    },
    source: {
      sourceName: "Star Citizen Wiki API",
      sourceUrl: item.web_url ?? resource?.web_url ?? item.api_url ?? item.link ?? `${WIKI_API_BASE_URL}/api/search/${encodeURIComponent(name)}`,
      sourceRecordId,
      gameVersion: item.version ?? resource?.version,
      fetchedAt: fetchedAt.toISOString(),
      sourceUpdatedAt: item.updated_at,
      freshness: computeFreshnessStatus(item.updated_at, fetchedAt)
    }
  };
}

function asArray<T>(value: T | T[] | undefined): T[] {
  return Array.isArray(value) ? value : value ? [value] : [];
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

function dedupeWikiRecords(records: SearchRecord[]): SearchRecord[] {
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

function toNumber(value: string | number | null | undefined): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function getManufacturerCode(manufacturer: WikiVehicle["manufacturer"]): string | undefined {
  if (!manufacturer || typeof manufacturer === "string") {
    return undefined;
  }

  return manufacturer.code;
}

function getMaxContainerSize(vehicle: WikiVehicle): number | undefined {
  const cargoGridSizes = (vehicle.cargo_grids ?? [])
    .map((grid) => toNumber(grid.max_scu_box))
    .filter((size) => size > 0);
  const cargoLimitSize = toNumber(vehicle.cargo_limits?.max_scu_box);
  const maxSize = Math.max(0, cargoLimitSize, ...cargoGridSizes);

  return maxSize > 0 ? maxSize : undefined;
}

function getVehicleRole(vehicle: WikiVehicle): string | undefined {
  return (
    pickWikiValue(vehicle.role, "en") ??
    pickWikiValue(vehicle.focus, "en") ??
    pickWikiValue(vehicle.career, "en") ??
    vehicle.foci?.map((focus) => pickWikiValue(focus, "en")).find(Boolean)
  );
}

function formatVehicleCrew(crew: WikiVehicle["crew"]): string | number | null {
  if (crew === undefined || crew === null) {
    return null;
  }

  if (typeof crew === "string" || typeof crew === "number") {
    return crew;
  }

  const min = toNumber(crew.min);
  const max = toNumber(crew.max);

  if (min > 0 && max > 0) {
    return min === max ? min : `${min}-${max}`;
  }

  return min || max || null;
}

function cargoShipCompletenessScore(ship: CargoShipRecord | CargoShipStatsRecord): number {
  return (
    (ship.imageUrl ? 12 : 0) +
    (ship.nameZh ? 5 : 0) +
    (ship.maxContainerSize ? 3 : 0) +
    (ship.role ? 2 : 0) +
    (ship.size ? 2 : 0) +
    (ship.pledgeUrl ? 2 : 0) +
    ((ship as CargoShipStatsRecord).productionState ? 3 : 0) +
    Math.min(12, Math.floor(ship.cargoScu / 500))
  );
}

function dedupeCargoShips(ships: Array<CargoShipRecord | CargoShipStatsRecord>): CargoShipStatsRecord[] {
  const deduped = new Map<string, CargoShipStatsRecord>();

  for (const ship of ships) {
    const key = `${ship.manufacturer}:${ship.name}`.toLowerCase();
    const existing = deduped.get(key);

    if (!existing || cargoShipCompletenessScore(ship) > cargoShipCompletenessScore(existing)) {
      deduped.set(key, { ...ship });
    }
  }

  return Array.from(deduped.values()).sort(
    (left, right) => left.manufacturer.localeCompare(right.manufacturer) || left.name.localeCompare(right.name)
  );
}

function normalizeCargoShipSearchText(value: string | number | null | undefined): string {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s_\-·・:：,，.。;；'"()[\]（）/]+/g, " ")
    .trim();
}

function mapWikiVehicleToCargoShip(vehicle: WikiVehicle, fetchedAt = new Date()): CargoShipRecord | undefined {
  const name = vehicle.game_name ?? vehicle.name;
  const cargoScu = Math.floor(toNumber(vehicle.cargo_capacity));

  if (!name || cargoScu <= 0) {
    return undefined;
  }

  const manufacturer = getManufacturerName(vehicle.manufacturer) ?? vehicle.manufacturer_name ?? "Unknown";
  const manufacturerCode = getManufacturerCode(vehicle.manufacturer);
  const sourceRecordId = String(vehicle.uuid ?? vehicle.id ?? vehicle.slug ?? name);
  const sourceUpdatedAt = vehicle.updated_at;

  return {
    id: `wiki-cargo-ship-${sourceRecordId}`,
    name,
    slug: vehicle.slug ?? slugify(name),
    manufacturer,
    manufacturerCode,
    role: getVehicleRole(vehicle),
    size: pickWikiValue(vehicle.size, "en"),
    cargoScu,
    maxContainerSize: getMaxContainerSize(vehicle),
    pledgeUrl: vehicle.pledge_url ?? vehicle.web_url,
    imageUrl: vehicle.images?.find((image) => image.thumbnail_url || image.original_url)?.thumbnail_url ?? undefined,
    source: {
      sourceName: "starcitizen.tools / Star Citizen Wiki API",
      sourceUrl: vehicle.web_url ?? vehicle.link ?? `${WIKI_API_BASE_URL}/api/vehicles`,
      sourceRecordId,
      gameVersion: vehicle.version,
      fetchedAt: fetchedAt.toISOString(),
      sourceUpdatedAt,
      freshness: computeFreshnessStatus(sourceUpdatedAt, fetchedAt)
    }
  };
}

function mapWikiSearchGroupToRecords(group: WikiSearchGroup, fetchedAt: Date): SearchRecord[] {
  return (group.results ?? [])
    .map((item) =>
      mapWikiSearchItemToRecord(item, fetchedAt, {
        type: group.type,
        web_url: item.web_url,
        api_url: item.api_url
      })
    )
    .filter((record): record is SearchRecord => Boolean(record));
}

export async function searchWikiRecords(query: string): Promise<SearchRecord[]> {
  const fetchedAt = new Date();
  const [exactResult, groupedResult] = await Promise.allSettled([fetchWikiSearch(query), fetchWikiGroupedSearch(query)]);
  const records: SearchRecord[] = [];

  if (exactResult.status === "fulfilled") {
    records.push(
      ...asArray(exactResult.value.data)
        .map((item) => mapWikiSearchItemToRecord(item, fetchedAt, exactResult.value.meta?.resource))
        .filter((record): record is SearchRecord => Boolean(record))
    );
  }

  if (groupedResult.status === "fulfilled") {
    records.push(...asArray(groupedResult.value.data).flatMap((group) => mapWikiSearchGroupToRecords(group, fetchedAt)));
  }

  if (!records.length && exactResult.status === "rejected" && groupedResult.status === "rejected") {
    throw exactResult.reason;
  }

  return dedupeWikiRecords(records);
}

export async function fetchWikiCargoShips(refresh = false): Promise<CargoShipRecord[]> {
  if (!refresh && cargoShipCache && cargoShipCache.expiresAt > Date.now()) {
    return cargoShipCache.ships;
  }

  const fetchedAt = new Date();
  let wikiShips: CargoShipRecord[] = [];

  try {
    const firstPage = await fetchWikiVehicles(1, 100);
    const lastPage = Math.max(1, firstPage.meta?.last_page ?? 1);
    const pages = [firstPage];

    if (lastPage > 1) {
      const remainingPages = await Promise.all(
        Array.from({ length: lastPage - 1 }, (_, index) => fetchWikiVehicles(index + 2, 100))
      );

      pages.push(...remainingPages);
    }

    const seen = new Set<string>();
    wikiShips = pages
      .flatMap((page) => page.data ?? [])
      .map((vehicle) => mapWikiVehicleToCargoShip(vehicle, fetchedAt))
      .filter((ship): ship is CargoShipRecord => Boolean(ship))
      .filter((ship) => {
        const key = `${ship.manufacturer}:${ship.name}`.toLowerCase();

        if (seen.has(key)) {
          return false;
        }

        seen.add(key);
        return true;
      });
  } catch {
    wikiShips = [];
  }

  const ships = dedupeCargoShips([...wikiShips, ...cargoShipStats]);

  cargoShipCache = {
    expiresAt: Date.now() + WIKI_SHIP_CACHE_TTL_MS,
    ships
  };

  return ships;
}

function scoreCargoShipRecord(ship: CargoShipStatsRecord, query: string): number {
  if (!query) {
    return 1;
  }

  const normalizedQuery = normalizeCargoShipSearchText(query);
  const fields = [ship.name, ship.nameZh, ship.manufacturer, ship.manufacturerCode, ship.role, ship.productionState]
    .map(normalizeCargoShipSearchText)
    .filter(Boolean);

  if (fields.some((field) => field === normalizedQuery)) {
    return 100;
  }

  if (fields.some((field) => field.startsWith(normalizedQuery))) {
    return 70;
  }

  if (fields.some((field) => field.includes(normalizedQuery))) {
    return 35;
  }

  return 0;
}

function cargoShipStatToSearchRecord(ship: CargoShipStatsRecord): SearchRecord {
  return {
    id: `cargo-ship-stat-${ship.slug}`,
    type: "ship",
    slug: `ship-${ship.slug}`,
    name: ship.name,
    nameZh: ship.nameZh,
    imageUrl: ship.imageUrl,
    manufacturer: ship.manufacturer,
    categoryLabel: ship.productionState ? `Ship / ${ship.productionState}` : "Ship / Cargo stats",
    summary:
      ship.summary ??
      `${ship.name} is listed with ${ship.cargoScu.toLocaleString("en-US")} SCU cargo capacity in StarCitizen.tools Ship cargo stats.`,
    tags: [ship.manufacturer, ship.manufacturerCode, ship.role, ship.size, ship.productionState, ship.nameZh].filter(
      (item): item is string => Boolean(item)
    ),
    stats: {
      Manufacturer: ship.manufacturer,
      Role: ship.role ?? null,
      Size: ship.size ?? null,
      Cargo: `${ship.cargoScu.toLocaleString("en-US")} SCU`,
      "Production State": ship.productionState ?? null
    },
    source: ship.source
  };
}

export function searchCargoShipStatsRecords(input: SearchInput): SearchRecord[] {
  const query = input.query?.trim() ?? "";

  return cargoShipStats
    .map((ship) => ({ ship, score: scoreCargoShipRecord(ship, query) }))
    .filter((item) => item.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.ship.cargoScu - left.ship.cargoScu ||
        left.ship.manufacturer.localeCompare(right.ship.manufacturer) ||
        left.ship.name.localeCompare(right.ship.name)
    )
    .map((item) => cargoShipStatToSearchRecord(item.ship))
    .filter((record) => {
      const matchesType = !input.type || input.type === "all" || record.type === input.type;
      const matchesFreshness =
        !input.freshness || input.freshness === "all" || record.source.freshness === input.freshness;

      return matchesType && matchesFreshness;
    })
    .slice(0, input.limit ?? 25);
}

export function mapWikiVehicleToRecord(vehicle: WikiVehicle, fetchedAt = new Date()): SearchRecord | null {
  const name = vehicle.game_name ?? vehicle.name;

  if (!name) {
    return null;
  }

  const sourceUpdatedAt = vehicle.updated_at;
  const manufacturer = getManufacturerName(vehicle.manufacturer) ?? vehicle.manufacturer_name;
  const sourceRecordId = String(vehicle.uuid ?? vehicle.id ?? vehicle.slug ?? name);
  const vehicleType = pickWikiValue(vehicle.type, "en");
  const image = vehicle.images?.find((candidate) => candidate.thumbnail_url || candidate.original_url);

  return {
    id: `wiki-vehicle-${sourceRecordId}`,
    type: vehicle.is_vehicle && !vehicle.is_spaceship ? "vehicle" : vehicleType?.toLowerCase().includes("vehicle") ? "vehicle" : "ship",
    slug: vehicle.slug ?? slugify(name),
    name,
    imageUrl: image?.thumbnail_url ?? image?.original_url ?? undefined,
    manufacturer,
    summary: pickLocalized(vehicle.description, "en") ?? pickLocalized(vehicle.game_description, "en") ?? "",
    tags: [
      getVehicleRole(vehicle),
      pickWikiValue(vehicle.size, "en"),
      pickWikiValue(vehicle.production_status, "en")
    ].filter((tag): tag is string => Boolean(tag)),
    stats: {
      Manufacturer: manufacturer ?? null,
      Type: vehicleType ?? null,
      Size: pickWikiValue(vehicle.size, "en") ?? null,
      Focus: getVehicleRole(vehicle) ?? null,
      Crew: formatVehicleCrew(vehicle.crew),
      Cargo: vehicle.cargo_capacity ?? null
    },
    source: {
      sourceName: "Star Citizen Wiki API",
      sourceUrl: `${WIKI_API_BASE_URL}/api/vehicles`,
      sourceRecordId,
      fetchedAt: fetchedAt.toISOString(),
      sourceUpdatedAt,
      freshness: computeFreshnessStatus(sourceUpdatedAt, fetchedAt)
    }
  };
}

export async function searchWikiVehicleRecords(query: string, limit = 20): Promise<SearchRecord[]> {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return [];
  }

  const requests = await Promise.allSettled([
    fetchJson<WikiCollection<WikiVehicle>>(`${WIKI_API_BASE_URL}/api/vehicles`, {
      searchParams: { "filter[name]": normalizedQuery, "page[number]": 1, "page[size]": limit },
      timeoutMs: 8_000
    }),
    fetchJson<WikiCollection<WikiVehicle>>(`${WIKI_API_BASE_URL}/api/vehicles`, {
      searchParams: { "filter[query]": normalizedQuery, "page[number]": 1, "page[size]": limit },
      timeoutMs: 8_000
    })
  ]);
  const fetchedAt = new Date();
  const records = requests
    .flatMap((request) => (request.status === "fulfilled" ? request.value.data ?? [] : []))
    .map((vehicle) => mapWikiVehicleToRecord(vehicle, fetchedAt))
    .filter((record): record is SearchRecord => Boolean(record));

  const failedRequest = requests.find((request) => request.status === "rejected");

  if (!records.length && failedRequest && requests.every((request) => request.status === "rejected")) {
    throw failedRequest.reason;
  }

  return dedupeWikiRecords(records).slice(0, limit);
}
