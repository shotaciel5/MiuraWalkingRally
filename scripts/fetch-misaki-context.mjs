import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createMisakiJunctionPoc } from "../lib/misaki-junctions.ts";

const directory = fileURLToPath(new URL("../data/misaki/", import.meta.url));
if (existsSync(directory + "/context.json") && !process.argv.includes("--refresh")) {
  throw new Error("Fixed context already exists; use --refresh explicitly.");
}
const poc = createMisakiJunctionPoc();
const points = [...poc.route.legs, ...poc.reference].flatMap(leg => leg.nodeIds.map(id => poc.graph.nodes.get(id)));
const margin = 80 / 111195.08;
const bounds = {
  south: Math.min(...points.map(p => p.lat)) - margin,
  west: Math.min(...points.map(p => p.lon)) - margin / Math.cos(points[0].lat * Math.PI / 180),
  north: Math.max(...points.map(p => p.lat)) + margin,
  east: Math.max(...points.map(p => p.lon)) + margin / Math.cos(points[0].lat * Math.PI / 180),
};
const bbox = [bounds.south, bounds.west, bounds.north, bounds.east].map(n => n.toFixed(7)).join(",");
const endpoint = "https://overpass-api.de/api/interpreter";
const date = poc.source.osmBaseTimestamp;
if (!date) throw new Error("Routing snapshot date is required.");
const selectors = [
  'way["building"]',
  ...["amenity", "shop", "tourism", "historic"].flatMap(key => ['node["' + key + '"]', 'way["' + key + '"]']),
  'node["highway"~"^(traffic_signals|crossing|bus_stop)$"]',
];
const query = '[out:json][timeout:40][date:"' + date + '"];\n(\n' +
  selectors.map(selector => "  " + selector + "(" + bbox + ");").join("\n") +
  "\n);\n(._;>;);\nout body;\n";
const response = await fetch(endpoint, {
  method: "POST", body: new URLSearchParams({data:query}),
  headers: {"User-Agent":"MiuraWalkingRally-PoC/0.1 (bounded context snapshot)"},
  signal: AbortSignal.timeout(60_000),
});
if (!response.ok) throw new Error("Overpass HTTP " + response.status);
const raw = Buffer.from(await response.arrayBuffer());
if (raw.length > 6_000_000) throw new Error("Context exceeds 6 MB limit.");
const payload = JSON.parse(raw.toString("utf8"));
if (payload.remark || !Array.isArray(payload.elements)) throw new Error("Incomplete context response: " + payload.remark);
const keys = new Set(["name","name:ja","ref","building","amenity","shop","tourism","historic","religion","denomination","highway","crossing"]);
const elements = payload.elements.map(item => {
  const tags = Object.fromEntries(Object.entries(item.tags ?? {}).filter(([k,v])=>keys.has(k)&&typeof v==="string").sort(([a],[b])=>a<b?-1:a>b?1:0));
  if (!Number.isSafeInteger(item.id)) throw new Error("Invalid ID");
  let result;
  if(item.type==="node" && Number.isFinite(item.lat) && Number.isFinite(item.lon)) result={type:"node",id:item.id,lat:item.lat,lon:item.lon};
  else if(item.type==="way" && Array.isArray(item.nodes) && item.nodes.every(Number.isSafeInteger)) result={type:"way",id:item.id,nodes:item.nodes};
  else throw new Error("Unsupported context element");
  return {...result,...(Object.keys(tags).length?{tags}:{})};
}).sort((a,b)=>(a.type==="node"?0:1)-(b.type==="node"?0:1)||a.id-b.id);
const ids = new Set(elements.filter(e=>e.type==="node").map(e=>e.id));
if (elements.some(e=>e.type==="way"&&e.nodes.some(id=>!ids.has(id)))) throw new Error("Missing context geometry");
const snapshot = '{"schemaVersion":1,"bounds":' + JSON.stringify(bounds) + ',"elements":[\n' + elements.map(e=>JSON.stringify(e)).join(",\n") + "\n]}\n";
const sha = value => createHash("sha256").update(value).digest("hex");
const source = {
  provider:"OpenStreetMap", attribution:"© OpenStreetMap contributors",
  copyrightUrl:"https://www.openstreetmap.org/copyright", license:"ODbL-1.0",
  licenseUrl:"https://opendatacommons.org/licenses/odbl/1-0/",
  endpoint,httpMethod:"POST",query,retrievedAt:new Date().toISOString(),
  requestedSnapshotAt:date,serverOsmBaseTimestamp:payload.osm3s?.timestamp_osm_base??null,
  originalSha256:sha(raw),snapshotSha256:sha(snapshot),
  routingSnapshotSha256:sha(readFileSync(directory+"/osm.json")),
  normalization:"Node coordinates, closed/open way references and whitelisted context tags. No relations, editor, contact or address metadata. Context never changes walking topology.",
};
writeFileSync(directory+"/context.json",snapshot);
writeFileSync(directory+"/context-source.json",JSON.stringify(source,null,2)+"\n");
console.log(JSON.stringify({bounds,nodes:ids.size,ways:elements.length-ids.size,sha256:source.snapshotSha256,requestedSnapshotAt:date},null,2));
