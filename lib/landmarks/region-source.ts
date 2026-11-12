import {createHash} from "node:crypto";
import roads from "../../data/miura-expanded/roads.json" with {type:"json"};
import {buildWalkingGraph} from "../route/graph.ts";
import {buildRoadBranches} from "../route/junctions.ts";
import type {Snapshot,Point} from "../route/types.ts";
import type {Target} from "./model.ts";
export const regionBounds=roads.bounds;
export const regionSourceHash=createHash("sha256").update(JSON.stringify(roads)).digest("hex");
export const targetKey=(p:Point)=>createHash("sha256").update(p.lat.toFixed(6)+","+p.lon.toFixed(6)).digest("hex");
export function regionTargets():Target[]{
 const graph=buildWalkingGraph(roads as Snapshot),branches=buildRoadBranches(graph),targets=new Map<string,Target>();
 for(const [id,arms]of branches){if(arms.length<3||!graph.adjacency.has(id))continue;const n=graph.nodes.get(id)!,point={lat:n.lat,lon:n.lon},key=targetKey(point);targets.set(key,{key,point,sequences:[],approaches:[]})}
 return [...targets.values()].sort((a,b)=>a.key.localeCompare(b.key,"en"));
}
