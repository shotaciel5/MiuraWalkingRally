import test from "node:test";import assert from "node:assert/strict";import fs from "node:fs";import os from "node:os";import path from "node:path";import {createHash} from "node:crypto";import sharp from "sharp";import {execFileSync} from "node:child_process";
import {projectCandidate} from "../lib/landmarks/model.ts";
import {regionTargets,regionBounds,regionSourceHash} from "../lib/landmarks/region-source.ts";
import {bundledTarget,getBundledLandmarks,bundledRegionInfo} from "../lib/landmarks/bundled.ts";
import {distanceMeters} from "../lib/route/graph.ts";
import {createBundledLandmarkStorage,createLandmarkStorage} from "../lib/landmarks/storage.ts";
import {loadLandmarkDataset} from "../lib/landmarks/dataset.ts";
import {workbenchState,operateWorkbench} from "../lib/landmarks/workbench.ts";
import {prepareCrop} from "../scripts/lib/landmark-crop.mjs";
import {parallelJobs,regionalPhotoPlan,prepareRegion} from "../scripts/prepare-region-landmarks.mjs";
const manifest=JSON.parse(fs.readFileSync("public/landmarks/miura-v1/manifest.json","utf8")),targets=regionTargets(),bundle=getBundledLandmarks();
function temporary(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),"miura-region-test-"));t.after(()=>{assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));assert.ok(path.basename(dir).startsWith("miura-region-test-"));fs.rmSync(dir,{recursive:true,force:true})});return dir}
test("every pinned branch point has a completed static acquisition record with matching source",()=>{
 assert.equal(targets.length,1326);assert.equal(manifest.sourceHash,regionSourceHash);assert.equal(manifest.junctions.length,targets.length);assert.equal(manifest.stats.ready,targets.length);assert.equal(manifest.stats.missing,0);assert.equal(manifest.stats.partial,0);assert.deepEqual(manifest.junctions.map(t=>t.key),targets.map(t=>t.key));
 const ids=new Set(manifest.features.map(f=>f.id));assert.equal(ids.size,manifest.features.length);for(const j of manifest.junctions)assert.ok(j.candidateIds.every(id=>ids.has(id)));assert.equal(manifest.photos.length,new Set(manifest.photos.map(p=>p.asset.featureId)).size);
});
test("all exported photos are real 128 by 128 PNGs and match both hashes and attribution",async()=>{
 let bytes=0;const notice=fs.readFileSync("public/landmarks/miura-v1/NOTICE.md","utf8");
 for(const p of manifest.photos){const image=fs.readFileSync("public"+p.path),meta=await sharp(image).metadata();assert.equal(meta.width,128);assert.equal(meta.height,128);assert.equal(meta.format,"png");assert.equal(createHash("sha256").update(image).digest("hex"),p.sha256);assert.equal(p.asset.crop.sha256,p.sha256);assert.equal(p.asset.crop.path,p.path);assert.equal(p.bytes,image.length);assert.ok(notice.includes(p.asset.imageId));assert.ok(manifest.features.some(c=>c.id==="mapillary:"+p.asset.featureId));bytes+=image.length}
 assert.ok(bytes>0&&bytes<100000000);assert.doesNotMatch(JSON.stringify(manifest),/MLY\||thumb_1024_url|access_token|fbcdn/);
});
test("spatial lookup matches a brute force search including route positions between acquired junctions",()=>{
 for(const t of targets.filter((_,i)=>i%47===0)){for(const p of [t.point,{lat:t.point.lat+.00001,lon:t.point.lon+.00001}]){const actual=bundledTarget("c".repeat(64),p);if(!actual)continue;const expected=manifest.features.filter(c=>distanceMeters(p,c.point)<=32).map(c=>c.id).sort();assert.deepEqual(actual.candidates.map(c=>c.id).sort(),expected)}}
});
test("outside and incompletely sampled positions are distinguished without fabricated features",()=>{
 assert.equal(bundledTarget("c".repeat(64),{lat:0,lon:0}),null);const p={lat:regionBounds.south+.00001,lon:regionBounds.west+.00001},result=bundledTarget("c".repeat(64),p);assert.ok(result);assert.equal(result.partial,true);
});
test("runtime ignores configured tokens and writable API caches; only review records remain writable",async t=>{
 const dir=temporary(t),dataset=loadLandmarkDataset("sample"),target=dataset.targets[0],local=createLandmarkStorage(dir);local.saveTarget({version:1,key:target.key,point:target.point,fetchedAt:new Date().toISOString(),candidates:[],partial:false});fs.writeFileSync(path.join(dir,"target-"+target.key+".json"),"{broken");
 const before=process.env.MAPILLARY_ACCESS_TOKEN,request=globalThis.fetch;let calls=0;process.env.MAPILLARY_ACCESS_TOKEN="test-only-must-never-be-used";globalThis.fetch=async()=>{calls++;throw Error("network forbidden")};
 try{const storage=createBundledLandmarkStorage(dir),state=workbenchState(dataset,storage);assert.equal(state.configured,false);assert.equal(state.mode,"bundled-only");assert.ok(Object.keys(state.assets).length>0);
 for(const action of ["prepare","photo"])await assert.rejects(()=>operateWorkbench({action,source:"sample",datasetId:dataset.id},storage),/external-fetch-disabled/);assert.equal(calls,0);
 }finally{globalThis.fetch=request;if(before===undefined)delete process.env.MAPILLARY_ACCESS_TOKEN;else process.env.MAPILLARY_ACCESS_TOKEN=before}
});
test("crop export preserves aspect ratio and transparency in a fixed 128 square",async()=>{
 const source=await sharp({create:{width:40,height:20,channels:4,background:{r:240,g:10,b:20,alpha:1}}}).png().toBuffer(),bytes=await prepareCrop(source,{left:0,top:0,width:100,height:100}),out=await sharp(bytes).raw().toBuffer({resolveWithObject:true});
 assert.equal(out.info.width,128);assert.equal(out.info.height,128);assert.equal(out.data[3],0);const center=(64*128+64)*4;assert.ok(out.data[center]>200);assert.equal(out.data[center+3],255);
});
test("regional photo candidates are capped per junction and deduplicated by feature identity",()=>{
 const t=targets[0],f=i=>({id:"mapillary:"+i,provider:"mapillary",kind:"unique",symbol:"sign",classification:"object--sign--store",label:"sign",point:t.point,sourceUrl:"https://www.mapillary.com/",note:"test"}),caches=new Map([[t.key,{candidates:[f(4),f(3),f(2),f(1)]}]]);assert.deepEqual(regionalPhotoPlan([t,t],caches).map(c=>c.id),["mapillary:1","mapillary:2","mapillary:3"]);
});
test("acquisition workers obey a bounded concurrency and preserve stop state",async()=>{
 let active=0,highest=0,done=0;await parallelJobs(Array.from({length:20},(_,i)=>i),3,async()=>{highest=Math.max(highest,++active);await new Promise(r=>setTimeout(r,1));active--;done++},()=>done>=5);assert.ok(highest<=3);assert.ok(done>=5&&done<=7);
});
test("partial acquisition resumes missing targets and never overwrites a complete publication by default",async t=>{
 const dir=temporary(t),out=path.join(dir,"out");fs.mkdirSync(out);fs.writeFileSync(path.join(out,"manifest.json"),JSON.stringify({protected:true}));let calls=0;
 const client={configured:true,requestCounts:{graph:0,images:0},target:async t=>{calls++;return {version:1,key:t.key,point:t.point,fetchedAt:new Date().toISOString(),candidates:[],partial:false}},photo:async()=>{throw Error("no photo candidates")}};
 const first=await prepareRegion({directory:dir,output:out,client,fetch:true,maxJunctions:1});assert.equal(first.ready,1);assert.equal(first.exported,false);
 const second=await prepareRegion({directory:dir,output:out,client,fetch:true,maxJunctions:1});assert.equal(second.ready,2);assert.equal(calls,2);assert.deepEqual(JSON.parse(fs.readFileSync(path.join(out,"manifest.json"),"utf8")),{protected:true});
});
test("authorization failure stops bounded acquisition and preserves the previous manifest",async t=>{
 const dir=temporary(t),out=path.join(dir,"out");fs.mkdirSync(out);fs.writeFileSync(path.join(out,"manifest.json"),JSON.stringify({protected:true}));let calls=0;
 const result=await prepareRegion({directory:dir,output:out,fetch:true,client:{configured:true,requestCounts:{graph:0,images:0},target:async()=>{calls++;throw Object.assign(Error("hidden"),{code:"authorization"})}}});
 assert.equal(result.aborted,true);assert.equal(result.exported,false);assert.ok(calls<=3);assert.deepEqual(JSON.parse(fs.readFileSync(path.join(out,"manifest.json"),"utf8")),{protected:true});
});

test("the developer batch boots without any pre-existing public dataset",t=>{
 const dir=temporary(t),repo=path.resolve("."),script=path.join(dir,"scripts","prepare-region-landmarks.mjs");
 fs.cpSync(path.join(repo,"lib"),path.join(dir,"lib"),{recursive:true});fs.mkdirSync(path.join(dir,"scripts","lib"),{recursive:true});fs.mkdirSync(path.join(dir,"data","miura-expanded"),{recursive:true});
 fs.copyFileSync(path.join(repo,"scripts","prepare-region-landmarks.mjs"),script);fs.copyFileSync(path.join(repo,"scripts","lib","landmark-crop.mjs"),path.join(dir,"scripts","lib","landmark-crop.mjs"));fs.copyFileSync(path.join(repo,"data","miura-expanded","roads.json"),path.join(dir,"data","miura-expanded","roads.json"));fs.writeFileSync(path.join(dir,"package.json"),JSON.stringify({type:"module"}));fs.symlinkSync(path.join(repo,"node_modules"),path.join(dir,"node_modules"),process.platform==="win32"?"junction":"dir");
 const result=JSON.parse(execFileSync(process.execPath,[script,"--report"],{cwd:dir,encoding:"utf8",env:{...process.env,MAPILLARY_ACCESS_TOKEN:"",LANDMARK_REGION_DIR:path.join(dir,"private")}}));assert.equal(result.junctions,1326);assert.equal(result.missing,1326);assert.deepEqual(result.requestCounts,{graph:0,images:0});assert.equal(fs.existsSync(path.join(dir,"public")),false);
});

test("landmark SVG anchors use stable millipixel coordinates across server and browser math",()=>{
 const dataset=loadLandmarkDataset("sample"),storage=createBundledLandmarkStorage(),state=workbenchState(dataset,storage);
 for(const card of dataset.cards){const target=dataset.targets.find(t=>t.sequences.includes(card.map.sequence));for(const c of state.targets[target.key].candidates){const p=projectCandidate(card,c);if(p){assert.equal(p.x,Number(p.x.toFixed(3)));assert.equal(p.y,Number(p.y.toFixed(3)))}}}
});
