const ENIGMA_DATA = globalThis.__ENIGMA_WORKER_DATA__ ?? {
  searchRecords: [],
  tradeRoutes: [],
  sourceCatalog: [],
};

const WIKI_API_BASE_URL = "https://api.star-citizen.wiki";
const UEX_API_BASE_URL = "https://api.uexcorp.uk/2.0";
const RATE_LIMITS = new Map();
const UEX_ROUTE_CACHE = new Map();
const UEX_ROUTE_CACHE_TTL_MS = 15 * 60 * 1000;
const WIKI_SHIP_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
let WIKI_SHIP_CACHE;

const ENTITY_TYPES = new Set([
  "all",
  "ship",
  "vehicle",
  "component",
  "weapon",
  "armor",
  "equipment",
  "commodity",
  "location",
  "shop",
  "manufacturer",
]);
const FRESHNESS_VALUES = new Set(["all", "fresh", "recent", "stale", "unknown"]);
const SOURCE_VALUES = new Set(["all", "local", "wiki", "database"]);
const TRADE_SOURCE_VALUES = new Set(["auto", "uex", "sample"]);
const TRADE_ROUTE_MODES = new Set(["mixed", "space"]);
const UEX_RESOURCES = new Set(["commodities_routes", "terminals"]);

const SECURITY_HEADERS = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "frame-src https://verseguide.com",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' 'unsafe-inline'",
    "connect-src 'self' https://api.star-citizen.wiki https://api.uexcorp.uk https://sc-trade.tools",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; "),
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-DNS-Prefetch-Control": "off",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
};

function withSecurityHeaders(response) {
  const headers = new Headers(response.headers);

  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function jsonResponse(payload, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return withSecurityHeaders(
    new Response(JSON.stringify(payload), {
      ...init,
      headers,
    }),
  );
}

function acceptsHtml(request) {
  return request.headers.get("accept")?.includes("text/html");
}

function clampInteger(value, fallback, min, max) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.min(Math.max(Math.floor(number), min), max);
}

function cleanEnum(value, allowed, fallback) {
  return allowed.has(value) ? value : fallback;
}

function getClientIp(request) {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

function rateLimitRequest(request, namespace, limit, windowSeconds) {
  const now = Date.now();
  const key = `${namespace}:${getClientIp(request)}`;
  const current = RATE_LIMITS.get(key);
  const bucket = current && current.resetAt > now ? current : { count: 0, resetAt: now + windowSeconds * 1000 };

  bucket.count += 1;
  RATE_LIMITS.set(key, bucket);

  return {
    allowed: bucket.count <= limit,
    limit,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: bucket.resetAt,
  };
}

function normalizeSearchText(value) {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    .normalize("NFKD");
}

function buildSearchDocument(record) {
  return [
    record.type,
    record.name,
    record.nameZh,
    record.manufacturer,
    record.categoryLabel,
    record.summary,
    record.source?.sourceName,
    record.source?.gameVersion,
    ...(record.tags ?? []),
    ...Object.values(record.stats ?? {}),
  ]
    .map(normalizeSearchText)
    .join(" ");
}

function scoreRecord(record, query) {
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

function searchLocalRecords(input) {
  const query = normalizeSearchText(input.query);
  const limit = clampInteger(input.limit, 25, 1, 50);

  return ENIGMA_DATA.searchRecords
    .map((record) => ({ record, score: scoreRecord(record, query) }))
    .filter(({ record, score }) => {
      const matchesQuery = query ? score > 0 : true;
      const matchesType = input.type === "all" || record.type === input.type;
      const matchesFreshness = input.freshness === "all" || record.source?.freshness === input.freshness;
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

function computeFreshnessStatus(timestamp, now = new Date()) {
  if (!timestamp) {
    return "unknown";
  }

  const sourceTime = new Date(timestamp);

  if (Number.isNaN(sourceTime.getTime())) {
    return "unknown";
  }

  const dayMs = 24 * 60 * 60 * 1000;
  const age = Math.max(0, now.getTime() - sourceTime.getTime());

  if (age <= dayMs) {
    return "fresh";
  }

  if (age <= 7 * dayMs) {
    return "recent";
  }

  return "stale";
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function lastUrlSegment(value) {
  if (!value) {
    return undefined;
  }

  try {
    return new URL(value).pathname.split("/").filter(Boolean).pop();
  } catch {
    return value.split("/").filter(Boolean).pop();
  }
}

function isUuidLike(value) {
  return Boolean(value?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i));
}

function getWikiItemSlug(item, name) {
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

function getWikiSourceRecordId(item, name, resource) {
  return String(
    resource?.uuid ??
      item.uuid ??
      item.id ??
      item.slug ??
      lastUrlSegment(item.api_url ?? item.link) ??
      lastUrlSegment(item.web_url) ??
      name,
  );
}

function isObject(value) {
  return typeof value === "object" && value !== null;
}

function pickLocalized(value, language = "en") {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (!isObject(value)) {
    return undefined;
  }

  return language === "zh" ? value.zh_CN ?? value.en_EN : value.en_EN ?? value.zh_CN;
}

function pickWikiValue(value, language = "en") {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (!isObject(value)) {
    return undefined;
  }

  const localized = pickLocalized(value, language);

  if (localized) {
    return localized;
  }

  const candidate = value.display_name ?? value.name ?? value.type_name ?? value.classification;
  return typeof candidate === "string" && candidate.trim() ? candidate : undefined;
}

function pickWikiDescription(item, language = "en") {
  return pickLocalized(item.description, language) ?? pickLocalized(item.game_description, language);
}

function getManufacturerName(manufacturer) {
  if (!manufacturer) {
    return undefined;
  }

  return typeof manufacturer === "string" ? manufacturer : manufacturer.name;
}

function getManufacturerCode(manufacturer, manufacturerName) {
  if (manufacturer && typeof manufacturer === "object" && manufacturer.code) {
    return String(manufacturer.code);
  }

  const normalized = normalizeUexName(manufacturerName ?? getManufacturerName(manufacturer));
  const known = {
    "aegis dynamics": "AEGS",
    "anvil aerospace": "ANVL",
    "argo astronautics": "ARGO",
    "consolidated outland": "CNOU",
    "crusader industries": "CRSD",
    "drake interplanetary": "DRAK",
    esperia: "ESPR",
    "gatac manufacture": "GAMA",
    "kruger intergalactic": "KRIG",
    misc: "MISC",
    mirai: "MRAI",
    "musashi industrial and starflight concern": "MISC",
    "origin jumpworks": "ORIG",
    "roberts space industries": "RSI",
    "tumbril land systems": "TMBL",
  };
  const fallback = String(manufacturerName ?? getManufacturerName(manufacturer) ?? "")
    .match(/\b[A-Z0-9]/g)
    ?.join("")
    .slice(0, 4);

  return known[normalized] ?? fallback ?? "MFG";
}

function collectWikiSearchTerms(item, resourceType) {
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
    item.foci?.map((focus) => pickWikiValue(focus, "en")).join(" "),
  ];

  return values
    .map((value) => pickWikiValue(value, "en"))
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function normalizeWikiResourceType(value) {
  const type = value?.trim().toLowerCase();

  if (!type) {
    return undefined;
  }

  const resourceTypes = {
    blueprints: "blueprint",
    commodities: "commodity",
    items: "item",
    locations: "location",
    manufacturers: "manufacturer",
    missions: "mission",
    shops: "shop",
    vehicles: "vehicle",
  };

  return resourceTypes[type] ?? type;
}

function getWikiResourceType(item, resourceType) {
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

function getClassificationLabel(item) {
  return (
    item.classification_label ??
    item.classification ??
    pickWikiValue(item.category_label ?? item.category, "en") ??
    (isObject(item.type) ? pickWikiValue(item.type.classification, "en") : undefined)
  );
}

function compactStringList(values) {
  const seen = new Set();
  const result = [];

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

function getWikiCategoryLabel(item, resourceType) {
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

function buildWikiSummary(item, categoryLabel) {
  return compactStringList([
    categoryLabel,
    item.extra_label,
    item.class_name ? `Class ${item.class_name}` : undefined,
  ]).join(" · ");
}

function mapWikiSearchType(item, resourceType) {
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

  const classification = collectWikiSearchTerms(item, wikiResourceType);

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

function mapWikiSearchItemToRecord(item, fetchedAt = new Date(), resource) {
  const name = item.game_name ?? item.name;

  if (!name) {
    return null;
  }

  const zhDescription = pickWikiDescription(item, "zh");
  const manufacturer = getManufacturerName(item.manufacturer);
  const wikiResourceType = getWikiResourceType(item, resource?.type);
  const itemSize = pickWikiValue(item.size ?? item.size_class, "en");
  const itemType = pickWikiValue(item.type_label ?? item.item_type_label ?? item.type, "en");
  const itemRole = pickWikiValue(item.role ?? item.career ?? item.extra_label, "en");
  const classification = getClassificationLabel(item);
  const subType = pickWikiValue(item.sub_type_label ?? item.sub_type, "en");
  const categoryLabel = getWikiCategoryLabel(item, wikiResourceType);
  const sourceRecordId = getWikiSourceRecordId(item, name, resource);
  const summary = pickWikiDescription(item, "en") ?? buildWikiSummary(item, categoryLabel);
  const slug = getWikiItemSlug(item, name);

  return {
    id: `wiki-search-${sourceRecordId}`,
    type: mapWikiSearchType(item, wikiResourceType),
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
      item.class,
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
      "ZH Description": zhDescription ?? null,
    },
    source: {
      sourceName: "Star Citizen Wiki API",
      sourceUrl: item.web_url ?? resource?.web_url ?? item.api_url ?? item.link ?? `${WIKI_API_BASE_URL}/api/search/${encodeURIComponent(name)}`,
      sourceRecordId,
      gameVersion: item.version ?? resource?.version,
      fetchedAt: fetchedAt.toISOString(),
      sourceUpdatedAt: item.updated_at,
      freshness: computeFreshnessStatus(item.updated_at, fetchedAt),
    },
  };
}

async function searchWikiRecords(query) {
  const exactRequest = fetch(`${WIKI_API_BASE_URL}/api/search/${encodeURIComponent(query)}`, {
    headers: { accept: "application/json" },
  });
  const groupedUrl = new URL(`${WIKI_API_BASE_URL}/api/search`);
  groupedUrl.searchParams.set("filter[query]", query);
  const groupedRequest = fetch(groupedUrl, {
    headers: { accept: "application/json" },
  });

  const [exactResult, groupedResult] = await Promise.allSettled([exactRequest, groupedRequest]);
  const fetchedAt = new Date();
  const records = [];

  if (exactResult.status === "fulfilled" && exactResult.value.ok) {
    const payload = await exactResult.value.json();
    const items = Array.isArray(payload.data) ? payload.data : payload.data ? [payload.data] : [];
    records.push(...items.map((item) => mapWikiSearchItemToRecord(item, fetchedAt, payload.meta?.resource)).filter(Boolean));
  }

  if (groupedResult.status === "fulfilled" && groupedResult.value.ok) {
    const payload = await groupedResult.value.json();
    const groups = Array.isArray(payload.data) ? payload.data : payload.data ? [payload.data] : [];

    for (const group of groups) {
      const items = Array.isArray(group.results) ? group.results : [];

      records.push(
        ...items
          .map((item) =>
            mapWikiSearchItemToRecord(item, fetchedAt, {
              type: group.type,
              web_url: item.web_url,
              api_url: item.api_url,
            }),
          )
          .filter(Boolean),
      );
    }
  }

  if (!records.length && exactResult.status === "fulfilled" && groupedResult.status === "fulfilled") {
    const exactStatus = exactResult.value.status;
    const groupedStatus = groupedResult.value.status;
    throw new Error(`Wiki search failed: ${exactStatus}/${groupedStatus}`);
  }

  if (!records.length && exactResult.status === "rejected" && groupedResult.status === "rejected") {
    throw exactResult.reason;
  }

  return dedupeRecords(records);
}

async function fetchWikiVehicleCollection(params = {}) {
  const url = new URL(`${WIKI_API_BASE_URL}/api/vehicles`);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    headers: { accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Wiki vehicles API returned ${response.status}.`);
  }

  return response.json();
}

function getVehicleRole(vehicle) {
  return (
    pickWikiValue(vehicle.role, "en") ??
    pickWikiValue(vehicle.focus, "en") ??
    pickWikiValue(vehicle.career, "en") ??
    vehicle.foci?.map((focus) => pickWikiValue(focus, "en")).find(Boolean)
  );
}

function getMaxContainerSize(vehicle) {
  const gridSizes = Array.isArray(vehicle.cargo_grids)
    ? vehicle.cargo_grids.map((grid) => numberOrZero(grid.max_scu_box))
    : [];
  const limitSize = numberOrZero(vehicle.cargo_limits?.max_scu_box);
  const sizes = [...gridSizes, limitSize].filter((size) => size > 0);

  return sizes.length ? Math.max(...sizes) : undefined;
}

function formatVehicleCrew(crew) {
  if (crew === undefined || crew === null) {
    return null;
  }

  if (typeof crew === "string" || typeof crew === "number") {
    return crew;
  }

  const min = numberOrZero(crew.min);
  const max = numberOrZero(crew.max);

  if (min > 0 && max > 0) {
    return min === max ? min : `${min}-${max}`;
  }

  return min || max || null;
}

function mapWikiVehicleToRecord(vehicle, fetchedAt = new Date()) {
  const name = vehicle.game_name ?? vehicle.name;

  if (!name) {
    return null;
  }

  const sourceUpdatedAt = vehicle.updated_at;
  const manufacturer = getManufacturerName(vehicle.manufacturer) ?? vehicle.manufacturer_name;
  const sourceRecordId = String(vehicle.uuid ?? vehicle.id ?? vehicle.slug ?? name);
  const vehicleType = pickWikiValue(vehicle.type, "en");

  return {
    id: `wiki-vehicle-${sourceRecordId}`,
    type: vehicle.is_vehicle && !vehicle.is_spaceship ? "vehicle" : vehicleType?.toLowerCase().includes("vehicle") ? "vehicle" : "ship",
    slug: vehicle.slug ?? slugify(name),
    name,
    manufacturer,
    summary: pickLocalized(vehicle.description, "en") ?? pickLocalized(vehicle.game_description, "en") ?? "",
    tags: [getVehicleRole(vehicle), pickWikiValue(vehicle.size, "en"), pickWikiValue(vehicle.production_status, "en")].filter(Boolean),
    stats: {
      Manufacturer: manufacturer ?? null,
      Type: vehicleType ?? null,
      Size: pickWikiValue(vehicle.size, "en") ?? null,
      Focus: getVehicleRole(vehicle) ?? null,
      Crew: formatVehicleCrew(vehicle.crew),
      Cargo: vehicle.cargo_capacity ?? null,
    },
    source: {
      sourceName: "Star Citizen Wiki API",
      sourceUrl: vehicle.web_url ?? vehicle.link ?? `${WIKI_API_BASE_URL}/api/vehicles`,
      sourceRecordId,
      fetchedAt: fetchedAt.toISOString(),
      sourceUpdatedAt,
      freshness: computeFreshnessStatus(sourceUpdatedAt, fetchedAt),
    },
  };
}

function mapWikiVehicleToCargoShip(vehicle, fetchedAt = new Date()) {
  const name = vehicle.game_name ?? vehicle.name;
  const cargoScu = Math.floor(numberOrZero(vehicle.cargo_capacity));

  if (!name || cargoScu <= 0) {
    return undefined;
  }

  const manufacturer = getManufacturerName(vehicle.manufacturer) ?? vehicle.manufacturer_name ?? "Unknown";
  const sourceRecordId = String(vehicle.uuid ?? vehicle.id ?? vehicle.slug ?? name);
  const sourceUpdatedAt = vehicle.updated_at;
  const image = Array.isArray(vehicle.images)
    ? vehicle.images.find((candidate) => candidate.thumbnail_url || candidate.original_url)
    : undefined;

  return {
    id: `wiki-cargo-ship-${sourceRecordId}`,
    name,
    slug: vehicle.slug ?? slugify(name),
    manufacturer,
    manufacturerCode: getManufacturerCode(vehicle.manufacturer, manufacturer),
    role: getVehicleRole(vehicle),
    size: pickWikiValue(vehicle.size, "en"),
    cargoScu,
    maxContainerSize: getMaxContainerSize(vehicle),
    pledgeUrl: vehicle.pledge_url ?? vehicle.web_url,
    imageUrl: image?.thumbnail_url ?? image?.original_url ?? undefined,
    source: {
      sourceName: "starcitizen.tools / Star Citizen Wiki API",
      sourceUrl: vehicle.web_url ?? vehicle.link ?? `${WIKI_API_BASE_URL}/api/vehicles`,
      sourceRecordId,
      gameVersion: vehicle.version,
      fetchedAt: fetchedAt.toISOString(),
      sourceUpdatedAt,
      freshness: computeFreshnessStatus(sourceUpdatedAt, fetchedAt),
    },
  };
}

async function searchWikiVehicleRecords(query, limit = 20) {
  const normalizedQuery = String(query ?? "").trim();

  if (!normalizedQuery) {
    return [];
  }

  const requests = await Promise.allSettled([
    fetchWikiVehicleCollection({
      "filter[name]": normalizedQuery,
      "page[number]": 1,
      "page[size]": limit,
    }),
    fetchWikiVehicleCollection({
      "filter[query]": normalizedQuery,
      "page[number]": 1,
      "page[size]": limit,
    }),
  ]);
  const fetchedAt = new Date();
  const records = requests
    .flatMap((request) => (request.status === "fulfilled" ? request.value.data ?? [] : []))
    .map((vehicle) => mapWikiVehicleToRecord(vehicle, fetchedAt))
    .filter(Boolean);

  if (!records.length && requests.every((request) => request.status === "rejected")) {
    throw requests[0].reason;
  }

  return dedupeRecords(records).slice(0, limit);
}

async function fetchWikiCargoShips(refresh = false) {
  if (!refresh && WIKI_SHIP_CACHE && WIKI_SHIP_CACHE.expiresAt > Date.now()) {
    return WIKI_SHIP_CACHE.ships;
  }

  const firstPage = await fetchWikiVehicleCollection({
    "page[number]": 1,
    "page[size]": 100,
  });
  const lastPage = Math.max(1, firstPage.meta?.last_page ?? 1);
  const pages = [firstPage];

  if (lastPage > 1) {
    const remainingPages = await Promise.all(
      Array.from({ length: lastPage - 1 }, (_, index) =>
        fetchWikiVehicleCollection({
          "page[number]": index + 2,
          "page[size]": 100,
        }),
      ),
    );

    pages.push(...remainingPages);
  }

  const fetchedAt = new Date();
  const seen = new Set();
  const ships = pages
    .flatMap((page) => page.data ?? [])
    .map((vehicle) => mapWikiVehicleToCargoShip(vehicle, fetchedAt))
    .filter(Boolean)
    .filter((ship) => {
      const key = `${ship.manufacturer}:${ship.name}`.toLowerCase();

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .sort((left, right) => left.manufacturer.localeCompare(right.manufacturer) || left.name.localeCompare(right.name));

  WIKI_SHIP_CACHE = {
    expiresAt: Date.now() + WIKI_SHIP_CACHE_TTL_MS,
    ships,
  };

  return ships;
}

function matchesFilters(record, input) {
  return (
    (input.type === "all" || record.type === input.type) &&
    (input.freshness === "all" || record.source?.freshness === input.freshness)
  );
}

function dedupeRecords(records) {
  const deduped = new Map();

  for (const record of records) {
    const key = `${record.type}:${normalizeUexName(record.name)}`;
    const existing = deduped.get(key);

    if (!existing || recordCompletenessScore(record) > recordCompletenessScore(existing)) {
      deduped.set(key, record);
    }
  }

  return Array.from(deduped.values());
}

function hasUsefulRecordValue(value) {
  if (value === null || value === undefined) {
    return false;
  }

  const text = String(value).trim().toLowerCase();
  return Boolean(text) && !["unknown", "n/a", "none", "null", "undefined"].includes(text);
}

function recordCompletenessScore(record) {
  const stats = Object.values(record.stats ?? {}).filter(hasUsefulRecordValue).length;
  const cargo = hasUsefulRecordValue(record.stats?.Cargo) ? 12 : 0;
  const manufacturer = record.manufacturer || hasUsefulRecordValue(record.stats?.Manufacturer) ? 6 : 0;
  const summary = record.summary ? Math.min(10, Math.floor(record.summary.length / 40)) : 0;

  return stats + cargo + manufacturer + summary + (record.tags ?? []).length + (record.source?.sourceUrl ? 3 : 0);
}

async function aggregateSearch(input) {
  const providerResults = [];
  const query = input.query.trim();

  if (input.source === "all" || input.source === "local") {
    providerResults.push({
      provider: "local",
      records: searchLocalRecords(input),
    });
  }

  if (input.source === "database") {
    providerResults.push({
      provider: "database",
      records: [],
      error: "Database provider is not configured for this public worker build.",
    });
  }

  if ((input.source === "all" || input.source === "wiki") && query.length >= 2) {
    try {
      const shouldSearchVehicles = input.type === "all" || input.type === "ship" || input.type === "vehicle";
      const wikiResults = await Promise.allSettled([
        searchWikiRecords(query),
        shouldSearchVehicles ? searchWikiVehicleRecords(query, input.limit) : Promise.resolve([]),
      ]);
      const records = dedupeRecords(wikiResults.flatMap((result) => (result.status === "fulfilled" ? result.value : [])))
        .filter((record) => matchesFilters(record, input))
        .slice(0, input.limit);

      if (!records.length && wikiResults.every((result) => result.status === "rejected")) {
        throw wikiResults[0].reason;
      }

      providerResults.push({
        provider: "wiki",
        records,
      });
    } catch (error) {
      providerResults.push({
        provider: "wiki",
        records: [],
        error: error instanceof Error ? error.message : "Wiki search failed.",
      });
    }
  }

  return providerResults;
}

function parseSearchInput(url) {
  return {
    query: String(url.searchParams.get("q") ?? "").trim().slice(0, 80),
    type: cleanEnum(url.searchParams.get("type") ?? "all", ENTITY_TYPES, "all"),
    freshness: cleanEnum(url.searchParams.get("freshness") ?? "all", FRESHNESS_VALUES, "all"),
    source: cleanEnum(url.searchParams.get("source") ?? "all", SOURCE_VALUES, "all"),
    limit: clampInteger(url.searchParams.get("limit"), 25, 1, 50),
  };
}

async function handleSearchApi(request, url) {
  if (request.method !== "GET") {
    return jsonResponse({ error: "Method not allowed." }, { status: 405, headers: { allow: "GET" } });
  }

  const rateLimit = rateLimitRequest(request, "search", 120, 60);

  if (!rateLimit.allowed) {
    return jsonResponse(
      { error: "Too many search requests." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
        },
      },
    );
  }

  const input = parseSearchInput(url);
  const providerResults = await aggregateSearch(input);
  const records = dedupeRecords(providerResults.flatMap((result) => result.records)).slice(0, input.limit);

  return jsonResponse({
    data: records,
    meta: {
      count: records.length,
      source: providerResults.map((result) => result.provider).join("+") || "none",
      providers: providerResults.map((result) => ({
        id: result.provider,
        count: result.records.length,
        error: result.error,
      })),
      rateLimit: {
        limit: rateLimit.limit,
        remaining: rateLimit.remaining,
        resetAt: new Date(rateLimit.resetAt).toISOString(),
      },
    },
  });
}

function normalizeUexName(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeRouteIdentity(value) {
  return normalizeUexName(value).replace(/\s+/g, "");
}

function isSameTradeEndpoint(left, right) {
  const normalizedLeft = normalizeRouteIdentity(left);
  const normalizedRight = normalizeRouteIdentity(right);

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  return normalizedLeft === normalizedRight || normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft);
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function isEnabledFlag(value) {
  return value === undefined || value === null || value === true || value === 1;
}

function arrayFromData(value) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function buildUexTerminalQueries(origin) {
  const queries = new Set();
  const trimmed = String(origin ?? "").trim();
  const withoutStation = trimmed.replace(/\bstation\b/gi, "").replace(/\s+/g, " ").trim();
  const afterDash = trimmed.split("-").at(-1)?.trim();

  for (const candidate of [trimmed, withoutStation, afterDash]) {
    if (candidate) {
      queries.add(candidate);
    }
  }

  return Array.from(queries);
}

function toIsoDateFromUnixSeconds(value) {
  const seconds = numberOrZero(value);

  if (seconds <= 0) {
    return undefined;
  }

  const date = new Date(seconds * 1000);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString().slice(0, 10);
}

function getRouteFreshness(sourceUpdatedAt) {
  if (!sourceUpdatedAt) {
    return "unknown";
  }

  const timestamp = new Date(sourceUpdatedAt).getTime();

  if (Number.isNaN(timestamp)) {
    return "unknown";
  }

  const ageDays = (Date.now() - timestamp) / 86400000;

  if (ageDays <= 7) {
    return "fresh";
  }

  if (ageDays <= 30) {
    return "recent";
  }

  return "stale";
}

async function fetchUexResource(env, resource, params = {}, timeoutMs = 10000) {
  if (!UEX_RESOURCES.has(resource)) {
    throw new Error(`UEX resource is not allowed: ${resource}`);
  }

  const url = new URL(`${UEX_API_BASE_URL}/${resource}`);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  const headers = {
    accept: "application/json",
    "user-agent": "ENIGMA Verse Index/0.1.0",
    "x-client-version": env.UEX_CLIENT_VERSION ?? "enigma-verse-index/0.1.0",
  };

  if (env.UEX_API_TOKEN) {
    headers.authorization = `Bearer ${env.UEX_API_TOKEN}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`UEX API returned ${response.status}.`);
    }

    const payload = await response.json();

    if (payload?.status && payload.status !== "ok") {
      throw new Error(payload.message || `UEX API status ${payload.status}.`);
    }

    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

function pickUexOriginTerminal(terminals, origin) {
  const normalizedOrigin = normalizeUexName(origin);
  const commodityTerminals = terminals.filter(
    (terminal) =>
      terminal?.type === "commodity" &&
      isEnabledFlag(terminal.is_available) &&
      isEnabledFlag(terminal.is_available_live) &&
      isEnabledFlag(terminal.is_visible),
  );

  if (!commodityTerminals.length) {
    return undefined;
  }

  return (
    commodityTerminals.find((terminal) =>
      [terminal.displayname, terminal.name, terminal.fullname, terminal.nickname, terminal.code].some(
        (candidate) => normalizeUexName(candidate) === normalizedOrigin,
      ),
    ) ??
    commodityTerminals.find((terminal) =>
      [terminal.displayname, terminal.name, terminal.fullname, terminal.nickname, terminal.code].some((candidate) =>
        normalizeUexName(candidate).includes(normalizedOrigin),
      ),
    ) ??
    commodityTerminals[0]
  );
}

async function fetchUexOriginTerminal(env, origin) {
  for (const query of buildUexTerminalQueries(origin)) {
    const terminalResponse = await fetchUexResource(env, "terminals", { name: query });
    const originTerminal = pickUexOriginTerminal(arrayFromData(terminalResponse.data), origin);

    if (originTerminal) {
      return originTerminal;
    }
  }

  return undefined;
}

function buildUexLocationTrail(system, planet, orbit) {
  return [system, planet ?? orbit].filter(Boolean).join(" / ");
}

function parseUexContainerSizes(value) {
  return Array.from(
    new Set(
      String(value ?? "")
        .split(/[,\s/|]+/)
        .map((entry) => Math.floor(numberOrZero(entry)))
        .filter((entry) => entry > 0),
    ),
  ).sort((left, right) => left - right);
}

function intersectContainerSizes(left, right) {
  if (!left.length) {
    return right;
  }

  if (!right.length) {
    return left;
  }

  return left.filter((size) => right.includes(size));
}

function isTrueFlag(value) {
  return value === true || value === 1;
}

function getUexRouteRisk(route) {
  const faction = normalizeUexName(route.destination_faction_name);

  if (
    !isEnabledFlag(route.is_monitored_destination) ||
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

  if (!isEnabledFlag(route.has_loading_dock_destination) && !isEnabledFlag(route.has_docking_port_destination)) {
    return "Medium";
  }

  return "Low";
}

function mapUexRouteToTradeRoute(route, fetchedAt) {
  const buyPrice = numberOrZero(route.price_origin);
  const sellPrice = numberOrZero(route.price_destination);
  const availableScu = Math.floor(numberOrZero(route.scu_reachable) || numberOrZero(route.scu_origin));

  if (!route.commodity_name || buyPrice <= 0 || sellPrice <= buyPrice || availableScu <= 0) {
    return undefined;
  }

  const destinationTrail = buildUexLocationTrail(
    route.destination_star_system_name,
    route.destination_planet_name,
    route.destination_orbit_name,
  );
  const originTrail = buildUexLocationTrail(route.origin_star_system_name, route.origin_planet_name, route.origin_orbit_name);
  const originContainerSizes = parseUexContainerSizes(route.container_sizes_origin);
  const destinationContainerSizes = parseUexContainerSizes(route.container_sizes_destination);
  const sourceUpdatedAt = toIsoDateFromUnixSeconds(route.date_added);
  const gameVersion = [route.game_version_origin, route.game_version_destination].filter(Boolean).join(" / ");
  const originTerminalId = Math.floor(numberOrZero(route.id_terminal_origin));
  const destinationTerminalId = Math.floor(numberOrZero(route.id_terminal_destination));

  return {
    id: `uex-route-${route.id}`,
    commodity: route.commodity_name,
    origin: route.origin_terminal_name ?? "Unknown origin",
    originTerminalId: originTerminalId || undefined,
    destinationTerminalId: destinationTerminalId || undefined,
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
    distanceGm: numberOrZero(route.distance) || undefined,
    marginPercent: numberOrZero(route.price_roi) || undefined,
    routeCode: route.code ?? undefined,
    score: numberOrZero(route.score) || undefined,
    containerSizes: intersectContainerSizes(originContainerSizes, destinationContainerSizes),
    originContainerSizes,
    destinationContainerSizes,
    originIsGround: isTrueFlag(route.is_on_ground_origin),
    destinationIsGround: isTrueFlag(route.is_on_ground_destination),
    originIsSpaceStation: isTrueFlag(route.is_space_station_origin),
    destinationIsSpaceStation: isTrueFlag(route.is_space_station_destination),
    originHasFreightElevator: isTrueFlag(route.has_freight_elevator_origin),
    destinationHasFreightElevator: isTrueFlag(route.has_freight_elevator_destination),
    originHasDockingPort: isTrueFlag(route.has_docking_port_origin),
    destinationHasDockingPort: isTrueFlag(route.has_docking_port_destination),
    risk: getUexRouteRisk(route),
    source: {
      sourceName: "UEX Corp API",
      sourceUrl: route.commodity_slug
        ? `https://uexcorp.space/commodities/info/name/${route.commodity_slug}`
        : "https://uexcorp.space/api/documentation/id/get_commodities_routes/",
      sourceRecordId: String(route.id),
      gameVersion: gameVersion || undefined,
      fetchedAt,
      sourceUpdatedAt,
      freshness: getRouteFreshness(sourceUpdatedAt),
    },
  };
}

async function fetchUexTradeRoutes(env, originInput, refresh = false) {
  const origin = String(originInput || "Seraphim Station").trim() || "Seraphim Station";
  const cacheKey = normalizeUexName(origin);
  const cached = UEX_ROUTE_CACHE.get(cacheKey);

  if (!refresh && cached && cached.expiresAt > Date.now()) {
    return {
      originTerminal: cached.originTerminal,
      routes: cached.routes,
    };
  }

  const originTerminal = await fetchUexOriginTerminal(env, origin);

  if (!originTerminal) {
    throw new Error(`UEX terminal not found for origin: ${origin}`);
  }

  const routeResponse = await fetchUexResource(env, "commodities_routes", {
    id_terminal_origin: originTerminal.id,
  });
  const fetchedAt = new Date().toISOString();
  const routes = arrayFromData(routeResponse.data)
    .map((route) => mapUexRouteToTradeRoute(route, fetchedAt))
    .filter(Boolean);

  UEX_ROUTE_CACHE.set(cacheKey, {
    expiresAt: Date.now() + UEX_ROUTE_CACHE_TTL_MS,
    originTerminal,
    routes,
  });

  return {
    originTerminal,
    routes,
  };
}

async function fetchUexTradeRoutesByTerminalId(env, terminalId, label, refresh = false) {
  const normalizedTerminalId = Math.floor(numberOrZero(terminalId));

  if (!normalizedTerminalId) {
    throw new Error(`UEX terminal id is invalid: ${terminalId}`);
  }

  const cacheKey = `terminal:${normalizedTerminalId}`;
  const cached = UEX_ROUTE_CACHE.get(cacheKey);

  if (!refresh && cached && cached.expiresAt > Date.now()) {
    return {
      originTerminal: cached.originTerminal,
      routes: cached.routes,
    };
  }

  const routeResponse = await fetchUexResource(env, "commodities_routes", {
    id_terminal_origin: normalizedTerminalId,
  });
  const fetchedAt = new Date().toISOString();
  const routes = arrayFromData(routeResponse.data)
    .map((route) => mapUexRouteToTradeRoute(route, fetchedAt))
    .filter(Boolean);
  const originTerminal = {
    id: normalizedTerminalId,
    name: label,
    displayname: label,
    fullname: label,
  };

  UEX_ROUTE_CACHE.set(cacheKey, {
    expiresAt: Date.now() + UEX_ROUTE_CACHE_TTL_MS,
    originTerminal,
    routes,
  });

  return {
    originTerminal,
    routes,
  };
}

function routeMatchesText(route, query, fields) {
  const normalizedQuery = normalizeUexName(query);

  if (!normalizedQuery) {
    return true;
  }

  return fields.some((field) => normalizeUexName(field).includes(normalizedQuery));
}

function routeMatchesTradeInput(route, input) {
  return (
    routeMatchesText(route, input.origin?.trim(), [
      route.origin,
      route.buyTerminal,
      route.originLocation ?? "",
      route.originTerminalName ?? "",
      route.originTerminalCode ?? "",
    ]) &&
    routeMatchesText(route, input.destination?.trim(), [
      route.sellTerminal,
      route.destinationLocation ?? "",
      route.destinationTerminalName ?? "",
      route.destinationTerminalCode ?? "",
    ]) &&
    routeMatchesMode(route, input.routeMode) &&
    routeMatchesContainer(route, input.containerSize)
  );
}

function routeMatchesMode(route, routeMode = "mixed") {
  if (routeMode !== "space") {
    return true;
  }

  return route.originIsGround !== true && route.destinationIsGround !== true;
}

function routeMatchesContainer(route, containerSize) {
  const normalizedSize = Math.floor(numberOrZero(containerSize));

  if (!normalizedSize) {
    return true;
  }

  return !route.containerSizes?.length || route.containerSizes.includes(normalizedSize);
}

function calculateTradeLeg(route, cargoScu, budgetUec) {
  const usableCargoScu = clampInteger(cargoScu, 696, 0, 10000);
  const availableBudgetUec = clampInteger(budgetUec, 750000, 0, 100000000);
  const availableScu =
    typeof route.availableScu === "number" && Number.isFinite(route.availableScu)
      ? Math.max(0, Math.floor(route.availableScu))
      : usableCargoScu;
  const profitPerScu = Math.max(0, route.sellPrice - route.buyPrice);
  const purchasableScu =
    route.buyPrice > 0 ? Math.max(0, Math.min(usableCargoScu, availableScu, Math.floor(availableBudgetUec / route.buyPrice))) : 0;
  const capitalUsed = purchasableScu * route.buyPrice;
  const totalProfit = purchasableScu * profitPerScu;

  if (purchasableScu <= 0 || totalProfit <= 0) {
    return undefined;
  }

  return {
    ...route,
    purchasableScu,
    capitalUsed,
    profitPerScu,
    totalProfit,
  };
}

function combineRisk(legs) {
  if (legs.some((leg) => leg.risk === "High")) {
    return "High";
  }

  if (legs.some((leg) => leg.risk === "Medium")) {
    return "Medium";
  }

  return "Low";
}

function intersectLegContainerSizes(legs) {
  const sizes = legs.map((leg) => leg.containerSizes ?? []).filter((legSizes) => legSizes.length);

  if (!sizes.length) {
    return [];
  }

  return sizes.reduce((shared, legSizes) => shared.filter((size) => legSizes.includes(size)));
}

function calculateTradeRoutePlan(rawLegs, input) {
  const calculatedLegs = [];
  const cargoScu = clampInteger(input.cargoScu, 696, 0, 10000);
  let currentBudget = clampInteger(input.budgetUec, 750000, 0, 100000000);

  for (const rawLeg of rawLegs) {
    if (!routeMatchesMode(rawLeg, input.routeMode) || !routeMatchesContainer(rawLeg, input.containerSize)) {
      return undefined;
    }

    const leg = calculateTradeLeg(rawLeg, cargoScu, currentBudget);

    if (!leg) {
      return undefined;
    }

    calculatedLegs.push(leg);
    currentBudget += leg.totalProfit;
  }

  const firstLeg = calculatedLegs[0];

  if (!firstLeg) {
    return undefined;
  }

  const totalProfit = calculatedLegs.reduce((sum, leg) => sum + leg.totalProfit, 0);
  const totalTransportedScu = calculatedLegs.reduce((sum, leg) => sum + leg.purchasableScu, 0);
  const peakCapital = Math.max(...calculatedLegs.map((leg) => leg.capitalUsed));
  const distanceGm = calculatedLegs.reduce((sum, leg) => sum + (leg.distanceGm ?? 0), 0) || undefined;
  const routeKind = calculatedLegs.length >= 3 ? "triangle" : "cycle";

  return {
    ...firstLeg,
    id: `${routeKind}-${calculatedLegs.map((leg) => leg.id).join("-")}`,
    commodity: calculatedLegs.map((leg) => leg.commodity).join(" -> "),
    sellTerminal: calculatedLegs[calculatedLegs.length - 1]?.sellTerminal ?? firstLeg.sellTerminal,
    destinationTerminalId: calculatedLegs[calculatedLegs.length - 1]?.destinationTerminalId,
    destinationTerminalCode: calculatedLegs[calculatedLegs.length - 1]?.destinationTerminalCode,
    destinationTerminalName: calculatedLegs[calculatedLegs.length - 1]?.destinationTerminalName,
    destinationTerminalSlug: calculatedLegs[calculatedLegs.length - 1]?.destinationTerminalSlug,
    destinationLocation: calculatedLegs[calculatedLegs.length - 1]?.destinationLocation,
    availableScu: Math.min(...calculatedLegs.map((leg) => leg.availableScu ?? leg.purchasableScu)),
    distanceGm,
    marginPercent: peakCapital > 0 ? (totalProfit / peakCapital) * 100 : undefined,
    containerSizes: intersectLegContainerSizes(calculatedLegs),
    originIsGround: calculatedLegs.some((leg) => leg.originIsGround),
    destinationIsGround: calculatedLegs.some((leg) => leg.destinationIsGround),
    originIsSpaceStation: calculatedLegs[0]?.originIsSpaceStation,
    destinationIsSpaceStation: calculatedLegs[calculatedLegs.length - 1]?.destinationIsSpaceStation,
    originHasFreightElevator: calculatedLegs[0]?.originHasFreightElevator,
    destinationHasFreightElevator: calculatedLegs[calculatedLegs.length - 1]?.destinationHasFreightElevator,
    originHasDockingPort: calculatedLegs[0]?.originHasDockingPort,
    destinationHasDockingPort: calculatedLegs[calculatedLegs.length - 1]?.destinationHasDockingPort,
    risk: combineRisk(calculatedLegs),
    routeKind,
    routePlanLabel: routeKind === "triangle" ? "三角循环航线" : "往返循环航线",
    legs: calculatedLegs,
    purchasableScu: totalTransportedScu,
    capitalUsed: peakCapital,
    profitPerScu: totalTransportedScu > 0 ? totalProfit / totalTransportedScu : 0,
    totalProfit,
  };
}

function calculateTradeRoutes(input, sourceRoutes = ENIGMA_DATA.tradeRoutes) {
  const cargoScu = clampInteger(input.cargoScu, 696, 0, 10000);
  const budgetUec = clampInteger(input.budgetUec, 750000, 0, 100000000);
  const limit = clampInteger(input.limit, 10, 1, 200);
  const origin = input.origin?.trim();
  const destination = input.destination?.trim();

  return sourceRoutes
    .filter((route) => routeMatchesTradeInput(route, { origin, destination, routeMode: input.routeMode, containerSize: input.containerSize }))
    .map((route) => calculateTradeLeg(route, cargoScu, budgetUec))
    .filter(Boolean)
    .map((route) => ({ ...route, routeKind: "direct" }))
    .filter((route) => route.purchasableScu > 0 && route.totalProfit > 0)
    .sort((left, right) => right.totalProfit - left.totalProfit)
    .slice(0, limit);
}

function routeReturnsToOrigin(route, originInput, originTerminal) {
  if (originTerminal?.id && route.destinationTerminalId === Number(originTerminal.id)) {
    return true;
  }

  return [originInput, originTerminal?.displayname, originTerminal?.name, originTerminal?.fullname, originTerminal?.code]
    .filter((value) => Boolean(String(value ?? "").trim()))
    .some((candidate) =>
      routeMatchesText(route, candidate, [
        route.sellTerminal,
        route.destinationLocation ?? "",
        route.destinationTerminalName ?? "",
        route.destinationTerminalCode ?? "",
      ]),
    );
}

function dedupeRoutePlans(routes) {
  const seen = new Set();
  const result = [];

  for (const route of routes) {
    const key = route.legs?.map((leg) => leg.id).join("|") ?? route.id;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(route);
  }

  return result;
}

async function resolveUexLoopRoutes(env, input) {
  const originRoutes = await fetchUexTradeRoutes(env, input.origin, input.refresh);
  const budgetUec = clampInteger(input.budgetUec, 750000, 0, 100000000);
  const requestedLimit = clampInteger(input.limit, 10, 1, 200);
  const leg1Candidates = calculateTradeRoutes(
    {
      cargoScu: input.cargoScu,
      budgetUec: input.budgetUec,
      limit: 24,
      routeMode: input.routeMode,
      containerSize: input.containerSize,
    },
    originRoutes.routes,
  ).filter((route) => route.destinationTerminalId);
  const scannedFirstLegs = leg1Candidates.slice(0, 12);
  const secondLegResults = await Promise.allSettled(
    scannedFirstLegs.map((route) =>
      fetchUexTradeRoutesByTerminalId(
        env,
        route.destinationTerminalId ?? 0,
        route.destinationTerminalName ?? route.sellTerminal,
        input.refresh,
      ),
    ),
  );
  const plans = [];
  const thirdLegPairs = [];
  let upstreamCount = originRoutes.routes.length;

  secondLegResults.forEach((result, index) => {
    if (result.status !== "fulfilled") {
      return;
    }

    const leg1 = scannedFirstLegs[index];
    const secondRoutes = result.value.routes;
    const afterLeg1Budget = budgetUec + leg1.totalProfit;
    upstreamCount += secondRoutes.length;
    const secondCandidates = calculateTradeRoutes(
      {
        cargoScu: input.cargoScu,
        budgetUec: afterLeg1Budget,
        limit: 10,
        routeMode: input.routeMode,
        containerSize: input.containerSize,
      },
      secondRoutes,
    );

    for (const returnLeg of secondCandidates
      .filter((route) => routeReturnsToOrigin(route, input.origin, originRoutes.originTerminal))
      .slice(0, 2)) {
      const plan = calculateTradeRoutePlan([leg1, returnLeg], input);

      if (plan) {
        plans.push(plan);
      }
    }

    for (const leg2 of secondCandidates
      .filter((route) => !routeReturnsToOrigin(route, input.origin, originRoutes.originTerminal))
      .filter((route) => route.destinationTerminalId && route.destinationTerminalId !== leg1.destinationTerminalId)
      .slice(0, 6)) {
      thirdLegPairs.push({ leg1, leg2, score: leg1.totalProfit + leg2.totalProfit });
    }
  });

  const thirdLegRequests = new Map();

  for (const { leg1, leg2 } of thirdLegPairs
    .sort((left, right) => right.score - left.score)
    .slice(0, 24)) {
    const destinationTerminalId = leg2.destinationTerminalId;

    if (!destinationTerminalId) {
      continue;
    }

    const request = thirdLegRequests.get(destinationTerminalId) ?? {
      label: leg2.destinationTerminalName ?? leg2.sellTerminal,
      pairs: [],
    };

    request.pairs.push({ leg1, leg2 });
    thirdLegRequests.set(destinationTerminalId, request);
  }

  const thirdLegResults = await Promise.allSettled(
    Array.from(thirdLegRequests.entries()).map(async ([terminalId, request]) => ({
      terminalId,
      result: await fetchUexTradeRoutesByTerminalId(env, terminalId, request.label, input.refresh),
    })),
  );

  for (const thirdLegResult of thirdLegResults) {
    if (thirdLegResult.status !== "fulfilled") {
      continue;
    }

    const request = thirdLegRequests.get(thirdLegResult.value.terminalId);

    if (!request) {
      continue;
    }

    upstreamCount += thirdLegResult.value.result.routes.length;

    for (const pair of request.pairs) {
      const afterLeg2Budget = budgetUec + pair.leg1.totalProfit + pair.leg2.totalProfit;
      const returnCandidates = calculateTradeRoutes(
        {
          cargoScu: input.cargoScu,
          budgetUec: afterLeg2Budget,
          limit: 6,
          routeMode: input.routeMode,
          containerSize: input.containerSize,
        },
        thirdLegResult.value.result.routes,
      ).filter((route) => routeReturnsToOrigin(route, input.origin, originRoutes.originTerminal));

      for (const returnLeg of returnCandidates.slice(0, 2)) {
        const plan = calculateTradeRoutePlan([pair.leg1, pair.leg2, returnLeg], input);

        if (plan) {
          plans.push(plan);
        }
      }
    }
  }

  return {
    routes: dedupeRoutePlans(plans)
      .sort((left, right) => right.totalProfit - left.totalProfit)
      .slice(0, requestedLimit),
    source: "uex-loop",
    upstreamCount,
    planMode: "loop",
    warning: plans.length ? undefined : "No profitable loop route found for the selected origin, budget, cargo, mode, and box size.",
  };
}

async function resolveTradeRoutes(env, input, provider) {
  if (provider !== "sample") {
    try {
      if (isSameTradeEndpoint(input.origin, input.destination)) {
        return await resolveUexLoopRoutes(env, input);
      }

      const uex = await fetchUexTradeRoutes(env, input.origin, input.refresh);
      const routes = calculateTradeRoutes(
        {
          destination: input.destination,
          cargoScu: input.cargoScu,
          budgetUec: input.budgetUec,
          limit: input.limit,
          routeMode: input.routeMode,
          containerSize: input.containerSize,
        },
        uex.routes,
      );

      return {
        routes,
        source: "uex",
        upstreamCount: uex.routes.length,
        planMode: "direct",
      };
    } catch (error) {
      if (provider === "uex") {
        throw error;
      }

      return {
        routes: calculateTradeRoutes(input),
        source: "sample",
        planMode: "direct",
        warning: "UEX API unavailable; using ENIGMA sample trade routes.",
      };
    }
  }

  return {
    routes: calculateTradeRoutes(input),
    source: "sample",
    planMode: "direct",
  };
}

async function handleTradeRoutesApi(request, env, url) {
  if (request.method !== "GET") {
    return jsonResponse({ error: "Method not allowed." }, { status: 405, headers: { allow: "GET" } });
  }

  const rateLimit = rateLimitRequest(request, "trade-routes", 80, 60);

  if (!rateLimit.allowed) {
    return jsonResponse(
      { error: "Too many trade route requests." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
        },
      },
    );
  }

  const input = {
    origin: String(url.searchParams.get("origin") ?? ""),
    destination: String(url.searchParams.get("destination") ?? ""),
    cargoScu: url.searchParams.get("cargoScu"),
    budgetUec: url.searchParams.get("budgetUec"),
    limit: url.searchParams.get("limit"),
    routeMode: cleanEnum(url.searchParams.get("routeMode") ?? "mixed", TRADE_ROUTE_MODES, "mixed"),
    containerSize: url.searchParams.get("containerSize"),
    refresh: ["1", "true"].includes(url.searchParams.get("refresh") ?? ""),
  };
  const provider = cleanEnum(url.searchParams.get("provider") ?? "auto", TRADE_SOURCE_VALUES, "auto");
  let routeResolution;

  try {
    routeResolution = await resolveTradeRoutes(env, input, provider);
  } catch (error) {
    return jsonResponse(
      {
        error: "UEX API unavailable.",
        message: error instanceof Error ? error.message : "Unknown UEX API error.",
      },
      { status: 502 },
    );
  }

  return jsonResponse({
    data: routeResolution.routes,
    meta: {
      count: routeResolution.routes.length,
      source: routeResolution.source,
      upstreamCount: routeResolution.upstreamCount,
      planMode: routeResolution.planMode,
      warning: routeResolution.warning,
      rateLimit: {
        limit: rateLimit.limit,
        remaining: rateLimit.remaining,
        resetAt: new Date(rateLimit.resetAt).toISOString(),
      },
    },
  });
}

async function handleTradeShipsApi(request, url) {
  if (request.method !== "GET") {
    return jsonResponse({ error: "Method not allowed." }, { status: 405, headers: { allow: "GET" } });
  }

  const rateLimit = rateLimitRequest(request, "trade-ships", 40, 60);

  if (!rateLimit.allowed) {
    return jsonResponse(
      { error: "Too many ship catalog requests." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
        },
      },
    );
  }

  try {
    const refresh = ["1", "true"].includes(url.searchParams.get("refresh") ?? "");
    const ships = await fetchWikiCargoShips(refresh);

    return jsonResponse({
      data: ships,
      meta: {
        count: ships.length,
        source: "starcitizen.tools",
        rateLimit: {
          limit: rateLimit.limit,
          remaining: rateLimit.remaining,
          resetAt: new Date(rateLimit.resetAt).toISOString(),
        },
      },
    });
  } catch (error) {
    return jsonResponse(
      {
        error: "Ship catalog unavailable.",
        message: error instanceof Error ? error.message : "Unknown ship catalog error.",
      },
      { status: 502 },
    );
  }
}

function handleSourcesApi(request) {
  if (request.method !== "GET") {
    return jsonResponse({ error: "Method not allowed." }, { status: 405, headers: { allow: "GET" } });
  }

  return jsonResponse({
    data: ENIGMA_DATA.sourceCatalog,
    meta: { count: ENIGMA_DATA.sourceCatalog.length },
  });
}

function handleHealthApi(request) {
  if (request.method !== "GET") {
    return jsonResponse({ error: "Method not allowed." }, { status: 405, headers: { allow: "GET" } });
  }

  return jsonResponse({
    ok: true,
    service: "ENIGMA Verse Index",
    runtime: "cloudflare-worker",
    checks: {
      searchRecords: ENIGMA_DATA.searchRecords.length,
      tradeRoutes: ENIGMA_DATA.tradeRoutes.length,
      sourceCatalog: ENIGMA_DATA.sourceCatalog.length,
    },
  });
}

function parseKookCommand(content) {
  const raw = content.trim();

  if (!raw.startsWith("/") && !raw.startsWith("!")) {
    return null;
  }

  const [commandName = "", ...args] = raw.slice(1).split(/\s+/).filter(Boolean);
  const aliases = {
    h: "help",
    help: "help",
    s: "search",
    search: "search",
    ship: "ship",
    ships: "ship",
    item: "item",
    i: "item",
    price: "price",
    p: "price",
    route: "route",
    r: "route",
  };

  return { name: aliases[commandName.toLowerCase()] ?? "unknown", args, raw };
}

function formatKookSearchReply(command) {
  const query = command.args.join(" ").trim();

  if (!query) {
    return "Input a query, for example: /ship C2 or /price Gold.";
  }

  const type = command.name === "ship" ? "ship" : command.name === "price" ? "commodity" : "all";
  const results = searchLocalRecords({ query, type, freshness: "all", limit: 3 });

  if (!results.length) {
    return `No local result found: ${query}`;
  }

  return results
    .map((record, index) =>
      [`${index + 1}. ${record.name}${record.nameZh ? ` / ${record.nameZh}` : ""}`, record.summary, record.source.sourceName].join(
        "\n",
      ),
    )
    .join("\n\n");
}

function formatKookRouteReply(command) {
  const routes = calculateTradeRoutes({
    origin: "Seraphim Station",
    cargoScu: command.args[0] ?? 696,
    budgetUec: command.args[1] ?? 750000,
    limit: 3,
  });

  if (!routes.length) {
    return "No profitable local route found for this cargo and budget.";
  }

  return routes
    .map(
      (route, index) =>
        `${index + 1}. ${route.commodity}: ${route.buyTerminal} -> ${route.sellTerminal}\n${route.purchasableScu} SCU / ${route.totalProfit.toLocaleString("en-US")} UEC`,
    )
    .join("\n\n");
}

async function sendKookChannelMessage(env, targetId, content, quoteMessageId) {
  if (!env.KOOK_BOT_TOKEN) {
    return { skipped: true, reason: "KOOK_BOT_TOKEN not configured." };
  }

  const apiBase = env.KOOK_API_BASE_URL ?? "https://www.kookapp.cn/api/v3";
  const response = await fetch(`${apiBase}/message/create`, {
    method: "POST",
    headers: {
      authorization: `Bot ${env.KOOK_BOT_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      type: 9,
      target_id: targetId,
      content: content.slice(0, 1800),
      quote: quoteMessageId,
    }),
  });

  if (!response.ok) {
    throw new Error(`KOOK message send failed: ${response.status}`);
  }

  return response.json();
}

async function handleKookWebhook(request, env) {
  if (request.method === "GET") {
    return jsonResponse({
      ok: true,
      service: "ENIGMA KOOK webhook",
      configured: Boolean(env.KOOK_VERIFY_TOKEN && env.KOOK_BOT_TOKEN),
    });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, { status: 405, headers: { allow: "GET, POST" } });
  }

  const rawBody = await request.text();

  if (rawBody.length > 256 * 1024) {
    return jsonResponse({ error: "Payload too large." }, { status: 413 });
  }

  let envelope;

  try {
    envelope = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: "Invalid KOOK payload." }, { status: 400 });
  }

  if (env.KOOK_VERIFY_TOKEN && envelope.d?.verify_token !== env.KOOK_VERIFY_TOKEN) {
    return jsonResponse({ error: "Invalid verify token." }, { status: 401 });
  }

  if (envelope.d?.challenge) {
    return jsonResponse({ challenge: envelope.d.challenge });
  }

  const event = envelope.d;

  if (!event || event.extra?.author?.bot || !event.target_id) {
    return jsonResponse({ ok: true, ignored: true });
  }

  const command = parseKookCommand(event.content ?? "");

  if (!command) {
    return jsonResponse({ ok: true, ignored: true });
  }

  const reply =
    command.name === "help"
      ? "ENIGMA Verse Index\n/search <query>\n/ship <ship>\n/item <item>\n/price <commodity>\n/route <cargoScu> <budgetUec>"
      : command.name === "route"
        ? formatKookRouteReply(command)
        : command.name === "search" || command.name === "ship" || command.name === "item" || command.name === "price"
          ? formatKookSearchReply(command)
          : "Unknown command. Use /help.";

  const sendResult = await sendKookChannelMessage(env, event.target_id, reply, event.msg_id);
  return jsonResponse({ ok: true, sent: !sendResult.skipped, sendResult });
}

async function fetchAsset(env, request, pathname) {
  const url = new URL(request.url);
  url.pathname = pathname;
  url.search = "";
  return env.ASSETS.fetch(new Request(url, request));
}

async function handleApi(request, env, url) {
  if (request.method === "OPTIONS") {
    return withSecurityHeaders(new Response(null, { status: 204 }));
  }

  if (url.pathname === "/api/health") {
    return handleHealthApi(request);
  }

  if (url.pathname === "/api/search") {
    return handleSearchApi(request, url);
  }

  if (url.pathname === "/api/sources") {
    return handleSourcesApi(request);
  }

  if (url.pathname === "/api/trade/routes") {
    return handleTradeRoutesApi(request, env, url);
  }

  if (url.pathname === "/api/trade/ships") {
    return handleTradeShipsApi(request, url);
  }

  if (url.pathname === "/api/kook/webhook") {
    return handleKookWebhook(request, env);
  }

  return jsonResponse({ error: "Not found." }, { status: 404 });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      return handleApi(request, env, url);
    }

    const response = await env.ASSETS.fetch(request);

    if (response.status !== 404 || !["GET", "HEAD"].includes(request.method)) {
      return withSecurityHeaders(response);
    }

    if (!acceptsHtml(request)) {
      return withSecurityHeaders(response);
    }

    if (!url.pathname.endsWith("/")) {
      const directoryIndex = await fetchAsset(env, request, `${url.pathname}/index.html`);

      if (directoryIndex.status !== 404) {
        return withSecurityHeaders(directoryIndex);
      }
    }

    const appShell = await fetchAsset(env, request, "/index.html");
    return withSecurityHeaders(appShell);
  },
};
