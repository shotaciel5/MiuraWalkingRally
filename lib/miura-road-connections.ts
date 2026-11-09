import {createHash} from "node:crypto";
import {encodeExpandedSnapshot} from "./expanded-osm.ts";
import snapshot from "../data/miura-expanded/roads.json" with {type:"json"};
import source from "../data/miura-expanded/source.json" with {type:"json"};
import {buildWalkingGraph} from "./route/graph.ts";
import {walkingSegments,nearestWalkingSegment,type RoadConnection} from "./route/road-connection.ts";
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
export function roadConnectionForSpot(spot:ManagedSpot):RoadConnection|null{
 const nearest=nearestWalkingSegment(spot.position,getExpandedSegments());
 return nearest?{...nearest,spotId:spot.id,spotRevision:spot.revision,facility:{lat:spot.position.lat,lon:spot.position.lon},snapshotSha256:source.roadSnapshotSha256,osmBaseTimestamp:source.osmBaseTimestamp}:null;
}
// For local calculation/verification only. No entrance or publication approval is recorded.
export function prepareExpandedRoadConnections(spots:readonly ManagedSpot[]){
 const unique=new Map<string,ManagedSpot>();
 for(const spot of spots){
  const previous=unique.get(spot.id);
  if(previous&&(previous.revision!==spot.revision||previous.position.lat!==spot.position.lat||previous.position.lon!==spot.position.lon))throw Error("Conflicting versions of the same spot");
  unique.set(spot.id,spot);
 }
 const connections=[...unique.values()].map(spot=>{
  const value=roadConnectionForSpot(spot);if(!value)throw Error("No road candidate: "+spot.id);return value;
 });
 const attached=attachRoadConnections(expandedGraph(),connections,{snapshotSha256:source.roadSnapshotSha256,osmBaseTimestamp:source.osmBaseTimestamp});
 return {...attached,connections};
}
export const expandedRoadSource=source;
