import {createHash} from "node:crypto";
import {encodeExpandedSnapshot} from "./expanded-osm.ts";
import snapshot from "../data/miura-expanded/roads.json" with {type:"json"};
import source from "../data/miura-expanded/source.json" with {type:"json"};
import {distanceMeters,buildWalkingGraph} from "./route/graph.ts";
import {walkingSegments,nearestWalkingSegment,connectionMatchesSpot,type RoadConnection} from "./route/road-connection.ts";
import {attachRoadConnections} from "./route/attach-road-connections.ts";
import type {Graph,Snapshot} from "./route/types.ts";
import type {ManagedSpot} from "./spots/editing.ts";
let cached:ReturnType<typeof walkingSegments>|undefined,cachedGraph:Graph|undefined;
function expandedGraph(){
 if(!cachedGraph){
  if(createHash("sha256").update(encodeExpandedSnapshot(snapshot as Snapshot)).digest("hex")!==source.roadSnapshotSha256)throw Error("Expanded road data integrity mismatch");
  cachedGraph=buildWalkingGraph(snapshot as Snapshot);cached=walkingSegments(cachedGraph);
 }
 return cachedGraph;
}
export function getExpandedSegments(){expandedGraph();return cached!}
export function roadConnectionForPoint(spot:ManagedSpot,point:{lat:number;lon:number}):RoadConnection|null{
 const nearest=nearestWalkingSegment(point,getExpandedSegments());
 return nearest?{...nearest,distanceMeters:distanceMeters(spot.position,nearest.point),spotId:spot.id,spotRevision:spot.revision,facility:{lat:spot.position.lat,lon:spot.position.lon},snapshotSha256:source.roadSnapshotSha256,osmBaseTimestamp:source.osmBaseTimestamp}:null;
}
export function roadConnectionForSpot(spot:ManagedSpot):RoadConnection|null{return roadConnectionForPoint(spot,spot.position)}
// For local calculation/verification only. No entrance or publication approval is recorded.
export function prepareExpandedRoadConnections(spots:readonly ManagedSpot[],overrides:readonly RoadConnection[]=[]){
 const unique=new Map<string,ManagedSpot>();
 for(const spot of spots){
  const previous=unique.get(spot.id);
  if(previous&&(previous.revision!==spot.revision||previous.position.lat!==spot.position.lat||previous.position.lon!==spot.position.lon))throw Error("Conflicting versions of the same spot");
  unique.set(spot.id,spot);
 }
 const manual=new Map<string,RoadConnection>();
 for(const value of overrides){
  if(manual.has(value.spotId)||!connectionMatchesSpot(value,unique.get(value.spotId)??null))throw Error("Invalid manual connection identity");
  manual.set(value.spotId,value);
 }
 const connections=[...unique.values()].map(spot=>{
  const value=manual.get(spot.id)??roadConnectionForSpot(spot);if(!value)throw Error("No road candidate: "+spot.id);return value;
 });
 const attached=attachRoadConnections(expandedGraph(),connections,{snapshotSha256:source.roadSnapshotSha256,osmBaseTimestamp:source.osmBaseTimestamp});
 return {...attached,connections};
}
export function connectionOnCurrentRoad(c:RoadConnection){
 if(c.snapshotSha256!==source.roadSnapshotSha256||c.osmBaseTimestamp!==source.osmBaseTimestamp)return false;
 const s=getExpandedSegments().find(s=>s.wayId===c.segment.wayId&&s.fromNodeId===c.segment.fromNodeId&&s.toNodeId===c.segment.toNodeId);
 return !!s&&s.from.lat===c.segment.from.lat&&s.from.lon===c.segment.from.lon&&s.to.lat===c.segment.to.lat&&s.to.lon===c.segment.to.lon&&s.forward===c.segment.forward&&s.backward===c.segment.backward&&s.name===c.segment.name&&s.highway===c.segment.highway;
}
export const expandedRoadSource=source;
