import type { EntityType, FreshnessStatus, SearchRecord, SourceMetadata, TradeRouteRecord } from "./types";

function seedSource(sourceUpdatedAt = "2026-09-01", freshness: FreshnessStatus = "recent"): SourceMetadata {
  return {
    sourceName: "ENIGMA Seed Data",
    sourceUrl: "https://example.invalid/enigma-seed-data",
    gameVersion: "sample",
    sourceUpdatedAt,
    freshness
  };
}

function record(input: {
  id: string;
  type: EntityType;
  slug: string;
  name: string;
  nameZh?: string;
  manufacturer?: string;
  summary: string;
  tags: string[];
  stats: Record<string, string | number | null>;
  freshness?: FreshnessStatus;
}): SearchRecord {
  return {
    ...input,
    source: seedSource("2026-09-01", input.freshness ?? "recent")
  };
}

export const mockRecords: SearchRecord[] = [
  record({
    id: "ship-c2-hercules",
    type: "ship",
    slug: "crusader-c2-hercules",
    name: "Crusader C2 Hercules",
    nameZh: "C2 大力神",
    manufacturer: "Crusader Industries",
    summary: "Heavy cargo transport focused on long-range hauling and vehicle logistics.",
    tags: ["cargo", "large ship", "Crusader", "696 SCU"],
    stats: { Manufacturer: "Crusader", Role: "Cargo", Cargo: "696 SCU", Crew: "1-2" }
  }),
  record({
    id: "ship-cutlass-black",
    type: "ship",
    slug: "drake-cutlass-black",
    name: "Drake Cutlass Black",
    nameZh: "弯刀黑",
    manufacturer: "Drake Interplanetary",
    summary: "Versatile medium ship used for cargo, combat, small-team operations, and daily travel.",
    tags: ["multi-role", "medium ship", "Drake"],
    stats: { Manufacturer: "Drake", Role: "Multi-role", Cargo: "46 SCU", Crew: "1-3" }
  }),
  record({
    id: "ship-carrack",
    type: "ship",
    slug: "anvil-carrack",
    name: "Anvil Carrack",
    nameZh: "卡拉克",
    manufacturer: "Anvil Aerospace",
    summary: "Large expedition ship built for exploration, mapping, long missions, and fleet support.",
    tags: ["exploration", "large ship", "Anvil"],
    stats: { Manufacturer: "Anvil", Role: "Exploration", Cargo: "456 SCU", Crew: "4-6" }
  }),
  record({
    id: "ship-vulture",
    type: "ship",
    slug: "drake-vulture",
    name: "Drake Vulture",
    nameZh: "秃鹫",
    manufacturer: "Drake Interplanetary",
    summary: "Solo salvage ship for hull scraping and compact industrial recovery work.",
    tags: ["salvage", "industrial", "solo", "Drake"],
    stats: { Manufacturer: "Drake", Role: "Salvage", Cargo: "12 SCU", Crew: "1" }
  }),
  record({
    id: "ship-prospector",
    type: "ship",
    slug: "misc-prospector",
    name: "MISC Prospector",
    nameZh: "勘探者",
    manufacturer: "Musashi Industrial and Starflight Concern",
    summary: "Single-seat mining ship used for asteroid and surface resource extraction.",
    tags: ["mining", "industrial", "solo", "MISC"],
    stats: { Manufacturer: "MISC", Role: "Mining", Cargo: "Mining bags", Crew: "1" }
  }),
  record({
    id: "ship-mole",
    type: "ship",
    slug: "argo-mole",
    name: "ARGO MOLE",
    nameZh: "鼹鼠",
    manufacturer: "ARGO Astronautics",
    summary: "Multi-crew mining platform with three mining turrets for coordinated extraction.",
    tags: ["mining", "multi-crew", "industrial", "ARGO"],
    stats: { Manufacturer: "ARGO", Role: "Mining", Turrets: "3", Crew: "2-4" }
  }),
  record({
    id: "ship-gladius",
    type: "ship",
    slug: "aegis-gladius",
    name: "Aegis Gladius",
    nameZh: "短剑",
    manufacturer: "Aegis Dynamics",
    summary: "Light fighter with strong maneuverability and a focused combat profile.",
    tags: ["fighter", "light", "Aegis"],
    stats: { Manufacturer: "Aegis", Role: "Light Fighter", Cargo: "0 SCU", Crew: "1" }
  }),
  record({
    id: "ship-arrow",
    type: "ship",
    slug: "anvil-arrow",
    name: "Anvil Arrow",
    nameZh: "箭矢",
    manufacturer: "Anvil Aerospace",
    summary: "Compact light fighter built around agility, speed, and pilot skill.",
    tags: ["fighter", "light", "Anvil"],
    stats: { Manufacturer: "Anvil", Role: "Light Fighter", Cargo: "0 SCU", Crew: "1" }
  }),
  record({
    id: "ship-taurus",
    type: "ship",
    slug: "rsi-constellation-taurus",
    name: "RSI Constellation Taurus",
    nameZh: "星座金牛",
    manufacturer: "Roberts Space Industries",
    summary: "Freight-focused Constellation variant for medium-to-large cargo operations.",
    tags: ["cargo", "multi-crew", "RSI"],
    stats: { Manufacturer: "RSI", Role: "Cargo", Cargo: "174 SCU", Crew: "3-4" }
  }),
  record({
    id: "ship-corsair",
    type: "ship",
    slug: "drake-corsair",
    name: "Drake Corsair",
    nameZh: "海盗船",
    manufacturer: "Drake Interplanetary",
    summary: "Exploration gunship with strong forward firepower and independent expedition utility.",
    tags: ["exploration", "gunship", "Drake"],
    stats: { Manufacturer: "Drake", Role: "Exploration", Cargo: "72 SCU", Crew: "1-4" }
  }),
  record({
    id: "ship-msr",
    type: "ship",
    slug: "crusader-mercury-star-runner",
    name: "Mercury Star Runner",
    nameZh: "水星星际快运",
    manufacturer: "Crusader Industries",
    summary: "Fast courier and data-running ship with cargo capacity and smuggling-friendly layout.",
    tags: ["courier", "data", "cargo", "Crusader"],
    stats: { Manufacturer: "Crusader", Role: "Data/Courier", Cargo: "114 SCU", Crew: "2-3" }
  }),
  record({
    id: "ship-reclaimer",
    type: "ship",
    slug: "aegis-reclaimer",
    name: "Aegis Reclaimer",
    nameZh: "回收者",
    manufacturer: "Aegis Dynamics",
    summary: "Heavy salvage capital-scale industrial ship for large wreck recovery.",
    tags: ["salvage", "heavy industrial", "Aegis"],
    stats: { Manufacturer: "Aegis", Role: "Heavy Salvage", Cargo: "Salvage hold", Crew: "4-5" }
  }),
  record({
    id: "component-xl1",
    type: "component",
    slug: "xl-1-quantum-drive",
    name: "XL-1 Quantum Drive",
    nameZh: "XL-1 量子驱动器",
    manufacturer: "Wei-Tek",
    summary: "Size 2 military quantum drive commonly selected for fast Stanton travel.",
    tags: ["quantum drive", "size 2", "military", "Wei-Tek"],
    stats: { Type: "Quantum Drive", Size: "2", Grade: "A", Class: "Military" },
    freshness: "fresh"
  }),
  record({
    id: "component-crossfield",
    type: "component",
    slug: "crossfield-quantum-drive",
    name: "Crossfield Quantum Drive",
    manufacturer: "Wei-Tek",
    summary: "Size 2 quantum drive often considered for balanced travel performance.",
    tags: ["quantum drive", "size 2", "Wei-Tek"],
    stats: { Type: "Quantum Drive", Size: "2", Class: "Civilian", Use: "Travel" }
  }),
  record({
    id: "component-fr86",
    type: "component",
    slug: "fr-86-shield-generator",
    name: "FR-86 Shield Generator",
    manufacturer: "Gorgon Defender Industries",
    summary: "Size 2 shield generator used by pilots who prioritize survivability.",
    tags: ["shield", "size 2", "military"],
    stats: { Type: "Shield Generator", Size: "2", Grade: "A", Class: "Military" }
  }),
  record({
    id: "component-js400",
    type: "component",
    slug: "js-400-power-plant",
    name: "JS-400 Power Plant",
    manufacturer: "Juno Starwerk",
    summary: "Size 2 power plant for ships with demanding component loadouts.",
    tags: ["power plant", "size 2", "industrial"],
    stats: { Type: "Power Plant", Size: "2", Grade: "A", Class: "Industrial" }
  }),
  record({
    id: "weapon-p4ar",
    type: "weapon",
    slug: "behring-p4-ar",
    name: "Behring P4-AR",
    nameZh: "P4-AR 步枪",
    manufacturer: "Behring",
    summary: "Common ballistic assault rifle for FPS contracts and bunker operations.",
    tags: ["fps", "rifle", "ballistic", "Behring"],
    stats: { Type: "Assault Rifle", Ammo: "Ballistic", Role: "FPS", Manufacturer: "Behring" }
  }),
  record({
    id: "weapon-fs9",
    type: "weapon",
    slug: "demeco-fs-9-lmg",
    name: "Demeco FS-9 LMG",
    manufacturer: "Demeco",
    summary: "Heavy automatic weapon for sustained FPS fire and suppression.",
    tags: ["fps", "lmg", "ballistic"],
    stats: { Type: "LMG", Ammo: "Ballistic", Role: "Suppression", Manufacturer: "Demeco" }
  }),
  record({
    id: "equipment-multitool",
    type: "equipment",
    slug: "pyro-ritya-multi-tool",
    name: "Pyro RYT Multi-Tool",
    nameZh: "多功能工具",
    manufacturer: "Greycat Industrial",
    summary: "Handheld utility tool platform used for tractor, mining, medical, and salvage attachments.",
    tags: ["utility", "tractor", "mining", "salvage"],
    stats: { Type: "Multi-tool", Slot: "Handheld", Attachments: "Multiple", Role: "Utility" }
  }),
  record({
    id: "armor-pembroke",
    type: "armor",
    slug: "pembroke-armor",
    name: "Pembroke Armor",
    nameZh: "彭布罗克护甲",
    manufacturer: "Caldera",
    summary: "Environmental armor associated with high-temperature and hazardous industrial work.",
    tags: ["armor", "environment", "industrial"],
    stats: { Category: "Armor", Weight: "Heavy", Use: "Environment", Role: "Industrial" }
  }),
  record({
    id: "armor-novikov",
    type: "armor",
    slug: "novikov-armor",
    name: "Novikov Armor",
    nameZh: "诺维科夫护甲",
    manufacturer: "Caldera",
    summary: "Environmental armor associated with cold weather and hostile planetary surfaces.",
    tags: ["armor", "environment", "cold"],
    stats: { Category: "Armor", Weight: "Heavy", Use: "Environment", Role: "Exploration" }
  }),
  record({
    id: "commodity-gold",
    type: "commodity",
    slug: "gold",
    name: "Gold",
    nameZh: "黄金",
    manufacturer: "Commodity",
    summary: "High-value metal commodity with strong trade interest and frequent route checking.",
    tags: ["commodity", "metal", "trade"],
    stats: { Category: "Metal", Trade: "High value", Risk: "Medium", Use: "Commerce" },
    freshness: "fresh"
  }),
  record({
    id: "commodity-beryl",
    type: "commodity",
    slug: "beryl",
    name: "Beryl",
    nameZh: "绿柱石",
    manufacturer: "Commodity",
    summary: "Mineral commodity commonly considered for medium-risk hauling routes.",
    tags: ["commodity", "mineral", "trade"],
    stats: { Category: "Mineral", Trade: "Medium value", Risk: "Medium", Use: "Commerce" },
    freshness: "fresh"
  }),
  record({
    id: "commodity-laranite",
    type: "commodity",
    slug: "laranite",
    name: "Laranite",
    nameZh: "拉兰石",
    manufacturer: "Commodity",
    summary: "Valuable mineral commodity often checked by cargo haulers.",
    tags: ["commodity", "mineral", "trade", "high value"],
    stats: { Category: "Mineral", Trade: "High value", Risk: "High", Use: "Commerce" }
  }),
  record({
    id: "commodity-quantanium",
    type: "commodity",
    slug: "quantanium",
    name: "Quantanium",
    nameZh: "量子矿",
    manufacturer: "Commodity",
    summary: "Volatile mined material associated with time-sensitive refining and transport.",
    tags: ["commodity", "mining", "volatile"],
    stats: { Category: "Ore", Trade: "High value", Risk: "High", Use: "Refining" }
  }),
  record({
    id: "commodity-medical-supplies",
    type: "commodity",
    slug: "medical-supplies",
    name: "Medical Supplies",
    nameZh: "医疗用品",
    manufacturer: "Commodity",
    summary: "Civilian supply commodity useful for route planning and station logistics.",
    tags: ["commodity", "civilian", "supply"],
    stats: { Category: "Supplies", Trade: "Route dependent", Risk: "Low", Use: "Logistics" }
  }),
  record({
    id: "location-seraphim",
    type: "location",
    slug: "seraphim-station",
    name: "Seraphim Station",
    nameZh: "炽天使空间站",
    manufacturer: "Crusader",
    summary: "Orbital station over Crusader and ENIGMA's current Stanton coordination node.",
    tags: ["Crusader", "station", "BASEMENT"],
    stats: { System: "Stanton", Planet: "Crusader", Type: "Orbital Station", Role: "Logistics" }
  }),
  record({
    id: "location-area18",
    type: "location",
    slug: "area18",
    name: "Area18",
    nameZh: "18 区",
    manufacturer: "ArcCorp",
    summary: "Dense city landing zone on ArcCorp with trade, shops, and corporate traffic.",
    tags: ["ArcCorp", "landing zone", "TDD"],
    stats: { System: "Stanton", Planet: "ArcCorp", Type: "Landing Zone", Role: "Commerce" }
  }),
  record({
    id: "location-lorville",
    type: "location",
    slug: "lorville",
    name: "Lorville",
    nameZh: "洛维尔",
    manufacturer: "Hurston Dynamics",
    summary: "Industrial city on Hurston and a major Stanton trade destination.",
    tags: ["Hurston", "landing zone", "CBD"],
    stats: { System: "Stanton", Planet: "Hurston", Type: "Landing Zone", Role: "Industry" }
  }),
  record({
    id: "location-new-babbage",
    type: "location",
    slug: "new-babbage",
    name: "New Babbage",
    nameZh: "新巴贝奇",
    manufacturer: "microTech",
    summary: "Technology-focused city on microTech with commerce, habitation, and transit hubs.",
    tags: ["microTech", "landing zone", "TDD"],
    stats: { System: "Stanton", Planet: "microTech", Type: "Landing Zone", Role: "Technology" }
  }),
  record({
    id: "shop-cousin-crows",
    type: "shop",
    slug: "cousin-crows",
    name: "Cousin Crows",
    nameZh: "考辛克劳维修店",
    manufacturer: "Shop",
    summary: "Ship component and vehicle service shop located around Crusader's commerce network.",
    tags: ["shop", "components", "Crusader"],
    stats: { Location: "Orison", Category: "Ship Components", Sells: "Components", Source: "Community" }
  }),
  record({
    id: "shop-centermass-area18",
    type: "shop",
    slug: "centermass-area18",
    name: "CenterMass Area18",
    manufacturer: "Shop",
    summary: "Weapon shop used by pilots preparing for FPS and ship combat contracts.",
    tags: ["shop", "weapons", "Area18"],
    stats: { Location: "Area18", Category: "Weapons", Sells: "FPS and ship weapons", Source: "Community" }
  }),
  record({
    id: "manufacturer-crusader",
    type: "manufacturer",
    slug: "crusader-industries",
    name: "Crusader Industries",
    nameZh: "十字军工业",
    manufacturer: "Manufacturer",
    summary: "Manufacturer associated with transport ships, passenger craft, and Crusader's corporate identity.",
    tags: ["manufacturer", "Crusader", "cargo", "transport"],
    stats: { Type: "Manufacturer", Focus: "Transport", KnownFor: "C2 Hercules, Mercury Star Runner", System: "Stanton" }
  }),
  record({
    id: "manufacturer-drake",
    type: "manufacturer",
    slug: "drake-interplanetary",
    name: "Drake Interplanetary",
    nameZh: "德雷克星际",
    manufacturer: "Manufacturer",
    summary: "Manufacturer known for pragmatic ships favored by independent pilots and frontier operators.",
    tags: ["manufacturer", "Drake", "frontier"],
    stats: { Type: "Manufacturer", Focus: "Frontier utility", KnownFor: "Cutlass, Corsair, Vulture", System: "Human" }
  })
];

function tradeSource(freshness: FreshnessStatus = "fresh", sourceUpdatedAt = "2026-09-06"): SourceMetadata {
  return {
    sourceName: "ENIGMA Sample Trade Data",
    sourceUrl: "https://example.invalid/enigma-sample-trade-data",
    gameVersion: "sample",
    sourceUpdatedAt,
    freshness
  };
}

export const mockTradeRoutes: TradeRouteRecord[] = [
  {
    id: "gold-sm0-18-area18",
    commodity: "Gold",
    origin: "Seraphim Station",
    buyTerminal: "SM0-18",
    sellTerminal: "Area18 TDD",
    buyPrice: 7190,
    sellPrice: 7980,
    risk: "Medium",
    source: tradeSource()
  },
  {
    id: "beryl-bezdek-lorville",
    commodity: "Beryl",
    origin: "Seraphim Station",
    buyTerminal: "HDMS-Bezdek",
    sellTerminal: "Lorville CBD",
    buyPrice: 4180,
    sellPrice: 4620,
    risk: "Medium",
    source: tradeSource()
  },
  {
    id: "laranite-sal2-new-babbage",
    commodity: "Laranite",
    origin: "Seraphim Station",
    buyTerminal: "Shubin SAL-2",
    sellTerminal: "New Babbage TDD",
    buyPrice: 2710,
    sellPrice: 3180,
    risk: "High",
    source: tradeSource("recent", "2026-08-29")
  },
  {
    id: "medical-supplies-hickes-everus",
    commodity: "Medical Supplies",
    origin: "Seraphim Station",
    buyTerminal: "Hickes Research",
    sellTerminal: "Everus Harbor",
    buyPrice: 1710,
    sellPrice: 1915,
    risk: "Low",
    source: tradeSource("recent", "2026-08-30")
  },
  {
    id: "titanium-lathan-lorville",
    commodity: "Titanium",
    origin: "Seraphim Station",
    buyTerminal: "HDMS-Lathan",
    sellTerminal: "Lorville CBD",
    buyPrice: 820,
    sellPrice: 960,
    risk: "Low",
    source: tradeSource("recent", "2026-08-30")
  }
];

