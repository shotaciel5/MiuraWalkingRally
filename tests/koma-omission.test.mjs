import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";import os from "node:os";import path from "node:path";import crypto from "node:crypto";
import engine from "../lib/route/omission/vendor/routing.cjs";
import {OMISSION_VERSION,selectOmission,freezeOmission,parseOmissionSnapshot,validateOmissionRoute,manualLandmarkSequences} from "../lib/route/omission/selection.ts";
import {projectOmittedPreview,projectOmittedLandmarks} from "../lib/route/omission/projection.ts";
import {demoCourses} from "../lib/demo/seed.ts";
import {createRallyPreview} from "../lib/operator/rally-preview.ts";
import {createDraftRepository} from "../lib/operator/draft-repository.ts";
import {createCourseService,prepareCourseSave} from "../lib/operator/course-save.ts";
import {createCourseRepository} from "../lib/operator/course-repository.ts";
import {parseCoursePayload,parseSaveReceipt,canonicalJson} from "../lib/operator/course-format.ts";
import {createPublicationRepository} from "../lib/operator/publication-repository.ts";
import {projectPublishedCourse,publishedSummary} from "../lib/published-course.ts";
import {createBundledLandmarkStorage} from "../lib/landmarks/storage.ts";
import {landmarkDatasetFromPreview} from "../lib/landmarks/dataset.ts";
import {workbenchState} from "../lib/landmarks/workbench.ts";
import {freezeLandmarks} from "../lib/landmarks/course-snapshot.ts";
import {candidatesForCard,choiceKey} from "../lib/landmarks/model.ts";
function shape(id,angles=[180,0,90]){
 const center={lat:35,lon:139};return {id:"koma:"+id+":"+id,at:id*50,heading:0,center,canOmit:true,label:"直進",branches:angles.map(a=>[center,{lat:35+Math.cos(a*Math.PI/180)*28/111320,lon:139+Math.sin(a*Math.PI/180)*28/111320/Math.cos(35*Math.PI/180)}])};
}
function plan(frames){return {version:1,algorithm:OMISSION_VERSION,frames:frames.map((f,i)=>({id:f.id,sourceSequence:i+1,canOmit:!!f.canOmit&&i>0&&i<frames.length-1,reason:i===0||i===frames.length-1?"endpoint":f.checkpoints?.length?"stop":f.retainedForStraightSignal?"straight-signal":f.canOmit?"continuation":"not-continuation",similarTo:frames.flatMap((t,j)=>j>i&&engine.similarJunctions(f,t)?[j+1]:[])})).map(f=>({...f,canOmit:f.reason==="continuation"}))}}
function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"miura-omission-"));t.after(()=>{assert.equal(path.dirname(dir),os.tmpdir());assert.ok(path.basename(dir).startsWith("miura-omission-"));fs.rmSync(dir,{recursive:true,force:true})});
 const db=path.join(dir,"db.sqlite"),drafts=createDraftRepository(db),storage=createBundledLandmarkStorage(path.join(dir,"reviews")),repo=createCourseRepository(db),service=createCourseService(db,{landmarks:true,omission:true,landmarkStorage:storage});
 drafts.save({title:"省略付きコース",expectedRevision:0,start:{id:"osm-way-384676338",revision:0},finish:{id:"osm-way-384676338",revision:0},stops:[{kind:"checkpoint",spot:{id:"osm-way-394752558",revision:0}},{kind:"waypoint",spot:{id:"osm-node-2046962408",revision:0}}]});
 const current=()=>drafts.load(),preview=()=>{const c=current();return createRallyPreview(c.draft,c.spots,c.corrections,{omission:true})},state=()=>workbenchState(landmarkDatasetFromPreview(preview()),storage);
 const prepare=(mode="rule")=>{const c=current(),p=preview(),s=state();return prepareCourseSave(c,p,freezeLandmarks(s),{mode,manualSequences:manualLandmarkSequences(s.review.choices,p.cards.length)})};
 return {dir,db,drafts,storage,repo,service,current,preview,state,prepare};
}
test("vendored rule is byte-identical to the verified handoff source",()=>{
 const hash=p=>crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
 assert.equal(hash("lib/route/omission/vendor/routing.cjs"),hash("tools/koma-omission-reference/source/site/routing.js"));
});
test("iterative selection, straight signal boundaries and edits match the source selector",()=>{
 for(const angles of [[180,0,90],[180,0,-90],[180,0,60],[180,0,90,270]]){
  for(const signal of [false,true]){
   const f=[shape(1),shape(2,angles),shape(3),shape(4,[180,0,-90]),shape(5)];
   f[2].canOmit=false;f[2].retainedForStraightSignal=signal;
   const p=plan(f);
   for(const edited of [[],[3],[2,3]])for(const mode of ["rule","all"]){
    const edits=Object.fromEntries(edited.map(s=>[f[s-1].id,{manual:true}]));
    const expected=engine.selectFrames(f,mode==="rule"?"reduced":"all",edits).map(x=>f.findIndex(y=>y.id===x.id)+1);
    assert.deepEqual(selectOmission(p,mode,edited).selected,expected);
   }
  }
 }
});
test("missing classification is retained, and manual false choices still protect their source frame",()=>{
 const f=[shape(1),shape(2),shape(3)];delete f[1].canOmit;assert.deepEqual(selectOmission(plan(f),"rule").selected,[1,2,3]);
 assert.deepEqual(manualLandmarkSequences({"4|x":false,"2|y":true,"4|z":true,"bad":false,"0|x":true},5),[2,4]);
});
test("real courses preserve mandatory frames, left/right geometry and total distance after projection",()=>{
 for(const saved of demoCourses()){
  const d=saved.payload.input.draft,p=createRallyPreview(d,[d.start,...d.stops.map(s=>s.spot),d.finish],saved.payload.input.corrections,{omission:true}),before=canonicalJson(p);
  assert.equal(p.state,"ready");const selected=selectOmission(p.omissionPlan,"rule").selected,v=projectOmittedPreview(p,selected);
  assert.ok(v.cards.length<p.cards.length);assert.equal(v.meters,p.meters);assert.equal(v.cards.reduce((n,c)=>n+(c.map.metersToNext??0),0),p.meters);
  for(const [i,c]of v.cards.entries()){assert.equal(c.map.sequence,i+1);assert.deepEqual(c.map.branches,p.cards[selected[i]-1].map.branches);assert.deepEqual(c.map.shortGeometry,p.cards[selected[i]-1].map.shortGeometry)}
  for(const c of p.cards)if(c.map.state==="held"||c.map.stopIds.length||c.map.kind==="return"||c.candidate.issues.length)assert.ok(selected.includes(c.map.sequence));
  for(const v2 of v.visits)assert.ok(v.cards[v2.komaIndex].map.stopIds.includes(v2.id));
  assert.deepEqual(projectOmittedPreview(p,p.cards.map(c=>c.map.sequence)),p);assert.equal(canonicalJson(p),before);
 }
});
test("each occurrence has an independent stable id even when a junction is revisited",t=>{
 const f=fixture(t),p=f.preview();assert.equal(new Set(p.omissionPlan.frames.map(x=>x.id)).size,p.cards.length);assert.ok(new Set(p.cards.map(c=>c.map.nodeId)).size<p.cards.length);
});
test("v3 stores both source geometry and frozen selection and publishes renumbered checkpoints",t=>{
 const f=fixture(t),p=f.prepare(),saved=f.service.save(p.receipt);
 assert.equal(saved.payload.formatVersion,3);assert.equal(p.receipt.omissionMode,"rule");assert.deepEqual(parseCoursePayload(saved.payload),saved.payload);
 const pubs=createPublicationRepository(f.db);pubs.publish({courseId:saved.id,fingerprint:saved.fingerprint,expectedRevision:0});const pub=pubs.get(saved.id),course=projectPublishedCourse(saved,pub.publication);
 assert.equal(course.cards.length,saved.payload.omission.selected.length);assert.equal(course.rally.cardCount,course.cards.length);assert.equal(f.repo.list()[0].cards,course.cards.length);
 assert.ok(course.cards.length<saved.payload.preview.cards.length);for(const s of course.stops)assert.ok(course.cards[s.komaIndex].stopIds.includes(s.id));
 assert.deepEqual(course.landmarks,projectOmittedLandmarks(saved.payload.landmarks,saved.payload.omission.selected));
});
test("all mode saves a distinct immutable edition and retries do not create duplicates",t=>{
 const f=fixture(t),rulePrepared=f.prepare(),allPrepared=f.prepare("all"),rule=f.service.save(rulePrepared.receipt);assert.throws(()=>f.service.save(allPrepared.receipt),e=>e.reason==="conflict");const all=f.repo.store(allPrepared.payload,()=>{});
 assert.notEqual(rule.id,all.id);assert.equal(all.payload.omission.selected.length,all.payload.preview.cards.length);assert.equal(f.service.save(rulePrepared.receipt).id,rule.id);assert.equal(f.repo.list().length,2);
});
test("source sequence keys protect an edited omitted frame and stale displayed receipts conflict",t=>{
 const f=fixture(t),p=f.preview(),s=f.state(),selected=selectOmission(p.omissionPlan,"rule").selected;
 let chosen;for(const card of s.dataset.cards){if(selected.includes(card.map.sequence))continue;const t=s.dataset.targets.find(t=>t.sequences.includes(card.map.sequence)),items=candidatesForCard(card,t?s.targets[t.key]:undefined);if(items.length){chosen={sequence:card.map.sequence,c:items[0]};break}}
 assert.ok(chosen);const old=f.prepare(),r=f.storage.review(s.dataset.id);f.storage.saveReview(s.dataset.id,r.revision,{[choiceKey(chosen.sequence,chosen.c.id)]:false});
 assert.throws(()=>f.service.save(old.receipt),e=>e.reason==="conflict");
 const saved=f.service.save(f.prepare().receipt);assert.ok(saved.payload.omission.selected.includes(chosen.sequence));assert.ok(saved.payload.omission.manualSequences.includes(chosen.sequence));
});
test("saved selection replays without present-day roads, review or catalog",t=>{
 const f=fixture(t),p=f.prepare(),saved=f.service.save(p.receipt),other=createCourseService(f.db,{landmarks:true,omission:true,generate:()=>{throw Error("must not regenerate")},loadInitial:()=>{throw Error("must not read current catalog")}});
 assert.deepEqual(other.save(p.receipt),saved);assert.deepEqual(f.repo.get(saved.id),saved);
});
test("malformed modes, altered selections and omission of mandatory source frames are rejected",t=>{
 const f=fixture(t),p=f.prepare(),payload=p.payload;
 for(const change of [x=>x.omission.selected.pop(),x=>x.omission.mode="AI",x=>x.omission.plan.algorithm="other",x=>x.omission.manualSequences.push(0),x=>x.omission.plan.frames[0].id="other"]){const x=structuredClone(payload);change(x);assert.throws(()=>parseCoursePayload(x))}
 const x=structuredClone(payload),held=x.preview.cards.findIndex((c,i)=>i>0&&c.map.state==="held");assert.ok(held>0);x.omission.plan.frames[held].canOmit=true;x.omission.plan.frames[held].reason="continuation";x.omission.selected=selectOmission(x.omission.plan,"rule",x.omission.manualSequences).selected;assert.throws(()=>parseCoursePayload(x));
 assert.throws(()=>parseSaveReceipt({...p.receipt,omissionMode:"AI"}));const noMode={...p.receipt};delete noMode.omissionMode;assert.throws(()=>parseSaveReceipt(noMode));
});

test("unknown branch ends retain a ready map; explicit endings and access policies are respected",async()=>{
 const {buildWalkingGraph}=await import("../lib/route/graph.ts"),{routeThroughStops}=await import("../lib/route/routing.ts"),{extractJunctions}=await import("../lib/route/junctions.ts"),{createKomaMaps}=await import("../lib/route/koma.ts"),{analyzeKomaOmission}=await import("../lib/route/omission/analyze.ts");
 function analyze({known=false,blocked=false,signal=false,turn=false,platform=false,tiny=false}={}){
  const nodes=[{id:1,lat:34.999,lon:139},{id:2,lat:35,lon:139,...(signal?{tags:{highway:"traffic_signals"}}:{})},{id:3,lat:35.001,lon:139},{id:4,lat:35,lon:tiny?139.00000005:139.00013,tags:{...(known?{noexit:"yes"}:{}),...(blocked?{foot:"no"}:{})}}].map(n=>({type:"node",...n}));
  const elements=[...nodes,{type:"way",id:1,nodes:[1,2,3],tags:{highway:"residential"}},{type:"way",id:2,nodes:[2,4],tags:{highway:platform?"platform":"residential"}}];
  const g=buildWalkingGraph({schemaVersion:1,bounds:{south:34,west:138,north:36,east:140},elements}),r=routeThroughStops(g,[{id:"start",name:"start",nodeId:1,note:""},{id:"finish",name:"finish",nodeId:turn?4:3,note:""}]),a=extractJunctions(g,r),maps=createKomaMaps(g,a,30,{retainShortGeometry:true}),cards=maps.map((map,i)=>({map,candidate:a.candidates[i]}));return {cards,plan:analyzeKomaOmission(g,r,cards)};
 }
 const unknown=analyze();assert.equal(unknown.cards[1].map.state,"ready");assert.equal(unknown.plan.frames[1].reason,"shape-unavailable");assert.equal(unknown.plan.frames[1].canOmit,false);
 assert.equal(analyze({known:true,tiny:true}).plan.frames[1].reason,"shape-unavailable");
 const known=analyze({known:true});assert.equal(known.plan.frames[1].canOmit,true);
 assert.equal(analyze({known:true,blocked:true}).plan.frames[1].canOmit,false);
 assert.equal(analyze({known:true,turn:true}).plan.frames[1].reason,"turn");
 assert.equal(analyze({known:true,signal:true}).plan.frames[1].reason,"straight-signal");
 const mismatch=analyze({known:true,platform:true});assert.equal(mismatch.plan.frames[1].canOmit,false);assert.ok(["branch-mismatch","access-review"].includes(mismatch.plan.frames[1].reason));
});
