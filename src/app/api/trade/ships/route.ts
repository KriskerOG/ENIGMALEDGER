import { NextResponse, type NextRequest } from "next/server";
import { getClientIp, rateLimitRequest } from "@/lib/security/rate-limit";
import { withSecurityHeaders } from "@/lib/security/headers";
import { fetchWikiCargoShips } from "@/lib/sources/star-citizen-wiki";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const clientIp = getClientIp(request);
  const rateLimit = await rateLimitRequest({
    key: `trade-ships:${clientIp}`,
    limit: 40,
    windowSeconds: 60
  });

  if (!rateLimit.allowed) {
    return withSecurityHeaders(
      NextResponse.json(
        { error: "Too many ship catalog requests." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000))
          }
        }
      )
    );
  }

  try {
    const refresh = ["1", "true"].includes(request.nextUrl.searchParams.get("refresh") ?? "");
    const ships = await fetchWikiCargoShips(refresh);

    return withSecurityHeaders(
      NextResponse.json({
        data: ships,
        meta: {
          count: ships.length,
          source: "starcitizen.tools",
          rateLimit: {
            limit: rateLimit.limit,
            remaining: rateLimit.remaining,
            resetAt: new Date(rateLimit.resetAt).toISOString()
          }
        }
      })
    );
  } catch (error) {
    return withSecurityHeaders(
      NextResponse.json(
        {
          error: "Ship catalog unavailable.",
          message: error instanceof Error ? error.message : "Unknown ship catalog error."
        },
        { status: 502 }
      )
    );
  }
}
