import {distanceMeters} from "./graph.ts";
import type {Graph,Point} from "./types.ts";
import {validSpotId} from "../spots/editing.ts";
export type RoadSegment={wayId:number;fromNodeId:number;toNodeId:number;from:Point;to:Point;forward:boolean;backward:boolean;name:string;highway:string};
export type RoadConnection={spotId:string;spotRevision:number;facility:Point;point:Point;fraction:number;distanceMeters:number;segment:RoadSegment;snapshotSha256:string;osmBaseTimestamp:string};
export function closestPointOnSegment(point:Point,from:Point,to:Point){
 distanceMeters(point,point);distanceMeters(from,from);distanceMeters(to,to);
 const scale=Math.cos(point.lat*Math.PI/180),ax=(from.lon-point.lon)*scale,ay=from.lat-point.lat,bx=(to.lon-point.lon)*scale,by=to.lat-point.lat;
 const dx=bx-ax,dy=by-ay,length=dx*dx+dy*dy;
 const fraction=length===0?0:Math.max(0,Math.min(1,-(ax*dx+ay*dy)/length));
 const projected={lat:from.lat+(to.lat-from.lat)*fraction,lon:from.lon+(to.lon-from.lon)*fraction};
 return {point:projected,fraction,distanceMeters:distanceMeters(point,projected)};
}
export function walkingSegments(graph:Graph):RoadSegment[]{
 const segments=new Map<string,RoadSegment>();
 for(const edges of graph.adjacency.values())for(const edge of edges){
  const fromNodeId=Math.min(edge.from,edge.to),toNodeId=Math.max(edge.from,edge.to),key=edge.wayId+"/"+fromNodeId+"/"+toNodeId,way=graph.ways.get(edge.wayId);
  if(!way||!graph.nodes.has(fromNodeId)||!graph.nodes.has(toNodeId)||fromNodeId===toNodeId)throw Error("Invalid walking segment source");
  const value=segments.get(key)??{wayId:edge.wayId,fromNodeId,toNodeId,from:graph.nodes.get(fromNodeId)!,to:graph.nodes.get(toNodeId)!,forward:false,backward:false,name:way.tags?.["name:ja"]||way.tags?.name||"",highway:way.tags?.highway||""};
  if(edge.from===fromNodeId)value.forward=true;else value.backward=true;
  segments.set(key,value);
 }
 return [...segments.values()].sort((a,b)=>a.wayId-b.wayId||a.fromNodeId-b.fromNodeId||a.toNodeId-b.toNodeId).map(s=>({...s,from:{lat:s.from.lat,lon:s.from.lon},to:{lat:s.to.lat,lon:s.to.lon}}));
}
export function nearestWalkingSegment(point:Point,segments:readonly RoadSegment[]){
 distanceMeters(point,point);
 let best:{segment:RoadSegment;point:Point;fraction:number;distanceMeters:number}|null=null;
 for(const segment of segments){
  const candidate={segment,...closestPointOnSegment(point,segment.from,segment.to)};
  if(!best||candidate.distanceMeters<best.distanceMeters-1e-7
   ||Math.abs(candidate.distanceMeters-best.distanceMeters)<=1e-7&&(segment.wayId<best.segment.wayId||segment.wayId===best.segment.wayId&&(segment.fromNodeId<best.segment.fromNodeId||segment.fromNodeId===best.segment.fromNodeId&&segment.toNodeId<best.segment.toNodeId)))best=candidate;
 }
 return best;
}
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
const point=(v:unknown):v is Point=>object(v)&&typeof v.lat==="number"&&typeof v.lon==="number"&&Number.isFinite(v.lat)&&Number.isFinite(v.lon)&&Math.abs(v.lat)<=90&&Math.abs(v.lon)<=180;
export function decodeRoadConnection(value:unknown):RoadConnection|null{
 try{
  if(!object(value)||typeof value.spotId!=="string"||!validSpotId(value.spotId)||!Number.isSafeInteger(value.spotRevision)||Number(value.spotRevision)<0
   ||!point(value.facility)||!point(value.point)||typeof value.fraction!=="number"||!Number.isFinite(value.fraction)||value.fraction<0||value.fraction>1
   ||typeof value.distanceMeters!=="number"||!Number.isFinite(value.distanceMeters)||value.distanceMeters<0||!object(value.segment)
   ||typeof value.snapshotSha256!=="string"||!/^[0-9a-f]{64}$/.test(value.snapshotSha256)||typeof value.osmBaseTimestamp!=="string"||!Number.isFinite(Date.parse(value.osmBaseTimestamp)))return null;
  const s=value.segment;
  if(!Number.isSafeInteger(s.wayId)||Number(s.wayId)<=0||!Number.isSafeInteger(s.fromNodeId)||Number(s.fromNodeId)<=0||!Number.isSafeInteger(s.toNodeId)||Number(s.toNodeId)<=Number(s.fromNodeId)
   ||!point(s.from)||!point(s.to)||typeof s.forward!=="boolean"||typeof s.backward!=="boolean"||!s.forward&&!s.backward||typeof s.name!=="string"||typeof s.highway!=="string")return null;
  const expected={lat:s.from.lat+(s.to.lat-s.from.lat)*value.fraction,lon:s.from.lon+(s.to.lon-s.from.lon)*value.fraction};
  if(distanceMeters(expected,value.point)>0.01||Math.abs(distanceMeters(value.facility,value.point)-value.distanceMeters)>0.01)return null;
  return value as RoadConnection;
 }catch{return null}
}

export function connectionMatchesSpot(value:RoadConnection|null,spot:{id:string;revision:number;position:Point}|null):value is RoadConnection{
 return !!value&&!!spot&&value.spotId===spot.id&&value.spotRevision===spot.revision&&value.facility.lat===spot.position.lat&&value.facility.lon===spot.position.lon;
}
