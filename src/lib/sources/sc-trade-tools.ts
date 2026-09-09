import { env } from "../env";
import { fetchJson } from "./http";

const allowedResources = new Set(["commodities", "locations", "shops", "terminals"]);

export async function fetchScTradeToolsResource<T>(
  resource: string,
  params: Record<string, string | number | boolean | undefined> = {}
): Promise<T> {
  if (!allowedResources.has(resource)) {
    throw new Error(`SC Trade Tools resource is not allowed: ${resource}`);
  }

  return fetchJson<T>(`${env.SC_TRADE_TOOLS_API_BASE_URL}/${resource}`, {
    searchParams: params
  });
}
