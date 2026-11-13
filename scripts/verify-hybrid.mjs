// Optional independent verification against the frozen Python/SciPy implementation.
import fs from "node:fs";import path from "node:path";import {fileURLToPath} from "node:url";import {execFileSync} from "node:child_process";import {createRequire} from "node:module";import assert from "node:assert/strict";
import {featureVector} from "../lib/route/omission/features.ts";
import {linearAssignment} from "../lib/route/omission/assignment.ts";
import {scoreForest,getBundledForest} from "../lib/route/omission/model.ts";
import {preparePair,predictHybridPair} from "../lib/route/omission/inference.ts";
const require=createRequire(import.meta.url),root=path.resolve(fileURLToPath(new URL("..",import.meta.url))),ref=path.join(root,"tools/koma-omission-reference");
const args=process.argv.slice(2);if(args.length&&!(args.length===2&&args[0]==="--python"))throw Error("Usage: node scripts/verify-hybrid.mjs [--python python-path]");
const python=args[1]??"python",rows=JSON.parse(fs.readFileSync(path.join(ref,"data/prepared-original-697.json"),"utf8")).rows;
const {prepare}=require(path.join(ref,"runtime/geometry.cjs")),inputs=rows.map(r=>({pair:r.pair,entryIndex:r.entryIndex??null,targetEntryIndex:r.targetEntryIndex??null}));
const prepared=inputs.map(input=>{try{return prepare(input)}catch(e){return {rule:"keep",entryKnown:false,error:String(e.message)}}});
let seed=42;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
const matrices=[];for(let nr=1;nr<=7;nr++)for(let nc=1;nc<=7;nc++)for(let n=0;n<10;n++)matrices.push(Array.from({length:nr},()=>Array.from({length:nc},()=>Math.floor(random()*7)-3+(n%2?random()*1e-6:0))));
let output;try{output=execFileSync(python,[path.join(root,"scripts/hybrid-reference.py")],{cwd:root,input:JSON.stringify({prepared,matrices}),encoding:"utf8",maxBuffer:64*1024*1024,env:{...process.env,PYTHONDONTWRITEBYTECODE:"1",PYTHONUTF8:"1"}});
}catch(e){throw Error("Python reference failed: "+String(e.stderr??e.message).slice(-8000))}
const expected=JSON.parse(output);assert.equal(expected.rows.length,697);
let maxFeatureError=0,maxScoreError=0;const models=new Map();
const csv=fs.readFileSync(path.join(ref,"experiments/original-697/predictions.csv"),"utf8").replace(/^\uFEFF/,"").trim().split(/\r?\n/),byKey=new Map(csv.slice(1).map(line=>{const [fold,key]=line.split(",");return [key,Number(fold)]}));
function compareFeatures(a,b,label){assert.equal(a.length,350);for(let i=0;i<350;i++){const e=Math.abs(a[i]-b[i]);maxFeatureError=Math.max(maxFeatureError,e);assert.ok(e<=1e-9,label+" feature "+i+" error "+e)}}
function compareScore(a,b,label){const e=Math.abs(a-b);maxScoreError=Math.max(maxScoreError,e);assert.ok(e<=1e-12,label+" score error "+e)}
for(let i=0;i<rows.length;i++){
 const r=rows[i],e=expected.rows[i],vector=featureVector(r);compareFeatures(vector,e.features,"historical row "+i);
 compareScore(scoreForest(getBundledForest(),vector),e.currentScore,"current row "+i);
 const fold=byKey.get(r.key);if(!models.has(fold))models.set(fold,JSON.parse(fs.readFileSync(path.join(ref,"experiments/original-697/fold-"+fold+"/model-D.json"),"utf8")));
 compareScore(scoreForest(models.get(fold),vector),e.legacyScore,"legacy row "+i);
 if(e.operationalFeatures)compareFeatures(featureVector(preparePair(inputs[i]).row),e.operationalFeatures,"operational row "+i);
 const actual=predictHybridPair(inputs[i]);assert.equal(actual.decision,e.operational.decision,"decision row "+i);assert.equal(actual.reason,e.operational.reason,"reason row "+i);
 if(e.operational.keepScore!==undefined)compareScore(actual.keepScore,e.operational.keepScore,"operational row "+i);else assert.equal(actual.keepScore,null);
}
matrices.forEach((m,i)=>assert.deepEqual(linearAssignment(m),expected.assignments[i],"assignment "+i));
console.log(JSON.stringify({rows:rows.length,featuresPerPair:350,assignmentCases:matrices.length,historicalAndOperationalFeatures:true,oldOofAndCurrentModelScores:true,operationalDecisionsIdentical:true,maxFeatureError,maxScoreError,networkRequests:0},null,2));
