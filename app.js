const records = [
  {
    id: "ship-c2-hercules",
    type: "ship",
    name: "Crusader C2 Hercules",
    zh: "C2 大力神",
    manufacturer: "Crusader Industries",
    summary: "Heavy cargo transport with high SCU capacity and long-range logistics utility.",
    source: "Star Citizen Wiki API",
    version: "Alpha 3.24.x",
    updated: "2026-08-30",
    freshness: "recent",
    tags: ["cargo", "large ship", "696 SCU"],
    stats: {
      Manufacturer: "Crusader",
      Role: "Cargo",
      Cargo: "696 SCU",
      Crew: "1-2",
    },
  },
  {
    id: "ship-prospector",
    type: "ship",
    name: "MISC Prospector",
    zh: "勘探者",
    manufacturer: "Musashi Industrial and Starflight Concern",
    summary: "Single-seat mining ship used for asteroid and surface resource extraction.",
    source: "Star Citizen Wiki API",
    version: "Alpha 3.24.x",
    updated: "2026-08-28",
    freshness: "recent",
    tags: ["mining", "industrial", "solo"],
    stats: {
      Manufacturer: "MISC",
      Role: "Mining",
      Cargo: "Mining bags",
      Crew: "1",
    },
  },
  {
    id: "component-xl1",
    type: "component",
    name: "XL-1 Quantum Drive",
    zh: "XL-1 量子驱动器",
    manufacturer: "Wei-Tek",
    summary: "Military-grade size 2 quantum drive commonly selected for fast travel.",
    source: "Star Citizen Wiki API",
    version: "Alpha 3.24.x",
    updated: "2026-08-31",
    freshness: "fresh",
    tags: ["quantum drive", "size 2", "military"],
    stats: {
      Type: "Quantum Drive",
      Size: "2",
      Grade: "A",
      Class: "Military",
    },
  },
  {
    id: "item-morozov",
    type: "item",
    name: "Morozov Heavy Armor",
    zh: "莫罗佐夫重甲",
    manufacturer: "Virgil",
    summary: "Heavy armor set suited to high-risk FPS contracts and hostile environments.",
    source: "Star Citizen Wiki API",
    version: "Alpha 3.24.x",
    updated: "2026-08-20",
    freshness: "stale",
    tags: ["armor", "heavy", "fps"],
    stats: {
      Category: "Armor",
      Weight: "Heavy",
      Slot: "Set",
      Usage: "FPS",
    },
  },
  {
    id: "commodity-gold",
    type: "commodity",
    name: "Gold",
    zh: "黄金",
    manufacturer: "Commodity",
    summary: "High-value commodity with strong trade interest and frequent route checking.",
    source: "UEX Corp API",
    version: "Alpha 3.24.x",
    updated: "2026-09-06",
    freshness: "fresh",
    tags: ["commodity", "high value", "trade"],
    stats: {
      Buy: "7,190 UEC",
      Sell: "7,980 UEC",
      Margin: "790 UEC",
      Risk: "Medium",
    },
  },
  {
    id: "location-seraphim",
    type: "location",
    name: "Seraphim Station",
    zh: "炽天使空间站",
    manufacturer: "Crusader",
    summary: "Orbital station over Crusader and ENIGMA's current Stanton coordination node.",
    source: "Star Citizen Wiki API",
    version: "Alpha 3.24.x",
    updated: "2026-08-25",
    freshness: "recent",
    tags: ["Crusader", "station", "BASEMENT"],
    stats: {
      System: "Stanton",
      Planet: "Crusader",
      Type: "Orbital Station",
      Role: "Logistics",
    },
  },
  {
    id: "shop-cousin-crows",
    type: "shop",
    name: "Cousin Crows",
    zh: "考辛克劳维修店",
    manufacturer: "Shop",
    summary: "Ship component and vehicle service shop located around Crusader's commerce network.",
    source: "SC Trade Tools API",
    version: "Alpha 3.24.x",
    updated: "2026-08-22",
    freshness: "stale",
    tags: ["shop", "components", "Crusader"],
    stats: {
      Location: "Orison",
      Category: "Ship Components",
      Sells: "Components",
      Source: "Community",
    },
  },
];

const tradeRoutes = [
  {
    commodity: "Gold",
    buy: "SM0-18",
    sell: "Area18 TDD",
    buyPrice: 7190,
    sellPrice: 7980,
    source: "UEX Corp API",
    updated: "2026-09-06",
    freshness: "fresh",
    risk: "Medium",
  },
  {
    commodity: "Beryl",
    buy: "HDMS-Bezdek",
    sell: "Lorville CBD",
    buyPrice: 4180,
    sellPrice: 4620,
    source: "UEX Corp API",
    updated: "2026-09-05",
    freshness: "fresh",
    risk: "Medium",
  },
  {
    commodity: "Laranite",
    buy: "Shubin SAL-2",
    sell: "New Babbage TDD",
    buyPrice: 2710,
    sellPrice: 3180,
    source: "SC Trade Tools API",
    updated: "2026-08-29",
    freshness: "recent",
    risk: "High",
  },
  {
    commodity: "Agricium",
    buy: "ArcCorp Mining Area 061",
    sell: "Area18 TDD",
    buyPrice: 2260,
    sellPrice: 2750,
    source: "UEX Corp API",
    updated: "2026-08-26",
    freshness: "recent",
    risk: "High",
  },
];

const labels = {
  ship: "舰船",
  component: "组件",
  item: "装备",
  commodity: "商品",
  location: "地点",
  shop: "商店",
};

const resultList = document.querySelector("#result-list");
const resultCount = document.querySelector("#result-count");
const searchInput = document.querySelector("#search-input");
const typeFilter = document.querySelector("#type-filter");
const freshnessFilter = document.querySelector("#freshness-filter");
const clearSearch = document.querySelector("#clear-search");
const detailPanel = document.querySelector("#detail-panel");
const metricRecords = document.querySelector("#metric-records");
const metricSources = document.querySelector("#metric-sources");
const metricFresh = document.querySelector("#metric-fresh");
const routeOrigin = document.querySelector("#route-origin");
const cargoCapacity = document.querySelector("#cargo-capacity");
const routeBudget = document.querySelector("#route-budget");
const routeList = document.querySelector("#route-list");
const routeSummary = document.querySelector("#route-summary");

function formatNumber(value) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function normalize(value) {
  return value.toLowerCase().trim();
}

function recordMatches(record, query) {
  if (!query) {
    return true;
  }

  const haystack = [
    record.name,
    record.zh,
    record.manufacturer,
    record.summary,
    record.source,
    record.type,
    ...record.tags,
    ...Object.values(record.stats),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

function getFilteredRecords() {
  const query = normalize(searchInput.value);
  const type = typeFilter.value;
  const freshness = freshnessFilter.value;

  return records.filter((record) => {
    const matchesType = type === "all" || record.type === type;
    const matchesFreshness = freshness === "all" || record.freshness === freshness;
    return matchesType && matchesFreshness && recordMatches(record, query);
  });
}

function renderMetrics() {
  const sources = new Set(records.map((record) => record.source));
  metricRecords.textContent = records.length;
  metricSources.textContent = sources.size;
  metricFresh.textContent = records.filter((record) => record.freshness === "fresh").length;
}

function renderResults() {
  const filtered = getFilteredRecords();
  resultCount.textContent = `${filtered.length} results`;

  if (!filtered.length) {
    resultList.innerHTML = `<article class="result-card"><div><div class="record-title"><h2>No matching records</h2></div><p class="record-summary">调整搜索词或筛选条件。</p></div></article>`;
    return;
  }

  resultList.innerHTML = filtered
    .map(
      (record) => `
        <button class="result-card" type="button" data-record-id="${record.id}">
          <div>
            <div class="record-title">
              <h2>${record.name}</h2>
              <small>${record.zh}</small>
            </div>
            <p class="record-summary">${record.summary}</p>
            <div class="tag-row">
              ${record.tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}
            </div>
            <div class="source-row">
              <span class="source-pill">${record.source}</span>
              <span class="source-pill">${record.version}</span>
              <span class="freshness ${record.freshness}">${record.freshness}</span>
            </div>
          </div>
          <span class="type-badge">${labels[record.type]}</span>
        </button>
      `,
    )
    .join("");

  document.querySelectorAll(".result-card[data-record-id]").forEach((button) => {
    button.addEventListener("click", () => selectRecord(button.dataset.recordId));
  });
}

function selectRecord(recordId) {
  const record = records.find((item) => item.id === recordId);
  if (!record) {
    return;
  }

  document.querySelectorAll(".result-card").forEach((button) => {
    button.classList.toggle("active", button.dataset.recordId === recordId);
  });

  detailPanel.innerHTML = `
    <p class="eyebrow">${labels[record.type]} · ${record.source}</p>
    <h2>${record.name}</h2>
    <p class="detail-summary">${record.zh} · ${record.summary}</p>
    <div class="detail-stats">
      ${Object.entries(record.stats)
        .map(
          ([key, value]) => `
            <div>
              <span>${key}</span>
              <strong>${value}</strong>
            </div>
          `,
        )
        .join("")}
    </div>
    <div class="source-row">
      <span class="source-pill">${record.version}</span>
      <span class="source-pill">Updated ${record.updated}</span>
      <span class="freshness ${record.freshness}">${record.freshness}</span>
    </div>
  `;
}

function calculateRoutes() {
  const cargo = Number(cargoCapacity.value || 0);
  const budget = Number(routeBudget.value || 0);

  return tradeRoutes
    .map((route) => {
      const purchasableScu = Math.max(0, Math.min(cargo, Math.floor(budget / route.buyPrice)));
      const profitPerScu = route.sellPrice - route.buyPrice;
      const totalProfit = purchasableScu * profitPerScu;
      const capitalUsed = purchasableScu * route.buyPrice;

      return {
        ...route,
        purchasableScu,
        profitPerScu,
        totalProfit,
        capitalUsed,
      };
    })
    .filter((route) => route.purchasableScu > 0)
    .sort((a, b) => b.totalProfit - a.totalProfit);
}

function renderRoutes() {
  const routes = calculateRoutes();
  const best = routes[0];
  const origin = routeOrigin.value;

  routeSummary.innerHTML = `
    <div>
      <strong>${best ? formatNumber(best.totalProfit) : 0}</strong>
      <span>Best Profit UEC</span>
    </div>
    <div>
      <strong>${best ? best.purchasableScu : 0}</strong>
      <span>Loaded SCU</span>
    </div>
    <div>
      <strong>${routes.length}</strong>
      <span>Routes from ${origin}</span>
    </div>
  `;

  routeList.innerHTML = routes
    .map(
      (route) => `
        <article class="route-card">
          <header>
            <h2>${route.commodity}</h2>
            <span class="freshness ${route.freshness}">${route.freshness}</span>
          </header>
          <p class="route-path">${route.buy} -> ${route.sell}</p>
          <div class="route-profit">
            <span>${route.purchasableScu} SCU · ${formatNumber(route.capitalUsed)} UEC capital</span>
            <strong>${formatNumber(route.totalProfit)} UEC</strong>
          </div>
          <div class="route-meta">
            <span class="source-pill">${route.source}</span>
            <span class="source-pill">Risk ${route.risk}</span>
            <span class="source-pill">Updated ${route.updated}</span>
          </div>
        </article>
      `,
    )
    .join("");
}

function bindPanels() {
  document.querySelectorAll(".nav-tab").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".nav-tab").forEach((tab) => tab.classList.remove("active"));
      document.querySelectorAll(".panel-section").forEach((panel) => panel.classList.remove("active-panel"));
      button.classList.add("active");
      document.querySelector(`#panel-${button.dataset.panel}`).classList.add("active-panel");
    });
  });
}

function drawMap() {
  const canvas = document.querySelector("#verse-map");
  const ctx = canvas.getContext("2d");
  const nodes = [
    { x: 0.18, y: 0.5, label: "Seraphim", color: "#d6a84f" },
    { x: 0.42, y: 0.24, label: "Area18", color: "#3cc8b4" },
    { x: 0.71, y: 0.33, label: "Lorville", color: "#a891f0" },
    { x: 0.78, y: 0.72, label: "New Babbage", color: "#7ac66a" },
    { x: 0.36, y: 0.74, label: "Grim HEX", color: "#df6d5f" },
  ];
  const links = [
    [0, 1],
    [0, 4],
    [1, 2],
    [2, 3],
    [3, 4],
    [0, 2],
  ];
  let tick = 0;

  function frame() {
    tick += 0.012;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#080a0d";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < 90; i += 1) {
      const x = ((i * 83) % canvas.width) + Math.sin(tick + i) * 1.8;
      const y = (i * 47) % canvas.height;
      const alpha = 0.2 + ((i % 7) / 20);
      ctx.fillStyle = `rgba(238, 242, 244, ${alpha})`;
      ctx.fillRect(x, y, 1.2, 1.2);
    }

    ctx.lineWidth = 1;
    links.forEach(([a, b], index) => {
      const start = nodes[a];
      const end = nodes[b];
      const pulse = 0.22 + Math.sin(tick * 3 + index) * 0.12;
      ctx.strokeStyle = `rgba(214, 168, 79, ${pulse})`;
      ctx.beginPath();
      ctx.moveTo(start.x * canvas.width, start.y * canvas.height);
      ctx.lineTo(end.x * canvas.width, end.y * canvas.height);
      ctx.stroke();
    });

    nodes.forEach((node, index) => {
      const x = node.x * canvas.width;
      const y = node.y * canvas.height;
      const radius = 5 + Math.sin(tick * 4 + index) * 1.2;

      ctx.fillStyle = node.color;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `${node.color}66`;
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = "#eef2f4";
      ctx.font = "12px Segoe UI, sans-serif";
      ctx.fillText(node.label, x + 13, y + 4);
    });

    requestAnimationFrame(frame);
  }

  frame();
}

searchInput.addEventListener("input", renderResults);
typeFilter.addEventListener("change", renderResults);
freshnessFilter.addEventListener("change", renderResults);
clearSearch.addEventListener("click", () => {
  searchInput.value = "";
  typeFilter.value = "all";
  freshnessFilter.value = "all";
  renderResults();
});

[routeOrigin, cargoCapacity, routeBudget].forEach((element) => {
  element.addEventListener("input", renderRoutes);
  element.addEventListener("change", renderRoutes);
});

renderMetrics();
renderResults();
selectRecord(records[0].id);
renderRoutes();
bindPanels();
drawMap();

