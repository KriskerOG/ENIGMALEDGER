import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageOrder = ["cnrsui_v2", "cn_search_v1", "cnen_v1", "cne_v1", "cn_pinyin_v1", "cn_v1"];
const maxAliases = 32000;
const paratranzTermsFile = path.join(root, "data", "paratranz-terms.json");
const cjkRe = /[\u3400-\u9fff]/u;
const englishRe = /[A-Za-z]/u;
const placeholders =
  /(~mission\(|\{\{|\}\}|<\/?|Mission|Destination|Location|Address|Objective|Current|Total|Player|Contractor|Items|Token|Variable|Default|DEBUG|WIP|UNINITIALIZED)/i;
const badEnglishExact = new Set([
  "UEE",
  "UEC",
  "AUEC",
  "SCU",
  "FPS",
  "NPC",
  "HUD",
  "MFD",
  "ATC",
  "ASOP",
  "UI",
  "PU",
  "LIVE",
  "TRUE",
  "FALSE",
  "NULL"
]);

function cleanMarkup(value) {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/\\n/g, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function compact(value) {
  return cleanMarkup(value)
    .replace(/[\t\r]+/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .replace(/^[-*#\s:：,，.。;；|/\\]+|[-*#\s:：,，.。;；|/\\]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeIdentity(value) {
  return compact(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s_\-·・:：,，.。;；'"()[\]（）]+/g, " ")
    .trim();
}

function trimAliasZh(value) {
  return compact(value)
    .replace(/^[\s\u3000的上于在从至到和及与以及其中其内外]+/u, "")
    .replace(/[（(]\s*$/u, "")
    .trim();
}

function trimAliasEn(value) {
  return compact(value)
    .replace(/^[-–—]+\s*/, "")
    .replace(/\s*[-–—]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyEnglishAlias(value) {
  const text = trimAliasEn(value);
  const identity = text.toUpperCase().replace(/[^A-Z0-9]/g, "");

  if (!englishRe.test(text) || placeholders.test(text)) {
    return false;
  }

  if (text.length < 2 || text.length > 84) {
    return false;
  }

  if (badEnglishExact.has(identity)) {
    return false;
  }

  if (/^\d+(?:\.\d+)?\s*(?:SCU|UEC|AUEC|K)$/i.test(text)) {
    return false;
  }

  if (/^[A-Z]{1,5}$/.test(text) && !["MISC", "ARGO", "ANVL", "Aegis"].includes(text)) {
    return false;
  }

  return (text.match(/[A-Za-z]/g) ?? []).length >= 2;
}

function isLikelyChineseAlias(value) {
  const text = trimAliasZh(value);

  if (!cjkRe.test(text) || placeholders.test(text)) {
    return false;
  }

  if (text.length < 2 || text.length > 42) {
    return false;
  }

  if (/\d+\s*(?:SCU|UEC|aUEC)/i.test(text)) {
    return false;
  }

  return (text.match(/[\u3400-\u9fff]/gu) ?? []).length >= 2;
}

function packagePriority(packageId) {
  const index = packageOrder.indexOf(packageId);
  return index === -1 ? 0 : (packageOrder.length - index) * 10;
}

function keyPriority(key) {
  const normalized = key.toLowerCase();

  if (normalized.startsWith("paratranz_term_")) {
    return 120;
  }

  if (normalized.startsWith("vehicle_name")) {
    return 90;
  }

  if (normalized.startsWith("items_commodities_")) {
    return 84;
  }

  if (normalized.includes("mission_location")) {
    return 80;
  }

  if (normalized.includes("journal_general_harvestables")) {
    return 70;
  }

  if (normalized.includes("transfer") || (normalized.includes("_desc") && /stanton|pyro|nyx|location/.test(normalized))) {
    return 55;
  }

  if (normalized.startsWith("item_name")) {
    return 45;
  }

  if (normalized.startsWith("mission_item")) {
    return 40;
  }

  if (normalized.startsWith("item_desc")) {
    return 20;
  }

  return 10;
}

const aliases = new Map();

function addAlias(rawZh, rawEn, key, packageId, kind, bonus = 0) {
  const zh = trimAliasZh(rawZh);
  const en = trimAliasEn(rawEn);

  if (!isLikelyChineseAlias(zh) || !isLikelyEnglishAlias(en)) {
    return;
  }

  if (normalizeIdentity(zh) === normalizeIdentity(en)) {
    return;
  }

  if (normalizeIdentity(en).includes("plushie") && !normalizeIdentity(zh).includes("\u6bdb\u7ed2")) {
    return;
  }

  const identity = `${normalizeIdentity(zh)}=>${normalizeIdentity(en)}`;
  const score = packagePriority(packageId) + keyPriority(key) + bonus;
  const existing = aliases.get(identity);

  if (!existing || score > existing.score) {
    aliases.set(identity, { zh, en, key, packageId, kind, score });
  }
}

function toVariantList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item : item?.term ?? item?.value ?? item?.text ?? ""))
    .map(trimAliasEn)
    .filter(Boolean);
}

function addParatranzTerms() {
  if (!existsSync(paratranzTermsFile)) {
    return;
  }

  const snapshot = JSON.parse(readFileSync(paratranzTermsFile, "utf8"));
  const terms = Array.isArray(snapshot.terms) ? snapshot.terms : [];

  for (const item of terms) {
    const id = String(item.id ?? "").trim();
    const term = trimAliasEn(item.term);
    const translation = trimAliasZh(item.translation);

    if (!id || !term || !translation) {
      continue;
    }

    addAlias(translation, term, `paratranz_term_${id}`, "paratranz_terms", "term", 80);

    for (const variant of toVariantList(item.variants)) {
      addAlias(translation, variant, `paratranz_term_${id}_variant`, "paratranz_terms", "term-variant", 76);
    }
  }
}

function extractBracketPairs(value, key, packageId) {
  const text = cleanMarkup(value);
  const forward =
    /(?:^|[\s\n\]）)>:：,，;；。])[\s\n]*([\u3400-\u9fff][^\n\r<>{}\[\]（）()]{0,44}?)\s*[\(（\[]\s*([A-Z][A-Za-z0-9][A-Za-z0-9'&./:+\- ]{0,78})\s*[\)）\]]/g;
  const reverse =
    /(?:^|[\s\n\]）)>:：,，;；。])[\s\n]*([A-Z][A-Za-z0-9][A-Za-z0-9'&./:+\- ]{0,78})\s*[\(（\[]\s*([\u3400-\u9fff][^\n\r<>{}\[\]（）()]{0,44}?)\s*[\)）\]]/g;
  let match;

  while ((match = forward.exec(text))) {
    addAlias(match[1], match[2], key, packageId, "bracket", 24);
  }

  while ((match = reverse.exec(text))) {
    addAlias(match[2], match[1], key, packageId, "bracket", 24);
  }
}

function extractLinePairs(value, key, packageId) {
  const lines = cleanMarkup(value)
    .split("\n")
    .map(compact)
    .filter(Boolean)
    .slice(0, 8);

  for (let index = 0; index < lines.length - 1; index += 1) {
    const left = lines[index];
    const right = lines[index + 1];
    const leftHasCjk = cjkRe.test(left);
    const rightHasCjk = cjkRe.test(right);

    if (leftHasCjk && !rightHasCjk && englishRe.test(right)) {
      addAlias(left, right, key, packageId, "line", 36);
    }

    if (!leftHasCjk && englishRe.test(left) && rightHasCjk) {
      addAlias(right, left, key, packageId, "line", 36);
    }
  }
}

function extractGluedPairs(value, key, packageId) {
  const text = cleanMarkup(value)
    .replace(/[<>]/g, " ")
    .replace(/[\n，。；;:：、|/\\]+/g, "\n");
  const glued =
    /([\u3400-\u9fff][\u3400-\u9fff0-9\s·・\-]{1,30})([A-Z][A-Za-z][A-Za-z0-9'&./:+\-]*(?:\s+[A-Z0-9][A-Za-z0-9'&./:+\-]*){0,5})(?=$|\s|[\n（）()，。；;:：、])/g;
  let match;

  while ((match = glued.exec(text))) {
    addAlias(match[1], match[2], key, packageId, "glued", 30);
  }
}

for (const packageId of packageOrder) {
  const filename = path.join(root, "data", "localization-snapshots", "packages", packageId, "global.ini");

  if (!existsSync(filename)) {
    continue;
  }

  const content = readFileSync(filename, "utf8").replace(/^\uFEFF/, "");

  for (const line of content.split(/\r?\n/)) {
    const separator = line.indexOf("=");

    if (separator <= 0) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();

    if (!value || !cjkRe.test(value)) {
      continue;
    }

    extractLinePairs(value, key, packageId);
    extractBracketPairs(value, key, packageId);
    extractGluedPairs(value, key, packageId);
  }
}

addParatranzTerms();

const sorted = Array.from(aliases.values())
  .filter((item) => item.zh.length <= 42 && item.en.length <= 84)
  .sort(
    (left, right) =>
      right.score - left.score || left.zh.localeCompare(right.zh, "zh-Hans") || left.en.localeCompare(right.en)
  )
  .slice(0, maxAliases)
  .map((item, index) => ({
    id: `loc-${String(index + 1).padStart(5, "0")}`,
    zh: item.zh,
    en: item.en,
    key: item.key,
    packageId: item.packageId,
    kind: item.kind
  }));

const outputDir = path.join(root, "src", "lib", "generated");
mkdirSync(outputDir, { recursive: true });

const outputFile = path.join(outputDir, "localization-aliases.ts");
const source = `export interface LocalizationAlias {\n  id: string;\n  zh: string;\n  en: string;\n  key: string;\n  packageId: string;\n  kind?: string;\n}\n\nexport const localizationAliases: LocalizationAlias[] = ${JSON.stringify(sorted, null, 2)};\n\nexport function normalizeLocalizationAliasText(value: string | number | null | undefined): string {\n  return String(value ?? \"\")\n    .normalize(\"NFKC\")\n    .toLowerCase()\n    .replace(/[\\s_\\-·・:：,，.。;；'\\\"()[\\]（）]+/g, \" \")\n    .trim();\n}\n\nfunction normalizeLooseLocalizationAliasText(value: string | number | null | undefined): string {\n  return normalizeLocalizationAliasText(value).replace(/[aeiou]/g, \"\").replace(/\\s+/g, \"\");\n}\n\nexport function findLocalizationAliases(query: string | undefined, limit = 8, aliasSource = localizationAliases): LocalizationAlias[] {\n  const normalizedQuery = normalizeLocalizationAliasText(query);\n  const looseQuery = normalizeLooseLocalizationAliasText(query);\n\n  if (!normalizedQuery) {\n    return [];\n  }\n\n  return aliasSource\n    .map((alias) => {\n      const zh = normalizeLocalizationAliasText(alias.zh);\n      const en = normalizeLocalizationAliasText(alias.en);\n      const key = normalizeLocalizationAliasText(alias.key);\n      const looseEn = normalizeLooseLocalizationAliasText(alias.en);\n      const exact = zh === normalizedQuery || en === normalizedQuery ? 100 : 0;\n      const prefix = zh.startsWith(normalizedQuery) || en.startsWith(normalizedQuery) ? 70 : 0;\n      const contains = zh.includes(normalizedQuery) || en.includes(normalizedQuery) || key.includes(normalizedQuery) ? 35 : 0;\n      const reverseContains = normalizedQuery.includes(zh) || normalizedQuery.includes(en) ? 20 : 0;\n      const loose = looseQuery.length >= 4 && looseEn.length >= 4 && (looseEn === looseQuery || looseEn.includes(looseQuery) || looseQuery.includes(looseEn)) ? 18 : 0;\n      const score = exact || prefix || contains || reverseContains || loose;\n\n      return { alias, score };\n    })\n    .filter((item) => item.score > 0)\n    .sort((left, right) => right.score - left.score || left.alias.zh.length - right.alias.zh.length)\n    .slice(0, limit)\n    .map((item) => item.alias);\n}\n`;

writeFileSync(outputFile, source, "utf8");

console.log(
  JSON.stringify(
    {
      aliases: sorted.length,
      candidates: aliases.size,
      outputFile: path.relative(root, outputFile)
    },
    null,
    2
  )
);
