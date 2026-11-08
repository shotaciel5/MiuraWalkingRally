import {createHash} from "node:crypto";
import {encodeExpandedSnapshot} from "./expanded-osm.ts";
import snapshot from "../data/miura-expanded/roads.json" with {type:"json"};
import source from "../data/miura-expanded/source.json" with {type:"json"};
import {buildWalkingGraph} from "./route/graph.ts";
import {walkingSegments,nearestWalkingSegment,type RoadConnection} from "./route/road-connection.ts";
import type {Snapshot} from "./route/types.ts";
import type {ManagedSpot} from "./spots/editing.ts";
let cached:ReturnType<typeof walkingSegments>|undefined;
export function getExpandedSegments(){
 if(!cached){
  if(createHash("sha256").update(encodeExpandedSnapshot(snapshot as Snapshot)).digest("hex")!==source.roadSnapshotSha256)throw Error("Expanded road data integrity mismatch");
  cached=walkingSegments(buildWalkingGraph(snapshot as Snapshot));
 }
 return cached;
}
export function roadConnectionForSpot(spot:ManagedSpot):RoadConnection|null{
 const nearest=nearestWalkingSegment(spot.position,getExpandedSegments());
 return nearest?{...nearest,spotId:spot.id,spotRevision:spot.revision,facility:{lat:spot.position.lat,lon:spot.position.lon},snapshotSha256:source.roadSnapshotSha256,osmBaseTimestamp:source.osmBaseTimestamp}:null;
}
export const expandedRoadSource=source;
