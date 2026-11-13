import test from "node:test";import assert from "node:assert/strict";import fs from "node:fs";import os from "node:os";import path from "node:path";import crypto from "node:crypto";import {createRequire} from "node:module";
import {featureVector} from "../lib/route/omission/features.ts";
import {getBundledForest,scoreForest,validateForest} from "../lib/route/omission/model.ts";
import {preparePair,predictHybridPair} from "../lib/route/omission/inference.ts";
import {HYBRID_VERSION,HYBRID_MODEL} from "../lib/route/omission/hybrid-contract.ts";
import {OMISSION_VERSION,selectOmission,freezeOmission,parseOmissionSnapshot,defaultOmissionMode,hybridFailureCount,parseHybridEvidence} from "../lib/route/omission/selection.ts";
import {createRallyPreview} from "../lib/operator/rally-preview.ts";
import {createDraftRepository} from "../lib/operator/draft-repository.ts";
import {createCourseService,prepareCourseSave} from "../lib/operator/course-save.ts";
import {createCourseRepository,courseFingerprint,checkedCoursePayload} from "../lib/operator/course-repository.ts";
import {parseSaveReceipt,courseReceipt} from "../lib/operator/course-format.ts";
import {createPublicationRepository} from "../lib/operator/publication-repository.ts";
import {projectPublishedCourse} from "../lib/published-course.ts";
import {landmarkDatasetFromPreview} from "../lib/landmarks/dataset.ts";
import {workbenchState} from "../lib/landmarks/workbench.ts";
import {createBundledLandmarkStorage} from "../lib/landmarks/storage.ts";
import {freezeLandmarks} from "../lib/landmarks/course-snapshot.ts";
const require=createRequire(import.meta.url),reference=require("../tools/koma-omission-reference/runtime/geometry.cjs"),sourceSelector=require("../tools/koma-omission-reference/runtime/select-frames.cjs"),engine=require("../lib/route/omission/vendor/routing.cjs");
const golden=require("../tools/koma-omission-reference/tests/golden.json"),rows=require("../tools/koma-omission-reference/data/prepared-original-697.json").rows;
// A fixed pre-existing geometry case, used for behavioral parity, not accuracy measurement.
const guardedInput={pair:rows[97].pair,entryIndex:rows[97].entryIndex,targetEntryIndex:rows[97].targetEntryIndex};
function frames(){
 const p=preparePair(guardedInput),a=p.row.pair.modelInput.candidate,b=p.row.pair.modelInput.target;
 return [a,a,b].map((f,i)=>({...structuredClone(f),id:"koma:"+(i+1)+":"+i,at:i*50,canOmit:i===1,label:"直進",incomingBranchIndex:i<2?p.row.entryIndex:p.row.targetEntryIndex}));
}
function planFor(list,provider=predictHybridPair){
 const frames=list.map((f,i)=>({sourceSequence:i+1,id:f.id,canOmit:i>0&&i<list.length-1&&f.canOmit&&!f.checkpoints?.length,reason:i===0||i===list.length-1?"endpoint":f.checkpoints?.length?"stop":f.retainedForStraightSignal?"straight-signal":f.canOmit?"continuation":"not-continuation",similarTo:[],hybridPairs:[]}));
 frames.forEach((f,i)=>{f.canOmit=f.reason==="continuation";if(f.canOmit)for(let j=i+1;j<list.length;j++)if(engine.similarJunctions(list[i],list[j]))f.similarTo.push(j+1);else f.hybridPairs.push({...provider({candidate:list[i],target:list[j],entryIndex:list[i].incomingBranchIndex,targetEntryIndex:list[j].incomingBranchIndex}),targetSequence:j+1})});
 return {version:2,algorithm:HYBRID_VERSION,model:{...HYBRID_MODEL},frames};
}
function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"miura-hybrid-"));t.after(()=>{assert.equal(path.dirname(dir),os.tmpdir());assert.ok(path.basename(dir).startsWith("miura-hybrid-"));fs.rmSync(dir,{recursive:true,force:true})});
 const db=path.join(dir,"db.sqlite"),drafts=createDraftRepository(db),storage=createBundledLandmarkStorage(path.join(dir,"reviews")),repo=createCourseRepository(db),service=createCourseService(db,{landmarks:true,omission:true,landmarkStorage:storage});
 drafts.save({title:"AI補助コース",expectedRevision:0,start:{id:"osm-way-384676338",revision:0},finish:{id:"osm-way-384676338",revision:0},stops:[{kind:"checkpoint",spot:{id:"osm-way-394752558",revision:0}},{kind:"waypoint",spot:{id:"osm-node-2046962408",revision:0}}]});
 const current=drafts.load(),preview=createRallyPreview(current.draft,current.spots,current.corrections,{omission:true});assert.equal(preview.state,"ready");
 const state=workbenchState(landmarkDatasetFromPreview(preview),storage),snapshot=freezeLandmarks(state),prepared=mode=>prepareCourseSave(current,preview,snapshot,mode?{mode,manualSequences:[]}:{manualSequences:[]});
 return {db,service,repo,preview,state,prepared};
}
test("all golden 350-feature vectors and current forest scores match the frozen oracle",()=>{
 for(const [i,e]of golden.entries()){
  const p=preparePair(e.input),original=reference.prepare(e.input),features=featureVector(p.row);assert.equal(p.rule,e.baseline);assert.equal(p.entryKnown,original.entryKnown);
  assert.equal(features.length,350);for(let j=0;j<350;j++)assert.ok(Math.abs(features[j]-e.features[j])<=1e-9,"case "+i+" feature "+j);
  assert.ok(Math.abs(scoreForest(getBundledForest(),features)-e.keepScore)<=1e-12);
 }
});
test("the deployed model bytes match the approved corrected candidate",()=>{
 const digest=p=>crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
 assert.equal(digest("lib/route/omission/model/corrected-697.json"),HYBRID_MODEL.sha256);
 assert.equal(digest("tools/koma-omission-reference/models/corrected-candidate/model.json"),HYBRID_MODEL.sha256);
 assert.equal(getBundledForest().trees.length,200);assert.ok(Object.isFrozen(getBundledForest().trees[0].left));
});
test("feature generation ignores labels, IDs, evaluator and rule outputs",()=>{
 const p=preparePair(golden[0].input),row=structuredClone(p.row),before=featureVector(row);
 Object.assign(row,{label:"keep",rule:"omit",region:"other",evaluator:"other",key:"different"});row.pair.modelInput.candidate.id="changed";row.pair.modelInput.target.name="changed";
 assert.deepEqual(featureVector(row),before);
});
test("forest comparisons round every feature to float32 before the double threshold",()=>{
 const tree={left:[1,-1,-1],right:[2,-1,-1],feature:[0,-2,-2],threshold:[.5,-2,-2],keepProbability:[.5,0,1]},model={format:"kyoto-junction-ablation-forest",version:1,featureVersion:HYBRID_MODEL.featureVersion,featureCount:350,inputPrecision:"float32",keepThreshold:.5,trees:Array.from({length:200},()=>structuredClone(tree))},v=Array(350).fill(0);
 v[0]=.5+1e-9;assert.equal(scoreForest(model,v),0);v[0]=.5+1e-5;assert.equal(scoreForest(model,v),1);
});
test("malformed models, bad tree links and nonfinite vectors cannot yield an omit",()=>{
 const base=JSON.parse(fs.readFileSync("lib/route/omission/model/corrected-697.json","utf8"));
 for(const change of [m=>m.featureVersion="other",m=>m.inputPrecision="float64",m=>m.trees[0].left[0]=0,m=>m.trees[0].right[0]=99999,m=>m.trees[0].keepProbability[0]=NaN]){
  const m=structuredClone(base);change(m);assert.throws(()=>validateForest(m));assert.equal(predictHybridPair(guardedInput,()=>m).reason,"inference-unavailable");
 }
 const invalid=Array(350).fill(0);invalid[0]=Infinity;assert.throws(()=>scoreForest(getBundledForest(),invalid));assert.equal(predictHybridPair(guardedInput,()=>{throw Error("unavailable")}).decision,"keep");
});
test("actual RandomForest adds retention to a rule-omitted pair with the documented .2 guard",async()=>{
 const list=frames(),plan=planFor(list),prediction=predictHybridPair(guardedInput);
 assert.equal(prediction.reason,"ai-geometry-guard");assert.ok(prediction.keepScore>=.2);assert.equal(getBundledForest().keepThreshold,.5);
 assert.deepEqual(selectOmission(plan,"rule").selected,[1,3]);assert.deepEqual(selectOmission(plan,"hybrid").selected,[1,2,3]);
 const expected=await sourceSelector.selectFrames(list,{mode:"hybrid-experimental",scorePair:async p=>predictHybridPair(p)});
 assert.deepEqual(expected.map(f=>f.id),selectOmission(plan,"hybrid").selected.map(s=>list[s-1].id));
});
test("straight signals delimit AI comparisons, while edits and checkpoints keep normal protection",()=>{
 const list=frames();list.push({...structuredClone(list[2]),id:"koma:4:3",at:150});list[2].retainedForStraightSignal=true;
 assert.deepEqual(selectOmission(planFor(list),"hybrid").selected,[1,3,4]);
 assert.deepEqual(selectOmission(planFor(list),"hybrid",[3]).selected,[1,2,3,4]);
 list[2].checkpoints=[{id:"cp"}];assert.deepEqual(selectOmission(planFor(list),"hybrid").selected,[1,2,3,4]);
});
test("missing geometry/approach and inference exceptions retain the pair",()=>{
 assert.equal(predictHybridPair({candidate:{},target:{}}).reason,"invalid-geometry");
 const p=preparePair(guardedInput),unknown={candidate:structuredClone(p.row.pair.modelInput.candidate),target:structuredClone(p.row.pair.modelInput.target)};delete unknown.candidate.routeIn;delete unknown.target.routeIn;
 assert.equal(predictHybridPair(unknown).reason,"incoming-branch-unknown");
 const plan=planFor(frames(),p=>predictHybridPair(p,()=>{throw Error("no model")}));assert.deepEqual(selectOmission(plan,"hybrid").selected,[1,2,3]);assert.ok(hybridFailureCount(plan)>0);
});
test("hybrid snapshots require pinned provenance, complete verdicts and valid guard outcomes",()=>{
 const original=freezeOmission(planFor(frames()));assert.equal(original.mode,"hybrid");
 for(const change of [s=>s.plan.model.sha256="0".repeat(64),s=>s.plan.model.keepThreshold=.5,s=>s.plan.frames[1].hybridPairs=[],s=>s.plan.frames[1].hybridPairs[0].keepScore=.1,s=>s.plan.frames[1].hybridPairs[0].counts=[3,4],s=>s.plan.frames[1].hybridPairs[0].decision="omit"]){const s=structuredClone(original);change(s);assert.throws(()=>parseOmissionSnapshot(s))}
 assert.throws(()=>parseHybridEvidence({targetSequence:3,decision:"omit",reason:"inference-unavailable",keepScore:null,maxAngleDegrees:null,counts:null}));
});
test("new saved courses default to hybrid and pin the trained model without changing roads or CPs",t=>{
 const f=fixture(t),p=f.prepared(),saved=f.service.save(p.receipt);assert.equal(saved.payload.omission.mode,"hybrid");assert.equal(saved.payload.omission.plan.version,2);assert.deepEqual(saved.payload.omission.plan.model,HYBRID_MODEL);
 assert.ok(saved.payload.omission.plan.frames.flatMap(f=>f.hybridPairs).some(p=>p.keepScore!==null));assert.equal(hybridFailureCount(saved.payload.omission.plan),0);
 const pubs=createPublicationRepository(f.db);pubs.publish({courseId:saved.id,fingerprint:saved.fingerprint,expectedRevision:0});const pub=pubs.get(saved.id),course=projectPublishedCourse(saved,pub.publication);
 assert.equal(course.cards.length,saved.payload.omission.selected.length);assert.equal(course.rally.distanceMeters,f.preview.meters);for(const s of course.stops)assert.ok(course.cards[s.komaIndex].stopIds.includes(s.id));
});
test("all, rule and hybrid editions are distinct and retries preserve the frozen edition",t=>{
 const f=fixture(t),values=["hybrid","rule","all"].map(mode=>f.repo.store(f.prepared(mode).payload,()=>{}));assert.equal(new Set(values.map(v=>v.id)).size,3);assert.equal(f.repo.list().length,3);
 for(const v of values)assert.deepEqual(f.service.save(courseReceipt(v.payload,v.fingerprint)),v);
 assert.throws(()=>f.service.save({...f.prepared("hybrid").receipt,omissionMode:"rule"}),e=>e.reason==="invalid");
});
test("legacy v1 plans and saved v3 courses remain readable and are never rescored",t=>{
 const f=fixture(t),payload=structuredClone(f.prepared("rule").payload),frames=payload.omission.plan.frames.map(({hybridPairs,...rest})=>rest),legacy={version:1,algorithm:OMISSION_VERSION,frames};payload.omission=freezeOmission(legacy,"rule");
 const checked=checkedCoursePayload(payload),saved=f.repo.store(checked,()=>{}),before=JSON.stringify(saved);assert.equal(defaultOmissionMode(legacy),"rule");assert.throws(()=>selectOmission(legacy,"hybrid"));
 const service=createCourseService(f.db,{omission:true,landmarks:true,generate:()=>{throw Error("must not regenerate")},loadInitial:()=>{throw Error("must not load catalog")}});
 assert.equal(JSON.stringify(service.save(courseReceipt(saved.payload,saved.fingerprint))),before);assert.equal(courseFingerprint(f.repo.get(saved.id).payload),saved.fingerprint);
 assert.equal(parseSaveReceipt(courseReceipt(saved.payload,saved.fingerprint)).omissionMode,"rule");
});
