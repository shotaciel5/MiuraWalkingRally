import {decodeRoadConnection,walkingSegments,type RoadConnection,type RoadSegment} from "./road-connection.ts";
import type {Graph,Point} from "./types.ts";

type Source=Pick<RoadConnection,"snapshotSha256"|"osmBaseTimestamp">;
type Split={wayId:number;fromNodeId:number;toNodeId:number;fraction:number};
export type AttachedRoadGraph={graph:Graph;nodeIdsBySpot:Map<string,number>;splits:Map<number,Split>};
const key=(s:Pick<RoadSegment,"wayId"|"fromNodeId"|"toNodeId">)=>s.wayId+"/"+s.fromNodeId+"/"+s.toNodeId;
const order=(a:RoadSegment,b:RoadSegment)=>a.wayId-b.wayId||a.fromNodeId-b.fromNodeId||a.toNodeId-b.toNodeId;
const same=(a:Point,b:Point)=>a.lat===b.lat&&a.lon===b.lon;
type Cut={fraction:number;nodeId:number};
type Group={segment:RoadSegment;connections:RoadConnection[];cuts:Cut[]};

// The caller supplies the verified, original walking graph and its data version.
// Facility-to-road reference lines are never inserted as walking edges.
export function attachRoadConnections(original:Graph,connections:readonly RoadConnection[],source:Source):AttachedRoadGraph{
 if(!/^[0-9a-f]{64}$/.test(source.snapshotSha256)||!Number.isFinite(Date.parse(source.osmBaseTimestamp)))throw Error("Invalid road source version");
 const segments=new Map(walkingSegments(original).map(s=>[key(s),s])),groups=new Map<string,Group>(),spotIds=new Set<string>();
 for(const input of connections){
  const c=decodeRoadConnection(input);
  if(!c||c.snapshotSha256!==source.snapshotSha256||c.osmBaseTimestamp!==source.osmBaseTimestamp)throw Error("Invalid or stale road connection");
  if(spotIds.has(c.spotId))throw Error("Duplicate spot connection: "+c.spotId);
  spotIds.add(c.spotId);
  const segment=segments.get(key(c.segment));
  if(!segment||!same(segment.from,c.segment.from)||!same(segment.to,c.segment.to)||segment.forward!==c.segment.forward||segment.backward!==c.segment.backward)
   throw Error("Connection does not match an allowed source segment: "+c.spotId);
  const way=original.ways.get(segment.wayId)!;
  if(!way.nodes.some((id,i)=>i>0&&Math.min(id,way.nodes[i-1])===segment.fromNodeId&&Math.max(id,way.nodes[i-1])===segment.toNodeId))
   throw Error("Connection segment is absent from source geometry");
  const group:Group=groups.get(key(segment))??{segment,connections:[],cuts:[]};
  group.connections.push(c);groups.set(key(segment),group);
 }
 const graph:Graph={
  nodes:new Map([...original.nodes].map(([id,n])=>[id,{...n,...(n.tags?{tags:{...n.tags}}:{})}])),
  ways:new Map([...original.ways].map(([id,w])=>[id,{...w,nodes:[...w.nodes],...(w.tags?{tags:{...w.tags}}:{})}])),
  adjacency:new Map([...original.adjacency].map(([id])=>[id,[]])),
  diagnostics:original.diagnostics.map(d=>({...d}))
 };
 const nodeIdsBySpot=new Map<string,number>(),splits=new Map<number,Split>();
 let nextId=-1;
 for(const group of [...groups.values()].sort((a,b)=>order(a.segment,b.segment))){
  const s=group.segment,points=new Map<string,number>();
  for(const c of group.connections.sort((a,b)=>a.fraction-b.fraction||(a.spotId<b.spotId?-1:a.spotId>b.spotId?1:0))){
   // Derive coordinates from the verified original endpoints, not a rounded display value.
   const point={lat:s.from.lat+(s.to.lat-s.from.lat)*c.fraction,lon:s.from.lon+(s.to.lon-s.from.lon)*c.fraction};
   let nodeId:number;
   if(same(point,s.from))nodeId=s.fromNodeId;
   else if(same(point,s.to))nodeId=s.toNodeId;
   else{
    const pointKey=point.lat+"/"+point.lon,previous=points.get(pointKey);
    if(previous!==undefined)nodeId=previous;
    else{
     while(graph.nodes.has(nextId))nextId--;
     if(!Number.isSafeInteger(nextId))throw Error("Virtual node IDs exhausted");
     nodeId=nextId--;points.set(pointKey,nodeId);
     graph.nodes.set(nodeId,{type:"node",id:nodeId,...point});graph.adjacency.set(nodeId,[]);
     splits.set(nodeId,{wayId:s.wayId,fromNodeId:s.fromNodeId,toNodeId:s.toNodeId,fraction:c.fraction});
     group.cuts.push({fraction:c.fraction,nodeId});
    }
   }
   nodeIdsBySpot.set(c.spotId,nodeId);
  }
 }
 // Split each existing directed edge independently; never synthesize its reverse.
 for(const [from,edges]of original.adjacency)for(const edge of edges){
  const group=groups.get(key({wayId:edge.wayId,fromNodeId:Math.min(edge.from,edge.to),toNodeId:Math.max(edge.from,edge.to)}));
  if(!group?.cuts.length){graph.adjacency.get(from)!.push({...edge});continue}
  const chain=[{fraction:0,nodeId:group.segment.fromNodeId},...group.cuts,{fraction:1,nodeId:group.segment.toNodeId}];
  if(edge.from!==group.segment.fromNodeId)chain.reverse();
  for(let i=1;i<chain.length;i++){
   const a=chain[i-1],b=chain[i],meters=edge.meters*Math.abs(b.fraction-a.fraction);
   if(!Number.isFinite(meters)||meters<=0)throw Error("Invalid split edge length");
   graph.adjacency.get(a.nodeId)!.push({from:a.nodeId,to:b.nodeId,wayId:edge.wayId,meters});
  }
 }
 // Keep physical topology consistent for subsequent junction/Koma analysis.
 for(const way of graph.ways.values()){
  const nodes:number[]=[];
  for(let i=0;i<way.nodes.length;i++){
   const to=way.nodes[i],from=way.nodes[i-1];
   if(i>0){
    const group=groups.get(key({wayId:way.id,fromNodeId:Math.min(from,to),toNodeId:Math.max(from,to)}));
    if(group?.cuts.length){
     const ids=group.cuts.map(c=>c.nodeId);
     nodes.push(...(from===group.segment.fromNodeId?ids:ids.reverse()));
    }
   }
   nodes.push(to);
  }
  way.nodes=nodes;
 }
 return {graph,nodeIdsBySpot:new Map([...nodeIdsBySpot].sort(([a],[b])=>a<b?-1:a>b?1:0)),splits};
}
