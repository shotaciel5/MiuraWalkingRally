import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import cp from "node:child_process";
import {fileURLToPath} from "node:url";
import {stairTicks} from "../lib/route/stairs.ts";
import {photoPreparationPlan,photoSuggestions,runLandmarkPreparation,needsPreparation} from "../lib/landmarks/preparation.ts";
import {loadLandmarkDataset,landmarkDatasetFromPreview} from "../lib/landmarks/dataset.ts";
import {createLandmarkStorage} from "../lib/landmarks/storage.ts";
import {createMapillaryClient} from "../lib/landmarks/mapillary.ts";
import {operateWorkbench,workbenchState} from "../lib/landmarks/workbench.ts";
import {getBrowserSpots} from "../lib/spots/browser-catalog.ts";
import {mergeSpotEdits} from "../lib/spots/editing.ts";
import {createDraftRepository} from "../lib/operator/draft-repository.ts";
import {createRallyPreview} from "../lib/operator/rally-preview.ts";
const sample=loadLandmarkDataset("sample"),now="2026-11-12T00:00:00.000Z";
const feature=(i,point)=>({id:"mapillary:"+i,provider:"mapillary",kind:"unique",symbol:"sign",label:"店舗看板",point,classification:"object--sign--store",sourceUrl:"https://www.mapillary.com/",note:"test"});
const asset=id=>({version:1,policyVersion:2,featureId:id,imageId:"789",creator:"tester",capturedAt:1,fetchedAt:now,roi:{left:10,top:10,width:30,height:20},contentType:"image/jpeg"});
function state(count=24){
 const cards=[],targets=[],caches={};
 for(let i=0;i<count;i++){const point={lat:35.14+i*.001,lon:139.62},key=i.toString(16).padStart(64,"0"),target={key,point,sequences:[i+1],approaches:[1]};cards.push({...structuredClone(sample.cards[0]),map:{...structuredClone(sample.cards[0].map),sequence:i+1},center:point,osm:[]});targets.push(target);caches[key]={version:1,key,point,fetchedAt:now,partial:false,candidates:[feature(100+i,point)]}}
 return {dataset:{id:"a".repeat(64),source:"draft",title:"any route",cards,targets},targets:caches,assets:{},photoFailures:{}};
}
function temporary(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),"miura-preparation-test-"));t.after(()=>{assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));assert.ok(path.basename(dir).startsWith("miura-preparation-test-"));fs.rmSync(dir,{recursive:true,force:true})});return dir}
test("mandatory stairs retain even short recorded segments; ordinary rendering remains unchanged",()=>{
 const steps=[{from:{x:10,y:10},to:{x:10,y:11},wayIds:[123]},{from:{x:20,y:10},to:{x:20,y:31},wayIds:[456]}];
 const ordinary=stairTicks(steps),mandatory=stairTicks(steps,true);assert.equal(ordinary.length,3);assert.equal(mandatory.length,5);assert.deepEqual(mandatory.filter(t=>t.wayIds[0]===123).map(t=>[t.x1,t.x2]),[[5,15],[5,15]]);
 assert.equal(stairTicks([{from:{x:0,y:0},to:{x:0,y:0},wayIds:[1]}],true).length,0);
 for(const tick of mandatory){assert.ok(Object.values(tick).filter(v=>typeof v==="number").every(Number.isFinite));assert.equal(tick.y1,tick.y2)}
});
test("mandatory stair symbols do not change the original steps or road geometry",()=>{
 const card=sample.cards.find(c=>c.context.steps.length),before=structuredClone(card);assert.ok(card);const ticks=stairTicks(card.context.steps,true);assert.ok(ticks.length>0);assert.deepEqual(card,before);assert.ok(ticks.every(t=>card.context.steps.some(s=>s.wayIds.join(",")===t.wayIds.join(","))));
});
test("photo planning is deterministic, deduplicated and spread across the generated route",()=>{
 const input=state(),before=structuredClone(input),plan=photoPreparationPlan(input);assert.equal(plan.length,8);assert.equal(new Set(plan.map(c=>c.id)).size,8);assert.equal(plan[0].id,"mapillary:100");assert.equal(plan[1].id,"mapillary:123");
 const reverse=structuredClone(input);for(const cache of Object.values(reverse.targets))cache.candidates.reverse();assert.deepEqual(photoPreparationPlan(reverse),plan);assert.deepEqual(input,before);
});
test("off-card and unknown-position photo objects never become gallery suggestions",()=>{
 const input=state(1),target=input.dataset.targets[0],outside=feature(999,{lat:0,lon:0});input.targets[target.key].candidates.push(outside);input.assets["999"]=asset("999");assert.equal(photoPreparationPlan(input).length,1);assert.deepEqual(photoSuggestions(input),[]);
 input.assets["100"]=asset("100");assert.deepEqual(photoSuggestions(input).map(p=>p.sequences),[[1]]);
});
test("automatic preparation obtains a bounded set of photos without accepting them",async()=>{
 const input=state(),seen=[];const result=await runLandmarkPreparation({initial:input,target:async()=>{throw Error("already cached")},photo:async id=>{seen.push(id);input.assets[id.slice(10)]=asset(id.slice(10));return input}});
 assert.equal(seen.length,3);assert.equal(result.report.readyPhotos,3);assert.equal(result.report.photoRequests,3);assert.equal(needsPreparation(result.state),false);assert.ok(!("choices" in result.state));
 const second=await runLandmarkPreparation({initial:result.state,target:async()=>{throw Error("no API")},photo:async()=>{throw Error("no API")}});assert.equal(second.report.photoRequests,0);
});
test("a longer route resumes missing targets after the first twenty",async()=>{
 const input=state(24),known=input.targets;input.targets={};const seen=[],target=async key=>{seen.push(key);input.targets[key]=known[key];return input},photo=async id=>{input.photoFailures[id.slice(10)]={version:1,policyVersion:2,featureId:id.slice(10),fetchedAt:now,code:"no-usable-photo"};return input};
 const first=await runLandmarkPreparation({initial:input,target,photo});assert.equal(first.report.preparedTargets,20);assert.equal(first.report.remainingTargets,4);
 const second=await runLandmarkPreparation({initial:input,target,photo});assert.equal(second.report.remainingTargets,0);assert.equal(seen.length,24);assert.equal(new Set(seen).size,24);
});
test("quality failures are reused without continuously trying more candidates",async()=>{
 const input=state();let calls=0;const photo=async id=>{calls++;input.photoFailures[id.slice(10)]={version:1,policyVersion:2,featureId:id.slice(10),fetchedAt:now,code:"no-usable-photo"};return input};
 const first=await runLandmarkPreparation({initial:input,target:async()=>input,photo});assert.equal(calls,8);assert.equal(first.report.qualityMisses,8);assert.equal(first.report.readyPhotos,0);
 await runLandmarkPreparation({initial:input,target:async()=>{throw Error("no query")},photo});assert.equal(calls,8);assert.equal(needsPreparation(input),false);
});
test("stopping preparation keeps a completed target and does not start photos",async()=>{
 const input=state(4),known=input.targets;input.targets={};let stopped=false,photos=0;
 const result=await runLandmarkPreparation({initial:input,shouldStop:()=>stopped,target:async key=>{input.targets[key]=known[key];stopped=true;return input},photo:async()=>{photos++;return input}});
 assert.equal(result.report.stopped,true);assert.equal(result.report.preparedTargets,1);assert.equal(photos,0);
});
test("authorization failures stop the queue and retain available local results",async()=>{
 const input=state(4);input.targets={};let calls=0;
 const result=await runLandmarkPreparation({initial:input,target:async()=>{calls++;throw Object.assign(Error("hidden"),{code:"authorization"})},photo:async()=>{throw Error("must not run")}});
 assert.equal(calls,1);assert.equal(result.report.errors[0].code,"authorization");assert.equal(result.report.remainingTargets,4);
});
test("a response for another route does not replace current workbench state",async()=>{
 const input=state(1);input.targets={};const wrong=state(1);wrong.dataset.id="b".repeat(64);
 const result=await runLandmarkPreparation({initial:input,target:async()=>wrong,photo:async()=>wrong});assert.equal(result.state.dataset.id,input.dataset.id);assert.equal(result.report.errors[0].code,"dataset-conflict");
});
test("no Mapillary features is an explicit empty result, never a fabricated photo",async()=>{
 const input=state(1);input.targets[input.dataset.targets[0].key].candidates=[];
 const result=await runLandmarkPreparation({initial:input,target:async()=>input,photo:async()=>{throw Error("must not call")}});assert.deepEqual(result.report.photoCandidates,[]);assert.equal(result.report.readyPhotos,0);assert.deepEqual(result.report.errors,[]);
});
test("photo quality misses have a finite cache and explicit retry path",async t=>{
 const storage=createLandmarkStorage(temporary(t)),candidate=feature(123,sample.targets[0].point);let calls=0;const client=createMapillaryClient("test",async()=>{calls++;return Response.json({data:[]})});
 await assert.rejects(()=>client.photo(candidate,storage),/no-usable-photo/);assert.equal(calls,1);assert.equal(storage.photoFailure("123").code,"no-usable-photo");
 await assert.rejects(()=>client.photo(candidate,storage),/no-usable-photo/);assert.equal(calls,1);storage.clearPhotoFailure("123");await assert.rejects(()=>client.photo(candidate,storage),/no-usable-photo/);assert.equal(calls,2);
});
test("transient network errors do not poison the quality-result cache",async t=>{
 const storage=createLandmarkStorage(temporary(t)),candidate=feature(123,sample.targets[0].point),client=createMapillaryClient("test",async()=>{throw Error("network")});
 await assert.rejects(()=>client.photo(candidate,storage),e=>e.code==="network");assert.equal(storage.photoFailure("123"),null);
});
test("out-of-budget preparation is rejected before any external operation",async()=>{
 const input=state(1);for(const limit of [0,201,NaN,1.5])await assert.rejects(()=>runLandmarkPreparation({initial:input,junctionLimit:limit,target:async()=>{throw Error("no")},photo:async()=>{throw Error("no")}}),/invalid-junction-limit/);
});
const spots=mergeSpotEdits(getBrowserSpots(),[]),ids=["osm-way-384676338","osm-way-394752558","osm-node-2046962408","osm-way-384676338"],find=id=>spots.find(s=>s.id===id);
function preview(route){return createRallyPreview({title:"new route",start:find(route[0]),finish:find(route.at(-1)),stops:route.slice(1,-1).map(id=>({kind:"checkpoint",spot:find(id)})),revision:1,updatedAt:now},spots)}
test("a freshly generated draft can prepare target twenty-one and later",async t=>{
 const dir=temporary(t),db=path.join(dir,"draft.sqlite"),repo=createDraftRepository(db),ref=id=>({id,revision:find(id).revision});repo.save({title:"new route",expectedRevision:0,start:ref(ids[0]),finish:ref(ids.at(-1)),stops:ids.slice(1,-1).map(id=>({kind:"checkpoint",spot:ref(id)}))});
 const previous=process.env.SPOT_DB_PATH;process.env.SPOT_DB_PATH=db;try{const dataset=loadLandmarkDataset("draft");assert.ok(dataset.targets.length>20);let calls=0;const client=createMapillaryClient("test",async()=>{calls++;return Response.json({data:[]})}),storage=createLandmarkStorage(path.join(dir,"cache"));const result=await operateWorkbench({action:"prepare",source:"draft",datasetId:dataset.id,targetKey:dataset.targets[20].key},storage,client);assert.ok(result.targets[dataset.targets[20].key]);assert.equal(calls,1)}finally{if(previous===undefined)delete process.env.SPOT_DB_PATH;else process.env.SPOT_DB_PATH=previous}
});
test("the reproducible CLI reads a different saved route without fixture image IDs or API calls",t=>{
 const dir=temporary(t),db=path.join(dir,"draft.sqlite"),repo=createDraftRepository(db),ref=id=>({id,revision:find(id).revision});repo.save({title:"new route",expectedRevision:0,start:ref(ids[0]),finish:ref(ids.at(-1)),stops:ids.slice(1,-1).map(id=>({kind:"checkpoint",spot:ref(id)}))});
 const script=fileURLToPath(new URL("../scripts/prepare-landmarks.mjs",import.meta.url)),result=cp.spawnSync(process.execPath,[script,"--source","draft","--cache-only"],{encoding:"utf8",env:{...process.env,SPOT_DB_PATH:db,LANDMARK_POC_DIR:path.join(dir,"cache"),MAPILLARY_ACCESS_TOKEN:""}});
 assert.equal(result.status,0,result.stderr);const report=JSON.parse(result.stdout);assert.equal(report.source,"draft");assert.notEqual(report.datasetId,sample.id);assert.equal(report.datasetId,landmarkDatasetFromPreview(preview(ids)).id);assert.ok(report.stairsCards>0);assert.deepEqual(report.requestCounts,{graph:0,images:0});assert.equal(report.remainingTargets,0);assert.equal(report.preparedTargets,report.targets);assert.ok(report.readyPhotos>=3);
});
