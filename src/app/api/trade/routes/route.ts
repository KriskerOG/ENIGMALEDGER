import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getClientIp, rateLimitRequest } from "@/lib/security/rate-limit";
import { withSecurityHeaders } from "@/lib/security/headers";
import {
  calculateTradeRoutePlan,
  calculateTradeRoutes,
  isSameTradeEndpoint,
  routeMatchesText
} from "@/lib/trade";
import { fetchUexTradeRoutes, fetchUexTradeRoutesByTerminalId } from "@/lib/sources/uex";
import type { CalculatedTradeRoute, TradeRouteProvider, TradeRouteRecord } from "@/lib/types";

export const runtime = "nodejs";

const RouteQuerySchema = z.object({
  origin: z.string().trim().max(120).optional(),
  destination: z.string().trim().max(120).optional(),
  cargoScu: z.coerce.number().int().min(1).max(10000).default(696),
  budgetUec: z.coerce.number().int().min(1).max(100000000).default(750000),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  provider: z.enum(["auto", "uex", "sample"]).optional().default("auto"),
  routeMode: z.enum(["mixed", "space"]).optional().default("mixed"),
  containerSize: z.coerce.number().int().min(0).max(32).optional().default(0),
  refresh: z
    .string()
    .optional()
    .transform((value) => value === "1" || value === "true")
});

interface RouteResolution {
  routes: CalculatedTradeRoute[];
  source: "uex" | "uex-loop" | "sample";
  upstreamCount?: number;
  planMode?: "direct" | "loop";
  warning?: string;
}

interface OriginTerminalRef {
  id?: number;
  name?: string | null;
  displayname?: string | null;
  fullname?: string | null;
  code?: string | null;
}

function routeReturnsToOrigin(
  route: TradeRouteRecord,
  originInput: string | undefined,
  originTerminal: OriginTerminalRef | undefined
): boolean {
  if (originTerminal?.id && route.destinationTerminalId === originTerminal.id) {
    return true;
  }

  return [originInput, originTerminal?.displayname, originTerminal?.name, originTerminal?.fullname, originTerminal?.code]
    .filter((value): value is string => Boolean(value?.trim()))
    .some((candidate) =>
      routeMatchesText(route, candidate, [
        route.sellTerminal,
        route.destinationLocation ?? "",
        route.destinationTerminalName ?? "",
        route.destinationTerminalCode ?? ""
      ])
    );
}

function dedupeRoutePlans(routes: CalculatedTradeRoute[]): CalculatedTradeRoute[] {
  const seen = new Set<string>();
  const result: CalculatedTradeRoute[] = [];

  for (const route of routes) {
    const key = route.legs?.map((leg) => leg.id).join("|") ?? route.id;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(route);
  }

  return result;
}

async function resolveUexLoopRoutes(input: z.infer<typeof RouteQuerySchema>): Promise<RouteResolution> {
  const originRoutes = await fetchUexTradeRoutes({ origin: input.origin, refresh: input.refresh });
  const leg1Candidates = calculateTradeRoutes(
    {
      cargoScu: input.cargoScu,
      budgetUec: input.budgetUec,
      limit: 24,
      routeMode: input.routeMode,
      containerSize: input.containerSize
    },
    originRoutes.routes
  ).filter((route) => route.destinationTerminalId);
  const scannedFirstLegs = leg1Candidates.slice(0, 12);
  const secondLegResults = await Promise.allSettled(
    scannedFirstLegs.map((route) =>
      fetchUexTradeRoutesByTerminalId(
        route.destinationTerminalId ?? 0,
        route.destinationTerminalName ?? route.sellTerminal,
        input.refresh
      )
    )
  );
  const plans: CalculatedTradeRoute[] = [];
  const thirdLegPairs: Array<{ leg1: CalculatedTradeRoute; leg2: CalculatedTradeRoute; score: number }> = [];
  let upstreamCount = originRoutes.routes.length;

  secondLegResults.forEach((result, index) => {
    if (result.status !== "fulfilled") {
      return;
    }

    const leg1 = scannedFirstLegs[index];
    const secondRoutes = result.value.routes;
    const afterLeg1Budget = input.budgetUec + leg1.totalProfit;
    upstreamCount += secondRoutes.length;
    const secondCandidates = calculateTradeRoutes(
      {
        cargoScu: input.cargoScu,
        budgetUec: afterLeg1Budget,
        limit: 10,
        routeMode: input.routeMode,
        containerSize: input.containerSize
      },
      secondRoutes
    );

    for (const returnLeg of secondCandidates.filter((route) => routeReturnsToOrigin(route, input.origin, originRoutes.originTerminal)).slice(0, 2)) {
      const plan = calculateTradeRoutePlan([leg1, returnLeg], input);

      if (plan) {
        plans.push(plan);
      }
    }

    for (const leg2 of secondCandidates
      .filter((route) => !routeReturnsToOrigin(route, input.origin, originRoutes.originTerminal))
      .filter((route) => route.destinationTerminalId && route.destinationTerminalId !== leg1.destinationTerminalId)
      .slice(0, 6)) {
      thirdLegPairs.push({ leg1, leg2, score: leg1.totalProfit + leg2.totalProfit });
    }
  });

  const thirdLegRequests = new Map<
    number,
    {
      label: string;
      pairs: Array<{ leg1: CalculatedTradeRoute; leg2: CalculatedTradeRoute }>;
    }
  >();

  for (const { leg1, leg2 } of thirdLegPairs
    .sort((left, right) => right.score - left.score)
    .slice(0, 24)) {
      const destinationTerminalId = leg2.destinationTerminalId;

      if (!destinationTerminalId) {
        continue;
      }

      const request = thirdLegRequests.get(destinationTerminalId) ?? {
        label: leg2.destinationTerminalName ?? leg2.sellTerminal,
        pairs: []
      };

      request.pairs.push({ leg1, leg2 });
      thirdLegRequests.set(destinationTerminalId, request);
  }

  const thirdLegResults = await Promise.allSettled(
    Array.from(thirdLegRequests.entries()).map(async ([terminalId, request]) => ({
      terminalId,
      result: await fetchUexTradeRoutesByTerminalId(terminalId, request.label, input.refresh)
    }))
  );

  for (const thirdLegResult of thirdLegResults) {
    if (thirdLegResult.status !== "fulfilled") {
      continue;
    }

    const request = thirdLegRequests.get(thirdLegResult.value.terminalId);

    if (!request) {
      continue;
    }

    upstreamCount += thirdLegResult.value.result.routes.length;

    for (const pair of request.pairs) {
      const afterLeg2Budget = input.budgetUec + pair.leg1.totalProfit + pair.leg2.totalProfit;
      const returnCandidates = calculateTradeRoutes(
        {
          cargoScu: input.cargoScu,
          budgetUec: afterLeg2Budget,
          limit: 6,
          routeMode: input.routeMode,
          containerSize: input.containerSize
        },
        thirdLegResult.value.result.routes
      ).filter((route) => routeReturnsToOrigin(route, input.origin, originRoutes.originTerminal));

      for (const returnLeg of returnCandidates.slice(0, 2)) {
        const plan = calculateTradeRoutePlan([pair.leg1, pair.leg2, returnLeg], input);

        if (plan) {
          plans.push(plan);
        }
      }
    }
  }

  return {
    routes: dedupeRoutePlans(plans)
      .sort((left, right) => right.totalProfit - left.totalProfit)
      .slice(0, input.limit),
    source: "uex-loop",
    upstreamCount,
    planMode: "loop",
    warning: plans.length ? undefined : "No profitable loop route found for the selected origin, budget, cargo, mode, and box size."
  };
}

async function resolveRoutes(
  input: z.infer<typeof RouteQuerySchema>,
  provider: TradeRouteProvider
): Promise<RouteResolution> {
  if (provider !== "sample") {
    try {
      if (isSameTradeEndpoint(input.origin, input.destination)) {
        return await resolveUexLoopRoutes(input);
      }

      const uex = await fetchUexTradeRoutes({ origin: input.origin, refresh: input.refresh });
      const routes = calculateTradeRoutes(
        {
          destination: input.destination,
          cargoScu: input.cargoScu,
          budgetUec: input.budgetUec,
          limit: input.limit,
          routeMode: input.routeMode,
          containerSize: input.containerSize
        },
        uex.routes
      );

      return {
        routes,
        source: "uex",
        upstreamCount: uex.routes.length,
        planMode: "direct"
      };
    } catch (error) {
      if (provider === "uex") {
        throw error;
      }

      const routes = calculateTradeRoutes({
        origin: input.origin,
        destination: input.destination,
        cargoScu: input.cargoScu,
        budgetUec: input.budgetUec,
        limit: input.limit,
        routeMode: input.routeMode,
        containerSize: input.containerSize
      });

      return {
        routes,
        source: "sample",
        planMode: "direct",
        warning: "UEX API unavailable; using ENIGMA sample trade routes."
      };
    }
  }

  return {
    routes: calculateTradeRoutes({
      origin: input.origin,
      destination: input.destination,
      cargoScu: input.cargoScu,
      budgetUec: input.budgetUec,
      limit: input.limit,
      routeMode: input.routeMode,
      containerSize: input.containerSize
    }),
    source: "sample",
    planMode: "direct"
  };
}

export async function GET(request: NextRequest) {
  const clientIp = getClientIp(request);
  const rateLimit = await rateLimitRequest({
    key: `trade-routes:${clientIp}`,
    limit: 80,
    windowSeconds: 60
  });

  if (!rateLimit.allowed) {
    return withSecurityHeaders(
      NextResponse.json(
        { error: "Too many trade route requests." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000))
          }
        }
      )
    );
  }

  const parsed = RouteQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()));

  if (!parsed.success) {
    return withSecurityHeaders(
      NextResponse.json(
        {
          error: "Invalid route query.",
          issues: parsed.error.flatten().fieldErrors
        },
        { status: 400 }
      )
    );
  }

  let routeResolution: RouteResolution;

  try {
    routeResolution = await resolveRoutes(parsed.data, parsed.data.provider);
  } catch (error) {
    return withSecurityHeaders(
      NextResponse.json(
        {
          error: "UEX API unavailable.",
          message: error instanceof Error ? error.message : "Unknown UEX API error."
        },
        { status: 502 }
      )
    );
  }

  return withSecurityHeaders(
    NextResponse.json({
      data: routeResolution.routes,
      meta: {
        count: routeResolution.routes.length,
        source: routeResolution.source,
        upstreamCount: routeResolution.upstreamCount,
        planMode: routeResolution.planMode,
        warning: routeResolution.warning,
        rateLimit: {
          limit: rateLimit.limit,
          remaining: rateLimit.remaining,
          resetAt: new Date(rateLimit.resetAt).toISOString()
        }
      }
    })
  );
}
