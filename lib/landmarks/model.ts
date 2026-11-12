import {distanceMeters} from "../route/graph.ts";
import {KOMA_VIEW,projectKomaPoint,type KomaMap,type KomaBranch} from "../route/koma.ts";
import type {Point} from "../route/types.ts";
import type {Landmark,LandmarkSymbol,KomaContext} from "../route/context.ts";
export type LandmarkKind="stop"|"control"|"crossing"|"signal"|"unique"|"bus"|"other";
export type Candidate={id:string;provider:"osm"|"mapillary";kind:LandmarkKind;symbol:LandmarkSymbol;label:string;point:Point;classification:string;sourceUrl:string;lastSeen?:number;note:string};
export type WorkCard={map:KomaMap;center:Point;context:KomaContext;referenceContext:KomaContext|null;osm:Candidate[]};
export type Target={key:string;point:Point;sequences:number[];approaches:number[]};
export type Dataset={id:string;source:"sample"|"draft";title:string;cards:WorkCard[];targets:Target[]};
export type TargetCache={version:1;key:string;point:Point;fetchedAt:string;candidates:Candidate[];partial:boolean};
export type PhotoAsset={version:1;policyVersion:2;featureId:string;imageId:string;creator:string;capturedAt:number;fetchedAt:string;roi:{left:number;top:number;width:number;height:number};contentType:string};
export type PhotoFailure={version:1;policyVersion:2;featureId:string;fetchedAt:string;code:"no-usable-photo"};
export type Review={revision:number;choices:Record<string,boolean>};
export const initialAccepted=(candidate:Pick<Candidate,"kind">)=>["stop","control","crossing"].includes(candidate.kind);
export const choiceKey=(sequence:number,id:string)=>sequence+"|"+id;
export function accepted(review:Review,sequence:number,c:Candidate){return review.choices[choiceKey(sequence,c.id)]??initialAccepted(c)}
export function osmCandidate(feature:Landmark):Candidate|null{
 const kind:LandmarkKind=feature.symbol==="stop-sign"?"stop":feature.symbol==="stop-control"?"control":feature.symbol==="crossing"?"crossing":feature.symbol==="signal"?"signal":feature.symbol==="bus"?"bus":"other";
 if(kind==="other")return null;
 return {id:"osm:"+feature.id,provider:"osm",kind,symbol:feature.symbol,point:{...feature.point},label:kind==="control"?"一時停止点（標識未確認）":kind==="crossing"?"横断箇所（形態未確認）":feature.kind,classification:feature.symbol,sourceUrl:"https://www.openstreetmap.org/"+feature.id,note:feature.detail??"OSMの記録。現地の設置・見え方は未確認です。"};
}
export function mapillaryKind(value:string):Pick<Candidate,"kind"|"symbol"|"label">|null{
 if(/^regulatory--stop--/.test(value))return {kind:"stop",symbol:"stop-sign",label:"止まれ標識"};
 if(/^marking--discrete--crosswalk(?:-|$)/.test(value))return {kind:"crossing",symbol:"crossing",label:"横断歩道の路面表示"};
 if(/^object--traffic-light(?:--|$)/.test(value))return {kind:"signal",symbol:"signal",label:"信号"};
 if(["object--sign--store","object--sign--advertisement","object--banner"].includes(value))return {kind:"unique",symbol:"sign",label:value==="object--sign--store"?"店舗看板":value==="object--banner"?"旗・バナー":"広告看板"};
 return null;
}
export function validPoint(point:Point){return Number.isFinite(point.lat)&&Number.isFinite(point.lon)&&point.lat>=-85&&point.lat<=85&&point.lon>=-180&&point.lon<=180}
export function candidatesForCard(card:WorkCard,cache:TargetCache|undefined){
 const candidates=[...card.osm,...(cache?.candidates??[]).filter(c=>distanceMeters(card.center,c.point)<=30)];
 // Different providers remain separately reviewable; a nearby sign and crossing are not merged.
 return candidates.sort((a,b)=>Number(!initialAccepted(a))-Number(!initialAccepted(b))||distanceMeters(card.center,a.point)-distanceMeters(card.center,b.point)||a.id.localeCompare(b.id,"en"));
}
export function projectCandidate(card:WorkCard,c:Candidate){
 const heading=card.map.shortGeometry?.headingDegrees??card.map.headingDegrees;
 if(heading===undefined||heading===null)return null;
 const p=projectKomaPoint(card.center,c.point,heading);
 return {x:KOMA_VIEW.centerX+p.x*KOMA_VIEW.radius/30,y:KOMA_VIEW.centerY+p.y*KOMA_VIEW.radius/30};
}
export function layoutCandidates(card:WorkCard,items:Candidate[],branches:Pick<KomaBranch,"points">[]=card.map.branches){
 const placed:{candidate:Candidate;x:number;y:number;anchor:{x:number;y:number}}[]=[],unplaced:Candidate[]=[];
 for(const candidate of items){
  const anchor=projectCandidate(card,candidate);if(!anchor){unplaced.push(candidate);continue}
  const positions=[[12,-36],[-36,-36],[12,12],[-36,12],[-12,-48],[-12,24],[24,-12],[-48,-12],[-12,-72],[-12,48],[48,-12],[-72,-12]].map(([dx,dy])=>({x:Math.max(9,Math.min(267,anchor.x+dx)),y:Math.max(9,Math.min(217,anchor.y+dy))}));
  const clear=positions.find(p=>!placed.some(q=>p.x<q.x+29&&p.x+29>q.x&&p.y<q.y+29&&p.y+29>q.y)&&!branches.some(b=>b.points.slice(1).some((v,i)=>segmentBox(b.points[i],v,p))));
  if(clear)placed.push({candidate,...clear,anchor});else unplaced.push(candidate);
 }
 return {placed,unplaced};
}
function segmentBox(a:{x:number;y:number},b:{x:number;y:number},p:{x:number;y:number}){
 let low=0,high=1;for(const [start,delta,min,max]of [[a.x,b.x-a.x,p.x-7,p.x+31],[a.y,b.y-a.y,p.y-7,p.y+31]]){if(Math.abs(delta)<1e-10){if(start<min||start>max)return false;continue}const x=(min-start)/delta,y=(max-start)/delta;low=Math.max(low,Math.min(x,y));high=Math.min(high,Math.max(x,y));if(low>high)return false}return true;
}
