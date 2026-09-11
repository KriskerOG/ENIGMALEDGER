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
import { fetchUexTradeRoutes, fetchUexTradeRoutesByTerminalId, resolveTradeQuery } from "@/lib/sources/uex";
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
  stopCount: z.union([z.literal("auto"), z.coerce.number().int().min(1).max(6)]).optional().default("auto"),
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
  stopCount?: number;
  warning?: string;
}

function isAutoStopCount(value: z.infer<typeof RouteQuerySchema>["stopCount"]): value is "auto" {
  return value === "auto";
}

function normalizeStopCount(value: z.infer<typeof RouteQuerySchema>["stopCount"], fallback = 1): number {
  return isAutoStopCount(value) ? fallback : Math.min(Math.max(value ?? fallback, 1), 6);
}

function bestRouteScore(routeResolution: RouteResolution): number {
  return routeResolution.routes[0]?.totalProfit ?? 0;
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
  const stopCount = Math.min(Math.max(normalizeStopCount(input.stopCount, 2), 2), 6);
  const budgetUec = Math.max(0, Math.floor(input.budgetUec));
  const requestedLimit = Math.min(Math.max(input.limit ?? 50, 1), 200);
  const resolvedOrigin = resolveTradeQuery(input.origin, "location");
  const resolvedDestination = resolveTradeQuery(input.destination, "location");
  const firstLegDestination = input.destination && !isSameTradeEndpoint(resolvedOrigin, resolvedDestination)
    ? resolvedDestination
    : undefined;
  const leg1Candidates = calculateTradeRoutes(
    {
      destination: firstLegDestination,
      cargoScu: input.cargoScu,
      budgetUec,
      limit: 24,
      routeMode: input.routeMode,
      containerSize: input.containerSize
    },
    originRoutes.routes
  ).filter((route) => route.destinationTerminalId);
  const plans: CalculatedTradeRoute[] = [];
  const relaxedPlans: CalculatedTradeRoute[] = [];
  let upstreamCount = originRoutes.routes.length;
  let paths: CalculatedTradeRoute[][] = leg1Candidates.slice(0, 12).map((route) => [route]);

  for (let legIndex = 2; legIndex <= stopCount && paths.length; legIndex += 1) {
    const terminalRequests = new Map<number, { label: string; paths: CalculatedTradeRoute[][] }>();

    for (const path of paths) {
      const lastLeg = path.at(-1);
      const terminalId = lastLeg?.destinationTerminalId;

      if (!terminalId) {
        continue;
      }

      const request = terminalRequests.get(terminalId) ?? {
        label: lastLeg.destinationTerminalName ?? lastLeg.sellTerminal,
        paths: []
      };

      request.paths.push(path);
      terminalRequests.set(terminalId, request);
    }

    const routeResults = await Promise.allSettled(
      Array.from(terminalRequests.entries()).map(async ([terminalId, request]) => ({
        terminalId,
        result: await fetchUexTradeRoutesByTerminalId(terminalId, request.label, input.refresh)
      }))
    );
    const routeResultByTerminal = new Map(
      routeResults
        .filter((result): result is PromiseFulfilledResult<{ terminalId: number; result: Awaited<ReturnType<typeof fetchUexTradeRoutesByTerminalId>> }> => result.status === "fulfilled")
        .map((result) => [result.value.terminalId, result.value.result])
    );
    const nextPaths: CalculatedTradeRoute[][] = [];
    const isFinalLeg = legIndex === stopCount;

    for (const [terminalId, request] of terminalRequests) {
      const routeResult = routeResultByTerminal.get(terminalId);

      if (!routeResult) {
        continue;
      }

      upstreamCount += routeResult.routes.length;

      for (const path of request.paths) {
        const currentBudget = budgetUec + path.reduce((sum, leg) => sum + leg.totalProfit, 0);
        const visitedTerminalIds = new Set(path.map((leg) => leg.destinationTerminalId).filter((id): id is number => Boolean(id)));
        const baseCandidates = calculateTradeRoutes(
        {
          cargoScu: input.cargoScu,
          budgetUec: currentBudget,
          limit: isFinalLeg ? 12 : 8,
          routeMode: input.routeMode,
          containerSize: input.containerSize
        },
          routeResult.routes
        );
        const candidates = isFinalLeg
          ? baseCandidates.filter((route) => routeReturnsToOrigin(route, input.origin, originRoutes.originTerminal)).slice(0, 3)
          : baseCandidates
              .filter(
                (route) =>
                  Boolean(route.destinationTerminalId) &&
                  !visitedTerminalIds.has(route.destinationTerminalId ?? 0) &&
                  !routeReturnsToOrigin(route, input.origin, originRoutes.originTerminal)
              )
              .slice(0, 4);
        const relaxedCandidates = isFinalLeg && !candidates.length
          ? baseCandidates
              .filter(
                (route) =>
                  Boolean(route.destinationTerminalId) &&
                  !visitedTerminalIds.has(route.destinationTerminalId ?? 0)
              )
              .slice(0, 3)
          : [];

        for (const nextLeg of [...candidates, ...relaxedCandidates]) {
          const nextPath = [...path, nextLeg];

          if (isFinalLeg) {
            const plan = calculateTradeRoutePlan(nextPath, input);

            if (plan) {
              if (candidates.includes(nextLeg)) {
                plans.push(plan);
              } else {
                relaxedPlans.push(plan);
              }
            }
          } else {
            nextPaths.push(nextPath);
          }
        }
      }
    }

    paths = nextPaths
      .sort((left, right) => right.reduce((sum, leg) => sum + leg.totalProfit, 0) - left.reduce((sum, leg) => sum + leg.totalProfit, 0))
      .slice(0, 48);
  }

  const selectedPlans = plans.length ? plans : relaxedPlans;

  return {
    routes: dedupeRoutePlans(selectedPlans)
      .sort((left, right) => right.totalProfit - left.totalProfit)
      .slice(0, input.limit),
    source: "uex-loop",
    upstreamCount,
    planMode: "loop",
    stopCount,
    warning: selectedPlans.length ? undefined : `No profitable ${stopCount}-stop route found for the selected origin, budget, cargo, mode, and box size.`
  };
}

async function resolveUexDirectRoutes(input: z.infer<typeof RouteQuerySchema>): Promise<RouteResolution> {
  const uex = await fetchUexTradeRoutes({ origin: input.origin, refresh: input.refresh });
  const sameEndpoint = isSameTradeEndpoint(resolveTradeQuery(input.origin, "location"), resolveTradeQuery(input.destination, "location"));
  const destination = sameEndpoint ? undefined : resolveTradeQuery(input.destination, "location");
  const routes = calculateTradeRoutes(
    {
      destination,
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
    planMode: "direct",
    stopCount: 1
  };
}

async function resolveUexAutoRoutes(input: z.infer<typeof RouteQuerySchema>): Promise<RouteResolution> {
  const sameEndpoint = isSameTradeEndpoint(resolveTradeQuery(input.origin, "location"), resolveTradeQuery(input.destination, "location"));
  const attempts: RouteResolution[] = [];
  const loopCandidates = sameEndpoint ? [3, 2, 4] : [2, 3, 4];

  if (!sameEndpoint) {
    attempts.push(await resolveUexDirectRoutes({ ...input, stopCount: 1 }));
  }

  for (const stopCount of loopCandidates) {
    const result = await resolveUexLoopRoutes({ ...input, stopCount });

    if (result.routes.length) {
      attempts.push(result);
    }
  }

  if (attempts.length) {
    return attempts.sort((left, right) => bestRouteScore(right) - bestRouteScore(left))[0];
  }

  return sameEndpoint
    ? await resolveUexLoopRoutes({ ...input, stopCount: 3 })
    : await resolveUexDirectRoutes({ ...input, stopCount: 1 });
}

async function resolveRoutes(
  input: z.infer<typeof RouteQuerySchema>,
  provider: TradeRouteProvider
): Promise<RouteResolution> {
  if (provider !== "sample") {
    try {
      if (isAutoStopCount(input.stopCount)) {
        return await resolveUexAutoRoutes(input);
      }

      const stopCount = normalizeStopCount(input.stopCount, 1);
      const shouldPlanLoop = stopCount >= 2 || isSameTradeEndpoint(resolveTradeQuery(input.origin, "location"), resolveTradeQuery(input.destination, "location"));

      if (shouldPlanLoop) {
        return await resolveUexLoopRoutes({
          ...input,
          stopCount: stopCount >= 2 ? stopCount : 3
        });
      }

      return await resolveUexDirectRoutes(input);
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
        stopCount: normalizeStopCount(input.stopCount, 1),
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
    planMode: "direct",
    stopCount: normalizeStopCount(input.stopCount, 1)
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
        stopCount: routeResolution.stopCount,
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
