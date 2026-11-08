import {createHash} from "node:crypto";
import {existsSync,writeFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {INITIAL_SPOT_BOUNDS,initialSpotQuery,normalizeSpotSnapshot} from "../lib/spots/initial-catalog.ts";
const directory=fileURLToPath(new URL("../data/spots/",import.meta.url));
if (existsSync(directory+"/osm.json") && !process.argv.includes("--refresh")) throw new Error("Fixed spot source exists; use --refresh explicitly.");
const endpoint="https://overpass-api.de/api/interpreter",query=initialSpotQuery();
const response=await fetch(endpoint,{method:"POST",body:new URLSearchParams({data:query}),
  headers:{"User-Agent":"MiuraWalkingRally/0.1 (bounded initial spot catalog)"},signal:AbortSignal.timeout(60000)});
if(!response.ok) throw new Error("Overpass HTTP "+response.status);
const raw=Buffer.from(await response.arrayBuffer());if(raw.length>6000000)throw new Error("Spot response exceeds 6 MB");
const payload=JSON.parse(raw.toString("utf8")),snapshot=normalizeSpotSnapshot(payload);
if(!payload.osm3s?.timestamp_osm_base || !snapshot.elements.length) throw new Error("Missing source date or empty snapshot");
const content=JSON.stringify(snapshot,null,2)+"\n",sha=value=>createHash("sha256").update(value).digest("hex");
const source={provider:"OpenStreetMap",attribution:"© OpenStreetMap contributors",license:"ODbL-1.0",
  copyrightUrl:"https://www.openstreetmap.org/copyright",licenseUrl:"https://opendatacommons.org/licenses/odbl/1-0/",
  endpoint,httpMethod:"POST",query,bounds:INITIAL_SPOT_BOUNDS,retrievedAt:new Date().toISOString(),osmBaseTimestamp:payload.osm3s.timestamp_osm_base,
  originalSha256:sha(raw),snapshotSha256:sha(content),originalBytes:raw.length,originalElementCount:payload.elements.length,
  normalization:"Named nodes and representative way/relation bounding-box centres. Whitelisted tags only; no editor, contact, address or full geometry. Not entrances or walking topology."};
writeFileSync(directory+"/osm.json",content);writeFileSync(directory+"/source.json",JSON.stringify(source,null,2)+"\n");
console.log(JSON.stringify({count:snapshot.elements.length,sha256:source.snapshotSha256}));
