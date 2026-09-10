import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const client = path.join(dist, "client");
const server = path.join(dist, "server");
const hostingDir = path.join(dist, ".openai");
const appBuild = path.join(root, ".next", "server", "app");

function loadTsExports(relativePath, exportNames) {
  const filename = path.join(root, relativePath);
  const script = `
    const moduleUrl = ${JSON.stringify(pathToFileURL(filename).href)};
    const exportNames = ${JSON.stringify(exportNames)};
    const module = await import(moduleUrl);
    const picked = Object.fromEntries(exportNames.map((name) => [name, module[name]]));
    process.stdout.write(JSON.stringify(picked));
  `;
  const output = execFileSync(process.execPath, ["--import", "tsx/esm", "-e", script], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024
  });

  return JSON.parse(output);
}

function requireFile(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`Missing Sites build input: ${filePath}`);
  }
}

requireFile(path.join(appBuild, "index.html"));
requireFile(path.join(root, "worker", "index.js"));

rmSync(dist, { recursive: true, force: true });
mkdirSync(client, { recursive: true });
mkdirSync(server, { recursive: true });
mkdirSync(hostingDir, { recursive: true });

cpSync(path.join(root, ".next", "static"), path.join(client, "_next", "static"), { recursive: true });
copyFileSync(path.join(appBuild, "index.html"), path.join(client, "index.html"));
copyFileSync(path.join(appBuild, "_not-found.html"), path.join(client, "404.html"));

const entityBuildDir = path.join(appBuild, "entity");
const entityClientDir = path.join(client, "entity");
mkdirSync(entityClientDir, { recursive: true });

for (const item of readdirSync(entityBuildDir, { withFileTypes: true })) {
  if (!item.isFile() || !item.name.endsWith(".html")) {
    continue;
  }

  const slug = item.name.slice(0, -".html".length);
  const targetDir = path.join(entityClientDir, slug);
  mkdirSync(targetDir, { recursive: true });
  copyFileSync(path.join(entityBuildDir, item.name), path.join(targetDir, "index.html"));
}

copyFileSync(path.join(root, "worker", "index.js"), path.join(server, "index.js"));
const { mockRecords, mockTradeRoutes } = loadTsExports("src/lib/mock-data.ts", ["mockRecords", "mockTradeRoutes"]);
const { dataSourceCatalog } = loadTsExports("src/lib/sources/catalog.ts", ["dataSourceCatalog"]);
const { localizationAliases } = loadTsExports("src/lib/generated/localization-aliases.ts", ["localizationAliases"]);
const { cargoShipStats } = loadTsExports("src/lib/generated/cargo-ship-stats.ts", ["cargoShipStats"]);
const { uexTradeLocations } = loadTsExports("src/lib/generated/uex-trade-locations.ts", ["uexTradeLocations"]);
const workerData = {
  searchRecords: mockRecords,
  tradeRoutes: mockTradeRoutes,
  sourceCatalog: dataSourceCatalog,
  localizationAliases,
  cargoShips: cargoShipStats,
  uexTradeLocations
};
const workerSource = readFileSync(path.join(root, "worker", "index.js"), "utf8");
const workerDataPrefix = `globalThis.__ENIGMA_WORKER_DATA__ = ${JSON.stringify(workerData)};\n`;
writeFileSync(path.join(server, "index.js"), workerDataPrefix + workerSource, "utf8");
writeFileSync(path.join(hostingDir, "hosting.json"), JSON.stringify({ d1: null, r2: null }, null, 2) + "\n", "utf8");

console.log("Prepared Sites build: dist/client, dist/server/index.js, and dist/.openai/hosting.json");
