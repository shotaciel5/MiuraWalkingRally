import test from "node:test";import assert from "node:assert/strict";import fs from "node:fs";import path from "node:path";import os from "node:os";
import {createDraftRepository} from "../lib/operator/draft-repository.ts";
import {createRallyPreview} from "../lib/operator/rally-preview.ts";
import {createCourseService,prepareCourseSave} from "../lib/operator/course-save.ts";
import {createCourseRepository,courseFingerprint} from "../lib/operator/course-repository.ts";
import {parseCoursePayload,parseSavedCourse,canonicalJson} from "../lib/operator/course-format.ts";
import {createPublicationRepository} from "../lib/operator/publication-repository.ts";
import {projectPublishedCourse} from "../lib/published-course.ts";
import {createBundledLandmarkStorage} from "../lib/landmarks/storage.ts";
import {landmarkDatasetFromPreview} from "../lib/landmarks/dataset.ts";
import {workbenchState} from "../lib/landmarks/workbench.ts";
import {freezeLandmarks,parseLandmarkSnapshot} from "../lib/landmarks/course-snapshot.ts";
import {candidatesForCard,choiceKey,layoutCandidates,projectCandidate} from "../lib/landmarks/model.ts";
function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"miura-course-landmarks-"));t.after(()=>{assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));assert.ok(path.basename(dir).startsWith("miura-course-landmarks-"));fs.rmSync(dir,{recursive:true,force:true})});
 const db=path.join(dir,"operator.sqlite"),drafts=createDraftRepository(db),storage=createBundledLandmarkStorage(path.join(dir,"reviews"));
 drafts.save({title:"写真付きコース",expectedRevision:0,start:{id:"osm-way-384676338",revision:0},finish:{id:"osm-way-384676338",revision:0},stops:[{kind:"checkpoint",spot:{id:"osm-way-394752558",revision:0}},{kind:"checkpoint",spot:{id:"osm-node-2046962408",revision:0}}]});
 const context=drafts.load(),preview=createRallyPreview(context.draft,context.spots,context.corrections);assert.equal(preview.state,"ready");const dataset=landmarkDatasetFromPreview(preview);
 const state=()=>workbenchState(dataset,storage);let photo;
 for(const card of dataset.cards){const target=dataset.targets.find(t=>t.sequences.includes(card.map.sequence));for(const c of candidatesForCard(card,state().targets[target.key]))if(c.kind==="unique"&&card.map.state==="ready"&&layoutCandidates(card,[c]).placed.length){photo={card,c};break}if(photo)break}assert.ok(photo);
 const select=value=>{const r=storage.review(dataset.id);return storage.saveReview(dataset.id,r.revision,{[choiceKey(photo.card.map.sequence,photo.c.id)]:value})};
 const prepared=()=>prepareCourseSave(context,preview,freezeLandmarks(state())),service=createCourseService(db,{landmarks:true,landmarkStorage:storage}),courses=createCourseRepository(db);
 return {dir,db,drafts,storage,context,preview,dataset,state,photo,select,prepared,service,courses};
}
test("v2 stores selected photos, source metadata and default symbols as an immutable course",t=>{
 const f=fixture(t);f.select(true);const before=canonicalJson(f.state()),p=f.prepared(),saved=f.service.save(p.receipt);assert.equal(saved.payload.formatVersion,2);assert.equal(p.receipt.formatVersion,2);assert.ok(saved.payload.landmarks.photos[f.photo.c.id.slice(10)].crop);assert.ok(saved.payload.landmarks.cards[f.photo.card.map.sequence-1].candidates.some(c=>c.id===f.photo.c.id));assert.equal(canonicalJson(f.state()),before);
 assert.deepEqual(f.courses.get(saved.id),saved);assert.deepEqual(parseSavedCourse(JSON.parse(canonicalJson(saved))),saved);
 const publications=createPublicationRepository(f.db);publications.publish({courseId:saved.id,fingerprint:saved.fingerprint,expectedRevision:0});const pub=publications.get(saved.id),projected=projectPublishedCourse(pub.course,pub.publication);assert.deepEqual(projected.landmarks,saved.payload.landmarks);assert.deepEqual(projected.centers,f.preview.cards.map(c=>c.candidate.point));
});
test("saved and published photos do not follow later review changes",t=>{
 const f=fixture(t);f.select(true);const saved=f.service.save(f.prepared().receipt);f.select(false);const later=f.prepared();assert.notEqual(later.receipt.fingerprint,saved.fingerprint);assert.ok(f.courses.get(saved.id).payload.landmarks.photos[f.photo.c.id.slice(10)]);const second=f.service.save(later.receipt);assert.equal(Object.keys(second.payload.landmarks.photos).length,0);assert.equal(f.courses.list().length,2);
});
test("identical visual choices retry the same record even if review revision increases",t=>{
 const f=fixture(t);f.select(true);const first=f.prepared(),saved=f.service.save(first.receipt);f.select(true);const next=f.prepared();assert.equal(next.receipt.fingerprint,first.receipt.fingerprint);assert.equal(f.service.save(next.receipt).id,saved.id);assert.equal(f.courses.list().length,1);
});
test("an existing saved result can replay without current catalog, renderer or review",t=>{
 const f=fixture(t);f.select(true);const p=f.prepared(),saved=f.service.save(p.receipt);const unavailable=createCourseService(f.db,{landmarks:true,landmarkStorage:{...f.storage,review:()=>{throw Error("must not read review")}},loadInitial:()=>{throw Error("must not read catalog")},generate:()=>{throw Error("must not generate")}});assert.deepEqual(unavailable.save(p.receipt),saved);
});
test("stale displayed adoption is rejected before saving a course",t=>{
 const f=fixture(t);const before=f.prepared();f.select(true);assert.throws(()=>f.service.save(before.receipt),e=>e.reason==="conflict");assert.equal(f.courses.list().length,0);
});
test("adoption changed during final verification rolls the course transaction back",t=>{
 const f=fixture(t);const prepared=f.prepared();let reads=0;const changing={...f.storage,review:id=>{if(++reads===2)f.select(true);return f.storage.review(id)}},service=createCourseService(f.db,{landmarks:true,landmarkStorage:changing});assert.throws(()=>service.save(prepared.receipt),e=>e.reason==="conflict");assert.equal(f.courses.list().length,0);
});
test("legacy v1 payloads remain readable without gaining current landmark defaults",t=>{
 const f=fixture(t),p=prepareCourseSave(f.context,f.preview),legacy=createCourseService(f.db).save(p.receipt),before=canonicalJson(legacy);assert.equal(legacy.payload.formatVersion,1);f.select(true);assert.equal(canonicalJson(f.courses.get(legacy.id)),before);assert.equal(projectPublishedCourse(legacy,{courseId:legacy.id,fingerprint:legacy.fingerprint,publishedAt:legacy.createdAt,changedAt:legacy.createdAt,status:"published",revision:1}).landmarks,undefined);
});
test("snapshot parsing rejects missing, foreign, duplicated or externally hosted photo references",t=>{
 const f=fixture(t);f.select(true);const p=f.prepared().payload;
 const mutate=fn=>{const c=structuredClone(p);fn(c.landmarks);assert.throws(()=>parseCoursePayload(c))};
 mutate(s=>{delete s.photos[f.photo.c.id.slice(10)]});mutate(s=>{s.photos[f.photo.c.id.slice(10)].crop.path="https://example.com/photo.png"});mutate(s=>{s.photos[f.photo.c.id.slice(10)].crop.sha256="0".repeat(64)});mutate(s=>{s.cards[f.photo.card.map.sequence-1].candidates.push({...f.photo.c})});mutate(s=>{s.cards[f.photo.card.map.sequence-1].candidates.find(c=>c.id===f.photo.c.id).point={lat:0,lon:0}});mutate(s=>{s.source.hash="not-a-hash"});mutate(s=>{s.photos["123"]=s.photos[f.photo.c.id.slice(10)]});
 assert.equal(courseFingerprint(parseCoursePayload(p)),courseFingerprint(p));
});
test("expanded marker projection scales original coordinates and omits out-of-view symbols",t=>{
 const f=fixture(t),card=f.photo.card,c=f.photo.c,a=projectCandidate(card,c),b=projectCandidate(card,c,2);assert.ok(Math.abs(b.x-(150+(a.x-150)*2))<.002);assert.ok(Math.abs(b.y-(140+(a.y-140)*2))<.002);const layout=layoutCandidates(card,[c],card.map.branches,100);assert.equal(layout.placed.length,0);assert.equal(layout.unplaced.length,1);
});
