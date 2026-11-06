import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const directory = fileURLToPath(new URL("../data/misaki/", import.meta.url));
if (existsSync(directory + "/osm.json") && !process.argv.includes("--refresh")) {
  throw new Error("The fixed snapshot already exists. Use --refresh explicitly to replace it.");
}
const bounds = { south: 35.137, west: 139.614, north: 35.147, east: 139.627 };
const endpoint = "https://overpass-api.de/api/interpreter";
const query = [
  "[out:json][timeout:25];",
  'way["highway"](35.137,139.614,35.147,139.627)->.roads;',
  "(",
  "  .roads;",
  "  node(w.roads);",
  '  nwr["name"~"^(三崎港|海南神社|光念寺|本瑞寺)$"](35.137,139.614,35.147,139.627);',
  '  rel(bw.roads)["type"~"^restriction"];',
  ");",
  "(._;>;);",
  "out body;",
].join("\n") + "\n";
const response = await fetch(endpoint, {
  method: "POST",
  body: new URLSearchParams({ data: query }),
  headers: { "User-Agent": "MiuraWalkingRally-PoC/0.1 (bounded snapshot acquisition)" },
  signal: AbortSignal.timeout(45_000),
});
if (!response.ok) throw new Error("Overpass HTTP " + response.status);
const raw = Buffer.from(await response.arrayBuffer());
if (raw.length > 2_000_000) throw new Error("Snapshot exceeds the 2 MB limit.");
const payload = JSON.parse(raw.toString("utf8"));
if (payload.remark || !Array.isArray(payload.elements)) {
  throw new Error("Incomplete or invalid Overpass response: " + (payload.remark ?? "missing elements"));
}
const keys = new Set([
  "highway", "name", "ref", "foot", "foot:forward", "foot:backward",
  "foot:conditional", "access", "access:conditional", "motorroad",
  "motor_vehicle", "motorcar", "vehicle", "oneway", "oneway:foot",
  "oneway:foot:conditional", "barrier", "entrance", "crossing",
  "sidewalk", "sidewalk:left", "sidewalk:right", "surface", "incline",
  "bridge", "tunnel", "layer", "area", "construction", "proposed",
  "junction", "type", "restriction", "restriction:foot",
  "restriction:foot:conditional", "except",
]);
function selectTags(tags = {}) {
  return Object.fromEntries(
    Object.entries(tags)
      .filter(([key, value]) => (keys.has(key) || /^(foot|access|oneway:foot|restriction:foot|motorroad):/.test(key)) && typeof value === "string")
      .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0),
  );
}
function normalize(item) {
  if (!Number.isSafeInteger(item.id)) throw new Error("Invalid OSM ID.");
  const result = { type: item.type, id: item.id };
  if (item.type === "node") {
    if (!Number.isFinite(item.lat) || !Number.isFinite(item.lon)) throw new Error("Missing node coordinates.");
    result.lat = item.lat;
    result.lon = item.lon;
  } else if (item.type === "way") {
    if (!Array.isArray(item.nodes) || !item.nodes.every(Number.isSafeInteger)) throw new Error("Invalid way references.");
    result.nodes = item.nodes;
  } else if (item.type === "relation") {
    result.members = item.members.map(({type, ref, role}) => ({type, ref, role}));
  } else {
    throw new Error("Unexpected OSM element type.");
  }
  const tags = selectTags(item.tags);
  if (Object.keys(tags).length) result.tags = tags;
  return result;
}
const elementsById = new Map(payload.elements.map(normalize).map(item => [item.type + "/" + item.id, item]));
const typeOrder = { node: 0, way: 1, relation: 2 };
const elements = [...elementsById.values()].sort((a, b) => typeOrder[a.type] - typeOrder[b.type] || a.id - b.id);
const nodes = new Map(elements.filter(item => item.type === "node").map(item => [item.id, item]));
const ways = elements.filter(item => item.type === "way" && item.tags?.highway);
for (const way of ways) {
  if (way.nodes.some(id => !nodes.has(id))) throw new Error("A highway has missing nodes.");
}
const snapshot = '{"schemaVersion":1,"bounds":' + JSON.stringify(bounds) + ',"elements":[\n' +
  elements.map(item => JSON.stringify(item)).join(",\n") + "\n]}\n";
const source = {
  provider: "OpenStreetMap",
  attribution: "© OpenStreetMap contributors",
  copyrightUrl: "https://www.openstreetmap.org/copyright",
  license: "ODbL-1.0",
  licenseUrl: "https://opendatacommons.org/licenses/odbl/1-0/",
  endpoint,
  httpMethod: "POST",
  query,
  retrievedAt: new Date().toISOString(),
  osmBaseTimestamp: payload.osm3s?.timestamp_osm_base ?? null,
  originalSha256: createHash("sha256").update(raw).digest("hex"),
  snapshotSha256: createHash("sha256").update(snapshot).digest("hex"),
  normalization: "Retained IDs, node coordinates, way references, relation members and routing/place tags; removed editor metadata and unrelated tags.",
};
mkdirSync(directory, { recursive: true });
writeFileSync(directory + "/osm.json", snapshot);
writeFileSync(directory + "/source.json", JSON.stringify(source, null, 2) + "\n");
console.log(JSON.stringify({ nodes: nodes.size, highways: ways.length, snapshotSha256: source.snapshotSha256, retrievedAt: source.retrievedAt }, null, 2));
