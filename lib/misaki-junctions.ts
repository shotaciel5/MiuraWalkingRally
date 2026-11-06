import { createMisakiPoc } from "./misaki.ts";
import { extractJunctions } from "./route/junctions.ts";
import type { WalkingRoute } from "./route/types.ts";

export function createMisakiJunctionPoc() {
  const poc = createMisakiPoc();
  const referenceRoute: WalkingRoute = {
    stops: poc.route.stops, speedKmh: poc.route.speedKmh,
    legs: poc.reference.map(leg => ({...leg, minutes: leg.meters / (poc.route.speedKmh * 1000 / 60)})),
    meters: poc.reference.reduce((sum, leg) => sum + leg.meters, 0),
    minutes: poc.reference.reduce((sum, leg) => sum + leg.meters / (poc.route.speedKmh * 1000 / 60), 0),
  };
  return {
    ...poc,
    junctions: extractJunctions(poc.graph, poc.route),
    referenceJunctions: extractJunctions(poc.graph, referenceRoute),
  };
}
