const ENIGMA_DATA = globalThis.__ENIGMA_WORKER_DATA__ ?? {
  searchRecords: [],
  tradeRoutes: [],
  sourceCatalog: [],
  localizationAliases: [],
  cargoShips: [],
};

const WIKI_API_BASE_URL = "https://api.star-citizen.wiki";
const UEX_API_BASE_URL = "https://api.uexcorp.uk/2.0";
const CITIZENWIKI_SEARCH_URL = "https://citizenwiki.cn/index.php";
const STAR_CITIZEN_TOOLS_SEARCH_URL = "https://starcitizen.tools/index.php";
const PARATRANZ_TERMS_API_URL = "https://paratranz.cn/api/projects/8340/terms";
const PARATRANZ_TERMS_SOURCE_URL = "https://paratranz.cn/projects/8340/terms";
const KRAKEN_IMAGE_URL =
  "https://robertsspaceindustries.com/i/246490295838c8d442391398f9bfa4069693509e/resize(2048,1024,cover,ADdPNihJzmPbNuTnFsH1DqUeqBRpXdSXVVtgJTyDDgscGKrzJuoFjResjqYHRGgyn5CBWsSTK3b9eZJ6fQD1C1ydp)/source.jpg";
const KRAKEN_PRIVATEER_IMAGE_URL =
  "https://robertsspaceindustries.com/i/9c5813524aed20500cd4407b65c19eab713303a9/resize(2048,1024,cover,ADdPNihJzmPbNuTnFsH1DqUeqBRpXdSXVVtgJTyDDgscGKrzJuoFjResjqYJiA954ovGyjrhJzKDcRSB3GeX5S1Wn)/source.jpg";
const ALIAS_SHIP_PATCHES = {
  "drake kraken": {
    name: "Drake Kraken",
    manufacturer: "Drake Interplanetary",
    manufacturerCode: "DRAK",
    role: "Light carrier",
    size: "Capital",
    cargoScu: 3792,
    sourceUrl: "https://robertsspaceindustries.com/pledge/ships/drake-kraken/Kraken",
    imageUrl: KRAKEN_IMAGE_URL,
    summary:
      "Drake's multi-role light carrier with exterior landing pads, hangars, and a dedicated cargo hold for ships, cargo, and supplies.",
    tags: ["Drake", "Carrier", "Capital", "Cargo"],
  },
  kraken: {
    name: "Drake Kraken",
    manufacturer: "Drake Interplanetary",
    manufacturerCode: "DRAK",
    role: "Light carrier",
    size: "Capital",
    cargoScu: 3792,
    sourceUrl: "https://robertsspaceindustries.com/pledge/ships/drake-kraken/Kraken",
    imageUrl: KRAKEN_IMAGE_URL,
    summary:
      "Drake's multi-role light carrier with exterior landing pads, hangars, and a dedicated cargo hold for ships, cargo, and supplies.",
    tags: ["Drake", "Carrier", "Capital", "Cargo"],
  },
  "drake kraken privateer": {
    name: "Drake Kraken Privateer",
    manufacturer: "Drake Interplanetary",
    manufacturerCode: "DRAK",
    role: "Mobile marketplace",
    size: "Capital",
    cargoScu: 768,
    sourceUrl: "https://robertsspaceindustries.com/pledge/ships/drake-kraken/Kraken-Privateer",
    imageUrl: KRAKEN_PRIVATEER_IMAGE_URL,
    summary: "A Kraken variant configured as a private mobile marketplace and trading platform.",
    tags: ["Drake", "Carrier", "Capital", "Trading"],
  },
  "kraken privateer": {
    name: "Drake Kraken Privateer",
    manufacturer: "Drake Interplanetary",
    manufacturerCode: "DRAK",
    role: "Mobile marketplace",
    size: "Capital",
    cargoScu: 768,
    sourceUrl: "https://robertsspaceindustries.com/pledge/ships/drake-kraken/Kraken-Privateer",
    imageUrl: KRAKEN_PRIVATEER_IMAGE_URL,
    summary: "A Kraken variant configured as a private mobile marketplace and trading platform.",
    tags: ["Drake", "Carrier", "Capital", "Trading"],
  },
};
const RATE_LIMITS = new Map();
const UEX_ROUTE_CACHE = new Map();
const UEX_ROUTE_CACHE_TTL_MS = 15 * 60 * 1000;
const MANUAL_TRADE_QUERY_ALIAS_PAIRS = [
  ["特蕾莎", ["Port Tressler"]],
  ["特蕾莎空间站", ["Port Tressler"]],
  ["特雷莎", ["Port Tressler"]],
  ["特雷莎空间站", ["Port Tressler"]],
  ["特雷斯勒", ["Port Tressler"]],
  ["特雷斯勒空间站", ["Port Tressler"]],
  ["炽天使", ["Seraphim Station"]],
  ["炽天使空间站", ["Seraphim Station"]],
  ["地球网关", ["Terra Gateway"]],
  ["泰拉网关", ["Terra Gateway"]],
];
const MANUAL_ENGLISH_TO_CHINESE_PAIRS = [
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
  ["Bloom", "盛放星"],
];
const WIKI_SHIP_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const PARATRANZ_TERMS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const PARATRANZ_TERMS_PAGE_SIZE = 100;
const PARATRANZ_TERMS_MAX_PAGES = 80;
let WIKI_SHIP_CACHE;
let PARATRANZ_TERMS_CACHE = {
  aliases: undefined,
  expiresAt: 0,
  fetchedAt: undefined,
  promise: undefined,
};
let UEX_TERMINAL_CACHE;

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
  "reference",
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

function getStaticCargoShips() {
  return Array.isArray(ENIGMA_DATA.cargoShips) ? ENIGMA_DATA.cargoShips : [];
}

function cargoShipCompletenessScore(ship) {
  return (
    (ship.imageUrl ? 12 : 0) +
    (ship.nameZh ? 5 : 0) +
    (ship.maxContainerSize ? 3 : 0) +
    (ship.role ? 2 : 0) +
    (ship.size ? 2 : 0) +
    (ship.pledgeUrl ? 2 : 0) +
    (ship.productionState ? 3 : 0) +
    Math.min(12, Math.floor(numberOrZero(ship.cargoScu) / 500))
  );
}

function dedupeCargoShips(ships) {
  const deduped = new Map();

  for (const ship of ships) {
    const key = `${ship.manufacturer}:${ship.name}`.toLowerCase();
    const existing = deduped.get(key);

    if (!existing || cargoShipCompletenessScore(ship) > cargoShipCompletenessScore(existing)) {
      deduped.set(key, { ...ship });
    }
  }

  return Array.from(deduped.values()).sort(
    (left, right) => String(left.manufacturer).localeCompare(String(right.manufacturer)) || String(left.name).localeCompare(String(right.name)),
  );
}

function normalizeCargoShipSearchText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s_\-·・:：,，.。;；'"()[\]（）/]+/g, " ")
    .trim();
}

function scoreCargoShipRecord(ship, query) {
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

function cargoShipStatToSearchRecord(ship) {
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
      `${ship.name} is listed with ${numberOrZero(ship.cargoScu).toLocaleString("en-US")} SCU cargo capacity in StarCitizen.tools Ship cargo stats.`,
    tags: [ship.manufacturer, ship.manufacturerCode, ship.role, ship.size, ship.productionState, ship.nameZh].filter(Boolean),
    stats: {
      Manufacturer: ship.manufacturer,
      Role: ship.role ?? null,
      Size: ship.size ?? null,
      Cargo: `${numberOrZero(ship.cargoScu).toLocaleString("en-US")} SCU`,
      "Production State": ship.productionState ?? null,
    },
    source: ship.source,
  };
}

function searchCargoShipStatsRecords(input) {
  const query = String(input.query ?? "").trim();

  return getStaticCargoShips()
    .map((ship) => ({ ship, score: scoreCargoShipRecord(ship, query) }))
    .filter((item) => item.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        numberOrZero(right.ship.cargoScu) - numberOrZero(left.ship.cargoScu) ||
        String(left.ship.manufacturer).localeCompare(String(right.ship.manufacturer)) ||
        String(left.ship.name).localeCompare(String(right.ship.name)),
    )
    .map((item) => cargoShipStatToSearchRecord(item.ship))
    .filter((record) => matchesFilters(record, input))
    .slice(0, input.limit ?? 25);
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
  const image = Array.isArray(vehicle.images)
    ? vehicle.images.find((candidate) => candidate.thumbnail_url || candidate.original_url)
    : undefined;

  return {
    id: `wiki-vehicle-${sourceRecordId}`,
    type: vehicle.is_vehicle && !vehicle.is_spaceship ? "vehicle" : vehicleType?.toLowerCase().includes("vehicle") ? "vehicle" : "ship",
    slug: vehicle.slug ?? slugify(name),
    name,
    imageUrl: image?.thumbnail_url ?? image?.original_url ?? undefined,
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

  const fetchedAt = new Date();
  let wikiShips = [];

  try {
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

    const seen = new Set();
    wikiShips = pages
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
      });
  } catch {
    wikiShips = [];
  }

  const ships = dedupeCargoShips([...wikiShips, ...getStaticCargoShips()]);

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

function buildWikiSearchUrl(baseUrl, query) {
  const url = new URL(baseUrl);
  url.searchParams.set("search", query);
  return url.toString();
}

function hasCjkText(value) {
  return /[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/u.test(value);
}

function buildSearchEntrySlug(prefix, query) {
  const asciiSlug = query
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${prefix}-${asciiSlug || encodeURIComponent(query).replace(/%/g, "").toLowerCase().slice(0, 48)}`;
}

function makeWikiSearchLinkRecords(query) {
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
        Source: "CitizenWiki CN",
      },
      source: {
        sourceName: "CitizenWiki CN",
        sourceUrl: buildWikiSearchUrl(CITIZENWIKI_SEARCH_URL, query),
        freshness: "unknown",
      },
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
        Source: "StarCitizen.tools",
      },
      source: {
        sourceName: "StarCitizen.tools",
        sourceUrl: buildWikiSearchUrl(STAR_CITIZEN_TOOLS_SEARCH_URL, query),
        freshness: "unknown",
      },
    },
  ];
}

function shouldAppendWikiSearchLinks(input, query, wikiRecordCount) {
  const canShowReference = input.type === "all" || input.type === "reference";

  return Boolean(query) && canShowReference && (hasCjkText(query) || wikiRecordCount === 0 || input.type === "reference");
}

function normalizeLocalizationAliasText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s_\-·・:：,，.。;；'\"()[\]（）]+/g, " ")
    .trim();
}

function findLocalizationAliases(query, limit = 10) {
  const normalizedQuery = normalizeLocalizationAliasText(query);

  if (!normalizedQuery) {
    return [];
  }

  const aliases = Array.isArray(ENIGMA_DATA.localizationAliases) ? ENIGMA_DATA.localizationAliases : [];

  return aliases
    .map((alias) => {
      const zh = normalizeLocalizationAliasText(alias.zh);
      const en = normalizeLocalizationAliasText(alias.en);
      const key = normalizeLocalizationAliasText(alias.key);
      const exact = zh === normalizedQuery || en === normalizedQuery ? 100 : 0;
      const prefix = zh.startsWith(normalizedQuery) || en.startsWith(normalizedQuery) ? 70 : 0;
      const contains = zh.includes(normalizedQuery) || en.includes(normalizedQuery) || key.includes(normalizedQuery) ? 35 : 0;
      const reverseContains = normalizedQuery.includes(zh) || normalizedQuery.includes(en) ? 20 : 0;
      const score = exact || prefix || contains || reverseContains;

      return { alias, score };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.alias.zh.length - right.alias.zh.length)
    .slice(0, limit)
    .map((item) => item.alias);
}

function normalizeRuntimeAliasText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s_\-·・:：,，.。;；'\"()[\]（）]+/g, " ")
    .trim();
}

function normalizeRuntimeAliasLooseText(value) {
  return normalizeRuntimeAliasText(value).replace(/[aeiou]/g, "").replace(/\s+/g, "");
}

function cleanParatranzTermText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}

function hasEnglishText(value) {
  return /[A-Za-z]/u.test(String(value ?? ""));
}

function makeParatranzAlias(term, index = 0, variant) {
  const id = String(term?.id ?? "").trim();
  const en = cleanParatranzTermText(variant ?? term?.term);
  const zh = cleanParatranzTermText(term?.translation);

  if (!id || !en || !zh || !hasEnglishText(en) || !hasCjkText(zh)) {
    return undefined;
  }

  return {
    id: `ptz-${id}${variant ? `-${index}` : ""}`,
    zh,
    en,
    key: `paratranz_term_${id}${variant ? "_variant" : ""}`,
    packageId: "paratranz_terms",
    kind: variant ? "term-variant" : "term",
  };
}

function makeParatranzAliases(terms) {
  const aliases = [];

  for (const term of Array.isArray(terms) ? terms : []) {
    const alias = makeParatranzAlias(term);

    if (alias) {
      aliases.push(alias);
    }

    if (Array.isArray(term?.variants)) {
      term.variants.forEach((variant, index) => {
        const variantAlias = makeParatranzAlias(term, index + 1, variant);

        if (variantAlias) {
          aliases.push(variantAlias);
        }
      });
    }
  }

  return aliases;
}

async function fetchParatranzAliases() {
  const terms = [];
  let pageCount = 1;

  for (let page = 1; page <= Math.min(pageCount, PARATRANZ_TERMS_MAX_PAGES); page += 1) {
    const url = new URL(PARATRANZ_TERMS_API_URL);
    url.searchParams.set("page", String(page));
    url.searchParams.set("pageSize", String(PARATRANZ_TERMS_PAGE_SIZE));

    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "ENIGMA Ledger localization sync",
      },
    });

    if (!response.ok) {
      throw new Error(`ParaTranz terms request failed: ${response.status}`);
    }

    const payload = await response.json();
    const results = Array.isArray(payload?.results) ? payload.results : [];
    terms.push(...results);
    pageCount = Number.isFinite(Number(payload?.pageCount)) ? Number(payload.pageCount) : pageCount;

    if (!results.length) {
      break;
    }
  }

  return makeParatranzAliases(terms);
}

function mergeRuntimeAliasSources(staticAliases, dynamicAliases) {
  const merged = [];
  const seen = new Set();

  for (const alias of [...(dynamicAliases ?? []), ...(staticAliases ?? [])]) {
    const key = `${normalizeRuntimeAliasText(alias.zh)}=>${normalizeRuntimeAliasText(alias.en)}`;

    if (!key.includes("=>") || seen.has(key)) {
      continue;
    }

    seen.add(key);
    merged.push(alias);
  }

  return merged;
}

async function getRuntimeLocalizationAliases(refresh = false) {
  const staticAliases = Array.isArray(ENIGMA_DATA.localizationAliases) ? ENIGMA_DATA.localizationAliases : [];
  const now = Date.now();

  if (!refresh && PARATRANZ_TERMS_CACHE.aliases && PARATRANZ_TERMS_CACHE.expiresAt > now) {
    return mergeRuntimeAliasSources(staticAliases, PARATRANZ_TERMS_CACHE.aliases);
  }

  if (!PARATRANZ_TERMS_CACHE.promise) {
    PARATRANZ_TERMS_CACHE.promise = fetchParatranzAliases()
      .then((aliases) => {
        PARATRANZ_TERMS_CACHE = {
          aliases,
          expiresAt: Date.now() + PARATRANZ_TERMS_CACHE_TTL_MS,
          fetchedAt: new Date().toISOString(),
          promise: undefined,
        };
        return aliases;
      })
      .catch((error) => {
        PARATRANZ_TERMS_CACHE.promise = undefined;
        console.error(error);
        return PARATRANZ_TERMS_CACHE.aliases ?? [];
      });
  }

  const dynamicAliases = await PARATRANZ_TERMS_CACHE.promise;
  return mergeRuntimeAliasSources(staticAliases, dynamicAliases);
}

function findRuntimeLocalizationAliases(query, limit = 10, aliasSource) {
  const normalizedQuery = normalizeRuntimeAliasText(query);
  const looseQuery = normalizeRuntimeAliasLooseText(query);

  if (!normalizedQuery) {
    return [];
  }

  return (Array.isArray(aliasSource) ? aliasSource : [])
    .map((alias) => {
      const zh = normalizeRuntimeAliasText(alias.zh);
      const en = normalizeRuntimeAliasText(alias.en);
      const key = normalizeRuntimeAliasText(alias.key);
      const looseEn = normalizeRuntimeAliasLooseText(alias.en);
      const exact = zh === normalizedQuery || en === normalizedQuery ? 100 : 0;
      const prefix = zh.startsWith(normalizedQuery) || en.startsWith(normalizedQuery) ? 70 : 0;
      const contains = zh.includes(normalizedQuery) || en.includes(normalizedQuery) || key.includes(normalizedQuery) ? 35 : 0;
      const reverseContains = normalizedQuery.includes(zh) || normalizedQuery.includes(en) ? 20 : 0;
      const loose =
        looseQuery.length >= 4 && looseEn.length >= 4 && (looseEn === looseQuery || looseEn.includes(looseQuery) || looseQuery.includes(looseEn))
          ? 18
          : 0;
      const score = exact || prefix || contains || reverseContains || loose;

      return { alias, score };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.alias.zh.length - right.alias.zh.length)
    .slice(0, limit)
    .map((item) => item.alias);
}

function getAliasShipPatch(alias) {
  if (!String(alias.key ?? "").toLowerCase().startsWith("vehicle_name")) {
    return undefined;
  }

  return ALIAS_SHIP_PATCHES[normalizeUexName(alias.en)];
}

function makeLocalizationAliasRecord(alias) {
  const shipPatch = getAliasShipPatch(alias);

  if (shipPatch) {
    return {
      id: `localization-ship-${alias.id}`,
      type: "ship",
      slug: buildSearchEntrySlug("ship", shipPatch.name),
      name: shipPatch.name,
      nameZh: alias.zh,
      imageUrl: shipPatch.imageUrl,
      manufacturer: shipPatch.manufacturer,
      categoryLabel: "Ship / Localization Alias",
      summary: shipPatch.summary,
      tags: [...shipPatch.tags, alias.zh, alias.en, alias.key],
      stats: {
        Manufacturer: shipPatch.manufacturer,
        Role: shipPatch.role,
        Focus: shipPatch.role,
        Size: shipPatch.size,
        Cargo: `${shipPatch.cargoScu} SCU`,
        "Chinese Alias": alias.zh,
        "English Alias": alias.en,
        "Localization Key": alias.key,
        Package: alias.packageId,
      },
      source: {
        sourceName: "RSI Official Store + SC Localization Alias",
        sourceUrl: shipPatch.sourceUrl,
        sourceRecordId: alias.id,
        freshness: "recent",
      },
    };
  }

  if (alias.packageId === "paratranz_terms") {
    return {
      id: `paratranz-${alias.id}`,
      type: "reference",
      slug: `paratranz-${alias.id}`,
      name: alias.en,
      nameZh: alias.zh,
      categoryLabel: "汉化组术语",
      summary: `来自 Paratranz 汉化组公共术语表的中英术语：${alias.zh} -> ${alias.en}。`,
      tags: ["ParaTranz", "汉化组术语", alias.zh, alias.en, alias.key],
      stats: {
        "Chinese Term": alias.zh,
        "English Term": alias.en,
        "Term ID": String(alias.key ?? "").replace("paratranz_term_", ""),
        Source: "ParaTranz project 8340",
      },
      source: {
        sourceName: "ParaTranz Terms",
        sourceUrl: PARATRANZ_TERMS_SOURCE_URL,
        sourceRecordId: alias.id,
        freshness: "recent",
      },
    };
  }

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
      Package: alias.packageId,
    },
    source: {
      sourceName: "SC Localization Alias",
      sourceRecordId: alias.id,
      freshness: "recent",
    },
  };
}

function dedupeLocalizationAliasesByEnglish(aliases) {
  const seen = new Set();
  const deduped = [];

  for (const alias of aliases) {
    const key = normalizeUexName(alias.en);

    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(alias);
  }

  return deduped;
}

function makeLocalizationAliasRecords(aliases, input) {
  return dedupeLocalizationAliasesByEnglish(aliases)
    .map(makeLocalizationAliasRecord)
    .filter((record) => matchesFilters(record, input));
}

function getWikiSearchQueries(query, aliases) {
  const values = [query, ...aliases.map((alias) => alias.en)]
    .map((value) => String(value ?? "").trim())
    .filter((value) => value.length >= 2);

  return Array.from(new Set(values)).slice(0, 5);
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
  const aliasSource = (input.source === "all" || input.source === "wiki") && query.length >= 2 ? await getRuntimeLocalizationAliases() : [];
  const localizationAliases =
    (input.source === "all" || input.source === "wiki") && query.length >= 2 ? findRuntimeLocalizationAliases(query, 10, aliasSource) : [];

  if (input.source === "local") {
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
      const wikiQueries = getWikiSearchQueries(query, localizationAliases);
      const cargoShipRecords = shouldSearchVehicles
        ? dedupeRecords(wikiQueries.flatMap((wikiQuery) => searchCargoShipStatsRecords({ ...input, query: wikiQuery }))).slice(0, input.limit)
        : [];
      const wikiResults = await Promise.allSettled(
        wikiQueries.flatMap((wikiQuery) => [
          searchWikiRecords(wikiQuery),
          shouldSearchVehicles ? searchWikiVehicleRecords(wikiQuery, input.limit) : Promise.resolve([]),
        ]),
      );
      const records = dedupeRecords(wikiResults.flatMap((result) => (result.status === "fulfilled" ? result.value : [])))
        .filter((record) => matchesFilters(record, input))
        .slice(0, input.limit);

      if (!cargoShipRecords.length && !records.length && wikiResults.every((result) => result.status === "rejected")) {
        throw wikiResults[0].reason;
      }

      if (cargoShipRecords.length) {
        providerResults.push({
          provider: "cargo-ship-stats",
          records: cargoShipRecords,
        });
      }

      if (localizationAliases.length) {
        providerResults.push({
          provider: "localization",
          records: makeLocalizationAliasRecords(localizationAliases, input),
        });
      }

      providerResults.push({
        provider: "wiki",
        records,
      });

      if (shouldAppendWikiSearchLinks(input, query, records.length)) {
        providerResults.push({
          provider: "wiki-links",
          records: makeWikiSearchLinkRecords(query).filter((record) => matchesFilters(record, input)),
        });
      }
    } catch (error) {
      if (localizationAliases.length) {
        providerResults.push({
          provider: "localization",
          records: makeLocalizationAliasRecords(localizationAliases, input),
        });
      }

      providerResults.push({
        provider: "wiki",
        records: [],
        error: error instanceof Error ? error.message : "Wiki search failed.",
      });

      if (shouldAppendWikiSearchLinks(input, query, 0)) {
        providerResults.push({
          provider: "wiki-links",
          records: makeWikiSearchLinkRecords(query).filter((record) => matchesFilters(record, input)),
        });
      }
    }
  } else if ((input.source === "all" || input.source === "wiki") && shouldAppendWikiSearchLinks(input, query, 0)) {
    providerResults.push({
      provider: "wiki-links",
      records: makeWikiSearchLinkRecords(query).filter((record) => matchesFilters(record, input)),
    });
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

function normalizeTradeMatchText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function normalizeTradeAliasText(value) {
  return normalizeRuntimeAliasText(value).replace(/\s+/g, " ").trim();
}

function getManualTradeQueryAliases(query) {
  const normalizedQuery = normalizeTradeAliasText(query);

  if (!normalizedQuery) {
    return [];
  }

  const explicitAliases = MANUAL_TRADE_QUERY_ALIAS_PAIRS.find(([alias]) => normalizeTradeAliasText(alias) === normalizedQuery)?.[1] ?? [];
  const englishAlias = MANUAL_ENGLISH_TO_CHINESE_PAIRS.find(
    ([english, chinese]) => normalizeTradeAliasText(english) === normalizedQuery || normalizeTradeAliasText(chinese) === normalizedQuery,
  )?.[0];

  return uniqueStrings([...explicitAliases, englishAlias]);
}

function getManualEnglishToChinese(value) {
  const normalizedValue = normalizeTradeAliasText(value);

  if (!normalizedValue) {
    return undefined;
  }

  return MANUAL_ENGLISH_TO_CHINESE_PAIRS.find(([english]) => normalizeTradeAliasText(english) === normalizedValue)?.[1];
}

function getLooseLocationQueryVariants(query) {
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
    trimmed.replace(/\b(area)(18)\b/gi, "$1 $2"),
  ]).filter((candidate) => normalizeTradeAliasText(candidate) !== normalizeTradeAliasText(trimmed));
}

function levenshteinDistance(left, right) {
  const a = Array.from(left);
  const b = Array.from(right);
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = new Array(b.length + 1).fill(0);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;

    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }

    for (let j = 0; j <= b.length; j += 1) {
      previous[j] = current[j];
    }
  }

  return previous[b.length];
}

function getStaticLocalizationAliases() {
  return Array.isArray(ENIGMA_DATA.localizationAliases) ? ENIGMA_DATA.localizationAliases : [];
}

function scoreTradeAlias(alias, purpose = "any") {
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

  if (String(alias.en ?? "").length <= 48) {
    score += 6;
  }

  if (String(alias.zh ?? "").length <= 18) {
    score += 10;
  } else if (String(alias.zh ?? "").length > 32) {
    score -= 18;
  }

  if (/[\n\r]|https?:\/\//.test(String(alias.zh ?? ""))) {
    score -= 30;
  }

  return score;
}

function getFuzzyTradeAliases(query, purpose = "any", limit = 8) {
  const normalizedQuery = normalizeTradeAliasText(query);

  if (!hasCjkText(normalizedQuery) || Array.from(normalizedQuery).length < 2) {
    return [];
  }

  return getStaticLocalizationAliases()
    .map((alias) => {
      const zh = normalizeTradeAliasText(alias.zh);

      if (!zh || !hasCjkText(zh)) {
        return { alias, score: 0 };
      }

      const distance = levenshteinDistance(normalizedQuery, zh);
      const firstCharBonus = Array.from(normalizedQuery)[0] === Array.from(zh)[0] ? 16 : 0;
      const fuzzyScore = distance <= 3 ? 44 - distance * 8 + firstCharBonus : 0;

      return { alias, score: fuzzyScore ? fuzzyScore + scoreTradeAlias(alias, purpose) : 0 };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || String(left.alias.zh ?? "").length - String(right.alias.zh ?? "").length)
    .slice(0, limit)
    .map((item) => item.alias);
}

function uniqueStrings(values) {
  const seen = new Set();
  const result = [];

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

function getTradeQueryCandidates(query, purpose = "any", limit = 8) {
  const trimmed = String(query ?? "").trim();

  if (!trimmed) {
    return [];
  }

  const aliases = [
    ...findLocalizationAliases(trimmed, limit * 2),
    ...getFuzzyTradeAliases(trimmed, purpose, limit),
  ]
    .map((alias) => ({ alias, score: scoreTradeAlias(alias, purpose) }))
    .sort((left, right) => right.score - left.score || String(left.alias.en ?? "").length - String(right.alias.en ?? "").length)
    .map((item) => item.alias);
  const manualAliases = getManualTradeQueryAliases(trimmed);
  const looseLocationVariants = purpose === "location" ? getLooseLocationQueryVariants(trimmed) : [];

  return uniqueStrings([...manualAliases, trimmed, ...looseLocationVariants, ...aliases.map((alias) => alias.en)]).slice(0, limit);
}

function resolveTradeQuery(query, purpose = "any") {
  return getTradeQueryCandidates(query, purpose, 2)[0] ?? String(query ?? "").trim();
}

function getBestAliasZhForEnglish(value, purpose = "any") {
  const normalizedValue = normalizeTradeAliasText(value);

  if (!normalizedValue) {
    return undefined;
  }

  const manual = getManualEnglishToChinese(value);

  if (manual) {
    return manual;
  }

  const best = getStaticLocalizationAliases()
    .filter((alias) => normalizeTradeAliasText(alias.en) === normalizedValue)
    .map((alias) => ({ alias, score: scoreTradeAlias(alias, purpose) }))
    .sort((left, right) => right.score - left.score || String(left.alias.zh ?? "").length - String(right.alias.zh ?? "").length)[0]?.alias;

  return best?.zh;
}

function localizeCompositeName(value, purpose = "any") {
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

function localizeLocationTrail(value) {
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

  for (const candidate of [trimmed, withoutStation, afterDash, ...getLooseLocationQueryVariants(trimmed), ...getTradeQueryCandidates(trimmed, "location")]) {
    if (candidate) {
      queries.add(candidate);
    }
  }

  return Array.from(queries);
}

function mapUexTerminalToLocationSuggestion(terminal) {
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
    type: terminal.type ?? undefined,
  };
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

function scoreUexTerminalMatch(terminal, query) {
  const normalizedQuery = normalizeUexName(resolveTradeQuery(query, "location") || query);
  const compactQuery = normalizedQuery.replace(/\s+/g, "");
  const candidates = [terminal.displayname, terminal.name, terminal.fullname, terminal.nickname, terminal.code]
    .map((candidate) => normalizeUexName(candidate))
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

function pickFuzzyUexTerminal(terminals, query) {
  return terminals
    .filter(
      (terminal) =>
        terminal?.type === "commodity" &&
        isEnabledFlag(terminal.is_available) &&
        isEnabledFlag(terminal.is_available_live) &&
        isEnabledFlag(terminal.is_visible),
    )
    .map((terminal) => ({ terminal, score: scoreUexTerminalMatch(terminal, query) }))
    .filter((item) => item.score >= 40)
    .sort(
      (left, right) =>
        right.score - left.score ||
        String(left.terminal.displayname ?? left.terminal.name).localeCompare(String(right.terminal.displayname ?? right.terminal.name)),
    )[0]?.terminal;
}

async function fetchAllUexTerminals(env, refresh = false) {
  if (!refresh && UEX_TERMINAL_CACHE && UEX_TERMINAL_CACHE.expiresAt > Date.now()) {
    return UEX_TERMINAL_CACHE.terminals;
  }

  const terminalResponse = await fetchUexResource(env, "terminals");
  const terminals = arrayFromData(terminalResponse.data);

  UEX_TERMINAL_CACHE = {
    expiresAt: Date.now() + UEX_ROUTE_CACHE_TTL_MS,
    terminals,
  };

  return terminals;
}

async function fetchUexOriginTerminal(env, origin) {
  for (const query of buildUexTerminalQueries(origin)) {
    const terminalResponse = await fetchUexResource(env, "terminals", { name: query });
    const originTerminal = pickUexOriginTerminal(arrayFromData(terminalResponse.data), origin);

    if (originTerminal) {
      return originTerminal;
    }
  }

  return pickFuzzyUexTerminal(await fetchAllUexTerminals(env), origin);
}

async function fetchUexTradeLocationSuggestions(env, query, limit = 20) {
  const queries = getTradeQueryCandidates(query, "location", 8);
  const terminalResponses = await Promise.allSettled(
    queries.map((name) => fetchUexResource(env, "terminals", { name })),
  );
  const suggestions = terminalResponses
    .filter((response) => response.status === "fulfilled")
    .flatMap((response) => arrayFromData(response.value.data))
    .filter(
      (terminal) =>
        isEnabledFlag(terminal.is_available) &&
        isEnabledFlag(terminal.is_available_live) &&
        isEnabledFlag(terminal.is_visible),
    )
    .map(mapUexTerminalToLocationSuggestion)
    .filter(Boolean);
  const fuzzySuggestion = query
    ? mapUexTerminalToLocationSuggestion(pickFuzzyUexTerminal(await fetchAllUexTerminals(env), query) ?? {})
    : undefined;
  const seen = new Set();

  return [...(fuzzySuggestion ? [fuzzySuggestion] : []), ...suggestions]
    .sort((left, right) => {
      const typeScore = (value) => (value.type === "commodity" ? 0 : 1);
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
    .slice(0, clampInteger(limit, 20, 1, 50));
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
  const buyTerminal = route.origin_terminal_name ?? route.origin_terminal_code ?? "Unknown buy terminal";
  const sellTerminalName = route.destination_terminal_name ?? route.destination_terminal_code ?? "Unknown sell terminal";
  const sellTerminal = destinationTrail ? `${sellTerminalName} (${destinationTrail})` : sellTerminalName;

  return {
    id: `uex-route-${route.id}`,
    commodity: route.commodity_name,
    commodityZh: localizeCompositeName(route.commodity_name, "commodity"),
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
  const normalizedQuery = normalizeTradeMatchText(query);

  if (!normalizedQuery) {
    return true;
  }

  return fields.some((field) => normalizeTradeMatchText(field).includes(normalizedQuery));
}

function routeMatchesTradeInput(route, input) {
  return (
    routeMatchesText(route, input.origin?.trim(), [
      route.origin,
      route.buyTerminal,
      route.buyTerminalZh ?? "",
      route.originLocation ?? "",
      route.originLocationZh ?? "",
      route.originTerminalName ?? "",
      route.originTerminalCode ?? "",
    ]) &&
    routeMatchesText(route, input.destination?.trim(), [
      route.sellTerminal,
      route.sellTerminalZh ?? "",
      route.destinationLocation ?? "",
      route.destinationLocationZh ?? "",
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

function getCycleRouteLabel(legCount) {
  if (legCount <= 2) {
    return "2 次停泊往返航线";
  }

  if (legCount === 3) {
    return "3 次停泊三角航线";
  }

  if (legCount === 4) {
    return "4 次停泊四角航线";
  }

  if (legCount === 5) {
    return "5 次停泊五角航线";
  }

  if (legCount === 6) {
    return "6 次停泊六角航线";
  }

  return `${legCount} 次停泊多角航线`;
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
  const routeKind = calculatedLegs.length === 3 ? "triangle" : "cycle";

  return {
    ...firstLeg,
    id: `${routeKind}-${calculatedLegs.map((leg) => leg.id).join("-")}`,
    commodity: calculatedLegs.map((leg) => leg.commodity).join(" -> "),
    commodityZh: calculatedLegs.map((leg) => leg.commodityZh ?? leg.commodity).join(" -> "),
    sellTerminal: calculatedLegs[calculatedLegs.length - 1]?.sellTerminal ?? firstLeg.sellTerminal,
    sellTerminalZh: calculatedLegs[calculatedLegs.length - 1]?.sellTerminalZh,
    destinationTerminalId: calculatedLegs[calculatedLegs.length - 1]?.destinationTerminalId,
    destinationTerminalCode: calculatedLegs[calculatedLegs.length - 1]?.destinationTerminalCode,
    destinationTerminalName: calculatedLegs[calculatedLegs.length - 1]?.destinationTerminalName,
    destinationTerminalSlug: calculatedLegs[calculatedLegs.length - 1]?.destinationTerminalSlug,
    destinationLocation: calculatedLegs[calculatedLegs.length - 1]?.destinationLocation,
    destinationLocationZh: calculatedLegs[calculatedLegs.length - 1]?.destinationLocationZh,
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
    routePlanLabel: getCycleRouteLabel(calculatedLegs.length),
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
  const stopCount = clampInteger(input.stopCount, 2, 2, 6);
  const firstLegDestination =
    input.destination && !isSameTradeEndpoint(input.origin, input.destination) ? resolveTradeQuery(input.destination, "location") : undefined;
  const leg1Candidates = calculateTradeRoutes(
    {
      destination: firstLegDestination,
      cargoScu: input.cargoScu,
      budgetUec,
      limit: 24,
      routeMode: input.routeMode,
      containerSize: input.containerSize,
    },
    originRoutes.routes,
  ).filter((route) => route.destinationTerminalId);
  const plans = [];
  let upstreamCount = originRoutes.routes.length;
  let paths = leg1Candidates.slice(0, 12).map((route) => [route]);

  for (let legIndex = 2; legIndex <= stopCount && paths.length; legIndex += 1) {
    const terminalRequests = new Map();

    for (const path of paths) {
      const lastLeg = path.at(-1);
      const terminalId = lastLeg?.destinationTerminalId;

      if (!terminalId) {
        continue;
      }

      const request = terminalRequests.get(terminalId) ?? {
        label: lastLeg.destinationTerminalName ?? lastLeg.sellTerminal,
        paths: [],
      };

      request.paths.push(path);
      terminalRequests.set(terminalId, request);
    }

    const routeResults = await Promise.allSettled(
      Array.from(terminalRequests.entries()).map(async ([terminalId, request]) => ({
        terminalId,
        result: await fetchUexTradeRoutesByTerminalId(env, terminalId, request.label, input.refresh),
      })),
    );
    const routeResultByTerminal = new Map(
      routeResults.filter((result) => result.status === "fulfilled").map((result) => [result.value.terminalId, result.value.result]),
    );
    const nextPaths = [];
    const isFinalLeg = legIndex === stopCount;

    for (const [terminalId, request] of terminalRequests) {
      const routeResult = routeResultByTerminal.get(terminalId);

      if (!routeResult) {
        continue;
      }

      upstreamCount += routeResult.routes.length;

      for (const path of request.paths) {
        const currentBudget = budgetUec + path.reduce((sum, leg) => sum + leg.totalProfit, 0);
        const visitedTerminalIds = new Set(path.map((leg) => leg.destinationTerminalId).filter(Boolean));
        const candidates = calculateTradeRoutes(
          {
            cargoScu: input.cargoScu,
            budgetUec: currentBudget,
            limit: isFinalLeg ? 12 : 8,
            routeMode: input.routeMode,
            containerSize: input.containerSize,
          },
          routeResult.routes,
        )
          .filter((route) =>
            isFinalLeg
              ? routeReturnsToOrigin(route, input.origin, originRoutes.originTerminal)
              : Boolean(route.destinationTerminalId) &&
                !visitedTerminalIds.has(route.destinationTerminalId) &&
                !routeReturnsToOrigin(route, input.origin, originRoutes.originTerminal),
          )
          .slice(0, isFinalLeg ? 3 : 4);

        for (const nextLeg of candidates) {
          const nextPath = [...path, nextLeg];

          if (isFinalLeg) {
            const plan = calculateTradeRoutePlan(nextPath, input);

            if (plan) {
              plans.push(plan);
            }
          } else {
            nextPaths.push(nextPath);
          }
        }
      }
    }

    paths = nextPaths
      .sort((left, right) => right.reduce((sum, leg) => sum + leg.totalProfit, 0) - left.reduce((sum, leg) => sum + leg.totalProfit, 0))
      .slice(0, 48);
  }

  return {
    routes: dedupeRoutePlans(plans)
      .sort((left, right) => right.totalProfit - left.totalProfit)
      .slice(0, requestedLimit),
    source: "uex-loop",
    upstreamCount,
    planMode: "loop",
    stopCount,
    warning: plans.length ? undefined : `No profitable ${stopCount}-stop loop route found for the selected origin, budget, cargo, mode, and box size.`,
  };
}

async function resolveTradeRoutes(env, input, provider) {
  if (provider !== "sample") {
    try {
      const stopCount = clampInteger(input.stopCount, 1, 1, 6);
      const shouldPlanLoop =
        stopCount >= 2 || isSameTradeEndpoint(resolveTradeQuery(input.origin, "location"), resolveTradeQuery(input.destination, "location"));

      if (shouldPlanLoop) {
        return await resolveUexLoopRoutes(env, {
          ...input,
          stopCount: stopCount >= 2 ? stopCount : 3,
        });
      }

      const uex = await fetchUexTradeRoutes(env, input.origin, input.refresh);
      const destination = resolveTradeQuery(input.destination, "location");
      const routes = calculateTradeRoutes(
        {
          destination,
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
        stopCount: 1,
      };
    } catch (error) {
      if (provider === "uex") {
        throw error;
      }

      return {
        routes: calculateTradeRoutes(input),
        source: "sample",
        planMode: "direct",
        stopCount: input.stopCount,
        warning: "UEX API unavailable; using ENIGMA sample trade routes.",
      };
    }
  }

  return {
    routes: calculateTradeRoutes(input),
    source: "sample",
    planMode: "direct",
    stopCount: input.stopCount,
  };
}

function fallbackTradeLocationSuggestions(query, limit) {
  return getTradeQueryCandidates(query, "location", clampInteger(limit, 20, 1, 50)).map((candidate, index) => ({
    id: -1 - index,
    name: candidate,
    displayName: candidate,
    type: "alias",
  }));
}

async function handleTradeLocationsApi(request, env, url) {
  if (request.method !== "GET") {
    return jsonResponse({ error: "Method not allowed." }, { status: 405, headers: { allow: "GET" } });
  }

  const rateLimit = rateLimitRequest(request, "trade-locations", 120, 60);

  if (!rateLimit.allowed) {
    return jsonResponse(
      { error: "Too many trade location requests." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
        },
      },
    );
  }

  const query = String(url.searchParams.get("q") ?? "").trim().slice(0, 120);
  const limit = clampInteger(url.searchParams.get("limit"), 20, 1, 50);

  try {
    const data = await fetchUexTradeLocationSuggestions(env, query, limit);

    return jsonResponse({
      data,
      meta: {
        count: data.length,
        source: "uex",
        rateLimit: {
          limit: rateLimit.limit,
          remaining: rateLimit.remaining,
          resetAt: new Date(rateLimit.resetAt).toISOString(),
        },
      },
    });
  } catch (error) {
    const data = fallbackTradeLocationSuggestions(query, limit);

    return jsonResponse({
      data,
      meta: {
        count: data.length,
        source: "localization",
        warning: error instanceof Error ? error.message : "UEX location lookup unavailable.",
      },
    });
  }
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
    stopCount: url.searchParams.get("stopCount"),
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
      stopCount: routeResolution.stopCount,
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

  if (url.pathname === "/api/trade/locations") {
    return handleTradeLocationsApi(request, env, url);
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
  async scheduled(_event, _env, ctx) {
    ctx.waitUntil(getRuntimeLocalizationAliases(true));
  },

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
