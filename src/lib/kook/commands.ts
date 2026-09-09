import { searchRecords } from "../search";
import { calculateTradeRoutes } from "../trade";
import type { KookCommand, KookReply } from "./types";
import { formatSourceLine, sanitizeKookText } from "./markdown";

const commandAliases = new Map<string, KookCommand["name"]>([
  ["help", "help"],
  ["h", "help"],
  ["search", "search"],
  ["s", "search"],
  ["查", "search"],
  ["ship", "ship"],
  ["ships", "ship"],
  ["船", "ship"],
  ["item", "item"],
  ["i", "item"],
  ["物品", "item"],
  ["price", "price"],
  ["p", "price"],
  ["价格", "price"],
  ["route", "route"],
  ["r", "route"],
  ["跑商", "route"]
]);

export function parseKookCommand(content: string): KookCommand | null {
  const raw = content.trim();

  if (!raw.startsWith("/") && !raw.startsWith("!")) {
    return null;
  }

  const [commandName = "", ...args] = raw.slice(1).split(/\s+/).filter(Boolean);
  const name = commandAliases.get(commandName.toLowerCase()) ?? "unknown";

  return {
    name,
    args,
    raw
  };
}

function helpReply(): KookReply {
  return {
    shouldSend: true,
    content: [
      "ENIGMA Verse Index",
      "/search <关键词> - 查询舰船、物品、地点、商品",
      "/ship <舰船名> - 查询舰船",
      "/item <物品名> - 查询物品或组件",
      "/price <商品名> - 查询商品价格记录",
      "/route <货舱SCU> <预算UEC> - 估算跑商收益"
    ].join("\n")
  };
}

export async function handleKookCommand(command: KookCommand): Promise<KookReply> {
  switch (command.name) {
    case "help":
      return helpReply();

    case "search":
    case "ship":
    case "item":
    case "price": {
      const query = command.args.join(" ").trim();

      if (!query) {
        return {
          shouldSend: true,
          content: "请输入关键词，例如 /ship C2 或 /price Gold。"
        };
      }

      const type =
        command.name === "ship"
          ? "ship"
          : command.name === "price"
            ? "commodity"
            : command.name === "item"
              ? "all"
              : "all";

      const results = searchRecords({ query, type, limit: 3 });

      if (!results.length) {
        return {
          shouldSend: true,
          content: `没有找到：${sanitizeKookText(query, 120)}`
        };
      }

      return {
        shouldSend: true,
        content: results
          .map((record, index) => {
            const title = `${index + 1}. ${sanitizeKookText(record.name, 120)}${
              record.nameZh ? ` / ${sanitizeKookText(record.nameZh, 80)}` : ""
            }`;
            const summary = sanitizeKookText(record.summary, 220);
            const source = formatSourceLine(
              record.source.sourceName,
              record.source.freshness,
              record.source.sourceUpdatedAt
            );
            return [title, summary, source].join("\n");
          })
          .join("\n\n")
      };
    }

    case "route": {
      const cargoScu = Number(command.args[0] ?? 696);
      const budgetUec = Number(command.args[1] ?? 750000);

      if (!Number.isFinite(cargoScu) || !Number.isFinite(budgetUec) || cargoScu <= 0 || budgetUec <= 0) {
        return {
          shouldSend: true,
          content: "格式：/route <货舱SCU> <预算UEC>，例如 /route 696 750000。"
        };
      }

      const routes = calculateTradeRoutes({
        origin: "Seraphim Station",
        cargoScu,
        budgetUec,
        limit: 3
      });

      if (!routes.length) {
        return {
          shouldSend: true,
          content: "当前预算或货舱容量下没有可用路线。"
        };
      }

      return {
        shouldSend: true,
        content: routes
          .map((route, index) =>
            [
              `${index + 1}. ${sanitizeKookText(route.commodity, 80)}: ${route.buyTerminal} -> ${route.sellTerminal}`,
              `${route.purchasableScu} SCU · Profit ${route.totalProfit.toLocaleString("en-US")} UEC`,
              formatSourceLine(route.source.sourceName, route.source.freshness, route.source.sourceUpdatedAt)
            ].join("\n")
          )
          .join("\n\n")
      };
    }

    default:
      return {
        shouldSend: true,
        content: "未知命令。输入 /help 查看可用命令。"
      };
  }
}

