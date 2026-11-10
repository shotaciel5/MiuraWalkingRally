import test from "node:test";import assert from "node:assert/strict";
import {mkdtempSync,mkdirSync,rmSync,readFileSync} from "node:fs";import {resolve,join,sep} from "node:path";import {DatabaseSync} from "node:sqlite";import {execFileSync} from "node:child_process";
import {createDraftRepository} from "../lib/operator/draft-repository.ts";import {createSpotRepository} from "../lib/spots/local-repository.ts";import {getBrowserSpots} from "../lib/spots/browser-catalog.ts";
import {CORRECTION_SOURCE,parseCorrectionInput,decodeCorrections,decodeCorrectionContext,staleCorrections} from "../lib/operator/rally-corrections.ts";import {draftInput,refreshDraftSpots} from "../lib/operator/rally-draft.ts";
import {createRallyPreview} from "../lib/operator/rally-preview.ts";import {getExpandedSegments,roadConnectionForPoint} from "../lib/miura-road-connections.ts";import {distanceMeters} from "../lib/route/graph.ts";
const S="osm-way-384676338",C="osm-way-394752558",M="osm-node-2046962408";
const input=(state,extra={})=>({expectedDraftRevision:state.draft.revision,expectedCorrectionRevision:state.corrections.revision,spotId:S,spotRevision:state.spots.find(s=>s.id===S).revision,sourceHash:CORRECTION_SOURCE.snapshotSha256,mode:"manual",point:{lat:35.141,lon:139.621},...extra});
function fixture(t){
 const parent=resolve(".tools/correction-tests");mkdirSync(parent,{recursive:true});const dir=mkdtempSync(join(parent,"case-"));t.after(()=>{assert.ok(resolve(dir).startsWith(parent+sep));rmSync(dir,{recursive:true,force:true})});
 const path=join(dir,"db.sqlite"),repo=createDraftRepository(path,undefined,()=>"2026-11-09T03:00:00.000Z");
 const state=repo.save({title:"Corrections",expectedRevision:0,start:{id:S,revision:0},finish:{id:S,revision:0},stops:[{kind:"checkpoint",spot:{id:C,revision:0}},{kind:"waypoint",spot:{id:M,revision:0}}]});
 return {dir,path,repo,state,spots:createSpotRepository(path)};
}
test("manual correction input accepts only bounded coordinates and versioned known fields",()=>{
 const base={expectedDraftRevision:1,expectedCorrectionRevision:0,spotId:S,spotRevision:0,sourceHash:CORRECTION_SOURCE.snapshotSha256,mode:"manual",point:{lat:35.14,lon:139.62}};
 assert.deepEqual(parseCorrectionInput(base),base);
 for(const bad of [{...base,published:true},{...base,point:{lat:0,lon:0}},{...base,point:{lat:NaN,lon:139.62}},{...base,point:{lat:35.14,lon:139.62,wayId:10}},{...base,spotId:"bad"},{...base,sourceHash:"bad"},{...base,expectedCorrectionRevision:-1},{...base,expectedDraftRevision:0},{...base,mode:"other"},{...base,mode:"auto"}])assert.throws(()=>parseCorrectionInput(bad));
 const {point,...auto}=base;assert.equal(parseCorrectionInput({...auto,mode:"auto"}).mode,"auto");
});
test("finding a candidate is read only and uses an allowed source segment",t=>{
 const {repo,state,path}=fixture(t),before=readFileSync(path),picked=repo.pickCorrection(input(state));
 assert.equal(picked.corrections.revision,0);assert.deepEqual(repo.load(),state);assert.deepEqual(readFileSync(path),before);
 const s=picked.connection.segment;assert.ok(getExpandedSegments().some(x=>x.wayId===s.wayId&&x.fromNodeId===s.fromNodeId&&x.toNodeId===s.toNodeId));
 assert.equal(picked.pickDistanceMeters,distanceMeters(input(state).point,picked.connection.point));assert.equal(picked.connection.distanceMeters,distanceMeters(state.draft.start.position,picked.connection.point));
});
test("saving changes only draft-specific corrections and survives a separate process",t=>{
 const {repo,state,path}=fixture(t),saved=repo.saveCorrection(input(state));assert.equal(saved.corrections.revision,1);assert.equal(saved.corrections.items.length,1);
 assert.deepEqual(saved.draft,state.draft);assert.deepEqual(saved.spots,state.spots);assert.equal(decodeCorrections(saved.corrections).revision,1);assert.ok(decodeCorrectionContext(saved));
 const code="import {createDraftRepository} from './lib/operator/draft-repository.ts';console.log(JSON.stringify(createDraftRepository("+JSON.stringify(path)+").load()));";
 assert.deepEqual(JSON.parse(execFileSync(process.execPath,["--input-type=module","-e",code],{encoding:"utf8"})),repo.load());
});
test("a shared start/finish receives the same correction and changes the generated path",t=>{
 const {repo,state}=fixture(t),saved=repo.saveCorrection(input(state)),p=createRallyPreview(saved.draft,saved.spots,saved.corrections),old=createRallyPreview(state.draft,state.spots);
 assert.equal(p.state,"ready");assert.equal(p.visits[0].mode,"manual");assert.equal(p.visits.at(-1).mode,"manual");assert.deepEqual(p.visits[0].point,p.visits.at(-1).point);
 assert.deepEqual(p.visits.map(v=>v.spotId),[S,C,M,S]);assert.notEqual(p.meters,old.meters);assert.deepEqual(saved.draft,state.draft);
});
test("reset returns to automatic routing and idempotent retries preserve revision/time",t=>{
 const {repo,state}=fixture(t),first=repo.saveCorrection(input(state));assert.deepEqual(repo.saveCorrection(input(state)).corrections,first.corrections);
 const {point,...reset}=input(first,{mode:"auto"}),r=repo.saveCorrection(reset);assert.equal(r.corrections.revision,2);assert.equal(r.corrections.items.length,0);
 assert.deepEqual(repo.saveCorrection(reset).corrections,r.corrections);const before=createRallyPreview(state.draft,state.spots),after=createRallyPreview(r.draft,r.spots,r.corrections);assert.equal(after.meters,before.meters);
});
test("stale different edits cannot replace another correction; matching retries retain others",t=>{
 const {repo,state}=fixture(t),first=repo.saveCorrection(input(state));
 assert.throws(()=>repo.saveCorrection(input(state,{point:{lat:35.14,lon:139.623}})),e=>e.reason==="correction-conflict");
 assert.throws(()=>repo.pickCorrection(input(state)),e=>e.reason==="correction-conflict");
 const second=repo.saveCorrection(input(first,{spotId:C,spotRevision:0,point:{lat:35.141,lon:139.624}}));
 const retry=repo.saveCorrection(input(state));assert.equal(retry.corrections.revision,second.corrections.revision);assert.equal(retry.corrections.items.length,2);
});
test("draft edits invalidate old requests while title/order changes retain selected corrections",t=>{
 const {repo,state}=fixture(t);const saved=repo.saveCorrection(input(state)),changed=repo.save({...draftInput(saved.draft,1),title:"Renamed",stops:[...draftInput(saved.draft,1).stops].reverse()});
 assert.deepEqual(changed.corrections,saved.corrections);assert.throws(()=>repo.saveCorrection(input(saved)),e=>e.reason==="draft-conflict");
 const next=repo.save({...draftInput(changed.draft,2),start:{id:M,revision:0},finish:{id:M,revision:0}});assert.equal(next.corrections.items.length,0);assert.equal(next.corrections.revision,2);
});
test("spot edits require draft review and an explicit correction reset or reselection",t=>{
 const {repo,state,spots}=fixture(t),saved=repo.saveCorrection(input(state)),s=saved.spots.find(s=>s.id===S);
 spots.save({id:S,expectedRevision:0,name:"Updated",category:s.category,position:{lat:s.position.lat,lon:s.position.lon},description:s.description});
 const old=repo.load();assert.throws(()=>repo.saveCorrection(input(old)),e=>e.reason==="catalog-conflict");
 const refreshed=repo.save(draftInput(refreshDraftSpots(old.draft,old.spots),1));
 assert.equal(staleCorrections(refreshed.draft,refreshed.spots,refreshed.corrections).length,1);
 assert.equal(createRallyPreview(refreshed.draft,refreshed.spots,refreshed.corrections).reason,"correction-stale");
 const {point,...reset}=input(refreshed,{mode:"auto"});const resetState=repo.saveCorrection(reset);assert.equal(createRallyPreview(resetState.draft,resetState.spots,resetState.corrections).state,"ready");
});
test("deleted and nonselected identities cannot be used for corrections",t=>{
 const {repo,state,spots}=fixture(t);
 assert.throws(()=>repo.pickCorrection(input(state,{spotId:"osm-node-1211621029"})),e=>e.reason==="catalog-conflict");
 spots.remove({id:C,expectedRevision:0});assert.throws(()=>repo.saveCorrection(input(state)),e=>e.reason==="catalog-conflict");
});
test("road source mismatch blocks requests and stale saved sources block generation until reset",t=>{
 const {repo,state,path}=fixture(t);assert.throws(()=>repo.saveCorrection(input(state,{sourceHash:"b".repeat(64)})),e=>e.reason==="source-conflict");
 const saved=repo.saveCorrection(input(state)),bad=structuredClone(saved.corrections);bad.items[0].snapshotSha256="b".repeat(64);
 const db=new DatabaseSync(path);db.prepare("UPDATE rally_corrections SET value=?").run(JSON.stringify(bad));db.close();
 const stale=repo.load();assert.equal(createRallyPreview(stale.draft,stale.spots,stale.corrections).reason,"correction-stale");
 const {point,...reset}=input(stale,{mode:"auto"});assert.equal(repo.saveCorrection(reset).corrections.items.length,0);
});
test("version 3 migration preserves the draft, spot edits and tombstones",t=>{
 const {repo,path,state,spots}=fixture(t),s=state.spots.find(s=>s.id===C);
 spots.save({id:C,expectedRevision:0,name:"Edited",category:s.category,position:{lat:s.position.lat,lon:s.position.lon},description:"kept"});spots.remove({id:M,expectedRevision:0});
 const before=repo.load(),db=new DatabaseSync(path);db.exec("DROP TABLE rally_corrections; DROP TABLE saved_courses; DROP TABLE course_publications; PRAGMA user_version=3");db.close();
 const migrated=repo.load();assert.deepEqual(migrated,before);const check=new DatabaseSync(path);assert.equal(check.prepare("PRAGMA user_version").get().user_version,7);assert.equal(check.prepare("SELECT count(*) AS n FROM rally_corrections").get().n,0);check.close();
});
test("failed migration rolls back and missing/corrupt correction data is never reset",t=>{
 const {repo,path,state}=fixture(t);let db=new DatabaseSync(path);db.exec("DROP TABLE rally_corrections; DROP TABLE saved_courses; DROP TABLE course_publications; CREATE TABLE rally_corrections(note TEXT); INSERT INTO rally_corrections VALUES ('keep'); PRAGMA user_version=3");db.close();
 assert.throws(()=>repo.load());db=new DatabaseSync(path);assert.equal(db.prepare("PRAGMA user_version").get().user_version,3);assert.equal(db.prepare("SELECT note FROM rally_corrections").get().note,"keep");db.exec("DROP TABLE rally_corrections");db.close();
 const now=repo.load();repo.saveCorrection(input(now));db=new DatabaseSync(path);db.exec("UPDATE rally_corrections SET value='{bad'");db.close();
 assert.throws(()=>repo.load());assert.throws(()=>repo.save(draftInput(state.draft,1)));
 db=new DatabaseSync(path);assert.equal(db.prepare("SELECT value FROM rally_corrections").get().value,"{bad");db.exec("DROP TABLE rally_corrections");db.close();assert.throws(()=>repo.load());
});
test("locked saves do not succeed and may be retried without a duplicate record",t=>{
 const {repo,state,path}=fixture(t),db=new DatabaseSync(path);db.exec("BEGIN EXCLUSIVE");
 try{assert.throws(()=>repo.saveCorrection(input(state)))}finally{db.exec("ROLLBACK");db.close()}
 assert.equal(repo.load().corrections.revision,0);assert.equal(repo.saveCorrection(input(state)).corrections.revision,1);
});
test("manual projection keeps walking rules and reference distances separate",()=>{
 const seed=getBrowserSpots(),spot={...seed[0],description:"",revision:0,updatedAt:null},point={lat:35.142,lon:139.625},c=roadConnectionForPoint(spot,point);
 assert.ok(c);assert.equal(c.distanceMeters,distanceMeters(spot.position,c.point));assert.deepEqual(c.facility,{lat:spot.position.lat,lon:spot.position.lon});
 const allowed=getExpandedSegments();assert.ok(allowed.some(s=>s.wayId===c.segment.wayId&&s.fromNodeId===c.segment.fromNodeId&&s.toNodeId===c.segment.toNodeId));
});

test("geometrically valid but foreign stored source roads fail closed without discarding data",t=>{
 const {repo,state,path}=fixture(t),saved=repo.saveCorrection(input(state)),bad=structuredClone(saved.corrections);
 bad.items[0].segment.wayId=999999999999;const value=JSON.stringify(bad),db=new DatabaseSync(path);db.prepare("UPDATE rally_corrections SET value=?").run(value);db.close();
 assert.throws(()=>repo.load(),e=>e.reason==="unavailable");const check=new DatabaseSync(path);assert.equal(check.prepare("SELECT value FROM rally_corrections").get().value,value);check.close();
});
