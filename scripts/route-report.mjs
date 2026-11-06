import { createMisakiPoc } from "../lib/misaki.ts";
const { graph, route, reference, source } = createMisakiPoc();
const key = edge => edge.wayId + "/" + Math.min(edge.from, edge.to) + "/" + Math.max(edge.from, edge.to);
console.log(JSON.stringify({
  source,
  nodes: graph.nodes.size, highways: graph.ways.size, graphNodes: graph.adjacency.size,
  diagnostics: graph.diagnostics,
  totalMeters: route.meters, totalMinutes: route.minutes, speedKmh: route.speedKmh,
  referenceMeters: reference.reduce((sum, leg) => sum + leg.meters, 0),
  legs: route.legs.map((leg, i) => {
    const referenceKeys = new Set(reference[i].edges.map(key));
    return {
      from:leg.from.id, to:leg.to.id, meters:leg.meters, minutes:leg.minutes,
      referenceMeters:reference[i].meters,
      commonMeters:leg.edges.filter(edge => referenceKeys.has(key(edge))).reduce((sum,e) => sum+e.meters,0),
      ways:[...new Set(leg.edges.map(edge => edge.wayId))], nodeIds:leg.nodeIds,
      stairs:leg.edges.some(e => graph.ways.get(e.wayId).tags.highway === "steps"),
    };
  }),
},null,2));
