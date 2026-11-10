import test from "node:test";
import assert from "node:assert/strict";
import {mkdirSync,mkdtempSync,rmSync,readFileSync} from "node:fs";
import {resolve,join,sep} from "node:path";
import {DatabaseSync} from "node:sqlite";
import {execFileSync,spawn} from "node:child_process";
import {createDraftRepository} from "../lib/operator/draft-repository.ts";
import {createSpotRepository} from "../lib/spots/local-repository.ts";
import {createCourseRepository} from "../lib/operator/course-repository.ts";
import {createCourseService,prepareCourseSave} from "../lib/operator/course-save.ts";
import {createRallyPreview} from "../lib/operator/rally-preview.ts";
import {createPublicationRepository} from "../lib/operator/publication-repository.ts";
import {parsePublishInput,parsePublication} from "../lib/operator/publication.ts";
import {projectPublishedCourse} from "../lib/published-course.ts";
import {draftInput} from "../lib/operator/rally-draft.ts";
import {startParticipation,readParticipation} from "../lib/participation.ts";
const M="osm-node-2046962408",S="osm-way-384676338",W="osm-way-394752554",C="osm-way-394752558";
const reason=code=>e=>e.reason===code;
const rows=(db,t)=>db.prepare("SELECT * FROM "+t).all();
function fixture(t){
 const parent=resolve(".tools/publication-controls-tests");mkdirSync(parent,{recursive:true});const dir=mkdtempSync(join(parent,"case-"));
 t.after(()=>{assert.ok(resolve(dir).startsWith(parent+sep));rmSync(dir,{recursive:true,force:true})});
 const path=join(dir,"db.sqlite"),drafts=createDraftRepository(path),courses=createCourseRepository(path),clock={time:"2026-11-10T01:00:00.000Z"},repo=createPublicationRepository(path,()=>clock.time);
 const state=drafts.save({title:"公開を切り替える三崎周回",expectedRevision:0,start:{id:M,revision:0},finish:{id:M,revision:0},stops:[{kind:"checkpoint",spot:{id:S,revision:0}},{kind:"waypoint",spot:{id:W,revision:0}},{kind:"checkpoint",spot:{id:C,revision:0}}]});
 const saved=createCourseService(path).save(prepareCourseSave(state,createRallyPreview(state.draft,state.spots,state.corrections)).receipt),input={courseId:saved.id,fingerprint:saved.fingerprint,expectedRevision:0};
 return {path,dir,drafts,courses,clock,repo,saved,input};
}
function publish(f){return f.repo.publish(f.input)}
function stop(f){f.clock.time="2026-11-10T02:00:00.000Z";return f.repo.unpublish({...f.input,expectedRevision:1})}
function reopen(f){f.clock.time="2026-11-10T03:00:00.000Z";return f.repo.publish({...f.input,expectedRevision:2})}
test("publish stop and reopen preserve the saved course and content edition",t=>{
 const f=fixture(t),p=publish(f),view=projectPublishedCourse(f.saved,p);assert.equal(p.status,"published");assert.equal(p.revision,1);
 const u=stop(f);assert.deepEqual(f.repo.get(f.saved.id),{course:null,publication:u});assert.equal(u.status,"withdrawn");assert.equal(u.revision,2);assert.equal(u.publishedAt,p.publishedAt);assert.deepEqual(f.repo.list(),[]);
 const again=reopen(f);assert.equal(again.status,"published");assert.equal(again.revision,3);assert.equal(again.changedAt,f.clock.time);assert.equal(again.publishedAt,f.clock.time);
 assert.equal(f.repo.list().length,1);assert.deepEqual(f.courses.get(f.saved.id),f.saved);assert.deepEqual(projectPublishedCourse(f.saved,again).cards,view.cards);assert.equal(projectPublishedCourse(f.saved,again).rally.revision,view.rally.revision);
});
test("lost response retries retain state revision date and file bytes",t=>{
 const f=fixture(t);publish(f);const u=stop(f),bytes=readFileSync(f.path);f.clock.time="2026-11-11T01:00:00.000Z";
 assert.deepEqual(f.repo.unpublish({...f.input,expectedRevision:1}),u);assert.deepEqual(f.repo.unpublish({...f.input,expectedRevision:2}),u);assert.deepEqual(readFileSync(f.path),bytes);
 const p=reopen(f),after=readFileSync(f.path);f.clock.time="2026-11-12T00:00:00.000Z";assert.deepEqual(f.repo.publish({...f.input,expectedRevision:2}),p);assert.deepEqual(readFileSync(f.path),after);
});
test("late publish and stop requests cannot undo later opposite actions",t=>{
 const f=fixture(t);publish(f);stop(f);let before=readFileSync(f.path);
 assert.throws(()=>f.repo.publish(f.input),reason("conflict"));assert.deepEqual(readFileSync(f.path),before);
 reopen(f);before=readFileSync(f.path);assert.throws(()=>f.repo.unpublish({...f.input,expectedRevision:1}),reason("conflict"));assert.throws(()=>f.repo.publish(f.input),reason("conflict"));assert.deepEqual(readFileSync(f.path),before);
 f.clock.time="2026-11-10T04:00:00.000Z";const latest=f.repo.unpublish({...f.input,expectedRevision:3});assert.equal(latest.revision,4);before=readFileSync(f.path);
 assert.throws(()=>f.repo.unpublish({...f.input,expectedRevision:1}),reason("conflict"));assert.throws(()=>f.repo.publish({...f.input,expectedRevision:2}),reason("conflict"));assert.deepEqual(readFileSync(f.path),before);
});
test("unpublished or unknown targets and stale fingerprints never create stop records",t=>{
 const f=fixture(t),before=readFileSync(f.path);
 assert.throws(()=>f.repo.unpublish(f.input),reason("conflict"));
 assert.throws(()=>f.repo.unpublish({...f.input,courseId:"course-00000000-0000-4000-8000-000000000000"}),reason("missing"));
 assert.throws(()=>f.repo.publish({...f.input,fingerprint:"b".repeat(64)}),reason("conflict"));assert.deepEqual(readFileSync(f.path),before);assert.deepEqual(f.repo.list(),[]);
});
test("strict operation versions reject legacy clients and forged metadata",t=>{
 const f=fixture(t);for(const value of [{courseId:f.input.courseId,fingerprint:f.input.fingerprint},{...f.input,expectedRevision:-1},{...f.input,expectedRevision:1.5},{...f.input,expectedRevision:"0"},{...f.input,expectedRevision:NaN},{...f.input,publishedAt:"2026-11-10T00:00:00.000Z"},{...f.input,status:"published"}]){
  assert.throws(()=>parsePublishInput(value),reason("invalid"));assert.throws(()=>f.repo.publish(value),reason("invalid"));assert.throws(()=>f.repo.unpublish(value),reason("invalid"));
 }assert.deepEqual(f.repo.list(),[]);
});
test("invalid or backwards clocks roll back state changes",t=>{
 const f=fixture(t);publish(f);const before=readFileSync(f.path);
 for(const time of ["bad","2026-11-09T00:00:00.000Z"]){f.clock.time=time;assert.throws(()=>f.repo.unpublish({...f.input,expectedRevision:1}),reason("unavailable"));assert.deepEqual(readFileSync(f.path),before)}
});
test("stopped state and old timestamps survive another process without rewriting data",t=>{
 const f=fixture(t);publish(f);const u=stop(f),before=readFileSync(f.path),code="import {createPublicationRepository} from './lib/operator/publication-repository.ts';console.log(JSON.stringify(createPublicationRepository("+JSON.stringify(f.path)+").get("+JSON.stringify(f.saved.id)+")));";
 assert.deepEqual(JSON.parse(execFileSync(process.execPath,["--input-type=module","-e",code],{encoding:"utf8"})),{course:null,publication:u});assert.deepEqual(readFileSync(f.path),before);
});
test("two concurrent stop requests share the same revision and timestamp",async t=>{
 const f=fixture(t);publish(f);const input={...f.input,expectedRevision:1},code="import {createPublicationRepository} from './lib/operator/publication-repository.ts';console.log(JSON.stringify(createPublicationRepository("+JSON.stringify(f.path)+",()=>\"2026-11-10T02:00:00.000Z\").unpublish("+JSON.stringify(input)+")));";
 const run=()=>new Promise((resolve,reject)=>{const child=spawn(process.execPath,["--input-type=module","-e",code]);let out="",err="";child.stdout.on("data",b=>out+=b);child.stderr.on("data",b=>err+=b);child.on("error",reject);child.on("close",c=>c?reject(Error(err)):resolve(JSON.parse(out)))});
 const [a,b]=await Promise.all([run(),run()]);assert.deepEqual(a,b);assert.equal(a.revision,2);assert.equal(f.repo.list().length,0);
});
test("a locked stop can be retried once without deleting the publication",t=>{
 const f=fixture(t);publish(f);const db=new DatabaseSync(f.path);db.exec("BEGIN IMMEDIATE");try{assert.throws(()=>f.repo.unpublish({...f.input,expectedRevision:1}))}finally{db.exec("ROLLBACK");db.close()}
 assert.equal(f.repo.get(f.saved.id).publication.status,"published");stop(f);const check=new DatabaseSync(f.path);assert.equal(rows(check,"course_publications").length,1);check.close();
});
test("v6 migration preserves all old records and published dates without publishing private courses",t=>{
 const f=fixture(t);publish(f);const current=f.drafts.load(),privateState=f.drafts.save({...draftInput(current.draft,1),title:"未掲載の別コース"});createCourseService(f.path).save(prepareCourseSave(privateState,createRallyPreview(privateState.draft,privateState.spots,privateState.corrections)).receipt);const spots=createSpotRepository(f.path),spot=spots.list().find(s=>s.id===M);
 spots.save({id:spot.id,expectedRevision:spot.revision,name:"移行前の編集",category:spot.category,position:{lat:35.136,lon:139.62},description:spot.description});
 const db=new DatabaseSync(f.path),before={};for(const table of ["spot_edits","spot_deletions","rally_draft","rally_corrections","saved_courses"])before[table]=rows(db,table);
 const old=db.prepare("SELECT course_id,fingerprint,published_at FROM course_publications").all();
 db.exec("ALTER TABLE course_publications RENAME TO current_publications; CREATE TABLE course_publications(course_id TEXT PRIMARY KEY,fingerprint TEXT NOT NULL,published_at TEXT NOT NULL) STRICT; INSERT INTO course_publications SELECT course_id,fingerprint,published_at FROM current_publications; DROP TABLE current_publications; PRAGMA user_version=6");db.close();
 const migrated=f.repo.get(f.saved.id);assert.equal(migrated.publication.status,"published");assert.equal(migrated.publication.revision,1);assert.equal(migrated.publication.changedAt,old[0].published_at);
 assert.equal(f.repo.list().length,1);const check=new DatabaseSync(f.path);assert.equal(rows(check,"saved_courses").length,2);assert.equal(check.prepare("PRAGMA user_version").get().user_version,7);assert.deepEqual(check.prepare("SELECT course_id,fingerprint,published_at FROM course_publications").all(),old);for(const table of Object.keys(before))assert.deepEqual(rows(check,table),before[table]);check.close();
});
test("foreign v6 tables or missing v7 columns fail without reset",t=>{
 for(const version of [6,7]){const f=fixture(t),db=new DatabaseSync(f.path);db.exec("DROP TABLE course_publications; CREATE TABLE course_publications(course_id TEXT PRIMARY KEY,fingerprint TEXT,published_at TEXT,status TEXT); INSERT INTO course_publications VALUES('keep','keep','keep','keep'); PRAGMA user_version="+version);db.close();const before=readFileSync(f.path);assert.throws(()=>f.repo.list());assert.deepEqual(readFileSync(f.path),before)}
});
test("malformed public state metadata fails closed and retains bytes",t=>{
 for(const update of ["status='broken'","revision=0","changed_at='bad'","status='withdrawn',revision=2,changed_at='2026-11-09T00:00:00.000Z'"]){
  const f=fixture(t);publish(f);const db=new DatabaseSync(f.path);db.exec("PRAGMA ignore_check_constraints=ON; UPDATE course_publications SET "+update);db.close();const before=readFileSync(f.path);
  assert.throws(()=>f.repo.get(f.saved.id),reason("unavailable"));assert.throws(()=>f.repo.list(),reason("unavailable"));assert.throws(()=>f.repo.unpublish({...f.input,expectedRevision:1}),reason("unavailable"));assert.deepEqual(readFileSync(f.path),before);
 }
});
test("stopped courses do not conceal corrupt saved content or project their maps",t=>{
 const f=fixture(t);publish(f);const u=stop(f);assert.throws(()=>projectPublishedCourse(f.saved,u),reason("unavailable"));
 const db=new DatabaseSync(f.path);db.exec("UPDATE saved_courses SET value='{bad'");db.close();const before=readFileSync(f.path);assert.throws(()=>f.repo.get(f.saved.id),reason("unavailable"));assert.throws(()=>reopen(f),reason("unavailable"));assert.deepEqual(readFileSync(f.path),before);
});
test("stop and reopen leave the original tab record and other courses intact",t=>{
 const f=fixture(t),p=publish(f),rally=projectPublishedCourse(f.saved,p).rally,memory=new Map([["other","kept"]]),storage=()=>({getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)}),source={uuid:()=>"00000000-0000-4000-8000-000000000001",now:()=>"2026-11-10T01:00:00.000Z"};
 const start=startParticipation(storage,rally,source),before=structuredClone(memory);assert.equal(start.status,"active");stop(f);assert.deepEqual(memory,before);const again=projectPublishedCourse(f.saved,reopen(f)).rally;
 assert.deepEqual(readParticipation(storage,again),start);assert.deepEqual(startParticipation(storage,again,{uuid:()=>{throw Error()},now:()=>{throw Error()}}),start);assert.deepEqual(memory,before);
});
test("publication DTO rejects impossible stopped revisions or extra metadata",t=>{
 const f=fixture(t),p=publish(f);for(const v of [{...p,status:"withdrawn"},{...p,changedAt:"2026-11-10T02:00:00.000Z"},{...p,revision:Infinity},{...p,extra:true}])assert.throws(()=>parsePublication(v),reason("unavailable"));
});
