// Frozen plan v1 remains readable. New v2 plans add pinned-model pair verdicts.
import {HYBRID_VERSION,HYBRID_MODEL,type HybridEvidence} from "./hybrid-contract.ts";
export const OMISSION_VERSION="kyoto-geometry-v4-visual-margin:miura-v1" as const;
export type OmissionMode="hybrid"|"rule"|"all";
export type OmissionReason="endpoint"|"stop"|"return"|"held"|"access-review"|"shape-unavailable"|"branch-mismatch"|"turn"|"straight-signal"|"not-continuation"|"continuation";
export type OmissionFrame={sourceSequence:number;id:string;canOmit:boolean;reason:OmissionReason;similarTo:number[]};
export type RulePlan={version:1;algorithm:typeof OMISSION_VERSION;frames:OmissionFrame[]};
export type HybridFrame=OmissionFrame&{hybridPairs:HybridEvidence[]};
export type HybridPlan={version:2;algorithm:typeof HYBRID_VERSION;model:typeof HYBRID_MODEL;frames:HybridFrame[]};
export type OmissionPlan=RulePlan|HybridPlan;
export type OmissionSnapshot={plan:OmissionPlan;mode:OmissionMode;manualSequences:number[];selected:number[]};
export const defaultOmissionMode=(plan:OmissionPlan|undefined):OmissionMode=>plan?.version===2?"hybrid":"rule";
export function manualLandmarkSequences(choices:Record<string,boolean>,count:number){
 return [...new Set(Object.keys(choices).map(k=>Number(k.split("|")[0])).filter(n=>Number.isSafeInteger(n)&&n>=1&&n<=count))].sort((a,b)=>a-b);
}
export function selectOmission(plan:OmissionPlan,mode:OmissionMode,manualSequences:number[]=[]){
 if(!["hybrid","rule","all"].includes(mode)||mode==="hybrid"&&plan.version!==2)throw Error("Unsupported omission mode for this saved plan");
 const manual=new Set(manualSequences),frames=plan.frames;
 const keep=frames.map((f,i)=>mode==="all"||i===0||i===frames.length-1||!f.canOmit||manual.has(f.sourceSequence));
 const relations=frames.map((f,i)=>new Set([...f.similarTo,...(mode==="hybrid"&&plan.version===2?plan.frames[i].hybridPairs.filter(p=>p.decision==="keep").map(p=>p.targetSequence):[])]));
 const restored:Record<number,number>={};
 if(mode!=="all"){
  let changed;do{
   changed=false;let previous=0;
   for(let target=1;target<frames.length;target++){
    if(!keep[target])continue;
    if(frames[target].reason==="straight-signal"&&!manual.has(frames[target].sourceSequence)){previous=target;continue}
    for(let i=previous+1;i<target;i++)if(relations[i].has(target+1)){
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
const numeric=(v:unknown,min:number,max:number)=>typeof v==="number"&&Number.isFinite(v)&&v>=min&&v<=max;
export function parseHybridEvidence(v:unknown):HybridEvidence{
 if(!obj(v,["targetSequence","decision","reason","keepScore","maxAngleDegrees","counts"])||!["keep","omit"].includes(v.decision as string)||!["current-rule-keep","ai-geometry-guard","omit-candidate","invalid-geometry","incoming-branch-unknown","inference-unavailable"].includes(v.reason as string)||v.keepScore!==null&&!numeric(v.keepScore,0,1)||v.maxAngleDegrees!==null&&!numeric(v.maxAngleDegrees,0,180+1e-9)||v.counts!==null&&(!Array.isArray(v.counts)||v.counts.length!==2||!v.counts.every(n=>Number.isSafeInteger(n)&&n>=3)))return fail();
 const p=v as unknown as HybridEvidence;
 if(p.reason==="ai-geometry-guard"||p.reason==="omit-candidate"){
  if(p.keepScore===null||p.maxAngleDegrees===null||!p.counts)return fail();
  const keep=p.counts[0]===p.counts[1]&&p.maxAngleDegrees<=HYBRID_MODEL.maxAngleDegrees&&p.keepScore>=HYBRID_MODEL.keepThreshold;
  if(p.reason==="ai-geometry-guard"?!keep||p.decision!=="keep":keep||p.decision!=="omit")return fail();
 }else if(p.decision!=="keep"||p.keepScore!==null)return fail();
 return p;
}
export function parseOmissionSnapshot(v:unknown):OmissionSnapshot{
 if(!obj(v,["plan","mode","manualSequences","selected"])||!["hybrid","rule","all"].includes(v.mode as string)||!v.plan||typeof v.plan!=="object")return fail();
 const p=v.plan as Record<string,unknown>,hybrid=p.version===2;
 if(!obj(p,hybrid?["version","algorithm","model","frames"]:["version","algorithm","frames"])||!hybrid&&p.version!==1||p.algorithm!==(hybrid?HYBRID_VERSION:OMISSION_VERSION)||!Array.isArray(p.frames)||p.frames.length<2||p.frames.length>2000||v.mode==="hybrid"&&!hybrid)return fail();
 if(hybrid&&(!obj(p.model,Object.keys(HYBRID_MODEL))||Object.entries(HYBRID_MODEL).some(([k,x])=>(p.model as Record<string,unknown>)[k]!==x)))return fail();
 const count=p.frames.length;
 const sequences=(a:unknown,min:number):a is number[]=>Array.isArray(a)&&a.length<=count&&a.every((n,i)=>Number.isSafeInteger(n)&&n>=min&&n<=count&&(i===0||n>a[i-1]));
 for(const [i,f]of p.frames.entries()){
  if(!obj(f,hybrid?["sourceSequence","id","canOmit","reason","similarTo","hybridPairs"]:["sourceSequence","id","canOmit","reason","similarTo"])||f.sourceSequence!==i+1||typeof f.id!=="string"||!/^koma:-?[1-9][0-9]*:[0-9]+$/.test(f.id)||!reasons.has(f.reason as OmissionReason)||typeof f.canOmit!=="boolean"||f.canOmit!==(f.reason==="continuation")||!sequences(f.similarTo,i+2))return fail();
  if(hybrid){
   if(!Array.isArray(f.hybridPairs)||f.hybridPairs.length>count)return fail();
   const pairs=f.hybridPairs.map(parseHybridEvidence),expected=f.canOmit?Array.from({length:count-i-1},(_,j)=>i+j+2).filter(n=>!(f.similarTo as number[]).includes(n)):[];
   if(JSON.stringify(pairs.map(e=>e.targetSequence))!==JSON.stringify(expected))return fail();
  }
 }
 if(!sequences(v.manualSequences,1)||!sequences(v.selected,1))return fail();
 const snapshot=v as unknown as OmissionSnapshot;
 if(JSON.stringify(selectOmission(snapshot.plan,snapshot.mode,snapshot.manualSequences).selected)!==JSON.stringify(snapshot.selected))return fail();
 return structuredClone(snapshot);
}
export function freezeOmission(plan:OmissionPlan,mode:OmissionMode=defaultOmissionMode(plan),manualSequences:number[]=[]):OmissionSnapshot{
 return parseOmissionSnapshot({plan,mode,manualSequences,selected:selectOmission(plan,mode,manualSequences).selected});
}
type CheckCard={map:{sequence:number;nodeId:number;pathIndex:number;state:string;kind:string;stopIds:string[];issues:string[]};candidate:{issues:string[];turnDegrees:number|null;branches:readonly unknown[]}};
export function validateOmissionRoute(snapshot:OmissionSnapshot,cards:CheckCard[]){
 if(snapshot.plan.frames.length!==cards.length)return fail();
 for(const [i,f]of snapshot.plan.frames.entries()){
  const c=cards[i],m=c.map;
  if(f.id!=="koma:"+m.nodeId+":"+m.pathIndex||f.sourceSequence!==m.sequence)return fail();
  if(f.canOmit&&(i===0||i===cards.length-1||m.stopIds.length||m.state==="held"||m.kind==="return"||m.issues.length||c.candidate.issues.length||c.candidate.turnDegrees===null||Math.abs(c.candidate.turnDegrees)>=60))return fail();
  if(f.reason==="straight-signal"&&(m.stopIds.length||m.kind==="return"||m.state==="held"||c.candidate.turnDegrees===null||Math.abs(c.candidate.turnDegrees)>=25))return fail();
  if(snapshot.plan.version===2)for(const pair of snapshot.plan.frames[i].hybridPairs)if(pair.counts&&(pair.counts[0]!==c.candidate.branches.length||pair.counts[1]!==cards[pair.targetSequence-1].candidate.branches.length))return fail();
 }
}
export function hybridFailureCount(plan:OmissionPlan){
 return plan.version===2?plan.frames.reduce((n,f)=>n+f.hybridPairs.filter(p=>["invalid-geometry","incoming-branch-unknown","inference-unavailable"].includes(p.reason)).length,0):0;
}
