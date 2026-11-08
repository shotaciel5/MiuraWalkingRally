import {createHash} from "node:crypto";
import {existsSync,mkdirSync,writeFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {expandedQuery,normalizeExpandedSnapshot,encodeExpandedSnapshot} from "../lib/expanded-osm.ts";
import {buildWalkingGraph} from "../lib/route/graph.ts";
if(!process.argv.includes("--fetch")&&!process.argv.includes("--refresh"))throw Error("Use --fetch explicitly; an existing snapshot requires --refresh.");
const directory=fileURLToPath(new URL("../data/miura-expanded/",import.meta.url));
if(existsSync(directory+"osm.json")&&!process.argv.includes("--refresh"))throw Error("Expanded snapshot exists; use --refresh explicitly.");
const endpoint=process.argv.find(v=>v.startsWith("--endpoint="))?.slice(11)??"https://overpass-api.de/api/interpreter";
if(!["https://overpass-api.de/api/interpreter","https://overpass.kumi.systems/api/interpreter"].includes(endpoint))throw Error("Unsupported Overpass endpoint");
const query=expandedQuery();
console.log("Fetching one bounded roads/context query from "+endpoint);
const response=await fetch(endpoint,{method:"POST",body:new URLSearchParams({data:query}),headers:{"User-Agent":"MiuraWalkingRally-PoC/0.1 (bounded Miura road/context snapshot)"},signal:AbortSignal.timeout(120000)});
if(!response.ok)throw Error("Overpass HTTP "+response.status);
const raw=Buffer.from(await response.arrayBuffer());if(raw.length>30000000)throw Error("Expanded response exceeds 30 MB limit");
const payload=JSON.parse(raw.toString("utf8")),snapshot=normalizeExpandedSnapshot(payload),graph=buildWalkingGraph(snapshot),encoded=encodeExpandedSnapshot(snapshot);
const sha=value=>createHash("sha256").update(value).digest("hex");
const source={provider:"OpenStreetMap",attribution:"© OpenStreetMap contributors",copyrightUrl:"https://www.openstreetmap.org/copyright",license:"ODbL-1.0",licenseUrl:"https://opendatacommons.org/licenses/odbl/1-0/",
 endpoint,httpMethod:"POST",query,retrievedAt:new Date().toISOString(),osmBaseTimestamp:payload.osm3s?.timestamp_osm_base??null,originalSha256:sha(raw),snapshotSha256:sha(encoded),bounds:snapshot.bounds,
 normalization:"Stable OSM IDs/geometry and whitelisted routing/building/landmark/sign tags only; no editor, contact or address metadata. Existing PoC data is retained separately.",
 counts:{nodes:graph.nodes.size,highways:graph.ways.size,elements:snapshot.elements.length,routableNodes:graph.adjacency.size,bytes:Buffer.byteLength(encoded)}};
if(!source.osmBaseTimestamp)throw Error("Missing OSM base timestamp");
mkdirSync(directory,{recursive:true});writeFileSync(directory+"osm.json",encoded);writeFileSync(directory+"source.json",JSON.stringify(source,null,2)+"\n");
console.log(JSON.stringify({counts:source.counts,osmBaseTimestamp:source.osmBaseTimestamp,snapshotSha256:source.snapshotSha256},null,2));
