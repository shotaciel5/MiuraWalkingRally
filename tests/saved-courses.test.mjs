import test from "node:test";
import assert from "node:assert/strict";
import {mkdirSync,mkdtempSync,rmSync,readFileSync} from "node:fs";
import {resolve,join,sep} from "node:path";
import {DatabaseSync} from "node:sqlite";
import {execFileSync,spawn} from "node:child_process";
import {createDraftRepository} from "../lib/operator/draft-repository.ts";
import {createSpotRepository} from "../lib/spots/local-repository.ts";
import {draftInput} from "../lib/operator/rally-draft.ts";
import {CORRECTION_SOURCE} from "../lib/operator/rally-corrections.ts";
import {createRallyPreview} from "../lib/operator/rally-preview.ts";
import {createCourseService,prepareCourseSave} from "../lib/operator/course-save.ts";
import {createCourseRepository,courseFingerprint,checkedCoursePayload} from "../lib/operator/course-repository.ts";
import {parseCoursePayload,parseSavedCourse,parseSaveReceipt,canonicalJson,validCourseId,MAX_COURSE_BYTES} from "../lib/operator/course-format.ts";
import {getBrowserSpots} from "../lib/spots/browser-catalog.ts";
import {mergeSpotEdits} from "../lib/spots/editing.ts";
import {AUDIT_CASES} from "../scripts/expanded-route-audit.mjs";
const S="osm-way-384676338",C="osm-way-394752558",M="osm-node-2046962408";
function fixture(t){
 const parent=resolve(".tools/course-tests");mkdirSync(parent,{recursive:true});
 const dir=mkdtempSync(join(parent,"case-"));t.after(()=>{assert.ok(resolve(dir).startsWith(parent+sep));rmSync(dir,{recursive:true,force:true})});
 const path=join(dir,"db.sqlite"),drafts=createDraftRepository(path),spots=createSpotRepository(path),courses=createCourseRepository(path),service=createCourseService(path);
 const state=drafts.save({title:"保存テスト",expectedRevision:0,start:{id:S,revision:0},finish:{id:S,revision:0},stops:[{kind:"checkpoint",spot:{id:C,revision:0}},{kind:"waypoint",spot:{id:M,revision:0}}]});
 const prepared=()=>{const c=drafts.load();return prepareCourseSave(c,createRallyPreview(c.draft,c.spots,c.corrections))};
 return {dir,path,drafts,spots,courses,service,state,prepared};
}
const reason=code=>e=>e.reason===code;
const edit=(repo,s,name)=>repo.save({id:s.id,expectedRevision:s.revision,name,category:s.category,position:{lat:s.position.lat,lon:s.position.lon},description:s.description});
test("saves multiple immutable results and returns summaries without full models",t=>{
 const f=fixture(t),p=f.prepared(),before=f.drafts.load(),first=f.service.save(p.receipt);
 assert.ok(validCourseId(first.id));assert.deepEqual(first.payload,p.payload);assert.deepEqual(f.drafts.load(),before);
 assert.deepEqual(f.courses.get(first.id),first);
 const next=f.drafts.save({...draftInput(before.draft,1),title:"別のコース",stops:[...draftInput(before.draft,1).stops].reverse()});
 const second=f.service.save(f.prepared().receipt);assert.notEqual(first.id,second.id);assert.notEqual(first.fingerprint,second.fingerprint);
 assert.deepEqual(f.courses.get(first.id),first);assert.deepEqual(f.drafts.load().draft,next.draft);
 const list=f.courses.list();assert.equal(list.length,2);assert.equal(list[0].id,second.id);assert.equal(list[1].title,first.payload.preview.title);
 assert.equal(list[0].payload,undefined);assert.equal(list[1].cards,39);assert.equal(list[1].nearby,12);
});
test("identical retries preserve ID/time even after current draft and catalog change",t=>{
 const f=fixture(t),p=f.prepared(),saved=f.service.save(p.receipt);f.spots.remove({id:C,expectedRevision:0});
 const unavailable=createCourseService(f.path,{loadInitial:()=>{throw Error("Current catalog must not be read")},generate:()=>{throw Error("Must not regenerate")}});
 assert.deepEqual(unavailable.save(p.receipt),saved);assert.equal(f.courses.list().length,1);
 assert.throws(()=>unavailable.save({...p.receipt,draftRevision:2}),reason("invalid"));
});
test("saved replay works after process restart and never reads corrupt current working data",t=>{
 const f=fixture(t),saved=f.service.save(f.prepared().receipt),db=new DatabaseSync(f.path);
 db.exec("UPDATE rally_draft SET value='{bad'; INSERT INTO spot_edits(id,value) VALUES('bad','{bad'); UPDATE rally_corrections SET value='{bad'");db.close();
 const before=readFileSync(f.path);
 assert.deepEqual(f.courses.get(saved.id),saved);assert.deepEqual(f.courses.list().map(x=>x.id),[saved.id]);assert.deepEqual(readFileSync(f.path),before);
 const code="import {createCourseRepository} from './lib/operator/course-repository.ts'; console.log(JSON.stringify(createCourseRepository("+JSON.stringify(f.path)+").get("+JSON.stringify(saved.id)+")));";
 assert.deepEqual(JSON.parse(execFileSync(process.execPath,["--input-type=module","-e",code],{encoding:"utf8"})),saved);
 assert.deepEqual(readFileSync(f.path),before);
});
test("receipt is small, strict and cannot accept full client generated models",t=>{
 const f=fixture(t),p=f.prepared();assert.ok(Buffer.byteLength(JSON.stringify(p.receipt))<1024);
 assert.deepEqual(parseSaveReceipt(p.receipt),p.receipt);
 for(const value of [null,{},p.payload,{...p.receipt,published:true},{...p.receipt,fingerprint:"bad"},{...p.receipt,draftRevision:0},{...p.receipt,correctionRevision:-1},{...p.receipt,formatVersion:2}])assert.throws(()=>f.service.save(value),reason("invalid"));
 assert.equal(f.courses.list().length,0);
});
test("stale draft, source or generation fingerprint is rejected rather than silently saved",t=>{
 const f=fixture(t),p=f.prepared();
 for(const value of [{...p.receipt,roadSha256:"b".repeat(64)},{...p.receipt,contextSha256:"b".repeat(64)},{...p.receipt,fingerprint:"b".repeat(64)}])assert.throws(()=>f.service.save(value),reason("conflict"));
 f.drafts.save({...draftInput(f.state.draft,1),title:"変更後"});assert.throws(()=>f.service.save(p.receipt),reason("conflict"));assert.equal(f.courses.list().length,0);
});
test("catalog and correction changes invalidate an unsaved displayed preview",t=>{
 const f=fixture(t),p=f.prepared();edit(f.spots,f.state.spots.find(s=>s.id===C),"名称変更");assert.throws(()=>f.service.save(p.receipt),reason("conflict"));assert.equal(f.courses.list().length,0);
 const g=fixture(t),old=g.prepared();g.drafts.saveCorrection({expectedDraftRevision:1,expectedCorrectionRevision:0,spotId:S,spotRevision:0,sourceHash:CORRECTION_SOURCE.snapshotSha256,mode:"manual",point:{lat:35.141,lon:139.621}});
 assert.throws(()=>g.service.save(old.receipt),reason("conflict"));assert.equal(g.courses.list().length,0);
 const corrected=g.service.save(g.prepared().receipt);assert.equal(corrected.payload.input.corrections.items.length,1);assert.equal(corrected.payload.preview.visits[0].mode,"manual");
});
test("transaction rechecks changes occurring while generation runs",t=>{
 for(const change of ["draft","spot","correction"]){
  const f=fixture(t),p=f.prepared();
  const service=createCourseService(f.path,{generate:(draft,spots,corrections)=>{
   const result=createRallyPreview(draft,spots,corrections);
   if(change==="draft")f.drafts.save({...draftInput(draft,1),title:"同時計算変更"});
   if(change==="spot")edit(f.spots,spots.find(s=>s.id===C),"競合名称");
   if(change==="correction")f.drafts.saveCorrection({expectedDraftRevision:1,expectedCorrectionRevision:0,spotId:S,spotRevision:0,sourceHash:CORRECTION_SOURCE.snapshotSha256,mode:"manual",point:{lat:35.141,lon:139.621}});
   return result;
  }});
  assert.throws(()=>service.save(p.receipt),reason("conflict"));assert.equal(f.courses.list().length,0);
 }
});
test("unrelated catalog edits during generation do not block saving",t=>{
 const f=fixture(t),p=f.prepared(),service=createCourseService(f.path,{generate:(draft,spots,corrections)=>{
  const result=createRallyPreview(draft,spots,corrections);edit(f.spots,spots.find(s=>![S,C,M].includes(s.id)),"無関係な編集");return result;
 }});
 assert.equal(service.save(p.receipt).fingerprint,p.receipt.fingerprint);
});
test("SQLite v4 migration preserves edits, tombstones, draft and corrections",t=>{
 const f=fixture(t);edit(f.spots,f.state.spots.find(s=>![S,C,M].includes(s.id)),"移行前の編集");
 f.spots.remove({id:"osm-node-1211621029",expectedRevision:f.spots.list().find(s=>s.id==="osm-node-1211621029").revision});
 f.drafts.saveCorrection({expectedDraftRevision:1,expectedCorrectionRevision:0,spotId:S,spotRevision:0,sourceHash:CORRECTION_SOURCE.snapshotSha256,mode:"manual",point:{lat:35.141,lon:139.621}});
 const before=f.drafts.load(),db=new DatabaseSync(f.path);db.exec("DROP TABLE saved_courses; DROP TABLE course_publications; PRAGMA user_version=4");db.close();
 assert.deepEqual(f.courses.list(),[]);assert.deepEqual(f.drafts.load(),before);
 const check=new DatabaseSync(f.path);assert.equal(check.prepare("PRAGMA user_version").get().user_version,6);check.close();
 assert.ok(f.service.save(f.prepared().receipt));
});
test("foreign saved-course table rolls migration back and is never reset",t=>{
 const f=fixture(t),db=new DatabaseSync(f.path);db.exec("DROP TABLE saved_courses; DROP TABLE course_publications; CREATE TABLE saved_courses(note TEXT); INSERT INTO saved_courses VALUES('keep'); PRAGMA user_version=4");db.close();
 assert.throws(()=>f.courses.list());const check=new DatabaseSync(f.path);assert.equal(check.prepare("PRAGMA user_version").get().user_version,4);assert.equal(check.prepare("SELECT note FROM saved_courses").get().note,"keep");check.close();
});
test("missing v5 table and unsupported DB version fail without recreating data",t=>{
 for(const sql of ["DROP TABLE saved_courses","PRAGMA user_version=99"]){
  const f=fixture(t),db=new DatabaseSync(f.path);db.exec(sql);db.close();const before=readFileSync(f.path);
  assert.throws(()=>f.courses.list());assert.deepEqual(readFileSync(f.path),before);
 }
});
test("locked writes cannot report success and the retry creates one course",t=>{
 const f=fixture(t),p=f.prepared(),db=new DatabaseSync(f.path);db.exec("BEGIN IMMEDIATE");
 try{assert.throws(()=>f.service.save(p.receipt))}finally{db.exec("ROLLBACK");db.close()}
 assert.equal(f.courses.list().length,0);const saved=f.service.save(p.receipt);assert.deepEqual(f.service.save(p.receipt),saved);assert.equal(f.courses.list().length,1);
});
test("two processes saving the same preview converge on the same record",async t=>{
 const f=fixture(t),p=f.prepared(),code="import {createCourseService} from './lib/operator/course-save.ts';console.log(JSON.stringify(createCourseService("+JSON.stringify(f.path)+").save("+JSON.stringify(p.receipt)+")));";
 const run=()=>new Promise((resolve,reject)=>{const child=spawn(process.execPath,["--input-type=module","-e",code]);let out="",err="";child.stdout.on("data",b=>out+=b);child.stderr.on("data",b=>err+=b);child.on("error",reject);child.on("close",c=>c?reject(Error(err)):resolve(JSON.parse(out)))});
 const [a,b]=await Promise.all([run(),run()]);assert.deepEqual(a,b);assert.equal(f.courses.list().length,1);
});
test("all five representative previews preserve geometry, source, context and zoom references",()=>{
 const spots=mergeSpotEdits(getBrowserSpots(),[]),byId=new Map(spots.map(s=>[s.id,s]));let short=0;
 for(const spec of AUDIT_CASES.filter(s=>!["separated","museum"].includes(s.id))){
  const selected=spec.ids.map(id=>byId.get(id)),draft={title:spec.label,start:selected[0],finish:selected.at(-1),stops:selected.slice(1,-1).map(spot=>({kind:"waypoint",spot})),revision:1,updatedAt:"2026-11-09T00:00:00.000Z"},context={draft,spots,corrections:{revision:0,updatedAt:null,items:[]}},preview=createRallyPreview(draft,spots,context.corrections);
  const prepared=prepareCourseSave(context,preview),restored=parseCoursePayload(JSON.parse(canonicalJson(prepared.payload)));
  assert.deepEqual(restored.preview,preview);assert.equal(courseFingerprint(restored),prepared.receipt.fingerprint);short+=restored.preview.cards.filter(c=>c.map.shortGeometry).length;
 }
 assert.equal(short,45);
});
test("unreachable, zero-distance and missing drafts cannot produce a save payload",()=>{
 const spots=mergeSpotEdits(getBrowserSpots(),[]),byId=new Map(spots.map(s=>[s.id,s]));
 for(const ids of [[S,S],["osm-node-1211621029","osm-node-12364319660"]]){
  const draft={title:"blocked",start:byId.get(ids[0]),finish:byId.get(ids[1]),stops:[],revision:1,updatedAt:"2026-11-09T00:00:00.000Z"},context={draft,spots,corrections:{revision:0,updatedAt:null,items:[]}},result=createRallyPreview(draft,spots,context.corrections);
  assert.equal(result.state,"blocked");assert.throws(()=>prepareCourseSave(context,result),reason("conflict"));
 }
 assert.throws(()=>prepareCourseSave({draft:null},{state:"blocked",message:"empty"}),reason("conflict"));
});
test("stored payload codec rejects invalid versions, geometry and relationships",t=>{
 const f=fixture(t),p=f.prepared();
 const mutations=[x=>x.formatVersion=2,x=>x.generatorVersion="future",x=>x.preview.extra=true,x=>x.preview.cards[0].map.sequence=8,x=>x.preview.cards[0].map.metersFromStart=1,x=>x.preview.cards[0].candidate.point.lat=NaN,x=>x.preview.cards[0].candidate.nodeId=0,x=>x.preview.visits[0].komaIndex=99999,x=>x.preview.title="other",x=>x.preview.path[0].lon=181,x=>x.input.draft.start.source.id=1,x=>x.preview.cards.find(c=>c.map.shortGeometry).referenceContext=null,x=>{const b=x.preview.cards.find(c=>c.map.shortGeometry).map.shortGeometry.branches[0];b.arrival=!b.arrival}];
 for(const mutate of mutations){const bad=structuredClone(p.payload);mutate(bad);assert.throws(()=>parseCoursePayload(bad))}
 const large=structuredClone(p.payload);large.preview.roads=Array.from({length:100000},()=>p.payload.preview.roads[0]);assert.ok(Buffer.byteLength(canonicalJson(large))>MAX_COURSE_BYTES);assert.throws(()=>checkedCoursePayload(large),reason("invalid"));
});
test("corrupt or unsupported records are reported without changing stored bytes",t=>{
 const mutations=[x=>x.payload.formatVersion=2,x=>x.payload.preview.title="tampered",x=>x.id="course-00000000-0000-4000-8000-000000000000",x=>x.createdAt="bad"];
 for(const mutate of mutations){const f=fixture(t),saved=f.service.save(f.prepared().receipt),bad=structuredClone(saved);mutate(bad);const db=new DatabaseSync(f.path);db.prepare("UPDATE saved_courses SET value=?").run(JSON.stringify(bad));db.close();const before=readFileSync(f.path);
  assert.throws(()=>f.courses.get(saved.id),reason("unavailable"));assert.throws(()=>f.courses.list(),reason("unavailable"));assert.deepEqual(readFileSync(f.path),before);
 }
});
test("saved codec keeps historical source metadata without requiring the current dataset",t=>{
 const f=fixture(t),p=f.prepared(),old=structuredClone(p.payload);old.preview.source.roadSnapshotSha256="a".repeat(64);old.preview.source.snapshotSha256="b".repeat(64);old.preview.source.osmBaseTimestamp="2020-01-01T00:00:00Z";
 const saved=f.courses.store(old,()=>{});assert.equal(f.courses.get(saved.id).payload.preview.source.osmBaseTimestamp,"2020-01-01T00:00:00Z");assert.equal(f.courses.list().length,1);
});
test("unknown and malformed course IDs are absent without an unintended lookup",t=>{
 const f=fixture(t);for(const id of ["bad","../draft","course-00000000-0000-4000-8000-000000000000"])assert.equal(f.courses.get(id),null);
 assert.equal(createCourseRepository("Z:/not-present/no.sqlite").get("../bad"),null);
 assert.throws(()=>parseSavedCourse({id:"bad"}));
});
