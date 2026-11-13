import {WALKING_SPEED_KMH} from "../walking-estimate.ts";
import type { Edge, Graph, Leg, Stop, WalkingRoute } from "./types.ts";

export function shortestPath(graph: Graph, from: number, to: number): { nodeIds: number[]; edges: Edge[]; meters: number } {
  if (!graph.adjacency.has(from) || !graph.adjacency.has(to)) {
    throw new Error("Stop is missing, outside the extract, isolated or access-restricted: " + from + " -> " + to);
  }
  const distances = new Map<number, number>([[from, 0]]);
  const previous = new Map<number, Edge>();
  const visited = new Set<number>();
  // The bounded PoC has only a few thousand nodes; a simple O(V²) search is sufficient.
  while (true) {
    let current: number | undefined;
    let best = Infinity;
    for (const [id, distance] of distances) {
      if (!visited.has(id) && distance < best) { current = id; best = distance; }
    }
    if (current === undefined) throw new Error("No walking path; review access/connectivity/extract bounds: " + from + " -> " + to);
    if (current === to) break;
    visited.add(current);
    for (const edge of graph.adjacency.get(current) ?? []) {
      if (!Number.isFinite(edge.meters) || edge.meters <= 0) throw new Error("Invalid graph edge length");
      const next = best + edge.meters;
      if (next < (distances.get(edge.to) ?? Infinity)) {
        distances.set(edge.to, next);
        previous.set(edge.to, edge);
      }
    }
  }
  const edges: Edge[] = [];
  let id = to;
  while (id !== from) {
    const edge = previous.get(id);
    if (!edge) throw new Error("Incomplete route reconstruction");
    edges.push(edge);
    id = edge.from;
  }
  edges.reverse();
  return { nodeIds: [from, ...edges.map(edge => edge.to)], edges, meters: distances.get(to)! };
}

export function routeThroughStops(graph: Graph, stops: Stop[], speedKmh = WALKING_SPEED_KMH): WalkingRoute {
  if (!Number.isFinite(speedKmh) || speedKmh <= 0) throw new Error("Walking speed must be finite and positive");
  if (stops.length < 2 || new Set(stops.map(stop => stop.id)).size !== stops.length) throw new Error("At least two distinct stop IDs required");
  const legs: Leg[] = [];
  for (let i = 1; i < stops.length; i++) {
    const from = stops[i - 1], to = stops[i];
    const path = shortestPath(graph, from.nodeId, to.nodeId);
    legs.push({ from, to, ...path, minutes: path.meters / (speedKmh * 1000 / 60) });
  }
  return {
    stops, legs, speedKmh,
    meters: legs.reduce((sum, leg) => sum + leg.meters, 0),
    minutes: legs.reduce((sum, leg) => sum + leg.minutes, 0),
  };
}
