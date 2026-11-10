import test from "node:test";
import assert from "node:assert/strict";
import {mkdirSync,mkdtempSync,rmSync,readFileSync} from "node:fs";
import {resolve,join,sep} from "node:path";
import {DatabaseSync} from "node:sqlite";
import {execFileSync,spawn} from "node:child_process";
import {createDraftRepository} from "../lib/operator/draft-repository.ts";
import {createSpotRepository} from "../lib/spots/local-repository.ts";
import {createCourseRepository} from "../lib/operator/course-repository.ts";
import {createCourseService} from "../lib/operator/course-save.ts";
import {prepareCourseSave} from "../lib/operator/course-save.ts";
import {createRallyPreview} from "../lib/operator/rally-preview.ts";
import {createPublicationRepository} from "../lib/operator/publication-repository.ts";
import {parsePublishInput,parsePublication} from "../lib/operator/publication.ts";
import {projectPublishedCourse} from "../lib/published-course.ts";
import {draftInput} from "../lib/operator/rally-draft.ts";
import {CORRECTION_SOURCE} from "../lib/operator/rally-corrections.ts";
import {startParticipation,readParticipation,participationKey} from "../lib/participation.ts";
const M="osm-node-2046962408",S="osm-way-384676338",W="osm-way-394752554",C="osm-way-394752558";
const reason=code=>e=>e.reason===code;
function fixture(t){
 const parent=resolve(".tools/publication-tests");mkdirSync(parent,{recursive:true});const dir=mkdtempSync(join(parent,"case-"));
 t.after(()=>{assert.ok(resolve(dir).startsWith(parent+sep));rmSync(dir,{recursive:true,force:true})});
 const path=join(dir,"db.sqlite"),drafts=createDraftRepository(path),courses=createCourseRepository(path),publisher=createPublicationRepository(path,()=>"2026-11-10T01:00:00.000Z");
 const state=drafts.save({title:"公開する三崎周回",expectedRevision:0,start:{id:M,revision:0},finish:{id:M,revision:0},stops:[{kind:"checkpoint",spot:{id:S,revision:0}},{kind:"waypoint",spot:{id:W,revision:0}},{kind:"checkpoint",spot:{id:C,revision:0}}]});
 const ready=prepareCourseSave(state,createRallyPreview(state.draft,state.spots,state.corrections)),saved=createCourseService(path).save(ready.receipt),input={courseId:saved.id,fingerprint:saved.fingerprint,expectedRevision:0};
 return {path,dir,drafts,courses,publisher,saved,input,state};
}
test("saved courses stay private until explicitly published and multiple public summaries are distinct",t=>{
 const f=fixture(t);assert.deepEqual(f.publisher.list(),[]);assert.equal(f.publisher.get(f.saved.id),null);
 const before=f.drafts.load(),publication=f.publisher.publish(f.input);
 assert.deepEqual(publication,{courseId:f.saved.id,fingerprint:f.saved.fingerprint,publishedAt:"2026-11-10T01:00:00.000Z",changedAt:"2026-11-10T01:00:00.000Z",status:"published",revision:1});
 const value=f.publisher.get(f.saved.id);assert.deepEqual(value.course,f.saved);assert.deepEqual(value.publication,publication);assert.deepEqual(f.drafts.load(),before);
 f.drafts.save({...draftInput(before.draft,1),title:"別の公開コース"});const c=f.drafts.load(),next=createCourseService(f.path).save(prepareCourseSave(c,createRallyPreview(c.draft,c.spots,c.corrections)).receipt);
 f.publisher.publish({courseId:next.id,fingerprint:next.fingerprint,expectedRevision:0});const rows=f.publisher.list();assert.equal(rows.length,2);assert.ok(rows.every(r=>!r.cards&&!r.payload&&!r.input));assert.equal(new Set(rows.map(r=>r.id)).size,2);
});
test("retries keep the original publication date without rewriting the saved snapshot",t=>{
 const f=fixture(t),before=f.saved,p=f.publisher.publish(f.input),bytes=readFileSync(f.path);
 assert.deepEqual(createPublicationRepository(f.path,()=>"2027-01-01T00:00:00.000Z").publish(f.input),p);
 assert.deepEqual(f.courses.get(before.id),before);assert.deepEqual(readFileSync(f.path),bytes);assert.equal(f.publisher.list().length,1);
});
test("publication reads and retries ignore changed or corrupt working draft and catalog data",t=>{
 const f=fixture(t),p=f.publisher.publish(f.input),db=new DatabaseSync(f.path);db.exec("UPDATE rally_draft SET value='{bad'; INSERT INTO spot_edits(id,value) VALUES('bad','{bad')");db.close();
 const before=readFileSync(f.path);assert.deepEqual(f.publisher.get(f.saved.id),{course:f.saved,publication:p});assert.equal(f.publisher.list()[0].title,f.saved.payload.preview.title);
 assert.deepEqual(f.publisher.publish(f.input),p);assert.deepEqual(readFileSync(f.path),before);
});
test("published content persists exactly across a separate process restart",t=>{
 const f=fixture(t),p=f.publisher.publish(f.input),before=readFileSync(f.path);
 const code="import {createPublicationRepository} from './lib/operator/publication-repository.ts';console.log(JSON.stringify(createPublicationRepository("+JSON.stringify(f.path)+").get("+JSON.stringify(f.saved.id)+")));";
 assert.deepEqual(JSON.parse(execFileSync(process.execPath,["--input-type=module","-e",code],{encoding:"utf8"})),{course:f.saved,publication:p});assert.deepEqual(readFileSync(f.path),before);
});
test("strict publication input rejects forged metadata and stale fingerprints",t=>{
 const f=fixture(t);assert.deepEqual(parsePublishInput(f.input),f.input);
 for(const bad of [null,{},f.saved,{...f.input,publishedAt:"2026-11-10T01:00:00.000Z"},{...f.input,courseId:"bad"},{...f.input,fingerprint:"x"}])assert.throws(()=>f.publisher.publish(bad),reason("invalid"));
 assert.throws(()=>f.publisher.publish({...f.input,fingerprint:"b".repeat(64)}),reason("conflict"));
 assert.throws(()=>f.publisher.publish({...f.input,courseId:"course-00000000-0000-4000-8000-000000000000"}),reason("missing"));assert.deepEqual(f.publisher.list(),[]);
});
test("v5 to v7 preserves all prior records and does not publish any course automatically",t=>{
 const f=fixture(t),spots=createSpotRepository(f.path),s=f.state.spots.find(s=>![S,W,C,M].includes(s.id));
 spots.save({id:s.id,expectedRevision:s.revision,name:"保持する編集",category:s.category,position:{lat:s.position.lat,lon:s.position.lon},description:s.description});spots.remove({id:"osm-node-1211621029",expectedRevision:spots.list().find(s=>s.id==="osm-node-1211621029").revision});
 f.drafts.saveCorrection({expectedDraftRevision:1,expectedCorrectionRevision:0,spotId:S,spotRevision:0,sourceHash:CORRECTION_SOURCE.snapshotSha256,mode:"manual",point:{lat:35.141,lon:139.621}});
 const db=new DatabaseSync(f.path),before={};for(const table of ["spot_edits","spot_deletions","rally_draft","rally_corrections","saved_courses"])before[table]=db.prepare("SELECT * FROM "+table).all();db.exec("DROP TABLE course_publications; PRAGMA user_version=5");db.close();
 assert.deepEqual(f.publisher.list(),[]);const check=new DatabaseSync(f.path);assert.equal(check.prepare("PRAGMA user_version").get().user_version,7);
 for(const table of Object.keys(before))assert.deepEqual(check.prepare("SELECT * FROM "+table).all(),before[table]);check.close();assert.deepEqual(f.courses.get(f.saved.id),f.saved);
});
test("a foreign publication table rolls migration back and is not reset",t=>{
 const f=fixture(t),db=new DatabaseSync(f.path);db.exec("DROP TABLE course_publications; CREATE TABLE course_publications(note TEXT); INSERT INTO course_publications VALUES('keep'); PRAGMA user_version=5");db.close();
 assert.throws(()=>f.publisher.list());const check=new DatabaseSync(f.path);assert.equal(check.prepare("PRAGMA user_version").get().user_version,5);assert.equal(check.prepare("SELECT note FROM course_publications").get().note,"keep");check.close();
});
test("missing v7 tables and unsupported versions never silently reset data",t=>{
 for(const sql of ["DROP TABLE course_publications","PRAGMA user_version=99"]){const f=fixture(t),db=new DatabaseSync(f.path);db.exec(sql);db.close();const before=readFileSync(f.path);assert.throws(()=>f.publisher.get(f.saved.id));assert.deepEqual(readFileSync(f.path),before)}
});
test("locked writes fail and a later retry publishes only once",t=>{
 const f=fixture(t),db=new DatabaseSync(f.path);db.exec("BEGIN IMMEDIATE");try{assert.throws(()=>f.publisher.publish(f.input))}finally{db.exec("ROLLBACK");db.close()}
 assert.deepEqual(f.publisher.list(),[]);const p=f.publisher.publish(f.input);assert.deepEqual(f.publisher.publish(f.input),p);assert.equal(f.publisher.list().length,1);
});
test("two processes publishing the same course return one publication and timestamp",async t=>{
 const f=fixture(t),code="import {createPublicationRepository} from './lib/operator/publication-repository.ts';console.log(JSON.stringify(createPublicationRepository("+JSON.stringify(f.path)+").publish("+JSON.stringify(f.input)+")));";
 const run=()=>new Promise((resolve,reject)=>{const child=spawn(process.execPath,["--input-type=module","-e",code]);let out="",err="";child.stdout.on("data",b=>out+=b);child.stderr.on("data",b=>err+=b);child.on("error",reject);child.on("close",c=>c?reject(Error(err)):resolve(JSON.parse(out)))});
 const [a,b]=await Promise.all([run(),run()]);assert.deepEqual(a,b);assert.equal(f.publisher.list().length,1);
});
test("corrupt publication metadata and orphaned references fail closed without changing bytes",t=>{
 for(const change of ["fingerprint","date","orphan"]){
  const f=fixture(t);f.publisher.publish(f.input);const db=new DatabaseSync(f.path);
  if(change==="fingerprint")db.exec("UPDATE course_publications SET fingerprint='"+ "b".repeat(64)+"'");
  if(change==="date")db.exec("UPDATE course_publications SET published_at='bad'");
  const id=change==="orphan"?"course-00000000-0000-4000-8000-000000000000":f.saved.id;if(change==="orphan")db.prepare("UPDATE course_publications SET course_id=?").run(id);db.close();
  const before=readFileSync(f.path);assert.throws(()=>f.publisher.get(id),reason("unavailable"));assert.throws(()=>f.publisher.list(),reason("unavailable"));assert.deepEqual(readFileSync(f.path),before);
 }
});
test("corrupted saved content is not regenerated or shown through an old publication",t=>{
 const f=fixture(t);f.publisher.publish(f.input);const db=new DatabaseSync(f.path);db.exec("UPDATE saved_courses SET value='{bad'");db.close();const before=readFileSync(f.path);
 assert.throws(()=>f.publisher.get(f.saved.id),reason("unavailable"));assert.throws(()=>f.publisher.list(),reason("unavailable"));assert.throws(()=>f.publisher.publish(f.input),reason("unavailable"));assert.deepEqual(readFileSync(f.path),before);
});
test("participant projection preserves the 41-card course and roles without sending operator input or overview",t=>{
 const f=fixture(t),publication=f.publisher.publish(f.input),before=structuredClone(f.saved),view=projectPublishedCourse(f.saved,publication);
 assert.equal(view.cards.length,41);assert.equal(view.rally.distanceMeters,f.saved.payload.preview.meters);
 assert.deepEqual(view.rally.checkpointIds,["stop-0","stop-2"]);assert.equal(view.rally.goalStopId,"finish");assert.deepEqual(view.stops.map(s=>s.kind),["start","checkpoint","waypoint","checkpoint","finish"]);
 assert.notEqual(view.stops[0].id,view.stops.at(-1).id);assert.equal(view.stops[0].name,view.stops.at(-1).name);assert.equal(view.stops[1].komaIndex,13);
 for(const [i,c]of view.cards.entries()){assert.deepEqual(c.map,f.saved.payload.preview.cards[i].map);assert.deepEqual(c.referenceContext,f.saved.payload.preview.cards[i].referenceContext);for(const id of c.stopIds)assert.ok(view.stops.some(s=>s.id===id))}
 for(const key of ["input","roads","path","corrections","source"])assert.equal(key in view,false);
 assert.equal(view.cards.some(c=>"candidate" in c||"evidence" in c),false);assert.deepEqual(JSON.parse(JSON.stringify(view)),view);assert.deepEqual(f.saved,before);
 assert.throws(()=>projectPublishedCourse(f.saved,{...publication,fingerprint:"b".repeat(64)}),reason("unavailable"));
});
test("published editions isolate start records and zero-checkpoint courses can start",t=>{
 const f=fixture(t),publication=f.publisher.publish(f.input),r=projectPublishedCourse(f.saved,publication).rally,memory=new Map([["miura-walking-rally:participation:misaki-shitamachi","untouched"]]),storage=()=>({getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value)}),source={uuid:()=>"00000000-0000-4000-8000-000000000001",now:()=>"2026-11-10T01:00:00.000Z"};
 const first=startParticipation(storage,r,source);assert.equal(first.status,"active");assert.deepEqual(startParticipation(storage,r,{uuid:()=>{throw Error()},now:()=>{throw Error()}}),first);assert.deepEqual(readParticipation(storage,r),first);
 const other={...r,id:"course-00000000-0000-4000-8000-000000000002",checkpointIds:[]};assert.equal(startParticipation(storage,other,source).status,"active");assert.notEqual(participationKey(r.id),participationKey(other.id));assert.equal(memory.size,3);assert.equal(memory.get("miura-walking-rally:participation:misaki-shitamachi"),"untouched");
});
test("unknown and malformed public IDs are absent and invalid publication time rolls back",t=>{
 const f=fixture(t);for(const id of ["bad","../draft","course-00000000-0000-4000-8000-000000000000",f.saved.id])assert.equal(f.publisher.get(id),null);
 assert.throws(()=>createPublicationRepository(f.path,()=>"bad").publish(f.input),reason("unavailable"));assert.deepEqual(f.publisher.list(),[]);
 assert.throws(()=>parsePublication({...f.input,publishedAt:"bad"}),reason("unavailable"));
});
