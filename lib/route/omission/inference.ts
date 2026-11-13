import engine from "./vendor/routing.cjs";
import {featureVector,type FeatureFrame,type FeatureRow} from "./features.ts";
import {getBundledForest,scoreForest,type Forest} from "./model.ts";
import {HYBRID_MODEL,type HybridPrediction} from "./hybrid-contract.ts";
export type PairInput=({candidate:FeatureFrame;target:FeatureFrame}|{pair:{modelInput:{candidate:FeatureFrame;target:FeatureFrame}}})&{entryIndex?:number|null;targetEntryIndex?:number|null};
const engineFrame=(f:FeatureFrame)=>({center:f.center,heading:f.heading,branches:f.branches,id:"shape",at:0,canOmit:false,label:""});
function validateFrame(f:FeatureFrame){
 const point=(p:{lat:number;lon:number})=>p&&Number.isFinite(p.lat)&&Math.abs(p.lat)<=90&&Number.isFinite(p.lon)&&Math.abs(p.lon)<=180;
 if(!f||!Number.isFinite(f.heading)||!point(f.center)||!Array.isArray(f.branches)||f.branches.length<3||!f.branches.every(b=>Array.isArray(b)&&b.length>=2&&b.every(point)&&engine.distance(f.center,b[0])<=.01)||!engine.junctionSignature(engineFrame(f)))throw Error("Invalid geometry");
}
function maximumAngle(a:number[][],b:number[][]){
 if(a.length>b.length)[a,b]=[b,a];
 const degrees=(x:number)=>Math.abs(engine.angle(x))*180/Math.PI,cost=a.map(u=>b.map(v=>Math.max(...[0,1].map(k=>degrees(u[k]-v[k]))))),limits=[...new Set(cost.flat())].sort((x,y)=>x-y);
 function possible(limit:number){
  const matches=Array(b.length).fill(-1);
  function assign(i:number,seen:Set<number>):boolean{for(let j=0;j<b.length;j++)if(!seen.has(j)&&cost[i][j]<=limit+1e-9){seen.add(j);if(matches[j]<0||assign(matches[j],seen)){matches[j]=i;return true}}return false}
  return a.every((_,i)=>assign(i,new Set()));
 }
 return limits.find(possible)??180;
}
export function preparePair(input:PairInput){
 const shapes="pair" in input?input.pair.modelInput:input;
 const frames=[shapes.candidate,shapes.target];frames.forEach(validateFrame);
 const entries=frames.map((f,i)=>{const e=i===0?input.entryIndex:input.targetEntryIndex;return e==null?engine.incomingBranchIndex(f):e});
 entries.forEach((e,i)=>{if(e!==null&&(!Number.isSafeInteger(e)||e<0||e>=frames[i].branches.length))throw Error("Invalid incoming branch")});
 const signatures=frames.map(f=>engine.junctionSignature(engineFrame(f))!);
 const row:FeatureRow={pair:{modelInput:{candidate:frames[0],target:frames[1]}},signatures,entryIndex:entries[0],targetEntryIndex:entries[1]};
 return {row,rule:engine.similarJunctions(...frames.map(engineFrame) as [ReturnType<typeof engineFrame>,ReturnType<typeof engineFrame>])?"keep" as const:"omit" as const,entryKnown:entries.every(e=>e!==null),counts:frames.map(f=>f.branches.length) as [number,number],angle:maximumAngle(signatures[0],signatures[1])};
}
export function predictHybridPair(input:PairInput,modelProvider:()=>Forest=getBundledForest):HybridPrediction{
 let prepared:ReturnType<typeof preparePair>|undefined;
 try{
  prepared=preparePair(input);
  const base={keepScore:null,maxAngleDegrees:prepared.angle,counts:prepared.counts};
  if(prepared.rule==="keep")return {...base,decision:"keep",reason:"current-rule-keep"};
  if(!prepared.entryKnown)return {...base,decision:"keep",reason:"incoming-branch-unknown"};
  const keepScore=scoreForest(modelProvider(),featureVector(prepared.row)),keep=prepared.counts[0]===prepared.counts[1]&&prepared.angle<=HYBRID_MODEL.maxAngleDegrees&&keepScore>=HYBRID_MODEL.keepThreshold;
  return {...base,keepScore,decision:keep?"keep":"omit",reason:keep?"ai-geometry-guard":"omit-candidate"};
 }catch{return {decision:"keep",reason:prepared?"inference-unavailable":"invalid-geometry",keepScore:null,maxAngleDegrees:prepared?.angle??null,counts:prepared?.counts??null}}
}
