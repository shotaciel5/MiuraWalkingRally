import {distanceMeters} from "./graph.ts";
import type {KomaContext} from "./context.ts";
import type {KomaBranch} from "./koma.ts";
export type LandmarkPresentation="source"|"symbols"|"roads";
export type SymbolLimit=1|2|3;
type Feature=KomaContext["landmarks"][number];
export type SymbolPlacement={feature:Feature;x:number;y:number;size:number};
export type OmittedSymbol={id:string;reason:"not-physical-evidence"|"invalid-position"|"near-duplicate"|"no-clear-space"|"limit"};
const priority={ "stop-sign":0,signal:1,bus:2 } as const;
export function isVisualLandmark(feature:Feature){
 if(feature.anchor!=="node")return false;
 if(feature.symbol==="signal"||feature.symbol==="bus")return true;
 if(feature.symbol!=="stop-sign")return false;
 return ["traffic_sign","traffic_sign:forward","traffic_sign:backward"].some(k=>(feature.sourceTags?.[k]??"").split(/[;,]/).some(v=>["JP:330","JP:330-A","JP:330-B"].includes(v.trim())));
}
function intersects(a:{x:number;y:number},b:{x:number;y:number},box:{x:number;y:number;width:number;height:number},pad=7){
 let low=0,high=1;
 for(const [start,delta,min,max]of [[a.x,b.x-a.x,box.x-pad,box.x+box.width+pad],[a.y,b.y-a.y,box.y-pad,box.y+box.height+pad]]){
  if(Math.abs(delta)<1e-10){if(start<min||start>max)return false;continue}
  const first=(min-start)/delta,last=(max-start)/delta;low=Math.max(low,Math.min(first,last));high=Math.min(high,Math.max(first,last));if(low>high)return false;
 }
 return true;
}
export function visualLandmarks(context:KomaContext,branches:Pick<KomaBranch,"points">[],limit:SymbolLimit=2){
 if(![1,2,3].includes(limit))throw new RangeError("Symbol limit must be 1, 2, or 3");
 const placements:SymbolPlacement[]=[],omitted:OmittedSymbol[]=[],eligible:Feature[]=[];
 for(const feature of context.landmarks){
  if(!isVisualLandmark(feature)){omitted.push({id:feature.id,reason:"not-physical-evidence"});continue}
  if(![feature.x,feature.y,feature.meters,feature.point.lat,feature.point.lon].every(Number.isFinite)||feature.meters<0||feature.x<9||feature.x>291||feature.y<9||feature.y>241){omitted.push({id:feature.id,reason:"invalid-position"});continue}
  eligible.push(feature);
 }
 eligible.sort((a,b)=>priority[a.symbol as keyof typeof priority]-priority[b.symbol as keyof typeof priority]||a.meters-b.meters||a.id.localeCompare(b.id,"en"));
 for(const feature of eligible){
  if(placements.some(p=>p.feature.id===feature.id||distanceMeters(p.feature.point,feature.point)<6)){omitted.push({id:feature.id,reason:"near-duplicate"});continue}
  if(placements.length>=limit){omitted.push({id:feature.id,reason:"limit"});continue}
  const size=32,positions=[[12,-44],[-44,-44],[12,12],[-44,12],[-16,-60],[-16,28],[28,-16],[-60,-16]].map(([x,y])=>({x:Math.max(9,Math.min(259,feature.x+x)),y:Math.max(9,Math.min(209,feature.y+y))}));
  const clear=positions.filter(p=>!branches.some(b=>b.points.slice(1).some((q,i)=>intersects(b.points[i],q,{...p,width:size,height:size})))&&!placements.some(q=>p.x<q.x+q.size+6&&p.x+size+6>q.x&&p.y<q.y+q.size+6&&p.y+size+6>q.y));
  clear.sort((a,b)=>Math.hypot(a.x+16-feature.x,a.y+16-feature.y)-Math.hypot(b.x+16-feature.x,b.y+16-feature.y));
  if(!clear.length){omitted.push({id:feature.id,reason:"no-clear-space"});continue}
  placements.push({feature,...clear[0],size});
 }
 return {placements,omitted,eligibleCount:eligible.length};
}
