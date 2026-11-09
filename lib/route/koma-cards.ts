import type {JunctionAnalysis} from "./junctions.ts";
import type {KomaMap} from "./koma.ts";
import type {WalkingRoute} from "./types.ts";

export function bindKomaCards(route: WalkingRoute, analysis: JunctionAnalysis, maps: KomaMap[]) {
  if (maps.length !== analysis.candidates.length) throw new Error("Koma/candidate count mismatch");
  return maps.map((map,i)=>{
    const candidate=analysis.candidates[i];
    if(map.pathIndex!==candidate.pathIndex||map.nodeId!==candidate.nodeId||map.sequence!==candidate.sequence)throw new Error("Koma occurrence mismatch");
    const stops=candidate.stopIds.map(id=>{
      const stop=route.stops.find(s=>s.id===id);
      if(!stop)throw new Error("Unknown koma stop");
      return stop;
    });
    return {map,candidate,stops};
  });
}
export type KomaCardData = ReturnType<typeof bindKomaCards>[number];
