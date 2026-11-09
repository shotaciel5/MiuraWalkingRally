import {createHash} from "node:crypto";
import snapshot from "../data/miura-expanded/osm.json" with {type:"json"};
import source from "../data/miura-expanded/source.json" with {type:"json"};
import {encodeExpandedSnapshot} from "./expanded-osm.ts";
import {extractContext,createKomaContext,type ContextData} from "./route/context.ts";
import type {Graph,Snapshot,Point} from "./route/types.ts";
import type {KomaMap,KomaGeometry} from "./route/koma.ts";
let cached:{data:ContextData;bounds:{south:number;north:number;west:number;east:number}[]} | undefined;
function index(graph:Graph){
 if(!cached){
  if(createHash("sha256").update(encodeExpandedSnapshot(snapshot as Snapshot)).digest("hex")!==source.snapshotSha256)throw Error("Expanded context integrity mismatch");
  const data=extractContext(snapshot as Snapshot,graph);
  const bounds=data.buildings.map(b=>({south:Math.min(...b.points.map(p=>p.lat)),north:Math.max(...b.points.map(p=>p.lat)),west:Math.min(...b.points.map(p=>p.lon)),east:Math.max(...b.points.map(p=>p.lon))}));
  cached={data,bounds};
 }
 return cached;
}
export function expandedKomaContext(graph:Graph,map:KomaMap,reference?:KomaGeometry){
 const {data,bounds}=index(graph),center:Point=graph.nodes.get(map.nodeId)!;
 // A conservative bounding box reduces work before the existing 30m/35m precise filters.
 const lat=60/111000,lon=60/(111000*Math.cos(center.lat*Math.PI/180));
 const nearby:ContextData={
  landmarks:data.landmarks.filter(p=>Math.abs(p.point.lat-center.lat)<=lat&&Math.abs(p.point.lon-center.lon)<=lon),
  buildings:data.buildings.filter((_,i)=>bounds[i].south<=center.lat+lat&&bounds[i].north>=center.lat-lat&&bounds[i].west<=center.lon+lon&&bounds[i].east>=center.lon-lon)
 };
 return createKomaContext(graph,map,nearby,reference);
}
