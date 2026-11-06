import { nodePolicy, wayPolicy } from "./walking-policy.ts";
import type { Graph, Point, Snapshot } from "./types.ts";

export function distanceMeters(a: Point, b: Point): number {
  for (const point of [a, b]) {
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon) || Math.abs(point.lat) > 90 || Math.abs(point.lon) > 180) {
      throw new Error("Invalid coordinates");
    }
  }
  const radians = Math.PI / 180;
  const dlat = (b.lat - a.lat) * radians;
  const dlon = (b.lon - a.lon) * radians;
  const h = Math.sin(dlat / 2) ** 2 + Math.cos(a.lat * radians) * Math.cos(b.lat * radians) * Math.sin(dlon / 2) ** 2;
  return 2 * 6_371_008.8 * Math.asin(Math.sqrt(Math.min(1, h)));
}

export function buildWalkingGraph(snapshot: Snapshot): Graph {
  const { south, west, north, east } = snapshot.bounds;
  if (snapshot.schemaVersion !== 1 || ![south, west, north, east].every(Number.isFinite) || south >= north || west >= east) {
    throw new Error("Invalid snapshot bounds or version");
  }
  const graph: Graph = { nodes: new Map(), ways: new Map(), adjacency: new Map(), diagnostics: [] };
  const seen = new Set<string>();
  for (const item of snapshot.elements) {
    const key = item.type + "/" + item.id;
    if (!Number.isSafeInteger(item.id) || seen.has(key)) throw new Error("Invalid or duplicate OSM ID: " + key);
    seen.add(key);
    if (item.type === "node") {
      distanceMeters(item, item);
      graph.nodes.set(item.id, item);
    } else if (item.type === "way" && item.tags?.highway) {
      graph.ways.set(item.id, item);
    } else if (item.type === "relation" && item.tags?.type?.startsWith("restriction")) {
      if (item.tags.type.includes(":foot") || Object.keys(item.tags).some(key => key.startsWith("restriction:foot"))) {
        throw new Error("Pedestrian turn restriction not supported: relation/" + item.id);
      }
    }
  }
  const inside = (p: Point) => p.lat >= south && p.lat <= north && p.lon >= west && p.lon <= east;
  const usableNodes = new Set<number>();
  for (const node of graph.nodes.values()) {
    const policy = nodePolicy(node.tags);
    if (policy.state !== "allowed") graph.diagnostics.push({ type: "node", id: node.id, state: policy.state, reason: policy.reason });
    else if (inside(node)) usableNodes.add(node.id);
  }
  for (const way of graph.ways.values()) {
    if (way.nodes.some(id => !graph.nodes.has(id))) throw new Error("Missing node reference in way/" + way.id);
    const policy = wayPolicy(way.tags);
    if (policy.state !== "allowed") {
      graph.diagnostics.push({ type: "way", id: way.id, state: policy.state, reason: policy.reason });
      continue;
    }
    for (let i = 1; i < way.nodes.length; i++) {
      const from = way.nodes[i - 1], to = way.nodes[i];
      if (from === to || !usableNodes.has(from) || !usableNodes.has(to)) continue;
      const meters = distanceMeters(graph.nodes.get(from)!, graph.nodes.get(to)!);
      if (meters <= 0) continue;
      const add = (a: number, b: number) => {
        const list = graph.adjacency.get(a) ?? [];
        list.push({ from: a, to: b, wayId: way.id, meters });
        graph.adjacency.set(a, list);
        if (!graph.adjacency.has(b)) graph.adjacency.set(b, []);
      };
      if (policy.forward) add(from, to);
      if (policy.backward) add(to, from);
    }
  }
  return graph;
}
