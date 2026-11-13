import {createMisakiReviewPoc} from "./misaki-review.ts";
import {osmCandidate,initialAccepted,type Candidate} from "./landmarks/model.ts";
import type {Point} from "./route/types.ts";
import type {KomaMap} from "./route/koma.ts";
import type {KomaContext} from "./route/context.ts";
export type HomeDemoCard={map:KomaMap;context:KomaContext;center:Point;candidates:Candidate[]};

export function createHomeDemo(){
 const source=createMisakiReviewPoc();
 const first=source.koma.findIndex((_,i)=>i+2<source.koma.length&&source.koma.slice(i,i+3).every(c=>c.map.kind==="junction"&&c.map.state==="ready"&&!c.map.shortGeometry));
 if(first<0)throw new Error("Three consecutive verified diagram geometries are required for the home example.");
 const cards:HomeDemoCard[]=source.koma.slice(first,first+3).map(({map,context,candidate})=>({map,context,center:{...candidate.point},candidates:context.landmarks.map(osmCandidate).filter((c):c is Candidate=>c!==null&&initialAccepted(c))}));
 const route=source.route.legs.flatMap((leg,i)=>leg.nodeIds.slice(i?1:0)).map(id=>source.graph.nodes.get(id)!);
 const latitude=route.reduce((sum,p)=>sum+p.lat,0)/route.length,factor=Math.cos(latitude*Math.PI/180);
 const xs=route.map(p=>p.lon*factor),ys=route.map(p=>p.lat),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 const scale=Math.min(260/(maxX-minX||1),140/(maxY-minY||1));
 const offsetX=(300-(maxX-minX)*scale)/2,offsetY=(180-(maxY-minY)*scale)/2;
 const project=(p:{lat:number;lon:number})=>({x:Number((offsetX+(p.lon*factor-minX)*scale).toFixed(2)),y:Number((180-offsetY-(p.lat-minY)*scale).toFixed(2))});
 return {cards,route:{points:route.map(project),stops:source.route.stops.map(stop=>project(source.graph.nodes.get(stop.nodeId)!))}};
}
