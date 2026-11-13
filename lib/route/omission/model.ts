import {createHash} from "node:crypto";
import bundled from "./model/corrected-697.json" with {type:"json"};
import {HYBRID_MODEL} from "./hybrid-contract.ts";
type Tree={left:readonly number[];right:readonly number[];feature:readonly number[];threshold:readonly number[];keepProbability:readonly number[]};
export type Forest={format:string;version:number;featureVersion:string;featureCount:number;inputPrecision:string;keepThreshold:number;trees:readonly Tree[]};
const valid=new WeakSet<object>();
export function validateForest(value:unknown):Forest{
 if(!value||typeof value!=="object")throw Error("Missing forest");
 if(valid.has(value))return value as Forest;
 const m=value as Forest;
 if(m.format!=="kyoto-junction-ablation-forest"||m.version!==1||m.featureVersion!==HYBRID_MODEL.featureVersion||m.featureCount!==350||m.inputPrecision!=="float32"||!Number.isFinite(m.keepThreshold)||m.keepThreshold<0||m.keepThreshold>1||!Array.isArray(m.trees)||m.trees.length!==200)throw Error("Unsupported forest contract");
 for(const t of m.trees){
  if(!t||!Array.isArray(t.left)||t.left.length<1||t.left.length>10000||![t.right,t.feature,t.threshold,t.keepProbability].every(a=>Array.isArray(a)&&a.length===t.left.length))throw Error("Invalid tree");
  const reachable=new Set<number>(),visit=[0];
  while(visit.length){
   const i=visit.pop()!;if(reachable.has(i))throw Error("Invalid tree links");reachable.add(i);
   if(!Number.isFinite(t.threshold[i])||!Number.isFinite(t.keepProbability[i])||t.keepProbability[i]<0||t.keepProbability[i]>1)throw Error("Invalid tree values");
   if(t.left[i]===-1){if(t.right[i]!==-1)throw Error("Invalid leaf")}
   else{if(![t.left[i],t.right[i]].every(n=>Number.isSafeInteger(n)&&n>i&&n<t.left.length)||!Number.isSafeInteger(t.feature[i])||t.feature[i]<0||t.feature[i]>=350)throw Error("Invalid split");visit.push(t.left[i],t.right[i])}
  }
  if(reachable.size!==t.left.length)throw Error("Unreachable tree nodes");
  for(const a of [t.left,t.right,t.feature,t.threshold,t.keepProbability])Object.freeze(a);Object.freeze(t);
 }
 Object.freeze(m.trees);Object.freeze(m);valid.add(m);return m;
}
export function scoreForest(value:unknown,features:readonly number[]):number{
 const model=validateForest(value);
 if(features.length!==350||features.some(x=>!Number.isFinite(x)))throw Error("Expected 350 finite features");
 const rounded=features.map(Math.fround);if(rounded.some(x=>!Number.isFinite(x)))throw Error("Invalid float32 features");
 const scores=model.trees.map(t=>{let i=0;while(t.left[i]!==-1)i=rounded[t.feature[i]]<=t.threshold[i]?t.left[i]:t.right[i];return t.keepProbability[i]});
 return scores.reduce((a,b)=>a+b,0)/scores.length;
}
const canonical=(v:unknown):unknown=>Array.isArray(v)?v.map(canonical):v&&typeof v==="object"?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,x])=>[k,canonical(x)])):v;
let loaded:Forest|undefined;
export function getBundledForest():Forest{
 if(loaded)return loaded;
 if(createHash("sha256").update(JSON.stringify(canonical(bundled))).digest("hex")!=="47c788f645b8afe88d68b7d7614b3d856bb4cfb1ab9a70921b8ce639f4dcb1d1")throw Error("Bundled model identity mismatch");
 loaded=validateForest(bundled);return loaded;
}
