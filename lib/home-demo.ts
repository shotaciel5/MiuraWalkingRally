import selection from "../data/ui/home-examples.json" with {type:"json"};
import {createMisakiReviewPoc} from "./misaki-review.ts";
import {osmCandidate,initialAccepted,type Candidate} from "./landmarks/model.ts";
import type {Point} from "./route/types.ts";
import type {KomaMap} from "./route/koma.ts";
import type {KomaContext} from "./route/context.ts";
export type HomeDemoCard={map:KomaMap;context:KomaContext;center:Point;candidates:Candidate[]};

export function createHomeDemo(config=selection){
 const source=createMisakiReviewPoc();
 const eligible=source.koma.filter(c=>c.map.kind==="junction"&&c.map.state==="ready"&&!c.map.shortGeometry);
 if(config.schemaVersion!==1||!Array.isArray(config.phoneSequences)||config.phoneSequences.length!==3||new Set(config.phoneSequences).size!==3)throw new Error("Home examples require exactly three distinct diagram sequences.");
 const cardAt=(sequence:number):HomeDemoCard=>{
  const card=eligible.find(c=>c.map.sequence===sequence);
  if(!card)throw new Error("Unavailable home diagram sequence: "+sequence);
  const {map,context,candidate}=card;
  return {map,context,center:{...candidate.point},candidates:context.landmarks.map(osmCandidate).filter((c):c is Candidate=>c!==null&&initialAccepted(c))};
 };
 const cards=config.phoneSequences.map(cardAt),introduction=cardAt(config.introductionSequence);
 const route=source.route.legs.flatMap((leg,i)=>leg.nodeIds.slice(i?1:0)).map(id=>source.graph.nodes.get(id)!);
 const latitude=route.reduce((sum,p)=>sum+p.lat,0)/route.length,factor=Math.cos(latitude*Math.PI/180);
 const xs=route.map(p=>p.lon*factor),ys=route.map(p=>p.lat),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 const scale=Math.min(260/(maxX-minX||1),140/(maxY-minY||1));
 const offsetX=(300-(maxX-minX)*scale)/2,offsetY=(180-(maxY-minY)*scale)/2;
 const project=(p:{lat:number;lon:number})=>({x:Number((offsetX+(p.lon*factor-minX)*scale).toFixed(2)),y:Number((180-offsetY-(p.lat-minY)*scale).toFixed(2))});
 return {cards,introduction,route:{points:route.map(project),stops:source.route.stops.map(stop=>project(source.graph.nodes.get(stop.nodeId)!))}};
}
