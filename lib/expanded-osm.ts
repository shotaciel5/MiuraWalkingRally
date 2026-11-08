import type {Snapshot,Tags} from "./route/types.ts";
export const EXPANDED_BOUNDS={south:35.122,west:139.604,north:35.160,east:139.642};
const keys=new Set(["highway","name","name:ja","ref","foot","foot:forward","foot:backward","foot:conditional","access","access:conditional",
 "motorroad","motor_vehicle","motorcar","vehicle","oneway","oneway:foot","oneway:foot:conditional","barrier","entrance","crossing",
 "sidewalk","sidewalk:left","sidewalk:right","surface","incline","bridge","tunnel","layer","area","construction","proposed","junction",
 "type","restriction","restriction:foot","restriction:foot:conditional","except","building","amenity","shop","tourism","historic","religion",
 "traffic_sign","traffic_sign:forward","traffic_sign:backward","traffic_sign:direction","direction","stop"]);
export function expandedQuery(){
 const box=[EXPANDED_BOUNDS.south,EXPANDED_BOUNDS.west,EXPANDED_BOUNDS.north,EXPANDED_BOUNDS.east].join(",");
 return '[out:json][timeout:90];\nway["highway"]('+box+')->.roads;\n(\n .roads;\n node(w.roads);\n rel(bw.roads)["type"~"^restriction"];\n'+
 ['way["building"]',...["amenity","shop","tourism","historic"].map(k=>'nwr["'+k+'"]'),
 'node["traffic_sign"]','node["traffic_sign:forward"]','node["traffic_sign:backward"]',
 'node["highway"~"^(stop|give_way|traffic_signals|crossing|bus_stop)$"]'].map(q=>" "+q+"("+box+");").join("\n")+'\n);\n(._;>;);\nout body;\n';
}
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
export function normalizeExpandedSnapshot(value:unknown):Snapshot{
 if(!object(value)||value.remark||!Array.isArray(value.elements)||!value.elements.length)throw Error("Incomplete expanded OSM response");
 const byId=new Map<string,Snapshot["elements"][number]>();
 for(const raw of value.elements){
  if(!object(raw)||!["node","way","relation"].includes(String(raw.type))||!Number.isSafeInteger(raw.id)||Number(raw.id)<=0)throw Error("Invalid expanded OSM identity");
  const id=Number(raw.id),tags:Tags={};
  if(raw.tags!==undefined&&!object(raw.tags))throw Error("Invalid tags");
  for(const [key,tag]of Object.entries((raw.tags??{}) as Record<string,unknown>).sort(([a],[b])=>a<b?-1:a>b?1:0))
   if((keys.has(key)||/^(foot|access|oneway:foot|restriction:foot|motorroad):/.test(key))&&typeof tag==="string")tags[key]=tag;
  let result:Snapshot["elements"][number];
  if(raw.type==="node"){
   if(typeof raw.lat!=="number"||typeof raw.lon!=="number"||!Number.isFinite(raw.lat)||!Number.isFinite(raw.lon)||Math.abs(raw.lat)>90||Math.abs(raw.lon)>180)throw Error("Invalid node position");
   result={type:"node",id,lat:raw.lat,lon:raw.lon};
  }else if(raw.type==="way"){
   if(!Array.isArray(raw.nodes)||!raw.nodes.every(n=>Number.isSafeInteger(n)&&n>0))throw Error("Invalid way references");
   result={type:"way",id,nodes:raw.nodes};
  }else{
   if(!Array.isArray(raw.members))throw Error("Invalid relation members");
   result={type:"relation",id,members:raw.members.map(member=>{
    if(!object(member)||!["node","way","relation"].includes(String(member.type))||!Number.isSafeInteger(member.ref)||Number(member.ref)<=0||typeof member.role!=="string")throw Error("Invalid relation reference");
    return {type:String(member.type),ref:Number(member.ref),role:member.role};
   })};
  }
  if(Object.keys(tags).length)result.tags=tags;
  const key=result.type+"/"+id,previous=byId.get(key);
  if(previous&&JSON.stringify(previous)!==JSON.stringify(result))throw Error("Conflicting duplicate OSM element");
  byId.set(key,result);
 }
 const rank={node:0,way:1,relation:2},elements=[...byId.values()].sort((a,b)=>rank[a.type]-rank[b.type]||a.id-b.id),nodes=new Set(elements.filter(e=>e.type==="node").map(e=>e.id));
 for(const element of elements)if(element.type==="way"&&element.nodes.some(id=>!nodes.has(id)))throw Error("Missing expanded way node");
 if(!elements.some(e=>e.type==="way"&&e.tags?.highway))throw Error("No roads in expanded data");
 return {schemaVersion:1,bounds:{...EXPANDED_BOUNDS},elements};
}
export function encodeExpandedSnapshot(snapshot:Snapshot){return '{"schemaVersion":1,"bounds":'+JSON.stringify(snapshot.bounds)+',"elements":[\n'+snapshot.elements.map(e=>JSON.stringify(e)).join(",\n")+"\n]}\n"}

export function expandedRoutingSnapshot(snapshot:Snapshot):Snapshot{
 const ways=snapshot.elements.filter(e=>e.type==="way"&&e.tags?.highway),ids=new Set(ways.flatMap(w=>w.type==="way"?w.nodes:[]));
 return {schemaVersion:1,bounds:{...snapshot.bounds},elements:snapshot.elements.filter(e=>e.type==="node"?ids.has(e.id):e.type==="way"?!!e.tags?.highway:!!e.tags?.type?.startsWith("restriction"))};
}
