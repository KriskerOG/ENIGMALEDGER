export type EntityType =
  | "ship"
  | "vehicle"
  | "component"
  | "weapon"
  | "armor"
  | "equipment"
  | "commodity"
  | "location"
  | "shop"
  | "manufacturer"
  | "reference";

export type EntityTypeFilter = EntityType | "all";

export type FreshnessStatus = "fresh" | "recent" | "stale" | "unknown";
export type FreshnessFilter = FreshnessStatus | "all";

export type SourceName =
  | "Star Citizen Wiki API"
  | "StarCitizen.tools"
  | "CitizenWiki CN"
  | "SC Localization Alias"
  | "ParaTranz Terms"
  | "StarCitizen.tools Ship Cargo Stats"
  | "UEX Corp API"
  | "SC Trade Tools API"
  | "ENIGMA";

export interface SourceMetadata {
  sourceName: SourceName | string;
  sourceUrl?: string;
  sourceRecordId?: string;
  gameVersion?: string;
  fetchedAt?: string;
  sourceUpdatedAt?: string;
  freshness: FreshnessStatus;
}

export interface SearchRecord {
  id: string;
  type: EntityType;
  slug: string;
  name: string;
  nameZh?: string;
  imageUrl?: string;
  manufacturer?: string;
  categoryLabel?: string;
  summary: string;
  tags: string[];
  stats: Record<string, string | number | null>;
  source: SourceMetadata;
}

export interface SearchInput {
  query?: string;
  type?: EntityTypeFilter;
  freshness?: FreshnessFilter;
  limit?: number;
}

export type SearchSourceFilter = "all" | "database" | "local" | "wiki";

export interface SearchProviderResult {
  provider: SearchSourceFilter | string;
  records: SearchRecord[];
  error?: string;
}

export interface TradeRouteInput {
  origin?: string;
  destination?: string;
  cargoScu: number;
  budgetUec: number;
  limit?: number;
  routeMode?: TradeRouteMode;
  containerSize?: number;
}

export type TradeRouteProvider = "auto" | "uex" | "sample";
export type TradeRouteMode = "mixed" | "space";
export type TradeRoutePlanKind = "direct" | "cycle" | "triangle";

export interface TradeRouteRecord {
  id: string;
  commodity: string;
  origin: string;
  buyTerminal: string;
  sellTerminal: string;
  originTerminalId?: number;
  destinationTerminalId?: number;
  originTerminalCode?: string;
  destinationTerminalCode?: string;
  originTerminalName?: string;
  destinationTerminalName?: string;
  originTerminalSlug?: string;
  destinationTerminalSlug?: string;
  originLocation?: string;
  destinationLocation?: string;
  buyPrice: number;
  sellPrice: number;
  availableScu?: number;
  distanceGm?: number;
  marginPercent?: number;
  routeCode?: string;
  score?: number;
  containerSizes?: number[];
  originContainerSizes?: number[];
  destinationContainerSizes?: number[];
  originIsGround?: boolean;
  destinationIsGround?: boolean;
  originIsSpaceStation?: boolean;
  destinationIsSpaceStation?: boolean;
  originHasFreightElevator?: boolean;
  destinationHasFreightElevator?: boolean;
  originHasDockingPort?: boolean;
  destinationHasDockingPort?: boolean;
  risk: "Low" | "Medium" | "High";
  source: SourceMetadata;
}

export interface CalculatedTradeLeg extends TradeRouteRecord {
  purchasableScu: number;
  capitalUsed: number;
  profitPerScu: number;
  totalProfit: number;
}

export interface CalculatedTradeRoute extends CalculatedTradeLeg {
  routeKind?: TradeRoutePlanKind;
  routePlanLabel?: string;
  legs?: CalculatedTradeLeg[];
}

export interface CargoShipRecord {
  id: string;
  name: string;
  nameZh?: string;
  slug: string;
  manufacturer: string;
  manufacturerCode?: string;
  role?: string;
  size?: string;
  cargoScu: number;
  maxContainerSize?: number;
  pledgeUrl?: string;
  imageUrl?: string;
  source: SourceMetadata;
}
