export interface DataSourceCatalogItem {
  id: string;
  name: string;
  purpose: string[];
  docsUrl: string;
  requiresToken: boolean;
  recommendedCadence: string;
  status: "planned" | "adapter_ready" | "enabled";
}

export const dataSourceCatalog: DataSourceCatalogItem[] = [
  {
    id: "rsi-official",
    name: "Roberts Space Industries Official",
    purpose: ["official_site", "patch_notes", "comm_link", "event_news", "ship_showroom"],
    docsUrl: "https://robertsspaceindustries.com/",
    requiresToken: false,
    recommendedCadence: "live official page",
    status: "enabled"
  },
  {
    id: "star-citizen-wiki",
    name: "Star Citizen Wiki API",
    purpose: ["search_database", "ship_cargo_stats", "cargo_ship_catalog", "ships", "vehicles", "components", "items", "locations", "manufacturers"],
    docsUrl: "https://docs.star-citizen.wiki/",
    requiresToken: false,
    recommendedCadence: "daily",
    status: "enabled"
  },
  {
    id: "citizenwiki-cn",
    name: "CitizenWiki CN",
    purpose: ["chinese_wiki", "localized_reference", "star_wiki_cross_link"],
    docsUrl: "https://citizenwiki.cn/",
    requiresToken: false,
    recommendedCadence: "linked live page",
    status: "enabled"
  },
  {
    id: "uex",
    name: "UEX Corp API",
    purpose: ["commodities", "commodity_prices", "trade_terminals", "trade_routes"],
    docsUrl: "https://uexcorp.space/api/documentation/",
    requiresToken: false,
    recommendedCadence: "15m-60m for trade data",
    status: "enabled"
  },
  {
    id: "sc-trade-tools",
    name: "SC Trade Tools API",
    purpose: ["commodities", "shops", "terminals", "trade cross-checking"],
    docsUrl: "https://sc-trade.tools/swagger-ui.html",
    requiresToken: false,
    recommendedCadence: "daily or cross-check only",
    status: "planned"
  },
  {
    id: "verseguide",
    name: "VerseGuide",
    purpose: ["starmap", "locations", "surface_navigation", "route_planning"],
    docsUrl: "https://verseguide.com/",
    requiresToken: false,
    recommendedCadence: "embedded live page",
    status: "enabled"
  }
];
