import {createHash} from "node:crypto";
import {existsSync,readFileSync,writeFileSync} from "node:fs";
import {fileURLToPath} from "node:url";

const directory=fileURLToPath(new URL("../data/misaki/",import.meta.url));
if(existsSync(directory+"/signs.json")&&!process.argv.includes("--refresh"))throw new Error("Fixed signs exist; use --refresh explicitly.");
const context=JSON.parse(readFileSync(directory+"/context.json","utf8"));
const roadSource=JSON.parse(readFileSync(directory+"/source.json","utf8"));
const bounds=context.bounds,date=roadSource.osmBaseTimestamp;
if(!date)throw new Error("Missing fixed road date");
const bbox=[bounds.south,bounds.west,bounds.north,bounds.east].map(n=>n.toFixed(7)).join(",");
const query='[out:json][timeout:20][date:"'+date+'"];\n(\n'+
 ['node["traffic_sign"]','node["traffic_sign:forward"]','node["traffic_sign:backward"]','node["highway"="stop"]','node["highway"="give_way"]'].map(selector=>"  "+selector+"("+bbox+");").join("\n")+'\n);\nout body;\n';
const endpoint=process.argv.find(arg=>arg.startsWith("--endpoint="))?.slice("--endpoint=".length)??"https://overpass-api.de/api/interpreter";
if(!["https://overpass-api.de/api/interpreter","https://overpass.kumi.systems/api/interpreter"].includes(endpoint))throw new Error("Unsupported Overpass endpoint");
const response=await fetch(endpoint,{method:"POST",body:new URLSearchParams({data:query}),headers:{"User-Agent":"MiuraWalkingRally-PoC/0.1 (bounded signs snapshot)"},signal:AbortSignal.timeout(30_000)});
if(!response.ok)throw new Error("Overpass HTTP "+response.status);
const raw=Buffer.from(await response.arrayBuffer());
if(raw.length>1_000_000)throw new Error("Signs exceed 1 MB limit");
const payload=JSON.parse(raw.toString("utf8"));
if(payload.remark||!Array.isArray(payload.elements))throw new Error("Incomplete signs response: "+payload.remark);
const keys=new Set(["highway","traffic_sign","traffic_sign:forward","traffic_sign:backward","traffic_sign:direction","direction","stop","name","name:ja"]);
const elements=payload.elements.map(item=>{
 if(item.type!=="node"||!Number.isSafeInteger(item.id)||!Number.isFinite(item.lat)||!Number.isFinite(item.lon))throw new Error("Invalid sign node");
 const tags=Object.fromEntries(Object.entries(item.tags??{}).filter(([k,v])=>keys.has(k)&&typeof v==="string").sort(([a],[b])=>a<b?-1:a>b?1:0));
 return {type:"node",id:item.id,lat:item.lat,lon:item.lon,tags};
}).sort((a,b)=>a.id-b.id);
const snapshot=JSON.stringify({schemaVersion:1,bounds,elements},null,2)+"\n";
const sha=value=>createHash("sha256").update(value).digest("hex");
const source={
 sourceType:"overpass-snapshot",
 provider:"OpenStreetMap",attribution:"© OpenStreetMap contributors",copyrightUrl:"https://www.openstreetmap.org/copyright",
 license:"ODbL-1.0",licenseUrl:"https://opendatacommons.org/licenses/odbl/1-0/",
 endpoint,httpMethod:"POST",query,retrievedAt:new Date().toISOString(),requestedSnapshotAt:date,
 serverOsmBaseTimestamp:payload.osm3s?.timestamp_osm_base??null,originalSha256:sha(raw),snapshotSha256:sha(snapshot),
 routingSnapshotSha256:sha(readFileSync(directory+"/osm.json")),contextSnapshotSha256:sha(readFileSync(directory+"/context.json")),
 normalization:"Nodes and explicit traffic-control/sign tags only. No inferred signs, editor/contact/address metadata, or routing changes.",
};
writeFileSync(directory+"/signs.json",snapshot);
writeFileSync(directory+"/signs-source.json",JSON.stringify(source,null,2)+"\n");
console.log(JSON.stringify({nodes:elements.length,elements,sha256:source.snapshotSha256,requestedSnapshotAt:date},null,2));
