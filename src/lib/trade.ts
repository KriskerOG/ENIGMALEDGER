import { mockTradeRoutes } from "./mock-data";
import type { CalculatedTradeLeg, CalculatedTradeRoute, TradeRouteInput, TradeRouteRecord } from "./types";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 200;

export function normalizeRouteText(value: string | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function normalizeRouteIdentity(value: string | undefined): string {
  return normalizeRouteText(value).replace(/\s+/g, "");
}

export function isSameTradeEndpoint(left: string | undefined, right: string | undefined): boolean {
  const normalizedLeft = normalizeRouteIdentity(left);
  const normalizedRight = normalizeRouteIdentity(right);

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  return normalizedLeft === normalizedRight || normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft);
}

export function routeMatchesText(route: TradeRouteRecord, query: string | undefined, fields: string[]): boolean {
  const normalizedQuery = normalizeRouteText(query);

  if (!normalizedQuery) {
    return true;
  }

  return fields.some((field) => normalizeRouteText(field).includes(normalizedQuery));
}

export function routeMatchesMode(route: TradeRouteRecord, routeMode = "mixed"): boolean {
  if (routeMode !== "space") {
    return true;
  }

  return route.originIsGround !== true && route.destinationIsGround !== true;
}

export function routeMatchesContainer(route: TradeRouteRecord, containerSize?: number): boolean {
  const normalizedSize = Math.floor(Number(containerSize ?? 0));

  if (!normalizedSize) {
    return true;
  }

  return !route.containerSizes?.length || route.containerSizes.includes(normalizedSize);
}

export function routeMatchesTradeInput(route: TradeRouteRecord, input: Pick<TradeRouteInput, "origin" | "destination" | "routeMode" | "containerSize">): boolean {
  return (
    routeMatchesText(route, input.origin?.trim(), [
      route.origin,
      route.buyTerminal,
      route.originLocation ?? "",
      route.originTerminalName ?? "",
      route.originTerminalCode ?? ""
    ]) &&
    routeMatchesText(route, input.destination?.trim(), [
      route.sellTerminal,
      route.destinationLocation ?? "",
      route.destinationTerminalName ?? "",
      route.destinationTerminalCode ?? ""
    ]) &&
    routeMatchesMode(route, input.routeMode) &&
    routeMatchesContainer(route, input.containerSize)
  );
}

export function calculateTradeLeg(route: TradeRouteRecord, cargoScu: number, budgetUec: number): CalculatedTradeLeg | undefined {
  const usableCargoScu = Math.max(0, Math.floor(cargoScu));
  const availableBudgetUec = Math.max(0, Math.floor(budgetUec));
  const availableScu =
    typeof route.availableScu === "number" && Number.isFinite(route.availableScu)
      ? Math.max(0, Math.floor(route.availableScu))
      : usableCargoScu;
  const profitPerScu = Math.max(0, route.sellPrice - route.buyPrice);
  const purchasableScu =
    route.buyPrice > 0 ? Math.max(0, Math.min(usableCargoScu, availableScu, Math.floor(availableBudgetUec / route.buyPrice))) : 0;
  const capitalUsed = purchasableScu * route.buyPrice;
  const totalProfit = purchasableScu * profitPerScu;

  if (purchasableScu <= 0 || totalProfit <= 0) {
    return undefined;
  }

  return {
    ...route,
    purchasableScu,
    capitalUsed,
    profitPerScu,
    totalProfit
  };
}

function combineRisk(legs: CalculatedTradeLeg[]): TradeRouteRecord["risk"] {
  if (legs.some((leg) => leg.risk === "High")) {
    return "High";
  }

  if (legs.some((leg) => leg.risk === "Medium")) {
    return "Medium";
  }

  return "Low";
}

function intersectLegContainerSizes(legs: CalculatedTradeLeg[]): number[] {
  const sizes = legs.map((leg) => leg.containerSizes ?? []).filter((legSizes) => legSizes.length);

  if (!sizes.length) {
    return [];
  }

  return sizes.reduce((shared, legSizes) => shared.filter((size) => legSizes.includes(size)));
}

export function calculateTradeRoutePlan(
  rawLegs: TradeRouteRecord[],
  input: Pick<TradeRouteInput, "cargoScu" | "budgetUec" | "routeMode" | "containerSize">
): CalculatedTradeRoute | undefined {
  const calculatedLegs: CalculatedTradeLeg[] = [];
  let currentBudget = Math.max(0, Math.floor(input.budgetUec));

  for (const rawLeg of rawLegs) {
    if (!routeMatchesMode(rawLeg, input.routeMode) || !routeMatchesContainer(rawLeg, input.containerSize)) {
      return undefined;
    }

    const leg = calculateTradeLeg(rawLeg, input.cargoScu, currentBudget);

    if (!leg) {
      return undefined;
    }

    calculatedLegs.push(leg);
    currentBudget += leg.totalProfit;
  }

  const firstLeg = calculatedLegs[0];

  if (!firstLeg) {
    return undefined;
  }

  const totalProfit = calculatedLegs.reduce((sum, leg) => sum + leg.totalProfit, 0);
  const totalTransportedScu = calculatedLegs.reduce((sum, leg) => sum + leg.purchasableScu, 0);
  const peakCapital = Math.max(...calculatedLegs.map((leg) => leg.capitalUsed));
  const distanceGm = calculatedLegs.reduce((sum, leg) => sum + (leg.distanceGm ?? 0), 0) || undefined;
  const routeKind = calculatedLegs.length >= 3 ? "triangle" : "cycle";

  return {
    ...firstLeg,
    id: `${routeKind}-${calculatedLegs.map((leg) => leg.id).join("-")}`,
    commodity: calculatedLegs.map((leg) => leg.commodity).join(" -> "),
    sellTerminal: calculatedLegs[calculatedLegs.length - 1]?.sellTerminal ?? firstLeg.sellTerminal,
    destinationTerminalId: calculatedLegs[calculatedLegs.length - 1]?.destinationTerminalId,
    destinationTerminalCode: calculatedLegs[calculatedLegs.length - 1]?.destinationTerminalCode,
    destinationTerminalName: calculatedLegs[calculatedLegs.length - 1]?.destinationTerminalName,
    destinationTerminalSlug: calculatedLegs[calculatedLegs.length - 1]?.destinationTerminalSlug,
    destinationLocation: calculatedLegs[calculatedLegs.length - 1]?.destinationLocation,
    availableScu: Math.min(...calculatedLegs.map((leg) => leg.availableScu ?? leg.purchasableScu)),
    distanceGm,
    marginPercent: peakCapital > 0 ? (totalProfit / peakCapital) * 100 : undefined,
    containerSizes: intersectLegContainerSizes(calculatedLegs),
    originIsGround: calculatedLegs.some((leg) => leg.originIsGround),
    destinationIsGround: calculatedLegs.some((leg) => leg.destinationIsGround),
    originIsSpaceStation: calculatedLegs[0]?.originIsSpaceStation,
    destinationIsSpaceStation: calculatedLegs[calculatedLegs.length - 1]?.destinationIsSpaceStation,
    originHasFreightElevator: calculatedLegs[0]?.originHasFreightElevator,
    destinationHasFreightElevator: calculatedLegs[calculatedLegs.length - 1]?.destinationHasFreightElevator,
    originHasDockingPort: calculatedLegs[0]?.originHasDockingPort,
    destinationHasDockingPort: calculatedLegs[calculatedLegs.length - 1]?.destinationHasDockingPort,
    risk: combineRisk(calculatedLegs),
    routeKind,
    routePlanLabel: routeKind === "triangle" ? "三角循环航线" : "往返循环航线",
    legs: calculatedLegs,
    purchasableScu: totalTransportedScu,
    capitalUsed: peakCapital,
    profitPerScu: totalTransportedScu > 0 ? totalProfit / totalTransportedScu : 0,
    totalProfit
  };
}

export function calculateTradeRoutes(
  input: TradeRouteInput,
  sourceRoutes: TradeRouteRecord[] = mockTradeRoutes
): CalculatedTradeRoute[] {
  const cargoScu = Math.max(0, Math.floor(input.cargoScu));
  const budgetUec = Math.max(0, Math.floor(input.budgetUec));
  const limit = Math.min(Math.max(input.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const origin = input.origin?.trim();
  const destination = input.destination?.trim();

  return sourceRoutes
    .filter((route) => routeMatchesTradeInput(route, { origin, destination, routeMode: input.routeMode, containerSize: input.containerSize }))
    .map((route) => calculateTradeLeg(route, cargoScu, budgetUec))
    .filter((route): route is CalculatedTradeRoute => Boolean(route))
    .map((route) => ({ ...route, routeKind: "direct" as const }))
    .sort((left, right) => right.totalProfit - left.totalProfit)
    .slice(0, limit);
}
