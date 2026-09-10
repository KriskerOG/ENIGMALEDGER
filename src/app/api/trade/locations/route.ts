import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getClientIp, rateLimitRequest } from "@/lib/security/rate-limit";
import { withSecurityHeaders } from "@/lib/security/headers";
import {
  fetchUexTradeLocationSuggestions,
  getTradeQueryCandidates,
  type UexTradeLocationSuggestion
} from "@/lib/sources/uex";

export const runtime = "nodejs";

const LocationQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20)
});

function aliasFallbackSuggestions(query: string | undefined, limit: number): UexTradeLocationSuggestion[] {
  return getTradeQueryCandidates(query, "location", limit).map((candidate, index) => ({
    id: -1 - index,
    name: candidate,
    displayName: candidate,
    type: "alias"
  }));
}

export async function GET(request: NextRequest) {
  const clientIp = getClientIp(request);
  const rateLimit = await rateLimitRequest({
    key: `trade-locations:${clientIp}`,
    limit: 120,
    windowSeconds: 60
  });

  if (!rateLimit.allowed) {
    return withSecurityHeaders(
      NextResponse.json(
        { error: "Too many trade location requests." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000))
          }
        }
      )
    );
  }

  const parsed = LocationQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()));

  if (!parsed.success) {
    return withSecurityHeaders(
      NextResponse.json(
        {
          error: "Invalid trade location query.",
          issues: parsed.error.flatten().fieldErrors
        },
        { status: 400 }
      )
    );
  }

  try {
    const data = await fetchUexTradeLocationSuggestions(parsed.data.q, parsed.data.limit);

    return withSecurityHeaders(
      NextResponse.json({
        data,
        meta: {
          count: data.length,
          source: "uex",
          rateLimit: {
            limit: rateLimit.limit,
            remaining: rateLimit.remaining,
            resetAt: new Date(rateLimit.resetAt).toISOString()
          }
        }
      })
    );
  } catch (error) {
    const data = aliasFallbackSuggestions(parsed.data.q, parsed.data.limit);

    return withSecurityHeaders(
      NextResponse.json({
        data,
        meta: {
          count: data.length,
          source: "localization",
          warning: error instanceof Error ? error.message : "UEX location lookup unavailable."
        }
      })
    );
  }
}
