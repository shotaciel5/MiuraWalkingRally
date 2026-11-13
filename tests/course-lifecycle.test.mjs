import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {DatabaseSync} from "node:sqlite";
import {createDraftRepository} from "../lib/operator/draft-repository.ts";
import {draftInput} from "../lib/operator/rally-draft.ts";
import {createCourseService,prepareCourseSave} from "../lib/operator/course-save.ts";
import {createCourseRepository} from "../lib/operator/course-repository.ts";
import {createCourseDeletionRepository} from "../lib/operator/course-deletion-repository.ts";
import {parseCourseDeleteInput} from "../lib/operator/course-deletion.ts";
import {createPublicationRepository} from "../lib/operator/publication-repository.ts";
import {createRallyPreview} from "../lib/operator/rally-preview.ts";
import {CORRECTION_SOURCE} from "../lib/operator/rally-corrections.ts";
import {walkingMinutes,WALKING_SPEED_KMH} from "../lib/walking-estimate.ts";
import {publishedSummary} from "../lib/published-course.ts";
import {seedDemoData,demoCourses} from "../lib/demo/seed.ts";
const S="osm-way-384676338",C="osm-way-394752558";
const reason=code=>e=>e.reason===code;
function fixture(t){
 const parent=path.resolve(".tools/lifecycle-tests");fs.mkdirSync(parent,{recursive:true});
 const dir=fs.mkdtempSync(path.join(parent,"case-"));t.after(()=>{assert.ok(path.resolve(dir).startsWith(parent+path.sep));fs.rmSync(dir,{recursive:true,force:true})});
 const dbPath=path.join(dir,"db.sqlite"),drafts=createDraftRepository(dbPath),courses=createCourseRepository(dbPath),service=createCourseService(dbPath),publisher=createPublicationRepository(dbPath),deletions=createCourseDeletionRepository(dbPath);
 const state=drafts.save({expectedRevision:0,title:"運用検証",start:{id:S,revision:0},finish:{id:S,revision:0},stops:[{kind:"checkpoint",spot:{id:C,revision:0}}]});
 const prepare=()=>{const c=drafts.load();return prepareCourseSave(c,createRallyPreview(c.draft,c.spots,c.corrections))};
 return {dbPath,drafts,courses,service,publisher,deletions,state,prepare};
}
const delInput=(course,revision=0)=>({courseId:course.id,fingerprint:course.fingerprint,expectedPublicationRevision:revision});

test("saving a course atomically clears its working fields and manual arrivals",t=>{
 const f=fixture(t);
 f.drafts.saveCorrection({expectedDraftRevision:1,expectedCorrectionRevision:0,spotId:S,spotRevision:0,sourceHash:CORRECTION_SOURCE.snapshotSha256,mode:"manual",point:{lat:35.141,lon:139.621}});
 const p=f.prepare(),saved=f.service.save(p.receipt),after=f.drafts.load();
 assert.equal(after.draft,null);assert.deepEqual(after.corrections.items,[]);
 assert.equal(saved.payload.input.corrections.items.length,1);
 assert.deepEqual(f.courses.get(saved.id),saved);
 assert.deepEqual(f.service.save(p.receipt),saved);assert.equal(f.courses.list().length,1);assert.equal(f.drafts.load().draft,null);
});
test("a stale course-save retry never clears a newer working draft and revisions do not repeat",t=>{
 const f=fixture(t),p=f.prepare(),saved=f.service.save(p.receipt);
 const next=f.drafts.save({...draftInput(f.state.draft,0),title:"次のコース"});
 assert.ok(next.draft.revision>f.state.draft.revision);
 assert.deepEqual(f.service.save(p.receipt),saved);assert.deepEqual(f.drafts.load().draft,next.draft);
 assert.throws(()=>f.drafts.save({...draftInput(f.state.draft,1),title:"古い画面"}),e=>e.reason==="draft-conflict");
});
test("clear failures roll back the new course and preserve the draft",t=>{
 const f=fixture(t),p=f.prepare(),db=new DatabaseSync(f.dbPath);
 db.exec("CREATE TRIGGER block_clear BEFORE DELETE ON rally_draft BEGIN SELECT RAISE(ABORT,'test clear failure'); END;");db.close();
 assert.throws(()=>f.service.save(p.receipt));assert.equal(f.courses.list().length,0);assert.deepEqual(f.drafts.load().draft,f.state.draft);
});
test("rejected saves retain the current working input",t=>{
 const f=fixture(t),p=f.prepare();assert.throws(()=>f.service.save({...p.receipt,fingerprint:"b".repeat(64)}),reason("conflict"));
 assert.deepEqual(f.drafts.load().draft,f.state.draft);assert.equal(f.courses.list().length,0);
});
test("published deletion atomically removes public and operator access and is idempotent",t=>{
 const f=fixture(t),saved=f.service.save(f.prepare().receipt),pub=f.publisher.publish({courseId:saved.id,fingerprint:saved.fingerprint,expectedRevision:0});
 const input=delInput(saved,pub.revision),deleted=f.deletions.remove(input);
 assert.equal(deleted.courseId,saved.id);assert.equal(deleted.publicationRevision,pub.revision);
 assert.equal(f.courses.get(saved.id),null);assert.deepEqual(f.courses.list(),[]);assert.equal(f.publisher.get(saved.id),null);assert.deepEqual(f.publisher.list(),[]);
 assert.deepEqual(f.deletions.remove(input),deleted);
 assert.throws(()=>f.publisher.publish({courseId:saved.id,fingerprint:saved.fingerprint,expectedRevision:0}),reason("missing"));
 const db=new DatabaseSync(f.dbPath);assert.equal(db.prepare("SELECT count(*) n FROM course_deletions").get().n,1);db.close();
});
test("deletion leaves other courses and the current new draft intact; the same content can be stored again",t=>{
 const f=fixture(t),first=f.service.save(f.prepare().receipt);
 const next=f.drafts.save({...draftInput(f.state.draft,0),title:"別コース"});
 const second=f.service.save(f.prepare().receipt);
 const working=f.drafts.save({...draftInput(next.draft,0),title:"作業を続ける"});
 f.deletions.remove(delInput(first));assert.deepEqual(f.courses.get(second.id),second);assert.deepEqual(f.drafts.load().draft,working.draft);
 const again=f.courses.store(first.payload,()=>{});assert.notEqual(again.id,first.id);assert.equal(again.fingerprint,first.fingerprint);
 f.deletions.remove(delInput(first));assert.deepEqual(f.courses.get(again.id),again);
});
test("wrong identities or concurrently changed publication revisions cannot delete",t=>{
 const f=fixture(t),saved=f.service.save(f.prepare().receipt);
 assert.throws(()=>f.deletions.remove({...delInput(saved),fingerprint:"a".repeat(64)}),reason("conflict"));
 f.publisher.publish({courseId:saved.id,fingerprint:saved.fingerprint,expectedRevision:0});
 assert.throws(()=>f.deletions.remove(delInput(saved)),reason("conflict"));
 assert.ok(f.courses.get(saved.id));assert.equal(f.publisher.list().length,1);
 for(const value of [null,{},delInput({...saved,id:"../bad"}),{...delInput(saved),expectedPublicationRevision:-1},{...delInput(saved),extra:true}])assert.throws(()=>parseCourseDeleteInput(value),reason("invalid"));
});
test("failed deletion rolls back public access and leaves no deletion record",t=>{
 const f=fixture(t),saved=f.service.save(f.prepare().receipt),pub=f.publisher.publish({courseId:saved.id,fingerprint:saved.fingerprint,expectedRevision:0});
 const db=new DatabaseSync(f.dbPath);db.exec("CREATE TRIGGER block_delete BEFORE DELETE ON saved_courses BEGIN SELECT RAISE(ABORT,'test delete failure'); END;");db.close();
 assert.throws(()=>f.deletions.remove(delInput(saved,pub.revision)));assert.deepEqual(f.courses.get(saved.id),saved);assert.equal(f.publisher.list().length,1);
 const check=new DatabaseSync(f.dbPath);assert.equal(check.prepare("SELECT count(*) n FROM course_deletions").get().n,0);check.close();
});
test("3 km/h estimates change time but retain old saved geometry and payload",t=>{
 const f=fixture(t),modern=f.prepare();assert.equal(modern.payload.preview.speedKmh,3);assert.equal(WALKING_SPEED_KMH,3);assert.equal(walkingMinutes(3000),60);
 const old=createRallyPreview(f.state.draft,f.state.spots,f.state.corrections,{speedKmh:4});
 const oldPayload=prepareCourseSave(f.state,old).payload,saved=f.courses.store(oldPayload,()=>{}),before=structuredClone(saved);
 const pub=f.publisher.publish({courseId:saved.id,fingerprint:saved.fingerprint,expectedRevision:0}),summary=publishedSummary(saved,pub);
 assert.equal(summary.walkingMinutes,Math.ceil(walkingMinutes(old.meters)));assert.deepEqual(f.courses.get(saved.id),before);
 assert.deepEqual(old.path,modern.payload.preview.path);assert.deepEqual(old.cards,modern.payload.preview.cards);
 for(const bad of [NaN,Infinity,-1])assert.throws(()=>walkingMinutes(bad));
});
test("v7 databases migrate without replacing saved or working data",t=>{
 const f=fixture(t),before=f.drafts.load(),db=new DatabaseSync(f.dbPath);
 db.exec("DROP TABLE course_deletions; DROP TABLE working_draft_state; PRAGMA user_version=7;");db.close();
 assert.deepEqual(f.drafts.load(),before);const check=new DatabaseSync(f.dbPath);assert.equal(check.prepare("PRAGMA user_version").get().user_version,8);check.close();
});
test("explicit demo seeding preserves deletion and a cleared working draft",t=>{
 const f=fixture(t);seedDemoData(f.dbPath);const demo=demoCourses()[0],pub=f.publisher.get(demo.id).publication;
 f.deletions.remove(delInput(demo,pub.revision));f.service.save(f.prepare().receipt);
 seedDemoData(f.dbPath);assert.equal(f.courses.get(demo.id),null);assert.equal(f.drafts.load().draft,null);
});
