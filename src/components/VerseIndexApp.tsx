"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { mockRecords } from "@/lib/mock-data";
import { calculateTradeRoutes } from "@/lib/trade";
import { dataSourceCatalog, type DataSourceCatalogItem } from "@/lib/sources/catalog";
import type {
  CalculatedTradeRoute,
  CargoShipRecord,
  EntityTypeFilter,
  FreshnessFilter,
  SearchRecord,
  TradeRouteMode
} from "@/lib/types";

const DEFAULT_TRADE_ORIGIN = "Seraphim Station";
const ROUTE_RESULT_LIMIT = 80;

const typeOptions: Array<{ value: EntityTypeFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "ship", label: "舰船" },
  { value: "vehicle", label: "载具" },
  { value: "component", label: "组件" },
  { value: "weapon", label: "武器" },
  { value: "armor", label: "护甲" },
  { value: "equipment", label: "装备" },
  { value: "commodity", label: "商品" },
  { value: "location", label: "地点" },
  { value: "shop", label: "商店" }
];

const freshnessOptions: Array<{ value: FreshnessFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "fresh", label: "Fresh" },
  { value: "recent", label: "Recent" },
  { value: "stale", label: "Stale" },
  { value: "unknown", label: "Unknown" }
];

type ActivePanel = "index" | "trade" | "starmap" | "network";

const navTabs: Array<{ value: ActivePanel; label: string }> = [
  { value: "index", label: "索引" },
  { value: "trade", label: "贸易" },
  { value: "starmap", label: "星图" },
  { value: "network", label: "网络" }
];

const routeModeOptions: Array<{ value: TradeRouteMode; label: string }> = [
  { value: "mixed", label: "混合运输" },
  { value: "space", label: "纯太空" }
];

const containerSizeOptions = [0, 1, 2, 4, 8, 16, 24, 32];

const tradeLocationSuggestions = [
  "Seraphim Station",
  "Area18",
  "Lorville",
  "New Babbage",
  "Port Tressler",
  "Everus Harbor",
  "Baijini Point",
  "Grim HEX",
  "Pyro Gateway (Stanton)",
  "Stanton Gateway (Pyro)",
  "Levski"
];

const verseGuideMaps = [
  {
    id: "stanton",
    label: "Stanton",
    url: "https://verseguide.com/location/STANTON",
    summary: "Crusader, Hurston, ArcCorp, microTech and the active trade core of ENIGMA operations."
  },
  {
    id: "pyro",
    label: "Pyro",
    url: "https://verseguide.com/location/PYRO",
    summary: "Frontier routes, contested infrastructure, and long-range logistics planning."
  },
  {
    id: "nyx",
    label: "Nyx",
    url: "https://verseguide.com/location/NYX",
    summary: "Austere frontier navigation reference for future exploration and supply routes."
  }
] as const;

const typeLabels: Record<string, string> = {
  ship: "舰船",
  vehicle: "载具",
  component: "组件",
  weapon: "武器",
  armor: "护甲",
  equipment: "装备",
  commodity: "商品",
  location: "地点",
  shop: "商店",
  manufacturer: "制造商"
};

interface SearchApiResponse {
  data: SearchRecord[];
  meta: {
    count: number;
    source: string;
    providers?: Array<{
      id: string;
      count: number;
      error?: string;
    }>;
  };
}

interface TradeApiResponse {
  data: CalculatedTradeRoute[];
  meta: {
    count: number;
    source: string;
    upstreamCount?: number;
    planMode?: "direct" | "loop";
    warning?: string;
  };
}

interface ShipCatalogApiResponse {
  data: CargoShipRecord[];
  meta: {
    count: number;
    source: string;
    warning?: string;
  };
}

interface SourcesApiResponse {
  data: DataSourceCatalogItem[];
  meta: {
    count: number;
  };
}

interface SourceFootnote {
  index: number;
  key: string;
  sourceName: string;
  sourceUrl?: string;
  gameVersion?: string;
  sourceUpdatedAt?: string;
  freshness: string;
}

type RouteRecommendationKind = "profit" | "hot" | "stable";

interface RouteRecommendation {
  kind: RouteRecommendationKind;
  title: string;
  badge: string;
  route?: CalculatedTradeRoute;
  score: number;
  scoreLabel: string;
  reason: string;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatSearchSourceLabel(source: string): string {
  if (!source || source === "none") {
    return "external index ready";
  }

  return source
    .split("+")
    .filter((provider) => provider !== "local")
    .map((provider) => {
      if (provider === "wiki") {
        return "Star Citizen Wiki API";
      }

      if (provider === "database") {
        return "database";
      }

      return provider;
    })
    .join(" + ") || "external index ready";
}

function buildSourceKey(record: SearchRecord): string {
  return [
    record.source.sourceName,
    record.source.sourceUrl ?? "",
    record.source.gameVersion ?? "",
    record.source.sourceUpdatedAt ?? "",
    record.source.freshness
  ].join("|");
}

function formatSourceDetail(source: SourceFootnote): string {
  return [source.gameVersion, source.sourceUpdatedAt ? `Updated ${source.sourceUpdatedAt}` : undefined, source.freshness]
    .filter(Boolean)
    .join(" · ");
}

function getRecordCategoryLabel(record: SearchRecord): string {
  return record.categoryLabel ?? typeLabels[record.type] ?? record.type;
}

function SourceBlock({ record }: { record: SearchRecord }) {
  return (
    <div className="source-row">
      <span>{record.source.sourceName}</span>
      {record.source.gameVersion ? <span>{record.source.gameVersion}</span> : null}
      {record.source.sourceUpdatedAt ? <span>Updated {record.source.sourceUpdatedAt}</span> : null}
      <span className={`freshness ${record.source.freshness}`}>{record.source.freshness}</span>
    </div>
  );
}

function isExternalRecord(record: SearchRecord): boolean {
  return record.source.sourceName === "Star Citizen Wiki API" && Boolean(record.source.sourceUrl);
}

function DetailPanel({ record }: { record: SearchRecord | undefined }) {
  if (!record) {
    return (
      <aside className="detail-panel">
        <p className="eyebrow">SELECTED RECORD</p>
        <h2>ENIGMA Ledger</h2>
        <p>选择一条记录查看来源、版本、新鲜度和关键属性。</p>
      </aside>
    );
  }

  return (
    <aside className="detail-panel">
      <p className="eyebrow">
        {getRecordCategoryLabel(record)} - {record.source.sourceName}
      </p>
      <h2>{record.name}</h2>
      <p>
        {record.nameZh ? `${record.nameZh} - ` : ""}
        {record.summary}
      </p>

      <div className="detail-stats">
        {Object.entries(record.stats).map(([key, value]) => (
          <div key={key}>
            <span>{key}</span>
            <strong>{value ?? "Unknown"}</strong>
          </div>
        ))}
      </div>

      <SourceBlock record={record} />
    </aside>
  );
}

type VerseGuideMap = (typeof verseGuideMaps)[number];

interface StarMapSelectionProps {
  selectedMapId: VerseGuideMap["id"];
  onSelectMap: (mapId: VerseGuideMap["id"]) => void;
}

function getSelectedVerseGuideMap(selectedMapId: VerseGuideMap["id"]): VerseGuideMap {
  return verseGuideMaps.find((map) => map.id === selectedMapId) ?? verseGuideMaps[0];
}

function VerseGuideFrame({ className, map }: { className: string; map: VerseGuideMap }) {
  return (
    <section className={className} aria-label={`${map.label} starmap`}>
      <iframe
        allow="fullscreen"
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        sandbox="allow-forms allow-popups allow-same-origin allow-scripts"
        src={map.url}
        title={`VerseGuide ${map.label} starmap`}
      />
    </section>
  );
}

function SystemSwitcher({ selectedMapId, onSelectMap }: StarMapSelectionProps) {
  const selectedMap = getSelectedVerseGuideMap(selectedMapId);

  return (
    <div className="system-switcher" aria-label="VerseGuide systems">
      {verseGuideMaps.map((map) => (
        <button
          className={selectedMap.id === map.id ? "active" : ""}
          key={map.id}
          type="button"
          onClick={() => onSelectMap(map.id)}
        >
          {map.label}
        </button>
      ))}
    </div>
  );
}

function InlineStarMap({
  selectedMapId,
  onExpand
}: Pick<StarMapSelectionProps, "selectedMapId"> & { onExpand: () => void }) {
  const selectedMap = getSelectedVerseGuideMap(selectedMapId);

  return (
    <section className="inline-starmap-panel">
      <header>
        <div>
          <p className="eyebrow">VERSEGUIDE STARMAP</p>
          <h2>{selectedMap.label} 星图</h2>
        </div>
        <button className="ghost-button" type="button" onClick={onExpand}>
          全屏
        </button>
      </header>

      <VerseGuideFrame className="inline-starmap-frame" map={selectedMap} />
    </section>
  );
}

function StarMapOverlay({
  selectedMapId,
  onClose,
  onSelectMap
}: StarMapSelectionProps & { onClose: () => void }) {
  const selectedMap = getSelectedVerseGuideMap(selectedMapId);

  return (
    <div className="starmap-modal-backdrop">
      <section className="starmap-modal" role="dialog" aria-modal="true" aria-label="VerseGuide fullscreen starmap">
        <header>
          <div>
            <p className="eyebrow">VERSEGUIDE STARMAP</p>
            <h2>{selectedMap.label}</h2>
          </div>
          <div className="starmap-modal-actions">
            <a className="ghost-button starmap-link" href={selectedMap.url} rel="noreferrer" target="_blank">
              Open
            </a>
            <button className="ghost-button" type="button" onClick={onClose}>
              关闭
            </button>
          </div>
        </header>

        <VerseGuideFrame className="starmap-modal-frame" map={selectedMap} />
        <SystemSwitcher selectedMapId={selectedMapId} onSelectMap={onSelectMap} />
      </section>
    </div>
  );
}

function StarMapPanel({ selectedMapId, onSelectMap }: StarMapSelectionProps) {
  const selectedMap = getSelectedVerseGuideMap(selectedMapId);

  return (
    <section className="starmap-panel">
      <div className="heading-row starmap-heading">
        <div>
          <p className="eyebrow">VERSEGUIDE STARMAP</p>
          <h1>星图导航</h1>
        </div>
        <a className="ghost-button starmap-link" href={selectedMap.url} rel="noreferrer" target="_blank">
          Open VerseGuide
        </a>
      </div>

      <div className="starmap-grid">
        <VerseGuideFrame className="starmap-frame-shell" map={selectedMap} />

        <aside className="starmap-sidebar">
          <SystemSwitcher selectedMapId={selectedMapId} onSelectMap={onSelectMap} />

          <article className="starmap-source-card">
            <span>Current Map</span>
            <h2>{selectedMap.label}</h2>
            <p>{selectedMap.summary}</p>
            <div className="source-row">
              <span>Source: VerseGuide</span>
              <span>Embedded</span>
            </div>
          </article>

          <article className="starmap-source-card">
            <span>Location Search</span>
            <h2>VerseGuide Search</h2>
            <p>Open VerseGuide's own location search for surface points, facilities, stations, and navigation targets.</p>
            <a href="https://verseguide.com/search" rel="noreferrer" target="_blank">
              Open Search
            </a>
          </article>
        </aside>
      </div>
    </section>
  );
}

function readStat(record: SearchRecord | undefined, key: string): string | undefined {
  const value = record?.stats[key];

  if (value === null || value === undefined) {
    return undefined;
  }

  return String(value);
}

function extractCargoScu(record: SearchRecord | undefined): number {
  const cargo = readStat(record, "Cargo");
  const match = cargo?.match(/\d+(?:\.\d+)?/);

  return match ? Math.floor(Number(match[0])) : 0;
}

function normalizeCatalogKey(value: string | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function manufacturerCodeFromName(manufacturer: string | undefined): string {
  const normalized = normalizeCatalogKey(manufacturer);
  const known: Record<string, string> = {
    "aegis dynamics": "AEGS",
    "anvil aerospace": "ANVL",
    "argo astronautics": "ARGO",
    "consolidated outland": "CNOU",
    "crusader industries": "CRSD",
    "drake interplanetary": "DRAK",
    "esperia": "ESPR",
    "gatac manufacture": "GAMA",
    "kruger intergalactic": "KRIG",
    "misc": "MISC",
    "mirai": "MRAI",
    "musashi industrial and starflight concern": "MISC",
    "origin jumpworks": "ORIG",
    "roberts space industries": "RSI",
    "tumbril land systems": "TMBL"
  };

  return known[normalized] ?? manufacturer?.match(/\b[A-Z0-9]/g)?.join("").slice(0, 4) ?? "MFG";
}

function mapSearchRecordToCargoShip(record: SearchRecord): CargoShipRecord | undefined {
  const cargoScu = extractCargoScu(record);

  if (record.type !== "ship" || cargoScu <= 0) {
    return undefined;
  }

  const manufacturer = record.manufacturer ?? readStat(record, "Manufacturer") ?? "Unknown";

  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    manufacturer,
    manufacturerCode: manufacturerCodeFromName(manufacturer),
    role: readStat(record, "Role") ?? readStat(record, "Focus"),
    size: readStat(record, "Size"),
    cargoScu,
    source: record.source
  };
}

function mergeCargoShipOptions(...shipGroups: CargoShipRecord[][]): CargoShipRecord[] {
  const seen = new Set<string>();
  const ships: CargoShipRecord[] = [];

  for (const ship of shipGroups.flat()) {
    const key = normalizeCatalogKey(ship.name);

    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    ships.push(ship);
  }

  return ships.sort((left, right) => left.manufacturer.localeCompare(right.manufacturer) || left.name.localeCompare(right.name));
}

function groupShipsByManufacturer(ships: CargoShipRecord[]): Array<{ manufacturer: string; ships: CargoShipRecord[] }> {
  const groups = new Map<string, CargoShipRecord[]>();

  for (const ship of ships) {
    const manufacturer = ship.manufacturer || "Unknown";
    groups.set(manufacturer, [...(groups.get(manufacturer) ?? []), ship]);
  }

  return Array.from(groups.entries())
    .map(([manufacturer, groupShips]) => ({
      manufacturer,
      ships: groupShips.sort((left, right) => left.name.localeCompare(right.name))
    }))
    .sort((left, right) => left.manufacturer.localeCompare(right.manufacturer));
}

function getShipCargoScu(ship: CargoShipRecord | undefined): number {
  return Math.max(0, Math.floor(Number(ship?.cargoScu ?? 0)));
}

function getShipRole(ship: CargoShipRecord | undefined): string {
  return ship?.role ?? "Unknown";
}

function buildShipTasks(ship: CargoShipRecord | undefined, cargoScu: number): string[] {
  const role = getShipRole(ship).toLowerCase();
  const name = ship?.name.toLowerCase() ?? "";

  if (role.includes("mining")) {
    return ["采矿合同", "精炼转运", "矿区护航"];
  }

  if (role.includes("salvage")) {
    return ["打捞合同", "RMC 转运", "残骸搜索"];
  }

  if (role.includes("fighter") || cargoScu <= 0) {
    return ["护航任务", "赏金任务", "地堡支援"];
  }

  if (name.includes("hull")) {
    return ["纯太空贸易", "轨道港补给", "大箱型货运"];
  }

  if (cargoScu >= 500) {
    return ["大宗贸易", "舰队补给", "高容量运输"];
  }

  if (cargoScu >= 100) {
    return ["中型跑商", "稳定补给", "城市 TDD 出货"];
  }

  if (cargoScu >= 40) {
    return ["小队运输", "高价值轻货", "前哨补给"];
  }

  return ["轻量快递", "样品运输", "侦察补给"];
}

function getRouteModeLabel(routeMode: TradeRouteMode): string {
  return routeModeOptions.find((option) => option.value === routeMode)?.label ?? routeMode;
}

function getRouteStationMode(route: CalculatedTradeRoute): string {
  if (route.originIsGround || route.destinationIsGround) {
    return "含地面站";
  }

  if (route.originIsSpaceStation && route.destinationIsSpaceStation) {
    return "全太空";
  }

  return "站点类型未公开";
}

function formatContainerSizes(route: CalculatedTradeRoute): string {
  if (!route.containerSizes?.length) {
    return "箱型未公开";
  }

  return `${route.containerSizes.join(" / ")} SCU`;
}

function getRouteKindLabel(route: CalculatedTradeRoute): string {
  return route.routePlanLabel ?? (route.routeKind === "direct" ? "单段航线" : "循环航线");
}

function formatRoutePath(route: CalculatedTradeRoute): string {
  if (route.legs?.length) {
    const terminals = [route.legs[0]?.buyTerminal, ...route.legs.map((leg) => leg.destinationTerminalName ?? leg.sellTerminal)]
      .filter((terminal): terminal is string => Boolean(terminal));

    return terminals.join(" -> ");
  }

  return `${route.buyTerminal} -> ${route.sellTerminal}`;
}

function getRouteLegCount(route: CalculatedTradeRoute): number {
  return route.legs?.length ?? 1;
}

function getRiskScore(route: CalculatedTradeRoute): number {
  if (route.risk === "Low") {
    return 18;
  }

  if (route.risk === "Medium") {
    return 8;
  }

  return -18;
}

function getFreshnessScore(route: CalculatedTradeRoute): number {
  if (route.source.freshness === "fresh") {
    return 8;
  }

  if (route.source.freshness === "recent") {
    return 5;
  }

  if (route.source.freshness === "stale") {
    return 1;
  }

  return 0;
}

function getStationScore(route: CalculatedTradeRoute): number {
  if (route.originIsSpaceStation && route.destinationIsSpaceStation) {
    return 8;
  }

  if (route.originIsGround || route.destinationIsGround) {
    return 3;
  }

  return 4;
}

function getSupplyCoverage(route: CalculatedTradeRoute, cargoScu: number): number {
  if (typeof route.availableScu !== "number" || !Number.isFinite(route.availableScu)) {
    return 0.75;
  }

  return Math.min(1.5, route.availableScu / Math.max(1, cargoScu));
}

function getRiskLabel(risk: CalculatedTradeRoute["risk"]): string {
  if (risk === "Low") {
    return "低风险";
  }

  if (risk === "Medium") {
    return "中风险";
  }

  return "高风险";
}

function scoreStableRoute(route: CalculatedTradeRoute, cargoScu: number): number {
  const margin = typeof route.marginPercent === "number" ? route.marginPercent : 0;
  const supplyScore = Math.min(16, getSupplyCoverage(route, cargoScu) * 10);
  const containerScore = route.containerSizes?.length ? 3 : 0;
  const legPenalty = Math.max(0, getRouteLegCount(route) - 1) * 0.75;

  return getRiskScore(route) + getFreshnessScore(route) + getStationScore(route) + supplyScore + Math.min(10, margin / 2) + containerScore - legPenalty;
}

function scoreHotRoute(route: CalculatedTradeRoute, cargoScu: number): number {
  const routeScore = typeof route.score === "number" ? route.score / 10 : 0;
  const margin = typeof route.marginPercent === "number" ? route.marginPercent : 0;
  const cargoFit = Math.min(8, route.purchasableScu / Math.max(1, cargoScu) * 8);

  return routeScore + Math.log10(Math.max(1, route.totalProfit)) * 6 + margin * 0.8 + getFreshnessScore(route) * 2 + cargoFit;
}

function pickRoute(
  routes: CalculatedTradeRoute[],
  usedRouteIds: Set<string>,
  scoreRoute: (route: CalculatedTradeRoute) => number
): { route?: CalculatedTradeRoute; score: number } {
  const scored = routes
    .map((route) => ({ route, score: scoreRoute(route) }))
    .sort((left, right) => right.score - left.score);
  const next = scored.find((item) => !usedRouteIds.has(item.route.id)) ?? scored[0];

  if (!next) {
    return { score: 0 };
  }

  usedRouteIds.add(next.route.id);

  return next;
}

function buildRecommendationReason(kind: RouteRecommendationKind, route: CalculatedTradeRoute, cargoScu: number): string {
  const supplyCoverage = getSupplyCoverage(route, cargoScu);
  const stationMode = getRouteStationMode(route);
  const containerText = route.containerSizes?.length ? `${formatContainerSizes(route)} 箱型` : "箱型未公开";

  if (kind === "stable") {
    return `${getRiskLabel(route.risk)}，${stationMode}，${supplyCoverage >= 1 ? "供应量够装满当前货仓" : "按可买货量部分装载"}，${containerText}。`;
  }

  if (kind === "hot") {
    return `综合 UEX 评分、利润密度、数据新鲜度和 ${formatNumber(cargoScu)} SCU 货仓匹配度。`;
  }

  return `当前筛选下预计总利润最高，按 ${formatNumber(route.purchasableScu)} SCU 装载计算。`;
}

function buildRouteRecommendations(routes: CalculatedTradeRoute[], cargoScu: number): RouteRecommendation[] {
  const usedRouteIds = new Set<string>();
  const stable = pickRoute(routes, usedRouteIds, (route) => scoreStableRoute(route, cargoScu));
  const hot = pickRoute(routes, usedRouteIds, (route) => scoreHotRoute(route, cargoScu));
  const profit = pickRoute(routes, usedRouteIds, (route) => route.totalProfit);
  const recommendations: Array<Omit<RouteRecommendation, "reason">> = [
    {
      kind: "stable",
      title: "稳定挣钱",
      badge: "LOW RISK",
      route: stable.route,
      score: stable.score,
      scoreLabel: stable.route ? getRiskLabel(stable.route.risk) : "暂无"
    },
    {
      kind: "hot",
      title: "热门优选",
      badge: "HOT PICK",
      route: hot.route,
      score: hot.score,
      scoreLabel: hot.route ? "综合优选" : "暂无"
    },
    {
      kind: "profit",
      title: "最高利润",
      badge: "MAX PROFIT",
      route: profit.route,
      score: profit.score,
      scoreLabel: profit.route ? `${formatNumber(profit.route.totalProfit)} UEC` : "暂无"
    }
  ];

  return recommendations.map((recommendation) => ({
    ...recommendation,
    reason: recommendation.route
      ? buildRecommendationReason(recommendation.kind, recommendation.route, cargoScu)
      : "当前飞船、预算、起点、终点、运输模式和箱型限制下暂无可盈利路线。"
  }));
}

function NewPlayerRouteGuide({
  budgetUec,
  cargoScu,
  routeMode,
  routePlanMode,
  routeSource,
  routes,
  selectedShip
}: {
  budgetUec: number;
  cargoScu: number;
  routeMode: TradeRouteMode;
  routePlanMode: "direct" | "loop";
  routeSource: string;
  routes: CalculatedTradeRoute[];
  selectedShip: CargoShipRecord | undefined;
}) {
  const recommendations = buildRouteRecommendations(routes, cargoScu);

  return (
    <section className="new-player-guide" aria-label="New player route recommendations">
      <div className="recommendation-head">
        <div>
          <p className="eyebrow">NEW PILOT ROUTES</p>
          <h2>新玩家路线推荐</h2>
        </div>
        <div className="recommendation-context">
          <span>{selectedShip?.name ?? "No ship"}</span>
          <span>{formatNumber(cargoScu)} SCU</span>
          <span>{formatNumber(budgetUec)} UEC</span>
          <span>{routePlanMode === "loop" ? "Triangle / Loop" : "Direct"}</span>
          <span>{getRouteModeLabel(routeMode)}</span>
        </div>
      </div>

      <div className="new-player-card-grid">
        {recommendations.map((recommendation) => {
          const route = recommendation.route;

          return (
            <article className={`new-player-card ${recommendation.kind}`} key={recommendation.kind}>
              <header>
                <div>
                  <span className="recommendation-kicker">{recommendation.badge}</span>
                  <h3>{recommendation.title}</h3>
                </div>
                <strong>{recommendation.scoreLabel}</strong>
              </header>

              {route ? (
                <>
                  <p className="recommendation-path">{formatRoutePath(route)}</p>
                  <div className="recommendation-commodity">{route.commodity}</div>
                  <div className="recommendation-stats">
                    <div>
                      <span>Profit</span>
                      <strong>{formatNumber(route.totalProfit)} UEC</strong>
                    </div>
                    <div>
                      <span>Load</span>
                      <strong>{formatNumber(route.purchasableScu)} SCU</strong>
                    </div>
                    <div>
                      <span>ROI</span>
                      <strong>{typeof route.marginPercent === "number" ? `${route.marginPercent.toFixed(1)}%` : "N/A"}</strong>
                    </div>
                  </div>
                  <p className="recommendation-reason">{recommendation.reason}</p>
                  <div className="source-row recommendation-source">
                    {route.source.sourceUrl ? (
                      <a href={route.source.sourceUrl} rel="noreferrer" target="_blank">
                        {route.source.sourceName}
                      </a>
                    ) : (
                      <span>{route.source.sourceName}</span>
                    )}
                    <span>{getRouteKindLabel(route)}</span>
                    <span>{route.source.freshness}</span>
                  </div>
                </>
              ) : (
                <p className="recommendation-reason">{recommendation.reason}</p>
              )}
            </article>
          );
        })}
      </div>

      <div className="recommendation-footnote">
        <span>Source {routeSource}</span>
        <span>稳定挣钱优先低风险、供应量、站点类型、数据新鲜度和公开箱型。</span>
      </div>
    </section>
  );
}

function PilotShipPanel({
  budgetUec,
  cargoScu,
  containerSize,
  destination,
  onBudgetChange,
  onCargoChange,
  onContainerSizeChange,
  onDestinationChange,
  onOpenTrade,
  onOriginChange,
  onRouteModeChange,
  onShipChange,
  origin,
  routeMode,
  routes,
  selectedShip,
  shipCatalogSource,
  shipOptions
}: {
  budgetUec: number;
  cargoScu: number;
  containerSize: number;
  destination: string;
  onBudgetChange: (value: number) => void;
  onCargoChange: (value: number) => void;
  onContainerSizeChange: (value: number) => void;
  onDestinationChange: (value: string) => void;
  onOpenTrade: () => void;
  onOriginChange: (value: string) => void;
  onRouteModeChange: (value: TradeRouteMode) => void;
  onShipChange: (shipId: string) => void;
  origin: string;
  routeMode: TradeRouteMode;
  routes: CalculatedTradeRoute[];
  selectedShip: CargoShipRecord | undefined;
  shipCatalogSource: string;
  shipOptions: CargoShipRecord[];
}) {
  const shipCargoScu = getShipCargoScu(selectedShip);
  const role = getShipRole(selectedShip);
  const tasks = buildShipTasks(selectedShip, cargoScu);
  const recommendedRoutes = buildRouteRecommendations(routes, cargoScu)
    .map((recommendation) => recommendation.route)
    .filter((route): route is CalculatedTradeRoute => Boolean(route))
    .slice(0, 3);
  const shipGroups = groupShipsByManufacturer(shipOptions);

  return (
    <aside className="pilot-panel">
      <div className="heading-row pilot-heading">
        <div>
          <p className="eyebrow">PILOT PROFILE</p>
          <h2>当前飞船</h2>
        </div>
        <button className="ghost-button" type="button" onClick={onOpenTrade}>
          贸易
        </button>
      </div>

      <label>
        <span>Ship</span>
        <select value={selectedShip?.id ?? ""} onChange={(event) => onShipChange(event.currentTarget.value)}>
          {shipGroups.map((group) => (
            <optgroup key={group.manufacturer} label={group.manufacturer}>
              {group.ships.map((ship) => (
                <option key={ship.id} value={ship.id}>
                  {ship.name} - {ship.cargoScu} SCU
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      <div className="manufacturer-identity">
        <span className="manufacturer-mark">{selectedShip?.manufacturerCode ?? manufacturerCodeFromName(selectedShip?.manufacturer)}</span>
        <div>
          <strong>{selectedShip?.manufacturer ?? "Unknown manufacturer"}</strong>
          <small>{shipCatalogSource} - {shipOptions.length} cargo ships</small>
        </div>
      </div>

      <div className="pilot-metrics">
        <div>
          <span>Ship Cargo</span>
          <strong>{shipCargoScu ? `${shipCargoScu} SCU` : "N/A"}</strong>
        </div>
        <div>
          <span>Role</span>
          <strong>{role}</strong>
        </div>
      </div>

      <div className="pilot-inputs">
        <label>
          <span>Usable Cargo</span>
          <input
            min={0}
            max={10000}
            type="number"
            value={cargoScu}
            onChange={(event) => onCargoChange(Number(event.currentTarget.value))}
          />
        </label>
        <label>
          <span>Budget UEC</span>
          <input
            min={0}
            step={1000}
            type="number"
            value={budgetUec}
            onChange={(event) => onBudgetChange(Number(event.currentTarget.value))}
          />
        </label>
      </div>

      <div className="pilot-inputs route-inputs">
        <label>
          <span>Origin</span>
          <input
            autoComplete="off"
            list="trade-location-suggestions"
            value={origin}
            onChange={(event) => onOriginChange(event.currentTarget.value)}
          />
        </label>
        <label>
          <span>Destination</span>
          <input
            autoComplete="off"
            list="trade-location-suggestions"
            placeholder="Any profitable destination"
            value={destination}
            onChange={(event) => onDestinationChange(event.currentTarget.value)}
          />
        </label>
      </div>

      <div className="planner-row">
        <label>
          <span>Mode</span>
          <select value={routeMode} onChange={(event) => onRouteModeChange(event.currentTarget.value as TradeRouteMode)}>
            {routeModeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Box Size</span>
          <select value={containerSize} onChange={(event) => onContainerSizeChange(Number(event.currentTarget.value))}>
            {containerSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size ? `${size} SCU` : "自动"}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="task-row" aria-label="Recommended mission types">
        {tasks.map((task) => (
          <span key={task}>{task}</span>
        ))}
      </div>

      <div className="route-preview-list">
        {recommendedRoutes.length ? (
          recommendedRoutes.map((route) => (
            <article key={route.id}>
              <div>
                <strong>{route.commodity}</strong>
                <span>
                  {`${route.buyTerminal} -> ${route.sellTerminal}`}
                </span>
              </div>
              <em>{formatNumber(route.totalProfit)} UEC</em>
            </article>
          ))
        ) : (
          <article>
            <div>
              <strong>暂无贸易路线</strong>
              <span>当前货仓或预算不足，建议切换任务类型。</span>
            </div>
          </article>
        )}
      </div>
    </aside>
  );
}

function StatusLine({ loading, source, error }: { loading: boolean; source: string; error?: string }) {
  return (
    <div className="status-line">
      <span className={loading ? "loading-dot" : ""} />
      {loading ? "正在同步界面数据" : `数据通道：${source}`}
      {error ? <strong>{error}</strong> : null}
    </div>
  );
}

export function VerseIndexApp() {
  const [activePanel, setActivePanel] = useState<ActivePanel>("index");
  const [selectedMapId, setSelectedMapId] = useState<VerseGuideMap["id"]>("stanton");
  const [mapExpanded, setMapExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<EntityTypeFilter>("all");
  const [freshness, setFreshness] = useState<FreshnessFilter>("all");
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [selectedShipId, setSelectedShipId] = useState("ship-c2-hercules");
  const [records, setRecords] = useState<SearchRecord[]>([]);
  const [recordSource, setRecordSource] = useState("wiki");
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordsError, setRecordsError] = useState<string>();
  const [cargoScu, setCargoScu] = useState(696);
  const [budgetUec, setBudgetUec] = useState(750000);
  const [tradeOrigin, setTradeOrigin] = useState(DEFAULT_TRADE_ORIGIN);
  const [tradeDestination, setTradeDestination] = useState("");
  const [routeMode, setRouteMode] = useState<TradeRouteMode>("mixed");
  const [containerSize, setContainerSize] = useState(0);
  const [routeRefreshNonce, setRouteRefreshNonce] = useState(0);
  const routeRefreshConsumedRef = useRef(0);
  const [shipCatalog, setShipCatalog] = useState<CargoShipRecord[]>([]);
  const [shipCatalogSource, setShipCatalogSource] = useState("external catalog");
  const [shipsLoading, setShipsLoading] = useState(false);
  const [shipsError, setShipsError] = useState<string>();
  const [routeUpstreamCount, setRouteUpstreamCount] = useState<number>();
  const [routes, setRoutes] = useState<CalculatedTradeRoute[]>(
    calculateTradeRoutes({ origin: DEFAULT_TRADE_ORIGIN, cargoScu: 696, budgetUec: 750000, limit: ROUTE_RESULT_LIMIT })
  );
  const [routeSource, setRouteSource] = useState("mock");
  const [routesLoading, setRoutesLoading] = useState(false);
  const [routesError, setRoutesError] = useState<string>();
  const [sourceCatalog, setSourceCatalog] = useState<DataSourceCatalogItem[]>([]);
  const [routePlanMode, setRoutePlanMode] = useState<"direct" | "loop">("direct");

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({
      q: query,
      type,
      freshness,
      limit: "50"
    });

    setRecordsLoading(true);
    setRecordsError(undefined);

    const timer = window.setTimeout(() => {
      fetch(`/api/search?${params.toString()}`)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Search API ${response.status}`);
          }

          return response.json() as Promise<SearchApiResponse>;
        })
        .then((payload) => {
          if (!active) {
            return;
          }

          setRecords(payload.data);
          setRecordSource(formatSearchSourceLabel(payload.meta.source));
          setSelectedId((current) => payload.data.find((record) => record.id === current)?.id ?? payload.data[0]?.id);
        })
        .catch(() => {
          if (!active) {
            return;
          }

          setRecords([]);
          setRecordSource("offline");
          setRecordsError("Search API unavailable; external index could not be reached.");
        })
        .finally(() => {
          if (active) {
            setRecordsLoading(false);
          }
        });
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [freshness, query, type]);

  useEffect(() => {
    let active = true;

    setShipsLoading(true);
    setShipsError(undefined);

    fetch("/api/trade/ships")
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Ship API ${response.status}`);
        }

        return response.json() as Promise<ShipCatalogApiResponse>;
      })
      .then((payload) => {
        if (!active) {
          return;
        }

        setShipCatalog(payload.data);
        setShipCatalogSource(payload.meta.source);
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setShipCatalog([]);
        setShipCatalogSource("offline ship fallback");
        setShipsError("飞船目录暂不可用，已使用本地可识别飞船。");
      })
      .finally(() => {
        if (active) {
          setShipsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const refreshNow = routeRefreshNonce !== routeRefreshConsumedRef.current;
    const params = new URLSearchParams({
      origin: tradeOrigin,
      destination: tradeDestination,
      cargoScu: String(cargoScu || 0),
      budgetUec: String(budgetUec || 0),
      limit: String(ROUTE_RESULT_LIMIT),
      provider: "auto",
      routeMode,
      containerSize: String(containerSize)
    });

    if (refreshNow) {
      params.set("refresh", "1");
    }

    setRoutesLoading(true);
    setRoutesError(undefined);

    fetch(`/api/trade/routes?${params.toString()}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Trade API ${response.status}`);
        }

        return response.json() as Promise<TradeApiResponse>;
      })
      .then((payload) => {
        if (!active) {
          return;
        }

        setRoutes(payload.data);
        setRouteSource(payload.meta.source);
        setRouteUpstreamCount(payload.meta.upstreamCount);
        setRoutePlanMode(payload.meta.planMode ?? "direct");
        setRoutesError(payload.meta.warning);
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setRoutes(
          calculateTradeRoutes({
            origin: tradeOrigin,
            destination: tradeDestination,
            cargoScu,
            budgetUec,
            limit: ROUTE_RESULT_LIMIT,
            routeMode,
            containerSize
          })
        );
        setRouteSource("local fallback");
        setRouteUpstreamCount(undefined);
        setRoutePlanMode("direct");
        setRoutesError("贸易 API 暂不可用");
      })
      .finally(() => {
        if (active) {
          routeRefreshConsumedRef.current = routeRefreshNonce;
          setRoutesLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [budgetUec, cargoScu, containerSize, routeMode, routeRefreshNonce, tradeDestination, tradeOrigin]);

  useEffect(() => {
    let active = true;

    fetch("/api/sources")
      .then((response) => response.json() as Promise<SourcesApiResponse>)
      .then((payload) => {
        if (active) {
          setSourceCatalog(payload.data);
        }
      })
      .catch(() => {
        if (active) {
          setSourceCatalog(dataSourceCatalog);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!mapExpanded) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMapExpanded(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mapExpanded]);

  const selectedRecord = useMemo(
    () => records.find((record) => record.id === selectedId) ?? records[0],
    [records, selectedId]
  );

  const fallbackShipOptions = useMemo(
    () => mockRecords.map(mapSearchRecordToCargoShip).filter((ship): ship is CargoShipRecord => Boolean(ship)),
    []
  );
  const indexedShipOptions = useMemo(
    () => records.map(mapSearchRecordToCargoShip).filter((ship): ship is CargoShipRecord => Boolean(ship)),
    [records]
  );
  const shipOptions = useMemo(() => {
    return mergeCargoShipOptions(shipCatalog, indexedShipOptions, fallbackShipOptions);
  }, [fallbackShipOptions, indexedShipOptions, shipCatalog]);
  const shipGroups = useMemo(() => groupShipsByManufacturer(shipOptions), [shipOptions]);

  const selectedShip = useMemo(
    () =>
      shipOptions.find((ship) => ship.id === selectedShipId) ??
      shipOptions.find((ship) => normalizeCatalogKey(ship.name).includes("c2 hercules")) ??
      shipOptions[0],
    [selectedShipId, shipOptions]
  );

  const sourceLedger = useMemo(() => {
    const seen = new Map<string, SourceFootnote>();
    const byRecordId = new Map<string, number>();

    for (const record of records) {
      const key = buildSourceKey(record);
      let footnote = seen.get(key);

      if (!footnote) {
        footnote = {
          index: seen.size + 1,
          key,
          sourceName: record.source.sourceName,
          sourceUrl: record.source.sourceUrl,
          gameVersion: record.source.gameVersion,
          sourceUpdatedAt: record.source.sourceUpdatedAt,
          freshness: record.source.freshness
        };
        seen.set(key, footnote);
      }

      byRecordId.set(record.id, footnote.index);
    }

    return {
      footnotes: Array.from(seen.values()),
      byRecordId
    };
  }, [records]);

  const freshCount = records.filter((record) => record.source.freshness === "fresh").length;

  function handleShipChange(shipId: string) {
    const nextShip = shipOptions.find((ship) => ship.id === shipId);

    setSelectedShipId(shipId);
    setCargoScu(getShipCargoScu(nextShip));
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand" aria-label="ENIGMA Verse Index">
          <span className="brand-mark">E</span>
          <span>
            <strong>ENIGMA</strong>
            <small>Verse Index</small>
          </span>
        </div>

        <nav className="nav-tabs" aria-label="Primary">
          {navTabs.map((tab) => (
            <button
              className={activePanel === tab.value ? "active" : ""}
              key={tab.value}
              type="button"
              onClick={() => setActivePanel(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="status-pill">
          <span />
          Alpha 3.24.x
        </div>
      </header>

      <datalist id="trade-location-suggestions">
        {tradeLocationSuggestions.map((location) => (
          <option key={location} value={location} />
        ))}
      </datalist>

      <main>
        {activePanel === "index" ? (
          <section className="work-grid">
            <section className="index-panel">
              <div className="heading-row">
                <div>
                  <p className="eyebrow">THE LEDGER</p>
                  <h1>查询万物</h1>
                </div>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setType("all");
                    setFreshness("all");
                  }}
                >
                  清空
                </button>
              </div>

              <div className="control-grid">
                <label>
                  <span>Search</span>
                  <input
                    autoComplete="off"
                    placeholder="舰船、装备、地点、商品、终端"
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.currentTarget.value)}
                  />
                </label>

                <label>
                  <span>Type</span>
                  <select value={type} onChange={(event) => setType(event.currentTarget.value as EntityTypeFilter)}>
                    {typeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Freshness</span>
                  <select
                    value={freshness}
                    onChange={(event) => setFreshness(event.currentTarget.value as FreshnessFilter)}
                  >
                    {freshnessOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

              </div>

              <StatusLine loading={recordsLoading} source={recordSource} error={recordsError} />

              <div className="metric-strip">
                <div>
                  <strong>{records.length}</strong>
                  <span>Records</span>
                </div>
                <div>
                  <strong>{sourceLedger.footnotes.length}</strong>
                  <span>Sources</span>
                </div>
                <div>
                  <strong>{freshCount}</strong>
                  <span>Fresh</span>
                </div>
              </div>

              <div className="result-count">{records.length} results</div>

              <div className="result-list">
                {records.length ? (
                  records.map((record) => {
                    const externalRecord = isExternalRecord(record);
                    const canSetShip = record.type === "ship";

                    return (
                      <article
                        className={selectedRecord?.id === record.id ? "result-card active" : "result-card"}
                        key={record.id}
                      >
                        <div>
                          <div className="record-title">
                            <h2>{record.name}</h2>
                            {record.nameZh ? <small>{record.nameZh}</small> : null}
                          </div>
                          <p>{record.summary}</p>
                          <div className="tag-row">
                            {record.tags.map((tag) => (
                              <span key={tag}>{tag}</span>
                            ))}
                          </div>
                          <div className="result-footnote">
                            <sup>[{sourceLedger.byRecordId.get(record.id) ?? 0}]</sup>
                            <span>{record.source.sourceName}</span>
                          </div>
                        </div>
                        <div className="result-actions">
                          <em>{getRecordCategoryLabel(record)}</em>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedId(record.id);

                              if (canSetShip) {
                                const nextShip =
                                  shipOptions.find((ship) => normalizeCatalogKey(ship.name) === normalizeCatalogKey(record.name)) ??
                                  mapSearchRecordToCargoShip(record);

                                if (nextShip) {
                                  setSelectedShipId(nextShip.id);
                                  setCargoScu(getShipCargoScu(nextShip));
                                }
                              }
                            }}
                          >
                            {canSetShip ? "设为飞船" : "选中"}
                          </button>
                          {externalRecord ? (
                            <a href={record.source.sourceUrl} rel="noreferrer" target="_blank">
                              来源
                            </a>
                          ) : (
                            <a href={`/entity/${record.slug}`}>详情</a>
                          )}
                        </div>
                      </article>
                    );
                  })
                ) : (
                  <article className="empty-state">
                    <h2>没有结果</h2>
                    <p>调整关键词或筛选条件。</p>
                  </article>
                )}
              </div>
              {sourceLedger.footnotes.length ? (
                <ol className="source-footnotes" aria-label="Search result sources">
                  {sourceLedger.footnotes.map((source) => (
                    <li key={source.key}>
                      <span>[{source.index}]</span>
                      {source.sourceUrl ? (
                        <a href={source.sourceUrl} rel="noreferrer" target="_blank">
                          {source.sourceName}
                        </a>
                      ) : (
                        <strong>{source.sourceName}</strong>
                      )}
                      <em>{formatSourceDetail(source)}</em>
                    </li>
                  ))}
                </ol>
              ) : null}
            </section>

            <section className="side-stack">
              <InlineStarMap
                selectedMapId={selectedMapId}
                onExpand={() => setMapExpanded(true)}
              />
              <PilotShipPanel
                budgetUec={budgetUec}
                cargoScu={cargoScu}
                containerSize={containerSize}
                destination={tradeDestination}
                onBudgetChange={setBudgetUec}
                onCargoChange={setCargoScu}
                onContainerSizeChange={setContainerSize}
                onDestinationChange={setTradeDestination}
                onOpenTrade={() => setActivePanel("trade")}
                onOriginChange={setTradeOrigin}
                onRouteModeChange={setRouteMode}
                onShipChange={handleShipChange}
                origin={tradeOrigin}
                routeMode={routeMode}
                routes={routes}
                selectedShip={selectedShip}
                shipCatalogSource={shipsError ? shipCatalogSource : `${shipCatalogSource}${shipsLoading ? " syncing" : ""}`}
                shipOptions={shipOptions}
              />
            </section>
          </section>
        ) : null}

        {activePanel === "trade" ? (
          <section className="trade-grid">
            <section className="index-panel">
              <div className="planner-toolbar">
                <div>
                  <p className="eyebrow">COMMERCE</p>
                  <h1>航线收益</h1>
                </div>
                <button className="ghost-button sync-button" type="button" onClick={() => setRouteRefreshNonce((value) => value + 1)}>
                  同步 UEX
                </button>
              </div>

              <div className="control-grid trade-controls planner-grid">
                <label className="wide-control">
                  <span>Ship</span>
                  <select value={selectedShip?.id ?? ""} onChange={(event) => handleShipChange(event.currentTarget.value)}>
                    {shipGroups.map((group) => (
                      <optgroup key={group.manufacturer} label={group.manufacturer}>
                        {group.ships.map((ship) => (
                          <option key={ship.id} value={ship.id}>
                            {ship.name} - {ship.cargoScu} SCU
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Auto Cargo</span>
                  <input readOnly type="text" value={selectedShip ? `${selectedShip.cargoScu} SCU` : "Unknown"} />
                </label>
                <label>
                  <span>Usable Cargo</span>
                  <input
                    max={10000}
                    min={1}
                    type="number"
                    value={cargoScu}
                    onChange={(event) => setCargoScu(Number(event.currentTarget.value))}
                  />
                </label>
                <label>
                  <span>Origin</span>
                  <input
                    autoComplete="off"
                    list="trade-location-suggestions"
                    value={tradeOrigin}
                    onChange={(event) => setTradeOrigin(event.currentTarget.value)}
                  />
                </label>
                <label>
                  <span>Destination</span>
                  <input
                    autoComplete="off"
                    list="trade-location-suggestions"
                    placeholder="Any destination"
                    value={tradeDestination}
                    onChange={(event) => setTradeDestination(event.currentTarget.value)}
                  />
                </label>
                <label>
                  <span>Budget UEC</span>
                  <input
                    min={1}
                    step={1000}
                    type="number"
                    value={budgetUec}
                    onChange={(event) => setBudgetUec(Number(event.currentTarget.value))}
                  />
                </label>
                <div className="mode-control">
                  <span>Transport Mode</span>
                  <div className="mode-toggle">
                    {routeModeOptions.map((option) => (
                      <button
                        className={routeMode === option.value ? "active" : ""}
                        key={option.value}
                        type="button"
                        onClick={() => setRouteMode(option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                <label>
                  <span>Box Size</span>
                  <select value={containerSize} onChange={(event) => setContainerSize(Number(event.currentTarget.value))}>
                    {containerSizeOptions.map((size) => (
                      <option key={size} value={size}>
                        {size ? `${size} SCU` : "自动匹配"}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="planner-source-line">
                <span>{selectedShip?.manufacturer ?? "Unknown"} / {getShipRole(selectedShip)}</span>
                <span>{routePlanMode === "loop" ? "三角/循环规划" : "单段规划"}</span>
                <span>{getRouteModeLabel(routeMode)}</span>
                <span>{containerSize ? `${containerSize} SCU 箱型` : "自动箱型"}</span>
                {typeof routeUpstreamCount === "number" ? <span>UEX upstream {routeUpstreamCount}</span> : null}
                {shipsError ? <strong>{shipsError}</strong> : null}
              </div>

              <StatusLine loading={routesLoading} source={routeSource} error={routesError} />

              <NewPlayerRouteGuide
                budgetUec={budgetUec}
                cargoScu={cargoScu}
                routeMode={routeMode}
                routePlanMode={routePlanMode}
                routeSource={routeSource}
                routes={routes}
                selectedShip={selectedShip}
              />

              <div className="metric-strip planner-metrics">
                <div>
                  <strong>{routes[0] ? formatNumber(routes[0].totalProfit) : 0}</strong>
                  <span>Best Profit UEC</span>
                </div>
                <div>
                  <strong>{routes[0]?.purchasableScu ?? 0}</strong>
                  <span>Loaded SCU</span>
                </div>
                <div>
                  <strong>{routes.length}</strong>
                  <span>Routes</span>
                </div>
                <div>
                  <strong>{shipOptions.length}</strong>
                  <span>Cargo Ships</span>
                </div>
              </div>
            </section>

            <section className="route-list">
              {routes.map((route) => {
                const hasRouteLegs = (route.legs?.length ?? 0) > 1;

                return (
                  <article className="route-card" key={route.id}>
                    <header>
                      <h2>{hasRouteLegs ? getRouteKindLabel(route) : route.commodity}</h2>
                      <span className={`freshness ${route.source.freshness}`}>{route.source.freshness}</span>
                    </header>
                    <p>{formatRoutePath(route)}</p>
                    {hasRouteLegs ? <div className="route-plan-commodity">{route.commodity}</div> : null}
                    <div className="route-profit">
                      <span>
                        {hasRouteLegs
                          ? `${route.legs?.length ?? 0} legs - ${formatNumber(route.purchasableScu)} SCU moved - peak ${formatNumber(route.capitalUsed)} UEC capital`
                          : `${route.purchasableScu} SCU - ${formatNumber(route.capitalUsed)} UEC capital`}
                      </span>
                      <strong>{formatNumber(route.totalProfit)} UEC</strong>
                    </div>
                    <div className="route-detail-grid">
                      <div>
                        <span>{hasRouteLegs ? "Peak Capital" : "Buy"}</span>
                        <strong>
                          {hasRouteLegs ? `${formatNumber(route.capitalUsed)} UEC` : `${formatNumber(route.buyPrice)} UEC/SCU`}
                        </strong>
                      </div>
                      <div>
                        <span>{hasRouteLegs ? "Legs" : "Sell"}</span>
                        <strong>{hasRouteLegs ? route.legs?.length ?? 0 : `${formatNumber(route.sellPrice)} UEC/SCU`}</strong>
                      </div>
                      <div>
                        <span>{hasRouteLegs ? "Avg Profit" : "Profit"}</span>
                        <strong>{formatNumber(route.profitPerScu)} UEC/SCU</strong>
                      </div>
                      <div>
                        <span>ROI</span>
                        <strong>{typeof route.marginPercent === "number" ? `${route.marginPercent.toFixed(1)}%` : "N/A"}</strong>
                      </div>
                    </div>
                    {hasRouteLegs ? (
                      <div className="route-leg-list">
                        {route.legs?.map((leg, index) => (
                          <div key={`${leg.id}-${index}`}>
                            <span>{index + 1}</span>
                            <strong>{leg.commodity}</strong>
                            <em>{`${leg.buyTerminal} -> ${leg.destinationTerminalName ?? leg.sellTerminal}`}</em>
                            <small>{`${formatNumber(leg.purchasableScu)} SCU / ${formatNumber(leg.totalProfit)} UEC`}</small>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <div className="source-row">
                      {route.source.sourceUrl ? (
                        <a href={route.source.sourceUrl} rel="noreferrer" target="_blank">
                          {route.source.sourceName}
                        </a>
                      ) : (
                        <span>{route.source.sourceName}</span>
                      )}
                      <span>{getRouteKindLabel(route)}</span>
                      <span>Risk {route.risk}</span>
                      {typeof route.availableScu === "number" ? (
                        <span>{formatNumber(route.availableScu)} SCU available</span>
                      ) : null}
                      <span>{getRouteStationMode(route)}</span>
                      <span>{formatContainerSizes(route)}</span>
                      {typeof route.distanceGm === "number" ? <span>{formatNumber(route.distanceGm)} GM</span> : null}
                      {route.source.sourceUpdatedAt ? <span>Updated {route.source.sourceUpdatedAt}</span> : null}
                    </div>
                  </article>
                );
              })}
              {!routes.length ? (
                <article className="empty-state">
                  <h2>没有可盈利路线</h2>
                  <p>如果起点和终点相同，系统会自动尝试三角/循环航线；调高预算、货仓或放宽纯太空/箱型限制后再同步 UEX。</p>
                </article>
              ) : null}
            </section>
          </section>
        ) : null}

        {activePanel === "starmap" ? (
          <StarMapPanel selectedMapId={selectedMapId} onSelectMap={setSelectedMapId} />
        ) : null}

        {activePanel === "network" ? (
          <section className="network-panel">
            <p className="eyebrow">ENIGMA ORGANIZATION</p>
            <h1>TRUST - TRADE - NEUTRALITY - FREEDOM</h1>
            <p>
              ENIGMA exists to make independent pilots, traders, miners, haulers, escorts, and explorers able to
              cooperate through contracts, reputation, and neutral commerce.
            </p>

            <div className="source-grid" aria-label="Data sources">
              {sourceCatalog.map((source) => (
                <article key={source.id}>
                  <header>
                    <h2>{source.name}</h2>
                    <span>{source.status}</span>
                  </header>
                  <p>{source.purpose.join(", ")}</p>
                  <footer>
                    <span>{source.requiresToken ? "Token required" : "No token"}</span>
                    <span>{source.recommendedCadence}</span>
                  </footer>
                </article>
              ))}
            </div>

            <div className="charter-grid">
              <article>
                <span>I</span>
                <h2>Honor The Contract</h2>
                <p>A deal accepted through the network must be fulfilled under the confirmed terms.</p>
              </article>
              <article>
                <span>II</span>
                <h2>Protect The Network</h2>
                <p>Neutral trade requires the ability to defend ships, cargo, routes, and trusted partners.</p>
              </article>
              <article>
                <span>III</span>
                <h2>Never Betray The Ledger</h2>
                <p>Reputation is the organization's core asset and must outlast any single job, ship, or balance.</p>
              </article>
            </div>
          </section>
        ) : null}
      </main>

      {mapExpanded ? (
        <StarMapOverlay
          selectedMapId={selectedMapId}
          onClose={() => setMapExpanded(false)}
          onSelectMap={setSelectedMapId}
        />
      ) : null}

      <footer className="site-footer">
        <span>ENIGMA Verse Index is an unofficial Star Citizen community tool.</span>
        <span>Not affiliated with Cloud Imperium Games, Roberts Space Industries, or Star Citizen.</span>
      </footer>
    </div>
  );
}
