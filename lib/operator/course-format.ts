import {parseLandmarkSnapshot,validateSnapshotRoute} from "../landmarks/course-snapshot.ts";
import {SpotError} from "../spots/editing.ts";
export const COURSE_FORMAT_VERSION=1;
export const COURSE_GENERATOR_VERSION="operator-preview-v1";
export const MAX_COURSE_BYTES=8*1024*1024;
export class CourseError extends SpotError{
 reason:string;
 constructor(reason:"invalid"|"conflict"|"missing"|"unavailable",message:string){super(reason,message);this.reason=reason}
}
type Rule<T>=(v:unknown)=>T;
const fail=():never=>{throw Error("Invalid saved-course v1 data")};
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
const text:Rule<string>=v=>typeof v==="string"&&v.length<=65536?v:fail();
const num:Rule<number>=v=>typeof v==="number"&&Number.isFinite(v)?v:fail();
const nonneg:Rule<number>=v=>num(v)>=0?v as number:fail();
const integer:Rule<number>=v=>Number.isSafeInteger(v)?v as number:fail();
const natural:Rule<number>=v=>integer(v)>=0?v as number:fail();
const positive:Rule<number>=v=>integer(v)>0?v as number:fail();
const node:Rule<number>=v=>integer(v)!==0?v as number:fail();
const bool:Rule<boolean>=v=>typeof v==="boolean"?v:fail();
const choice=<const T extends readonly (string|number)[]>(...values:T):Rule<T[number]>=>v=>values.includes(v as T[number])?v as T[number]:fail();
const optional=<T>(rule:Rule<T>):Rule<T|undefined>=>v=>v===undefined?undefined:rule(v);
const nullable=<T>(rule:Rule<T>):Rule<T|null>=>v=>v===null?null:rule(v);
const array=<T>(rule:Rule<T>):Rule<T[]>=>v=>Array.isArray(v)&&v.length<=200000?v.map(rule):fail();
const object=<S extends Record<string,Rule<unknown>>>(shape:S):Rule<{[K in keyof S]:ReturnType<S[K]>}>=>v=>{
 if(!record(v)||Object.keys(v).some(k=>!Object.hasOwn(shape,k)))return fail();
 const entries=Object.entries(shape).map(([key,rule])=>{try{return [key,rule(v[key])] as const}catch(error){throw Error(key+": "+String(error))}}).filter(([,x])=>x!==undefined);
 return Object.fromEntries(entries) as {[K in keyof S]:ReturnType<S[K]>};
};
const tags:Rule<Record<string,string>>=v=>record(v)&&Object.keys(v).length<=100?Object.fromEntries(Object.entries(v).map(([k,x])=>[text(k),text(x)])):fail();
const hash:Rule<string>=v=>typeof v==="string"&&/^[0-9a-f]{64}$/.test(v)?v:fail();
const iso:Rule<string>=v=>typeof v==="string"&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v?v:fail();
const osmTime:Rule<string>=v=>typeof v==="string"&&Number.isFinite(Date.parse(v))?v:fail();
const lat:Rule<number>=v=>Math.abs(num(v))<=90?v as number:fail(),lon:Rule<number>=v=>Math.abs(num(v))<=180?v as number:fail();
const fraction:Rule<number>=v=>num(v)>=0&&num(v)<=1?v as number:fail();
const spotId:Rule<string>=v=>typeof v==="string"&&/^(osm-(node|way|relation)-[1-9][0-9]*|local-[0-9a-f-]{36})$/.test(v)?v:fail();
const featureId:Rule<string>=v=>typeof v==="string"&&/^(node|way)\/[1-9][0-9]*$/.test(v)?v:fail();
export const validCourseId=(v:unknown):v is string=>typeof v==="string"&&/^course-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const courseId:Rule<string>=v=>validCourseId(v)?v:fail();
const point=object({lat,lon}),pixel=object({x:num,y:num}),diagramPoint=object({x:num,y:num,nodeId:nullable(node)});
const access=choice("candidate","excluded","review");
const segment=object({from:node,to:node,wayIds:array(positive),fraction});
const branch=object({neighborNodeId:node,points:array(diagramPoint),sourceSegments:array(segment),arrival:bool,departure:bool,entry:access,exit:access,endReason:choice("limit","junction","end"),pathPixels:nonneg});
const geometry=object({headingDegrees:num,branches:array(branch),issues:array(text)});
const map=object({sequence:positive,nodeId:node,pathIndex:natural,stopIds:array(text),metersFromStart:nonneg,metersToNext:nullable(nonneg),kind:choice("start","finish","return","junction"),headingDegrees:nullable(num),state:choice("ready","held"),issues:array(text),branches:array(branch),shortGeometry:optional(geometry)});
const evidence=object({wayId:positive,highway:text,entry:access,exit:access});
const candidateBranch=object({neighborNodeId:node,bearingDegrees:nullable(num),evidence:array(evidence),entry:access,exit:access,relativeDegrees:nullable(num),arrival:bool,departure:bool});
const direction=object({neighborNodeId:node,wayId:positive,bearingDegrees:nullable(num)});
const candidate=object({sequence:positive,pathIndex:natural,nodeId:node,point,reasons:array(choice("start","finish","stop","junction","return")),stopIds:array(text),arrival:nullable(direction),departure:nullable(direction),turnDegrees:nullable(num),branches:array(candidateBranch),metersFromStart:nonneg,metersToNext:nullable(nonneg),issues:array(text)});
const symbol=choice("signal","crossing","bus","shrine","temple","worship","toilet","water","parking","shop","food","historic","tourism","facility","stop-sign","stop-control","give-way-control","sign");
const landmark=object({id:featureId,point,name:text,kind:text,symbol,detail:optional(text),sourceTags:optional(tags),anchor:choice("node","area-label"),meters:nonneg,x:num,y:num});
const context=object({buildings:array(object({id:featureId,points:array(pixel)})),landmarks:array(landmark),roads:array(object({id:positive,name:text,highway:text})),steps:array(object({from:diagramPoint,to:diagramPoint,wayIds:array(positive)})),availableLandmarks:natural,availableBuildings:natural});
const stop=object({id:text,name:text,nodeId:node,note:text});
const wayEvidence=object({kind:choice("way"),id:positive,fromNodeId:positive,toNodeId:positive,fraction});
const nodeEvidence=object({kind:choice("node"),id:positive});
const sourceEvidence:Rule<ReturnType<typeof wayEvidence>|ReturnType<typeof nodeEvidence>>=v=>record(v)&&v.kind==="way"?wayEvidence(v):nodeEvidence(v);
const bounds=object({south:lat,west:lon,north:lat,east:lon});
const source=object({provider:text,attribution:text,copyrightUrl:text,license:text,licenseUrl:text,endpoint:text,httpMethod:text,query:text,retrievedAt:iso,osmBaseTimestamp:osmTime,originalSha256:hash,snapshotSha256:hash,bounds,normalization:text,counts:object({nodes:natural,highways:natural,elements:natural,routableNodes:natural,bytes:natural}),roadSnapshotSha256:hash,roadProjection:text,roadCounts:object({nodes:natural,highways:natural,routableNodes:natural,bytes:natural})});
// Frozen v1 contract, independent of the live generator's inferred return type or OSM contents.
const preview=object({
 state:choice("ready"),correctionRevision:natural,title:text,draftRevision:positive,draftUpdatedAt:iso,source,
 meters:nonneg,minutes:nonneg,speedKmh:nonneg,
 legs:array(object({label:text,from:text,to:text,meters:nonneg,minutes:nonneg,points:array(point)})),
 path:array(point),roads:array(object({id:positive,points:array(point)})),
 cards:array(object({map,candidate,stops:array(stop),context,referenceContext:nullable(context),evidence:sourceEvidence})),
 visits:array(object({id:text,label:text,name:text,spotId,spotRevision:natural,point,facility:point,gap:nonneg,mode:choice("manual","auto"),komaIndex:natural}))
});
const spotSource=object({type:choice("node","way","relation"),id:positive,url:text});
const routing:Rule<{state:"poc-reference";nodeId:number}|{state:"entrance-unverified"|"outside-road-snapshot"}>=v=>{
 if(record(v)&&v.state==="poc-reference")return object({state:choice("poc-reference"),nodeId:positive})(v);
 return object({state:choice("entrance-unverified","outside-road-snapshot")})(v);
};
const spot=object({id:spotId,name:text,category:choice("market","cafe","food","sweets","souvenir","shopping","scenery","park","history","religious","attraction","activity","stay","information"),area:choice("misaki-vicinity","jogashima-vicinity"),position:object({lat,lon,kind:choice("node","bounding-box-center","operator")}),source:nullable(spotSource),reviewStatus:choice("unverified"),routing,description:text,revision:natural,updatedAt:nullable(iso)});
const draft=object({title:text,start:spot,finish:spot,stops:array(object({kind:choice("checkpoint","waypoint"),spot})),revision:positive,updatedAt:iso});
const roadSegment=object({wayId:positive,fromNodeId:positive,toNodeId:positive,from:point,to:point,forward:bool,backward:bool,name:text,highway:text});
const connection=object({spotId,spotRevision:natural,facility:point,point,fraction,distanceMeters:nonneg,segment:roadSegment,snapshotSha256:hash,osmBaseTimestamp:osmTime});
const corrections=object({revision:natural,updatedAt:nullable(iso),items:array(connection)});
const legacyPayloadRule=object({formatVersion:choice(1),generatorVersion:choice("operator-preview-v1"),input:object({draft,corrections}),preview});
const landmarkPayloadRule=object({formatVersion:choice(2),generatorVersion:choice("operator-preview-v1"),input:object({draft,corrections}),preview,landmarks:parseLandmarkSnapshot});
const payloadRule:Rule<ReturnType<typeof legacyPayloadRule>|ReturnType<typeof landmarkPayloadRule>>=v=>record(v)&&v.formatVersion===2?landmarkPayloadRule(v):legacyPayloadRule(v);
export type CoursePayload=ReturnType<typeof payloadRule>;
export type SavedPreviewV1=CoursePayload["preview"];
const recordRule=object({id:courseId,createdAt:iso,fingerprint:hash,payload:payloadRule});
export type SavedCourse=ReturnType<typeof recordRule>;
const receiptRule=object({formatVersion:choice(1,2),fingerprint:hash,draftRevision:positive,correctionRevision:natural,roadSha256:hash,contextSha256:hash});
export type SaveReceipt=ReturnType<typeof receiptRule>;
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
export function canonicalJson(value:unknown):string{
 const normalize=(v:unknown):unknown=>Array.isArray(v)?v.map(normalize):record(v)?Object.fromEntries(Object.entries(v).filter(([,x])=>x!==undefined).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,x])=>[k,normalize(x)])):v;
 return JSON.stringify(normalize(value));
}
export function parseSaveReceipt(value:unknown):SaveReceipt{
 try{return receiptRule(value)}catch{throw new CourseError("invalid","保存する生成結果の識別情報を確認してください。")}
}
export function courseReceipt(payload:CoursePayload,fingerprint:string):SaveReceipt{
 return {formatVersion:payload.formatVersion,fingerprint,draftRevision:payload.input.draft.revision,correctionRevision:payload.input.corrections.revision,roadSha256:payload.preview.source.roadSnapshotSha256,contextSha256:payload.preview.source.snapshotSha256};
}
export function parseCoursePayload(value:unknown):CoursePayload{
 const p=payloadRule(value),v=p.preview,d=p.input.draft,c=p.input.corrections;
 if(!v.title.trim()||v.title!==d.title||v.title.length>100||v.draftRevision!==d.revision||v.draftUpdatedAt!==d.updatedAt||v.correctionRevision!==c.revision||!(v.meters>0&&v.speedKmh>0)||v.path.length<2||!v.cards.length||v.cards.length!==v.cards.at(-1)!.map.sequence||v.legs.length!==d.stops.length+1)return fail();
 if((c.revision===0&&(c.items.length||c.updatedAt!==null))||(c.revision>0&&c.updatedAt===null)||new Set(c.items.map(x=>x.spotId)).size!==c.items.length)return fail();
 const expected=[{id:"start",spot:d.start},...d.stops.map((s,i)=>({id:"stop-"+i,spot:s.spot})),{id:"finish",spot:d.finish}];
 if(v.visits.length!==expected.length)return fail();
 for(const [i,x]of expected.entries()){
  const visit=v.visits[i],card=v.cards[visit.komaIndex];
  if(visit.id!==x.id||visit.spotId!==x.spot.id||visit.spotRevision!==x.spot.revision||visit.name!==x.spot.name||!same(visit.facility,{lat:x.spot.position.lat,lon:x.spot.position.lon})||!card?.map.stopIds.includes(x.id))return fail();
 }
 const seen=new Map<string,string>();
 for(const x of expected){
  const s=x.spot,key=canonicalJson(s);
  if(seen.has(s.id)&&seen.get(s.id)!==key)return fail();seen.set(s.id,key);
  if(s.source&&(s.id!=="osm-"+s.source.type+"-"+s.source.id||s.source.url!=="https://www.openstreetmap.org/"+s.source.type+"/"+s.source.id))return fail();
  if(!s.source&&(!s.id.startsWith("local-")||s.position.kind!=="operator"))return fail();
  if(s.revision===0?(s.updatedAt!==null||!s.source):s.updatedAt===null)return fail();
 }
 for(const x of c.items){
  const s=expected.find(e=>e.spot.id===x.spotId)?.spot;
  if(!s||s.revision!==x.spotRevision||!same(x.facility,{lat:s.position.lat,lon:s.position.lon})||x.snapshotSha256!==v.source.roadSnapshotSha256||x.osmBaseTimestamp!==v.source.osmBaseTimestamp||!x.segment.forward&&!x.segment.backward)return fail();
 }
 const close=(a:number,b:number)=>Math.abs(a-b)<1e-6;
 if(!close(v.legs.reduce((n,l)=>n+l.meters,0),v.meters)||!close(v.cards.reduce((n,x)=>n+(x.map.metersToNext??0),0),v.meters)||v.cards[0].map.metersFromStart!==0||v.cards.at(-1)!.map.metersToNext!==null||!close(v.cards.at(-1)!.map.metersFromStart,v.meters))return fail();
 for(const [i,x]of v.cards.entries()){
  const m=x.map,a=x.candidate;
  if(m.sequence!==i+1||m.sequence!==a.sequence||m.nodeId!==a.nodeId||m.pathIndex!==a.pathIndex||!same(a.point,v.path[m.pathIndex])||!same(m.stopIds,a.stopIds)||!same(x.stops.map(s=>s.id),m.stopIds)||!close(m.metersFromStart,a.metersFromStart)||m.metersToNext!==a.metersToNext)return fail();
  if(i<v.cards.length-1&&(m.pathIndex>=v.cards[i+1].map.pathIndex||m.metersToNext===null||!close(m.metersFromStart+m.metersToNext,v.cards[i+1].map.metersFromStart)))return fail();
  if(m.state==="held"&&m.branches.length||m.state==="ready"&&!m.branches.length||!!m.shortGeometry!==!!x.referenceContext)return fail();
  const branches=m.shortGeometry?.branches??m.branches;
  if(m.state==="ready"||m.shortGeometry){
   if(m.headingDegrees===null||!same(branches.map(b=>b.neighborNodeId),a.branches.map(b=>b.neighborNodeId))||new Set(branches.map(b=>b.neighborNodeId)).size!==branches.length)return fail();
   for(const b of branches){
    const origin=a.branches.find(t=>t.neighborNodeId===b.neighborNodeId)!;
    if(b.arrival!==origin.arrival||b.departure!==origin.departure||b.entry!==origin.entry||b.exit!==origin.exit||b.points.length<2||b.sourceSegments.length!==b.points.length-1||b.points[0].x!==150||b.points[0].y!==140||b.sourceSegments.some(s=>s.fraction<=0||!s.wayIds.length))return fail();
   }
  }
  if(m.shortGeometry&&(m.state!=="held"||m.shortGeometry.headingDegrees!==m.headingDegrees||m.issues.length!==1||m.issues[0]!=="Selected arms too short to distinguish symbols"))return fail();

 }
 if(p.formatVersion===2)validateSnapshotRoute(p.landmarks,p.preview.cards);
 return p;
}
export function parseSavedCourse(value:unknown):SavedCourse{
 const saved=recordRule(value);parseCoursePayload(saved.payload);return saved;
}
