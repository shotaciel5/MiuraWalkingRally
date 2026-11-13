import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {getBundledLandmarks} from "../lib/landmarks/bundled.ts";
import {createLandmarkStorage,createBundledLandmarkStorage} from "../lib/landmarks/storage.ts";
import {loadLandmarkDataset,landmarkDatasetFromPreview} from "../lib/landmarks/dataset.ts";
import {workbenchState} from "../lib/landmarks/workbench.ts";
import {photoSuggestions,runLandmarkPreparation} from "../lib/landmarks/preparation.ts";
import {demoCourses,seedDemoData} from "../lib/demo/seed.ts";
import {createCourseRepository,courseFingerprint} from "../lib/operator/course-repository.ts";
import {createPublicationRepository} from "../lib/operator/publication-repository.ts";
import {createDraftRepository} from "../lib/operator/draft-repository.ts";
import {draftInput} from "../lib/operator/rally-draft.ts";
import {createSpotRepository} from "../lib/spots/local-repository.ts";
import {openOperatorDatabase} from "../lib/operator/local-database.ts";
const bundle=getBundledLandmarks(),courses=demoCourses();
function temporary(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),"miura-bundle-test-"));t.after(()=>{assert.equal(path.dirname(path.resolve(root)),path.resolve(os.tmpdir()));assert.ok(path.basename(root).startsWith("miura-bundle-test-"));fs.rmSync(root,{recursive:true,force:true})});return root}
const sha=p=>createHash("sha256").update(fs.readFileSync(p)).digest("hex");
test("shipped image files match their provenance manifest and remain a small finite bundle",()=>{
 assert.equal(bundle.version,1);assert.equal(bundle.targets.length,1326);assert.ok(bundle.photos.length>=9);
 let bytes=0;for(const photo of bundle.photos){assert.match(photo.path,/^\/landmarks\/miura-v1\/[a-f0-9]{64}\.png$/);const p=path.join("public",photo.path.slice(1));assert.equal(sha(p),photo.sha256);assert.equal(fs.statSync(p).size,photo.bytes);assert.ok(photo.asset.creator);assert.equal(photo.asset.policyVersion,2);assert.ok(photo.asset.roi.width>0&&photo.asset.roi.height>0);bytes+=photo.bytes}
 assert.ok(bytes<100000000);const json=fs.readFileSync("public/landmarks/miura-v1/manifest.json","utf8");assert.match(json,/opendatacommons.org/);assert.match(json,/creativecommons.org/);assert.doesNotMatch(json,/MLY\||access_token|thumb_1024_url|fbcdn|[A-Z]:\\\\/);
 assert.equal(new Set(bundle.targets.map(t=>t.key)).size,bundle.targets.length);assert.equal(new Set(bundle.photos.map(p=>p.asset.featureId)).size,bundle.photos.length);
});
test("read-only bundled fallback survives cache expiry without creating local files",t=>{
 const root=path.join(temporary(t),"absent"),store=createLandmarkStorage(root,bundle),target=bundle.targets[0],photo=bundle.photos[0],before=JSON.stringify(bundle),now=Date.now;
 Date.now=()=>now()+30*86400000;try{assert.deepEqual(store.target(target.key),target);assert.deepEqual(store.asset(photo.asset.featureId),photo.asset);assert.equal(store.image(photo.asset.featureId).path,photo.path)}finally{Date.now=now}
 const mutable=store.target(target.key);mutable.candidates.length=0;assert.equal(JSON.stringify(bundle),before);assert.equal(fs.existsSync(root),false);
});
test("fresh writable results override demo data; expired results fall back and corrupt results stay errors",t=>{
 const root=temporary(t),store=createLandmarkStorage(root,bundle),entry=structuredClone(bundle.targets[0]);entry.fetchedAt=new Date().toISOString();entry.candidates=[];store.saveTarget(entry);assert.deepEqual(store.target(entry.key),entry);
 entry.fetchedAt="2000-01-01T00:00:00.000Z";store.saveTarget(entry);assert.deepEqual(store.target(entry.key),bundle.targets[0]);
 const photo=bundle.photos[0],meta={...photo.asset,imageId:"987654321",fetchedAt:new Date().toISOString()};store.saveAsset(meta,Buffer.from([255,216,...Array(20).fill(0)]));assert.equal(store.asset(meta.featureId).imageId,"987654321");assert.ok("bytes" in store.image(meta.featureId));
 fs.writeFileSync(path.join(root,"target-"+entry.key+".json"),"{broken");assert.throws(()=>store.target(entry.key),/unreadable/);
 assert.equal(createLandmarkStorage(path.join(root,"no-bundle")).target(bundle.targets[0].key),null);
});
test("fixed sample and both bundled course routes have offline targets and real photo suggestions",async t=>{
 const root=path.join(temporary(t),"absent"),store=createBundledLandmarkStorage(root);
 for(const dataset of [loadLandmarkDataset("sample"),...courses.map(c=>landmarkDatasetFromPreview(c.payload.preview))]){
  const initial=workbenchState(dataset,store);assert.equal(Object.keys(initial.targets).length,dataset.targets.length);assert.ok(photoSuggestions(initial).length>=3);
  const result=await runLandmarkPreparation({initial,target:async()=>{throw Error("No external request allowed")},photo:async()=>{throw Error("No external request allowed")}});assert.deepEqual(result.report.errors,[]);assert.equal(result.report.photoRequests,0);
 }
 assert.equal(fs.existsSync(root),false);
});
test("explicit demo import seeds two published courses and one working draft without changing format",t=>{
 const p=path.join(temporary(t),"operator.sqlite"),r=seedDemoData(p),repo=createCourseRepository(p),publications=createPublicationRepository(p);
 assert.equal(r.added.length,2);assert.equal(r.draft,"added");assert.deepEqual(repo.list().map(c=>c.cards).sort((a,b)=>a-b),[29,39]);assert.equal(publications.list().length,2);assert.equal(createDraftRepository(p).load().draft.title,courses[0].payload.input.draft.title);
 const db=openOperatorDatabase(p);try{assert.equal(Number(db.prepare("PRAGMA user_version").get().user_version),8)}finally{db.close()}
});
test("reimport is idempotent and preserves withdrawal, operator edits and a different working draft",t=>{
 const p=path.join(temporary(t),"operator.sqlite");seedDemoData(p);const publications=createPublicationRepository(p),first=courses[0];publications.unpublish({courseId:first.id,fingerprint:first.fingerprint,expectedRevision:1});
 const drafts=createDraftRepository(p),before=drafts.load();drafts.save({...draftInput(before.draft,before.draft.revision),title:"運営者の作業を保持"});createSpotRepository(p).remove({id:first.payload.input.draft.stops[0].spot.id,expectedRevision:0});
 const hash=sha(p),result=seedDemoData(p);assert.equal(result.added.length,0);assert.equal(result.existing.length,2);assert.equal(result.draft,"preserved");assert.equal(sha(p),hash);assert.equal(publications.list().length,1);assert.equal(publications.get(first.id).publication.status,"withdrawn");assert.equal(drafts.load().draft.title,"運営者の作業を保持");
});
test("a changed catalog does not receive a stale initial working draft",t=>{
 const p=path.join(temporary(t),"operator.sqlite");createSpotRepository(p).remove({id:courses[0].payload.input.draft.start.id,expectedRevision:0});const result=seedDemoData(p);assert.equal(result.added.length,2);assert.equal(result.draft,"catalog-changed");assert.equal(createDraftRepository(p).load().draft,null);
});
test("conflicting fixed IDs roll back the entire import instead of partially publishing",t=>{
 const p=path.join(temporary(t),"operator.sqlite"),other=structuredClone(courses[1]);other.payload.input.draft.title="different";other.payload.preview.title="different";other.fingerprint=courseFingerprint(other.payload);
 const db=openOperatorDatabase(p);try{db.prepare("INSERT INTO saved_courses(id,fingerprint,value) VALUES(?,?,?)").run(other.id,other.fingerprint,JSON.stringify(other))}finally{db.close()}
 assert.throws(()=>seedDemoData(p),/conflict/);assert.equal(createCourseRepository(p).list().length,1);assert.equal(createPublicationRepository(p).list().length,0);assert.equal(createDraftRepository(p).load().draft,null);
});
test("the seed CLI works in a tokenless process and can be repeated without duplicates",t=>{
 const p=path.join(temporary(t),"operator.sqlite"),env={...process.env,SPOT_DB_PATH:p,MAPILLARY_ACCESS_TOKEN:""};const run=()=>JSON.parse(execFileSync(process.execPath,["scripts/seed-demo.mjs"],{env,encoding:"utf8"}));
 assert.equal(run().added.length,2);assert.equal(run().added.length,0);assert.equal(createCourseRepository(p).list().length,2);
});
