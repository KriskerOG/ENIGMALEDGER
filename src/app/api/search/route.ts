import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { aggregateSearch, flattenProviderResults } from "@/lib/search-aggregate";
import { getClientIp, rateLimitRequest } from "@/lib/security/rate-limit";
import { withSecurityHeaders } from "@/lib/security/headers";

export const runtime = "nodejs";

const SearchQuerySchema = z.object({
  q: z.string().trim().max(80).optional().default(""),
  type: z
    .enum(["all", "ship", "vehicle", "component", "weapon", "armor", "equipment", "commodity", "location", "shop", "manufacturer"])
    .optional()
    .default("all"),
  freshness: z.enum(["all", "fresh", "recent", "stale", "unknown"]).optional().default("all"),
  source: z.enum(["all", "database", "local", "wiki"]).optional().default("all"),
  limit: z.coerce.number().int().min(1).max(50).optional().default(25)
});

export async function GET(request: NextRequest) {
  const clientIp = getClientIp(request);
  const rateLimit = await rateLimitRequest({
    key: `search:${clientIp}`,
    limit: 120,
    windowSeconds: 60
  });

  if (!rateLimit.allowed) {
    return withSecurityHeaders(
      NextResponse.json(
        { error: "Too many search requests." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000))
          }
        }
      )
    );
  }

  const parsed = SearchQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()));

  if (!parsed.success) {
    return withSecurityHeaders(
      NextResponse.json(
        {
          error: "Invalid search query.",
          issues: parsed.error.flatten().fieldErrors
        },
        { status: 400 }
      )
    );
  }

  const providerResults = await aggregateSearch({
    query: parsed.data.q,
    type: parsed.data.type,
    freshness: parsed.data.freshness,
    source: parsed.data.source,
    limit: parsed.data.limit
  });
  const records = flattenProviderResults(providerResults, parsed.data.limit);

  return withSecurityHeaders(
    NextResponse.json({
      data: records,
      meta: {
        count: records.length,
        source: providerResults.map((result) => result.provider).join("+") || "none",
        providers: providerResults.map((result) => ({
          id: result.provider,
          count: result.records.length,
          error: result.error
        })),
        rateLimit: {
          limit: rateLimit.limit,
          remaining: rateLimit.remaining,
          resetAt: new Date(rateLimit.resetAt).toISOString()
        }
      }
    })
  );
}
