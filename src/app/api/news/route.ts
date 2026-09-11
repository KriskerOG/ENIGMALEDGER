import { NextResponse } from "next/server";
import { withSecurityHeaders } from "@/lib/security/headers";

export const runtime = "nodejs";

const RSI_BASE_URL = "https://robertsspaceindustries.com";

const officialFeeds = [
  {
    id: "patch-notes",
    name: "RSI Patch Notes",
    url: `${RSI_BASE_URL}/en/patch-notes`,
    defaultCategory: "patch"
  },
  {
    id: "comm-link",
    name: "RSI Comm-Link",
    url: `${RSI_BASE_URL}/en/comm-link`,
    defaultCategory: "official"
  }
] as const;

type NewsCategory = "patch" | "hotfix" | "event" | "roadmap" | "weekly" | "report" | "official";

interface OfficialNewsItem {
  id: string;
  title: string;
  titleZh: string;
  category: NewsCategory;
  categoryZh: string;
  sourceName: string;
  sourceUrl: string;
  url: string;
  posted: string;
  summary: string;
  summaryZh: string;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&ndash;/g, "-")
    .replace(/&mdash;/g, "-")
    .replace(/&hellip;/g, "...")
    .replace(/&nbsp;/g, " ");
}

function stripTags(value: string): string {
  return decodeHtml(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function getCategory(title: string, fallback: NewsCategory): NewsCategory {
  const normalized = title.toLowerCase();

  if (normalized.includes("hotfix")) {
    return "hotfix";
  }

  if (fallback === "patch" || normalized.includes("alpha ") || normalized.includes("patch notes")) {
    return "patch";
  }

  if (normalized.includes("roadmap")) {
    return "roadmap";
  }

  if (normalized.includes("this week in star citizen")) {
    return "weekly";
  }

  if (normalized.includes("monthly report")) {
    return "report";
  }

  if (
    normalized.includes("pirate week") ||
    normalized.includes("iae") ||
    normalized.includes("luminalia") ||
    normalized.includes("coramor") ||
    normalized.includes("red festival") ||
    normalized.includes("stella fortuna") ||
    normalized.includes("invictus") ||
    normalized.includes("alien week") ||
    normalized.includes("foundation festival")
  ) {
    return "event";
  }

  return fallback;
}

function getCategoryZh(category: NewsCategory): string {
  const labels: Record<NewsCategory, string> = {
    patch: "版本更新",
    hotfix: "热修",
    event: "活动",
    roadmap: "路线图",
    weekly: "周报",
    report: "报告",
    official: "官方公告"
  };

  return labels[category];
}

function localizeTitle(title: string, category: NewsCategory): string {
  const replacements: Array<[RegExp, string]> = [
    [/This Week in Star Citizen/i, "本周星际公民"],
    [/Roadmap Roundup/i, "路线图汇总"],
    [/Star Citizen Monthly Report/i, "星际公民月度报告"],
    [/Monthly Report/i, "月度报告"],
    [/Pirate Week/i, "海盗周"],
    [/Luminalia/i, "光灯节"],
    [/Coramor/i, "科拉爱人节"],
    [/Red Festival/i, "火红节"],
    [/Stella Fortuna/i, "幸运星节"],
    [/Invictus Launch Week|ILW/i, "舰队周"],
    [/Alien Week/i, "外星周"],
    [/Foundation Festival/i, "奠基节"],
    [/Subscriber Promotions/i, "订阅者促销"],
    [/Jump Point Now Available/i, "Jump Point 杂志已发布"],
    [/Letter From The Chairman/i, "主席来信"],
    [/Improving The Live Experience/i, "改善线上体验"],
    [/Patch Notes/i, "补丁说明"],
    [/Hotfix/i, "热修"]
  ];

  const translated = replacements.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), title);

  if (translated !== title) {
    return translated;
  }

  if (category === "patch") {
    return `版本更新：${title}`;
  }

  if (category === "hotfix") {
    return `热修：${title}`;
  }

  if (category === "official") {
    return `官方公告：${title}`;
  }

  return title;
}

function localizeSummary(summary: string, category: NewsCategory): string {
  if (!summary) {
    return `${getCategoryZh(category)}新闻，点击查看官方原文。`;
  }

  if (category === "patch") {
    return "版本补丁说明，建议查看原文确认具体改动。";
  }

  if (category === "hotfix") {
    return "热修说明，通常包含临时修复和线上问题处理。";
  }

  if (category === "event") {
    return "官方活动新闻，包含活动时间、奖励或商店内容。";
  }

  if (category === "roadmap") {
    return "路线图更新，包含开发进度和计划调整。";
  }

  if (category === "weekly") {
    return "官方周报，汇总本周活动和公告。";
  }

  if (category === "report") {
    return "官方月报，汇总各团队开发进展。";
  }

  return "官方公告，点击查看原文。";
}

function getTitleFromHref(href: string): string {
  const slug = href.split("/").pop() ?? href;
  return decodeURIComponent(slug.replace(/^\d+-/, "").replace(/-/g, " "));
}

function parseNewsCardText(text: string, href: string): { title: string; posted: string; summary: string } {
  const fallbackTitle = getTitleFromHref(href);
  const compact = text.replace(/^(post|patchnotes)\s+/i, "").replace(/\s+/g, " ").trim();
  const parts = compact.match(/^(.*?)\s+\d+\s+Posted:\s+(.+)$/i);

  if (!parts) {
    return {
      title: fallbackTitle,
      posted: "",
      summary: ""
    };
  }

  const postedMatch = parts[2].match(/^((?:\d+\s+)?(?:minute|hour|day|week|month|year)s?\s+ago|today|yesterday)\s*(.*)$/i);

  return {
    title: parts[1].trim() || fallbackTitle,
    posted: postedMatch?.[1] ?? "",
    summary: postedMatch?.[2]?.trim() ?? ""
  };
}

async function fetchFeed(feed: (typeof officialFeeds)[number]): Promise<OfficialNewsItem[]> {
  const response = await fetch(feed.url, {
    headers: {
      "User-Agent": "ENIGMA Ledger news index/1.0"
    },
    next: {
      revalidate: 900
    }
  });

  if (!response.ok) {
    throw new Error(`${feed.id} ${response.status}`);
  }

  const html = await response.text();
  const matches = Array.from(html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g));
  const seen = new Set<string>();

  return matches
    .map<OfficialNewsItem | undefined>((match) => {
      const href = match[1];

      if (!href.includes("/comm-link/") || href.includes("{$")) {
        return undefined;
      }

      const url = href.startsWith("http") ? href : `${RSI_BASE_URL}${href}`;
      const text = stripTags(match[2]);

      if (!text || seen.has(url)) {
        return undefined;
      }

      seen.add(url);

      const parsed = parseNewsCardText(text, href);
      const category = getCategory(parsed.title, feed.defaultCategory);

      return {
        id: `${feed.id}:${href}`,
        title: parsed.title,
        titleZh: localizeTitle(parsed.title, category),
        category,
        categoryZh: getCategoryZh(category),
        sourceName: feed.name,
        sourceUrl: feed.url,
        url,
        posted: parsed.posted,
        summary: parsed.summary,
        summaryZh: localizeSummary(parsed.summary, category)
      };
    })
    .filter((item): item is OfficialNewsItem => item !== undefined)
    .slice(0, feed.id === "patch-notes" ? 10 : 16);
}

export async function GET() {
  const results = await Promise.allSettled(officialFeeds.map(fetchFeed));
  const items = results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));

  return withSecurityHeaders(
    NextResponse.json({
      data: items,
      meta: {
        count: items.length,
        source: "RSI official",
        updatedAt: new Date().toISOString(),
        providers: results.map((result, index) => ({
          id: officialFeeds[index].id,
          status: result.status,
          url: officialFeeds[index].url
        }))
      }
    })
  );
}
