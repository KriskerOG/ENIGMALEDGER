import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputFile = path.join(root, "data", "paratranz-terms.json");
const apiUrl = "https://paratranz.cn/api/projects/8340/terms";
const pageSize = 100;
const maxPages = 80;

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "ENIGMA Ledger localization sync"
    }
  });

  if (!response.ok) {
    throw new Error(`ParaTranz request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

const terms = [];
let pageCount = 1;

for (let page = 1; page <= Math.min(pageCount, maxPages); page += 1) {
  const url = new URL(apiUrl);
  url.searchParams.set("page", String(page));
  url.searchParams.set("pageSize", String(pageSize));

  const payload = await fetchJson(url);
  const results = Array.isArray(payload.results) ? payload.results : [];

  terms.push(...results);
  pageCount = Number.isFinite(Number(payload.pageCount)) ? Number(payload.pageCount) : pageCount;

  if (!results.length) {
    break;
  }
}

const snapshot = {
  source: "ParaTranz project 8340 public terms",
  sourceUrl: "https://paratranz.cn/projects/8340/terms",
  apiUrl,
  fetchedAt: new Date().toISOString(),
  count: terms.length,
  terms
};

mkdirSync(path.dirname(outputFile), { recursive: true });
writeFileSync(outputFile, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      count: terms.length,
      pageCount,
      outputFile: path.relative(root, outputFile)
    },
    null,
    2
  )
);
