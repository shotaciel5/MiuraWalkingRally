// Deterministic selection/projection. Road geometry is analyzed only on the server.
export const OMISSION_VERSION="kyoto-geometry-v4-visual-margin:miura-v1" as const;
export type OmissionMode="rule"|"all";
export type OmissionReason="endpoint"|"stop"|"return"|"held"|"access-review"|"shape-unavailable"|"branch-mismatch"|"turn"|"straight-signal"|"not-continuation"|"continuation";
export type OmissionFrame={sourceSequence:number;id:string;canOmit:boolean;reason:OmissionReason;similarTo:number[]};
export type OmissionPlan={version:1;algorithm:typeof OMISSION_VERSION;frames:OmissionFrame[]};
export type OmissionSnapshot={plan:OmissionPlan;mode:OmissionMode;manualSequences:number[];selected:number[]};
export function manualLandmarkSequences(choices:Record<string,boolean>,count:number){
 return [...new Set(Object.keys(choices).map(k=>Number(k.split("|")[0])).filter(n=>Number.isSafeInteger(n)&&n>=1&&n<=count))].sort((a,b)=>a-b);
}
export function selectOmission(plan:OmissionPlan,mode:OmissionMode,manualSequences:number[]=[]){
 const manual=new Set(manualSequences),frames=plan.frames;
 const keep=frames.map((f,i)=>mode==="all"||i===0||i===frames.length-1||!f.canOmit||manual.has(f.sourceSequence));
 const restored:Record<number,number>={};
 if(mode==="rule"){
  let changed;do{
   changed=false;let previous=0;
   for(let target=1;target<frames.length;target++){
    if(!keep[target])continue;
    if(frames[target].reason==="straight-signal"&&!manual.has(frames[target].sourceSequence)){previous=target;continue}
    for(let i=previous+1;i<target;i++)if(frames[i].similarTo.includes(target+1)){
     keep[i]=true;restored[i+1]=target+1;changed=true;break;
    }
    if(changed)break;previous=target;
   }
  }while(changed);
 }
 return {selected:frames.flatMap((f,i)=>keep[i]?[f.sourceSequence]:[]),restored};
}
const reasons=new Set<OmissionReason>(["endpoint","stop","return","held","access-review","shape-unavailable","branch-mismatch","turn","straight-signal","not-continuation","continuation"]);
const obj=(v:unknown,keys:string[]):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const fail=():never=>{throw Error("Invalid omission snapshot")};
export function parseOmissionSnapshot(v:unknown):OmissionSnapshot{
 if(!obj(v,["plan","mode","manualSequences","selected"])||!["rule","all"].includes(v.mode as string)||!obj(v.plan,["version","algorithm","frames"])||v.plan.version!==1||v.plan.algorithm!==OMISSION_VERSION||!Array.isArray(v.plan.frames)||v.plan.frames.length<2||v.plan.frames.length>2000)return fail();
 const count=v.plan.frames.length;
 const sequences=(a:unknown,min:number):a is number[]=>Array.isArray(a)&&a.length<=count&&a.every((n,i)=>Number.isSafeInteger(n)&&n>=min&&n<=count&&(i===0||n>a[i-1]));
 for(const [i,f]of v.plan.frames.entries()){
  if(!obj(f,["sourceSequence","id","canOmit","reason","similarTo"])||f.sourceSequence!==i+1||typeof f.id!=="string"||!/^koma:-?[1-9][0-9]*:[0-9]+$/.test(f.id)||!reasons.has(f.reason as OmissionReason)||typeof f.canOmit!=="boolean"||f.canOmit!==(f.reason==="continuation")||!sequences(f.similarTo,i+2))return fail();
 }
 if(!sequences(v.manualSequences,1)||!sequences(v.selected,1))return fail();
 const snapshot=v as unknown as OmissionSnapshot;
 if(JSON.stringify(selectOmission(snapshot.plan,snapshot.mode,snapshot.manualSequences).selected)!==JSON.stringify(snapshot.selected))return fail();
 return structuredClone(snapshot);
}
export function freezeOmission(plan:OmissionPlan,mode:OmissionMode,manualSequences:number[]=[]):OmissionSnapshot{
 return parseOmissionSnapshot({plan,mode,manualSequences,selected:selectOmission(plan,mode,manualSequences).selected});
}
type CheckCard={map:{sequence:number;nodeId:number;pathIndex:number;state:string;kind:string;stopIds:string[];issues:string[]};candidate:{issues:string[];turnDegrees:number|null}};
export function validateOmissionRoute(snapshot:OmissionSnapshot,cards:CheckCard[]){
 if(snapshot.plan.frames.length!==cards.length)return fail();
 for(const [i,f]of snapshot.plan.frames.entries()){
  const c=cards[i],m=c.map;
  if(f.id!=="koma:"+m.nodeId+":"+m.pathIndex||f.sourceSequence!==m.sequence)return fail();
  if(f.canOmit&&(i===0||i===cards.length-1||m.stopIds.length||m.state==="held"||m.kind==="return"||m.issues.length||c.candidate.issues.length||c.candidate.turnDegrees===null||Math.abs(c.candidate.turnDegrees)>=60))return fail();
  if(f.reason==="straight-signal"&&(m.stopIds.length||m.kind==="return"||m.state==="held"||c.candidate.turnDegrees===null||Math.abs(c.candidate.turnDegrees)>=25))return fail();
 }
}
