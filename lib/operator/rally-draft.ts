import {decodeManagedSpot,validSpotId,SpotError,type ManagedSpot} from "../spots/editing.ts";
export type StopKind="checkpoint"|"waypoint";
export type DraftForm={title:string;start:ManagedSpot|null;finish:ManagedSpot|null;stops:{kind:StopKind;spot:ManagedSpot}[]};
export type RallyDraft=DraftForm&{start:ManagedSpot;finish:ManagedSpot;revision:number;updatedAt:string};
export type SpotRef={id:string;revision:number};
export type DraftInput={expectedRevision:number;title:string;start:SpotRef;finish:SpotRef;stops:{kind:StopKind;spot:SpotRef}[]};
export class DraftError extends SpotError {
  reason:"draft-conflict"|"catalog-conflict"|"invalid"|"unavailable";
  constructor(reason:DraftError["reason"],message:string){super(reason.endsWith("conflict")?"conflict":reason as "invalid"|"unavailable",message);this.reason=reason}
}
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
const keys=(v:Record<string,unknown>,allowed:string[])=>Object.keys(v).every(k=>allowed.includes(k));
const revision=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>=0&&Number(v)<Number.MAX_SAFE_INTEGER;
function ref(v:unknown):SpotRef{
 if(!object(v)||!keys(v,["id","revision"])||typeof v.id!=="string"||!validSpotId(v.id)||!revision(v.revision))throw new DraftError("invalid","地点を選択し直してください。");
 return {id:v.id,revision:v.revision};
}
export const blankDraft=():DraftForm=>({title:"",start:null,finish:null,stops:[]});
export function parseDraftInput(value:unknown):DraftInput{
 if(!object(value)||!keys(value,["expectedRevision","title","start","finish","stops"])||!revision(value.expectedRevision)
  ||typeof value.title!=="string"||!value.title.trim()||value.title.trim().length>100||!Array.isArray(value.stops))
  throw new DraftError("invalid","下書き名（1〜100文字）と開始・終了地点を確認してください。");
 const seen=new Set<string>();
 const stops=value.stops.map(raw=>{
  if(!object(raw)||!keys(raw,["kind","spot"])||!["checkpoint","waypoint"].includes(String(raw.kind)))throw new DraftError("invalid","途中地点の役割を確認してください。");
  const spot=ref(raw.spot);if(seen.has(spot.id))throw new DraftError("invalid","同じ途中地点が重複しています。");seen.add(spot.id);
  return {kind:raw.kind as StopKind,spot};
 });
 return {expectedRevision:value.expectedRevision,title:value.title.trim(),start:ref(value.start),finish:ref(value.finish),stops};
}
export function spotSignature(spot:ManagedSpot){
 return JSON.stringify([spot.id,spot.revision,spot.name,spot.category,spot.area,spot.position.lat,spot.position.lon,spot.position.kind,
  spot.description,spot.reviewStatus,spot.routing.state,spot.routing.state==="poc-reference"?spot.routing.nodeId:null,spot.source?.url??null,spot.updatedAt]);
}
export function draftSignature(form:DraftForm){
 return JSON.stringify([form.title.trim(),form.start?spotSignature(form.start):null,form.stops.map(s=>[s.kind,spotSignature(s.spot)]),form.finish?spotSignature(form.finish):null]);
}
export function decodeRallyDraft(value:unknown):RallyDraft|null{
 try{
  if(!object(value)||!keys(value,["title","start","finish","stops","revision","updatedAt"])||!revision(value.revision)||value.revision<1
   ||typeof value.updatedAt!=="string"||!Number.isFinite(Date.parse(value.updatedAt))||new Date(value.updatedAt).toISOString()!==value.updatedAt||!Array.isArray(value.stops))return null;
  const start=decodeManagedSpot(value.start),finish=decodeManagedSpot(value.finish);
  const stops=value.stops.map(raw=>object(raw)?{kind:raw.kind,spot:decodeManagedSpot(raw.spot)}:null);
  if(!start||!finish||stops.some(s=>!s?.spot))return null;
  parseDraftInput({expectedRevision:value.revision,title:value.title,start:{id:start.id,revision:start.revision},finish:{id:finish.id,revision:finish.revision},stops:stops.map(s=>({kind:s!.kind,spot:{id:s!.spot!.id,revision:s!.spot!.revision}}))});
  const snapshots=[start,finish,...stops.map(s=>s!.spot!)],seen=new Map<string,string>();
  for(const spot of snapshots){const signature=spotSignature(spot);if(seen.has(spot.id)&&seen.get(spot.id)!==signature)return null;seen.set(spot.id,signature)}
  return {title:String(value.title),start,finish,stops:stops as RallyDraft["stops"],revision:value.revision,updatedAt:value.updatedAt};
 }catch{return null}
}
export function draftInput(form:DraftForm,expectedRevision:number):DraftInput{
 const reference=(spot:ManagedSpot|null)=>spot?{id:spot.id,revision:spot.revision}:null;
 return parseDraftInput({expectedRevision,title:form.title,start:reference(form.start),finish:reference(form.finish),stops:form.stops.map(s=>({kind:s.kind,spot:reference(s.spot)}))});
}
export function draftVisits(form:DraftForm){
 return [{key:"start",label:"開始",spot:form.start},...form.stops.map((s,i)=>({key:"stop-"+i,label:(s.kind==="checkpoint"?"チェックポイント":"経由地")+" "+(i+1),spot:s.spot})),{key:"finish",label:"終了",spot:form.finish}];
}
export type DraftIssue={key:string;label:string;spot:ManagedSpot|null;state:"missing"|"changed";current:ManagedSpot|null};
export function draftIssues(form:DraftForm,spots:readonly ManagedSpot[]):DraftIssue[]{
 const byId=new Map(spots.map(s=>[s.id,s]));
 return draftVisits(form).flatMap<DraftIssue>(visit=>{
  if(!visit.spot)return [];
  const current=byId.get(visit.spot.id);
  if(!current)return [{...visit,state:"missing" as const,current:null}];
  if(spotSignature(current)!==spotSignature(visit.spot))return [{...visit,state:"changed" as const,current}];
  return [];
 });
}
export function refreshDraftSpots(form:DraftForm,spots:readonly ManagedSpot[]):DraftForm{
 const byId=new Map(spots.map(s=>[s.id,s])),latest=(s:ManagedSpot|null)=>s?(byId.get(s.id)??s):null;
 return {...form,start:latest(form.start),finish:latest(form.finish),stops:form.stops.map(s=>({...s,spot:latest(s.spot)!}))};
}

export function decodeDraftContext(value:unknown):{draft:RallyDraft|null;spots:ManagedSpot[]}|null{
 if(!object(value)||!Array.isArray(value.spots))return null;
 const draft=value.draft===null?null:decodeRallyDraft(value.draft),spots=value.spots.map(decodeManagedSpot);
 if(value.draft!==null&&!draft||spots.some(s=>!s)||new Set(spots.map(s=>s?.id)).size!==spots.length)return null;
 return {draft,spots:spots as ManagedSpot[]};
}
