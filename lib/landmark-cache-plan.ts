import type {KomaMap} from "./route/koma.ts";
import type {Point} from "./route/types.ts";
type Card={map:KomaMap;candidate:{point:Point}};
export type JunctionTarget={nodeId:number;point:Point;sequences:number[];approaches:number[];branches:number;nearby:boolean;acute:boolean;score:number;reasons:string[]};
export function planLandmarkCache(cards:readonly Card[],limit=5){
 if(!Number.isInteger(limit)||limit<1||limit>20)throw new RangeError("Junction limit must be 1..20");
 const grouped=new Map<number,JunctionTarget>();
 for(const {map,candidate}of cards){
  if(!Number.isSafeInteger(map.nodeId)||map.nodeId<=0||!Number.isFinite(candidate.point.lat)||!Number.isFinite(candidate.point.lon))continue;
  const branches=map.shortGeometry?.branches??map.branches;
  const angles=branches.flatMap(b=>{const p=b.points.find(p=>Math.hypot(p.x-b.points[0].x,p.y-b.points[0].y)>1e-6);return p?[Math.atan2(p.y-b.points[0].y,p.x-b.points[0].x)*180/Math.PI]:[]});
  const acute=angles.some((a,i)=>angles.slice(i+1).some(b=>{const d=Math.abs(a-b)%360,gap=Math.min(d,360-d);return gap>1e-6&&gap<30}));
  const item=grouped.get(map.nodeId)??{nodeId:map.nodeId,point:{...candidate.point},sequences:[],approaches:[],branches:0,nearby:false,acute:false,score:0,reasons:[]};
  item.sequences.push(map.sequence);item.branches=Math.max(item.branches,branches.length);item.nearby ||=!!map.shortGeometry;item.acute ||=acute;
  const arrival=branches.find(b=>b.arrival);if(arrival&&!item.approaches.includes(arrival.neighborNodeId))item.approaches.push(arrival.neighborNodeId);
  grouped.set(map.nodeId,item);
 }
 const candidates=[...grouped.values()].filter(j=>j.branches>=3||j.nearby&&j.branches>=2);
 for(const j of candidates){
  j.approaches.sort((a,b)=>a-b);j.sequences.sort((a,b)=>a-b);
  j.score=(j.branches>=3?30+Math.min(3,j.branches-3)*15:0)+(j.acute?20:0)+(j.nearby?15:0)+(j.sequences.length>1?5:0);
  j.reasons=[...(j.branches>=3?[j.branches+"本の枝"]:[]),...(j.acute?["近い角度の枝"]:[]),...(j.nearby?["近接分岐"]:[]),...(j.sequences.length>1?["再訪あり"]:[])];
 }
 candidates.sort((a,b)=>b.score-a.score||a.nodeId-b.nodeId);
 const selected=candidates.slice(0,limit),viewSlots=selected.reduce((sum,j)=>sum+Math.max(1,j.approaches.length),0);
 return {courseCards:cards.length,physicalNodes:grouped.size,candidates,selected,viewSlots,exampleImageCeiling:viewSlots*2};
}
