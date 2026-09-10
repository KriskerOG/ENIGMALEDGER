import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputFile = path.join(root, "src", "lib", "generated", "cargo-ship-stats.ts");
const snapshotFile = path.join(root, "data", "starcitizen-tools-cargo-ships.json");
const cargoStatsUrl = "https://starcitizen.tools/Ship_cargo_stats";
const wikiApiUrl = "https://starcitizen.tools/api.php";

const manufacturerCodes = new Map(
  Object.entries({
    "Aegis Dynamics": "AEGS",
    "Anvil Aerospace": "ANVL",
    "Argo Astronautics": "ARGO",
    "Consolidated Outland": "CNOU",
    "Crusader Industries": "CRSD",
    "Drake Interplanetary": "DRAK",
    Esperia: "ESPR",
    "Gatac Manufacture": "GAMA",
    "Greycat Industrial": "GRIN",
    "Kruger Intergalactic": "KRIG",
    "Musashi Industrial and Starflight Concern": "MISC",
    Mirai: "MRAI",
    "Origin Jumpworks": "ORIG",
    "Roberts Space Industries": "RSI",
    "Tumbril Land Systems": "TMBL"
  })
);

function decodeHtml(value) {
  return String(value ?? "")
    .replace(/&nbsp;/g, " ")
    .replace(/&#95;/g, "_")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getAttr(value, attrName) {
  const match = String(value ?? "").match(new RegExp(`${attrName}=["']([^"']+)["']`, "i"));
  return match ? decodeHtml(match[1]) : undefined;
}

function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseNumber(value) {
  const number = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(number) ? number : 0;
}

function fetchViaPowerShell(url) {
  const command = [
    "$ProgressPreference='SilentlyContinue'",
    "[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)",
    "(Invoke-WebRequest -Uri $env:ENIGMA_SYNC_URL -UseBasicParsing -TimeoutSec 60).Content"
  ].join("; ");

  return execFileSync("powershell.exe", ["-NoProfile", "-Command", command], {
    encoding: "utf8",
    env: { ...process.env, ENIGMA_SYNC_URL: String(url) },
    maxBuffer: 128 * 1024 * 1024
  });
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "accept-language": "en-US,en;q=0.9",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
    }
  });

  if (!response.ok && process.platform === "win32") {
    return fetchViaPowerShell(url);
  }

  if (!response.ok) {
    throw new Error(`StarCitizen.tools request failed: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

async function fetchJson(url) {
  return JSON.parse(await fetchText(url));
}

function parseCargoRows(html) {
  const rows = [];

  for (const rowMatch of String(html ?? "").matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const rowHtml = rowMatch[1];
    const cells = Array.from(rowHtml.matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/gi));

    if (cells.length < 5) {
      continue;
    }

    const [nameCell, manufacturerCell, cargoCell, sizeCell, stateCell] = cells;
    const name = decodeHtml(nameCell[2]);
    const manufacturer = decodeHtml(manufacturerCell[2]);
    const cargoScu = parseNumber(getAttr(cargoCell[1], "data-sort-value") ?? decodeHtml(cargoCell[2]));

    if (!name || !manufacturer || cargoScu <= 0) {
      continue;
    }

    const href = getAttr(nameCell[2], "href");

    rows.push({
      name,
      slug: slugify(name),
      wikiTitle: getAttr(nameCell[2], "title") ?? name,
      manufacturer,
      manufacturerCode: manufacturerCodes.get(manufacturer) ?? manufacturer.match(/\b[A-Z0-9]/g)?.join("").slice(0, 4) ?? "MFG",
      cargoScu,
      size: decodeHtml(sizeCell[2]) || undefined,
      productionState: decodeHtml(stateCell[2]) || undefined,
      pledgeUrl: href ? new URL(href, "https://starcitizen.tools").toString() : `${cargoStatsUrl}#${encodeURIComponent(name)}`
    });
  }

  return rows;
}

async function fetchCargoRows() {
  const url = new URL(wikiApiUrl);
  url.searchParams.set("action", "parse");
  url.searchParams.set("page", "Ship_cargo_stats");
  url.searchParams.set("prop", "text");
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");

  const payload = await fetchJson(url);
  return parseCargoRows(payload?.parse?.text);
}

function chunks(values, size) {
  const result = [];

  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }

  return result;
}

async function fetchPageMetadata(titles) {
  const metadata = new Map();

  for (const chunk of chunks(titles, 50)) {
    const url = new URL(wikiApiUrl);
    url.searchParams.set("action", "query");
    url.searchParams.set("titles", chunk.join("|"));
    url.searchParams.set("prop", "pageimages|pageprops|info");
    url.searchParams.set("inprop", "url");
    url.searchParams.set("pithumbsize", "1200");
    url.searchParams.set("format", "json");
    url.searchParams.set("formatversion", "2");

    const payload = await fetchJson(url);

    for (const page of payload?.query?.pages ?? []) {
      metadata.set(page.title, {
        imageUrl: page.thumbnail?.source,
        summary: page.pageprops?.description ?? page.pageprops?.shortdesc,
        sourceUrl: page.fullurl,
        sourceUpdatedAt: page.touched
      });
    }
  }

  return metadata;
}

function loadZhTerms() {
  try {
    const snapshot = JSON.parse(readFileSync(path.join(root, "data", "paratranz-terms.json"), "utf8"));
    const terms = Array.isArray(snapshot.terms) ? snapshot.terms : [];
    const byEnglish = new Map();

    for (const item of terms) {
      const term = String(item.term ?? "").normalize("NFKC").trim().toLowerCase();
      const translation = String(item.translation ?? "").normalize("NFKC").trim();

      if (term && translation) {
        byEnglish.set(term, translation);
      }
    }

    return byEnglish;
  } catch {
    return new Map();
  }
}

const fetchedAt = new Date().toISOString();
const rows = await fetchCargoRows();
const metadata = await fetchPageMetadata(rows.map((row) => row.wikiTitle));
const zhTerms = loadZhTerms();

const ships = rows
  .map((row) => {
    const page = metadata.get(row.wikiTitle) ?? {};

    return {
      id: `cargo-stats-${row.slug}`,
      name: row.name,
      nameZh: zhTerms.get(row.name.toLowerCase()),
      slug: row.slug,
      manufacturer: row.manufacturer,
      manufacturerCode: row.manufacturerCode,
      role: row.productionState?.toLowerCase().includes("concept") ? "Concept cargo-capable ship" : "Cargo-capable ship",
      size: row.size,
      cargoScu: row.cargoScu,
      pledgeUrl: page.sourceUrl ?? row.pledgeUrl,
      imageUrl: page.imageUrl,
      productionState: row.productionState,
      summary: page.summary ?? `${row.name} has ${row.cargoScu.toLocaleString("en-US")} SCU cargo capacity in the StarCitizen.tools cargo table.`,
      source: {
        sourceName: "StarCitizen.tools Ship Cargo Stats",
        sourceUrl: page.sourceUrl ?? cargoStatsUrl,
        sourceRecordId: row.wikiTitle,
        fetchedAt,
        sourceUpdatedAt: page.sourceUpdatedAt,
        freshness: "recent"
      }
    };
  })
  .sort((left, right) => left.manufacturer.localeCompare(right.manufacturer) || left.name.localeCompare(right.name));

const generated = `import type { CargoShipRecord } from "../types";\n\nexport interface CargoShipStatsRecord extends CargoShipRecord {\n  nameZh?: string;\n  productionState?: string;\n  summary?: string;\n}\n\nexport const cargoShipStats: CargoShipStatsRecord[] = ${JSON.stringify(ships, null, 2)};\n`;

mkdirSync(path.dirname(outputFile), { recursive: true });
mkdirSync(path.dirname(snapshotFile), { recursive: true });
writeFileSync(outputFile, generated, "utf8");
writeFileSync(
  snapshotFile,
  `${JSON.stringify(
    {
      source: "StarCitizen.tools Ship cargo stats",
      sourceUrl: cargoStatsUrl,
      fetchedAt,
      count: ships.length,
      ships
    },
    null,
    2
  )}\n`,
  "utf8"
);

console.log(
  JSON.stringify(
    {
      count: ships.length,
      outputFile: path.relative(root, outputFile),
      snapshotFile: path.relative(root, snapshotFile)
    },
    null,
    2
  )
);
