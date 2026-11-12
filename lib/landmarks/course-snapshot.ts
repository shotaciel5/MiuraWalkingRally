import {accepted,candidatesForCard,selectableCandidates,type Candidate,type PhotoAsset,type Dataset,type TargetCache,type Review} from "./model.ts";
import {distanceMeters} from "../route/graph.ts";
export type LandmarkSnapshot={version:1;datasetId:string;source:{id:string;hash:string};cards:{sequence:number;candidates:Candidate[]}[];photos:Record<string,PhotoAsset>};
const object=(v:unknown,keys:string[]):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v)&&Object.keys(v).every(k=>keys.includes(k));
const str=(v:unknown,n=500)=>typeof v==="string"&&v.length<=n;
const hash=(v:unknown)=>typeof v==="string"&&/^[a-f0-9]{64}$/.test(v);
const number=(v:unknown)=>typeof v==="number"&&Number.isFinite(v);
const iso=(v:unknown)=>typeof v==="string"&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
const fail=():never=>{throw Error("Invalid saved landmark snapshot")};
export function parseLandmarkSnapshot(value:unknown):LandmarkSnapshot{
 if(!object(value,["version","datasetId","source","cards","photos"])||value.version!==1||!hash(value.datasetId)||!object(value.source,["id","hash"])||!str(value.source.id,100)||!hash(value.source.hash)||!Array.isArray(value.cards)||!value.cards.length||value.cards.length>10000||!value.photos||typeof value.photos!=="object"||Array.isArray(value.photos)||Object.keys(value.photos).length>2000)return fail();
 const used=new Set<string>(),consistent=new Map<string,string>();let total=0;
 for(const [i,card]of value.cards.entries()){
  if(!object(card,["sequence","candidates"])||card.sequence!==i+1||!Array.isArray(card.candidates)||card.candidates.length>200||new Set(card.candidates.map(c=>(c as Candidate)?.id)).size!==card.candidates.length)return fail();
  total+=card.candidates.length;if(total>10000)return fail();
  for(const c of card.candidates){
   if(!object(c,["id","provider","kind","symbol","label","point","classification","sourceUrl","lastSeen","note"])||!str(c.id,80)||!str(c.label,200)||!str(c.classification,200)||!str(c.note,1000)||!object(c.point,["lat","lon"])||!number(c.point.lat)||!number(c.point.lon)||Math.abs(c.point.lat as number)>90||Math.abs(c.point.lon as number)>180||c.lastSeen!==undefined&&!number(c.lastSeen))return fail();
   const kinds:Record<string,string>={stop:"stop-sign",control:"stop-control",crossing:"crossing",signal:"signal",bus:"bus",unique:"sign"};if(typeof c.kind!=="string"||kinds[c.kind]!==c.symbol)return fail();
   if(c.provider==="osm"){if(!/^osm:(node|way)\/[1-9][0-9]*$/.test(c.id as string)||c.sourceUrl!=="https://www.openstreetmap.org/"+String(c.id).slice(4)||c.kind==="unique")return fail()}
   else if(c.provider==="mapillary"){if(!/^mapillary:\d{1,30}$/.test(c.id as string)||c.sourceUrl!=="https://www.mapillary.com/")return fail()}else return fail();
   const identity=JSON.stringify(Object.keys(c).sort().map(k=>[k,c[k]]));if(consistent.has(c.id as string)&&consistent.get(c.id as string)!==identity)return fail();consistent.set(c.id as string,identity);
   if(c.kind==="unique")used.add(String(c.id).slice(10));
  }
 }
 const photos=value.photos as Record<string,unknown>;if(Object.keys(photos).length!==used.size)return fail();
 for(const [id,p]of Object.entries(photos)){
  if(!used.has(id)||!object(p,["version","policyVersion","featureId","imageId","creator","capturedAt","fetchedAt","roi","contentType","crop"])||p.version!==1||p.policyVersion!==2||p.featureId!==id||!str(p.imageId,30)||!/^\d{1,30}$/.test(p.imageId as string)||!str(p.creator,100)||!number(p.capturedAt)||(p.capturedAt as number)<0||!iso(p.fetchedAt)||!["image/jpeg","image/png","image/webp"].includes(p.contentType as string)||!object(p.roi,["left","top","width","height"]))return fail();
  const r=p.roi;if(![r.left,r.top,r.width,r.height].every(number)||(r.left as number)<0||(r.top as number)<0||!(r.width as number>0)||!(r.height as number>0)||(r.left as number)+(r.width as number)>100.001||(r.top as number)+(r.height as number)>100.001)return fail();
  const crop=p.crop;if(!object(crop,["size","version","path","sha256","contentType"])||crop.size!==128||crop.version!==1||crop.contentType!=="image/png"||!hash(crop.sha256)||crop.path!=="/landmarks/miura-v1/"+crop.sha256+".png")return fail();
 }
 return structuredClone(value) as unknown as LandmarkSnapshot;
}
export function validateSnapshotRoute(snapshot:LandmarkSnapshot,cards:{map:{sequence:number};candidate:{point:{lat:number;lon:number}}}[]){
 if(snapshot.cards.length!==cards.length)fail();
 for(const [i,c]of snapshot.cards.entries())if(c.sequence!==cards[i].map.sequence||c.candidates.some(p=>distanceMeters(p.point,cards[i].candidate.point)>30.000001))fail();
}
export function freezeLandmarks(state:{dataset:Dataset;targets:Record<string,TargetCache>;assets:Record<string,PhotoAsset>;review:Review;region:{id:string;contentHash:string}}):LandmarkSnapshot{
 const photos:Record<string,PhotoAsset>={};
 const cards=state.dataset.cards.map(card=>{const target=state.dataset.targets.find(t=>t.sequences.includes(card.map.sequence)),items=selectableCandidates(candidatesForCard(card,target?state.targets[target.key]:undefined),state.assets).filter(c=>accepted(state.review,card.map.sequence,c));for(const c of items)if(c.kind==="unique")photos[c.id.slice(10)]=state.assets[c.id.slice(10)];return {sequence:card.map.sequence,candidates:items}});
 return parseLandmarkSnapshot({version:1,datasetId:state.dataset.id,source:{id:state.region.id,hash:state.region.contentHash},cards,photos});
}
