import review from "../../data/spots/review.json" with {type:"json"};
import stops from "../../data/misaki/stops.json" with {type:"json"};
import {getDemoRally} from "../demo-rally.ts";

export type FixedCourseUse={spotId:string;courseTitle:string;href:string;stopId:string;stopName:string;role:string};
// The fixed demo is an independent snapshot. Identity, not the current name/coordinates, links its known source spots.
export function getFixedCourseUses():FixedCourseUse[]{
  const rally=getDemoRally();
  return review.anchors.map(anchor=>{
    const stop=rally.stops.find(s=>s.id===anchor.fixtureStopId),fixture=stops.find(s=>s.id===anchor.fixtureStopId);
    if(!stop||!fixture||fixture.nodeId!==anchor.nodeId)throw new Error("Fixed demo/source spot correspondence is invalid");
    return {spotId:anchor.spotId,courseTitle:rally.title,href:rally.href,stopId:stop.id,stopName:stop.name,role:stop.role};
  });
}
