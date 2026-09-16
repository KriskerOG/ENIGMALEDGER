import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { withSecurityHeaders } from "@/lib/security/headers";
import { getClientIp, rateLimitRequest } from "@/lib/security/rate-limit";
import { fetchUexSellOptions } from "@/lib/sources/uex";

export const runtime = "nodejs";

const SellQuerySchema = z.object({
  commodity: z.string().trim().min(1).max(120),
  cargoScu: z.coerce.number().int().min(1).max(100000).default(100),
  buyPricePerScu: z.coerce.number().min(0).max(100000000).optional().default(0),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  refresh: z
    .string()
    .optional()
    .transform((value) => value === "1" || value === "true")
});

export async function GET(request: NextRequest) {
  const clientIp = getClientIp(request);
  const rateLimit = await rateLimitRequest({
    key: `trade-sell:${clientIp}`,
    limit: 80,
    windowSeconds: 60
  });

  if (!rateLimit.allowed) {
    return withSecurityHeaders(
      NextResponse.json(
        { error: "Too many sell navigation requests." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000))
          }
        }
      )
    );
  }

  const parsed = SellQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()));

  if (!parsed.success) {
    return withSecurityHeaders(
      NextResponse.json(
        {
          error: "Invalid sell navigation query.",
          issues: parsed.error.flatten().fieldErrors
        },
        { status: 400 }
      )
    );
  }

  try {
    const result = await fetchUexSellOptions({
      commodity: parsed.data.commodity,
      cargoScu: parsed.data.cargoScu,
      buyPricePerScu: parsed.data.buyPricePerScu || undefined,
      limit: parsed.data.limit,
      refresh: parsed.data.refresh
    });

    return withSecurityHeaders(
      NextResponse.json({
        data: result.options,
        meta: {
          count: result.options.length,
          source: "uex-prices",
          commodity: result.commodity?.name,
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
          error: "UEX sell navigation unavailable.",
          message: error instanceof Error ? error.message : "Unknown UEX API error."
        },
        { status: 502 }
      )
    );
  }
}
