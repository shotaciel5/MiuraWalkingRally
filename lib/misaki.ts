import snapshotData from "../data/misaki/osm.json" with { type: "json" };
import source from "../data/misaki/source.json" with { type: "json" };
import stopData from "../data/misaki/stops.json" with { type: "json" };
import referenceData from "../data/misaki/reference.json" with { type: "json" };
import { buildWalkingGraph } from "./route/graph.ts";
import { routeThroughStops } from "./route/routing.ts";
import type { Edge, Graph, Snapshot, Stop } from "./route/types.ts";

// This fixture adapter is the only place the route code depends on local OSM files.
export function loadMisakiGraph() {
  return buildWalkingGraph(snapshotData as Snapshot);
}

export function manualReference(graph: Graph) {
  return referenceData.legs.map((leg, i) => {
    const from = stopData[i], to = stopData[i + 1];
    if (from.id !== leg.from || to.id !== leg.to) throw new Error("Reference stop order mismatch");
    const nodeIds: number[] = [from.nodeId];
    const edges: Edge[] = [];
    for (const [wayId, first, last] of leg.segments) {
      const way = graph.ways.get(wayId);
      if (!way) throw new Error("Missing reference way/" + wayId);
      const a = way.nodes.indexOf(first), b = way.nodes.indexOf(last);
      if (a < 0 || b < 0 || a === b || nodeIds.at(-1) !== first) throw new Error("Disconnected manual reference");
      const step = a < b ? 1 : -1;
      for (let j = a; j !== b; j += step) {
        const edge = graph.adjacency.get(way.nodes[j])?.find(e => e.to === way.nodes[j + step] && e.wayId === wayId);
        if (!edge) throw new Error("Manual reference access unresolved on way/" + wayId);
        edges.push(edge);
        nodeIds.push(edge.to);
      }
    }
    if (nodeIds.at(-1) !== to.nodeId) throw new Error("Manual reference misses its stop");
    return { from, to, nodeIds, edges, meters: edges.reduce((sum, e) => sum + e.meters, 0) };
  });
}

export function createMisakiPoc() {
  const graph = loadMisakiGraph();
  const reference = manualReference(graph);
  const route = routeThroughStops(graph, stopData as Stop[], 4);
  return { graph, route, reference, source, referenceBasis: referenceData.basis };
}
