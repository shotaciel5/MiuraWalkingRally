import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {loadLandmarkDataset} from "../lib/landmarks/dataset.ts";
import {initialAccepted,accepted,choiceKey,mapillaryKind,candidatesForCard,layoutCandidates,projectCandidate} from "../lib/landmarks/model.ts";
import {createLandmarkStorage,CACHE_DAYS,MAX_IMAGE_BYTES} from "../lib/landmarks/storage.ts";
import {createMapillaryClient,MapillaryError} from "../lib/landmarks/mapillary.ts";
import {detectionCrop} from "../lib/landmarks/detection-crop.ts";
import {operateWorkbench,workbenchState} from "../lib/landmarks/workbench.ts";
const encode=n=>{const out=[];do{let v=n%128;n=Math.floor(n/128);if(n)v|=128;out.push(v)}while(n);return out};
const field=(id,bytes)=>[...encode(id*8+2),...encode(bytes.length),...bytes],scalar=(id,n)=>[...encode(id*8),...encode(n)],zig=n=>n<0?-n*2-1:n*2;
function geometry(x=400,y=800,w=800,h=400){
 const values=[9,zig(x),zig(y),26,zig(w),0,0,zig(h),zig(-w),0,15],feature=[...scalar(3,3),...field(4,values.flatMap(encode))],layer=[...scalar(15,2),...field(1,[100]),...field(2,feature),...scalar(5,4096)];
 return Buffer.from(field(3,layer)).toString("base64");
}
const data=loadLandmarkDataset("sample"),target=data.targets[0],f={id:"mapillary:123",provider:"mapillary",kind:"unique",symbol:"sign",label:"店舗看板",point:target.point,classification:"object--sign--store",sourceUrl:"https://www.mapillary.com/",note:"test"};
const response=value=>new Response(JSON.stringify(value),{headers:{"Content-Type":"application/json"}});
function temporary(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),"miura-landmark-test-"));t.after(()=>{assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));assert.ok(path.basename(dir).startsWith("miura-landmark-test-"));fs.rmSync(dir,{recursive:true,force:true})});return createLandmarkStorage(dir)}
test("stop and crossing records default on; signals, photos and buses default off",()=>{
 for(const kind of ["stop","control","crossing"])assert.equal(initialAccepted({kind}),true);
 for(const kind of ["signal","unique","bus","other"])assert.equal(initialAccepted({kind}),false);
 assert.equal(mapillaryKind("regulatory--stop--g1").kind,"stop");assert.equal(mapillaryKind("marking--discrete--crosswalk-zebra").kind,"crossing");
 assert.equal(mapillaryKind("warning--stop-ahead--g1"),null);assert.equal(mapillaryKind("regulatory--no-parking--g1"),null);assert.equal(mapillaryKind("object--sign--store").kind,"unique");
});
test("all OSM control/crossing candidates are read beyond the old four-item map cap",()=>{
 assert.equal(data.cards.length,31);assert.equal(data.targets.length,16);
 assert.ok(data.cards.some(c=>c.osm.some(x=>x.kind==="control")));
 const before=structuredClone(data);for(const c of data.cards){const items=candidatesForCard(c);assert.ok(items.every(x=>x.provider==="osm"));for(const x of items)assert.equal(accepted({revision:0,choices:{}},c.map.sequence,x),initialAccepted(x))}
 assert.deepEqual(data,before);assert.equal(loadLandmarkDataset("sample").id,data.id);
});
test("operator choices override defaults separately for each incoming visit",()=>{
 const c={...f,kind:"stop"},review={revision:1,choices:{[choiceKey(1,c.id)]:false,[choiceKey(31,c.id)]:true}};
 assert.equal(accepted(review,1,c),false);assert.equal(accepted(review,31,c),true);assert.equal(accepted(review,1,f),false);
});
test("selected items have no count cap; unplaceable items are explicitly returned",()=>{
 const card=data.cards.find(c=>c.map.state==="ready"),items=Array.from({length:40},(_,i)=>({...f,id:"mapillary:"+i,kind:"stop"})),before=structuredClone(card);
 const layout=layoutCandidates(card,items);assert.equal(layout.placed.length+layout.unplaced.length,40);assert.ok(layout.unplaced.length>0);assert.deepEqual(card,before);
 assert.deepEqual(projectCandidate(card,{...f,point:card.center}),{x:150,y:140});
});
test("polygon decoding keeps top-down image coordinates and rejects malformed crops",()=>{
 const r=detectionCrop(geometry());assert.deepEqual(r,{left:400/4096*100,top:800/4096*100,width:800/4096*100,height:400/4096*100});
 for(const bad of ["","!","AAAA",Buffer.from([26,255]).toString("base64"),geometry(0,0,4000,4000)])assert.throws(()=>detectionCrop(bad));
});
test("review persistence preserves overrides and rejects stale saves",t=>{
 const store=temporary(t);assert.deepEqual(store.review(data.id),{revision:0,choices:{}});
 const first=store.saveReview(data.id,0,{"1|osm:node/1":false});assert.equal(first.revision,1);assert.throws(()=>store.saveReview(data.id,0,{}),/review-conflict/);
 assert.deepEqual(createLandmarkStorage(store.root).review(data.id),first);assert.throws(()=>store.review("../private"),/Invalid cache key/);
});
test("expired target cache is not reused; broken cache is preserved as an error",t=>{
 const store=temporary(t),entry={version:1,key:target.key,point:target.point,fetchedAt:new Date(Date.now()-(CACHE_DAYS+1)*86400000).toISOString(),candidates:[],partial:false};
 store.saveTarget(entry);assert.equal(store.target(target.key),null);const file=path.join(store.root,"target-"+target.key+".json");fs.writeFileSync(file,"{broken");assert.throws(()=>store.target(target.key),/unreadable/);assert.equal(fs.readFileSync(file,"utf8"),"{broken");
});
test("Graph authorization stays in headers; only positioned, known classes are accepted",async()=>{
 const calls=[],secret="test-only-token",client=createMapillaryClient(secret,async(url,options)=>{calls.push({url:String(url),options});return response({data:[{id:"123",geometry:{type:"Point",coordinates:[target.point.lon,target.point.lat]},object_value:f.classification},{id:"124",geometry:{type:"Point",coordinates:[0,0]},object_value:f.classification},{id:"125",geometry:{type:"Point",coordinates:[target.point.lon,target.point.lat]},object_value:"object--utility-pole"}]})});
 const result=await client.target(target);assert.equal(result.candidates.length,1);assert.deepEqual(result.candidates[0].point,target.point);assert.equal(calls.length,1);assert.equal(calls[0].options.headers.Authorization,"OAuth "+secret);assert.ok(!calls[0].url.includes(secret));assert.ok(!JSON.stringify(result).includes(secret));
});
test("pagination follows a bounded cursor on our host and reports truncation",async()=>{
 const calls=[],client=createMapillaryClient("test",async url=>{calls.push(String(url));return response({data:[],paging:{next:"https://evil.test/?access_token=bad",cursors:{after:"next-page"}}})});
 const result=await client.target(target);assert.equal(calls.length,2);assert.equal(result.partial,true);assert.ok(calls.every(u=>new URL(u).hostname==="graph.mapillary.com"));assert.match(calls[1],/after=next-page/);
});
test("authorization and network failures never expose the token or external error body",async()=>{
 const secret="test-secret",client=createMapillaryClient(secret,async()=>new Response(secret,{status:403}));
 await assert.rejects(()=>client.target(target),e=>e instanceof MapillaryError&&e.code==="authorization"&&!e.message.includes(secret));
 await assert.rejects(()=>createMapillaryClient(undefined).target(target),/not-configured/);
 await assert.rejects(()=>createMapillaryClient(secret,async()=>{throw Error(secret)}).target(target),e=>e.code==="network"&&!e.message.includes(secret));
});
test("cache hit avoids both detections and image requests; CDN never receives authorization",async t=>{
 const store=temporary(t),calls=[],client=createMapillaryClient("test-token",async(url,options)=>{calls.push({url:String(url),options});if(new URL(url).hostname==="graph.mapillary.com")return response({data:[{value:f.classification,geometry:geometry(),image:{id:"456",width:1024,height:512,thumb_1024_url:"https://scontent-test.fbcdn.net/p.jpg?signature=private",creator:{username:"tester"},captured_at:100}}]});return new Response(new Uint8Array([255,216,255,...Array(30).fill(0)]),{headers:{"Content-Type":"image/jpeg"}})});
 const asset=await client.photo(f,store);assert.equal(calls.length,2);assert.equal(calls[1].options.headers,undefined);assert.equal(asset.imageId,"456");assert.ok(!JSON.stringify(asset).includes("signature"));await client.photo(f,store);assert.equal(calls.length,2);assert.equal(store.image("123").bytes.length,33);
});
test("untrusted image hosts and invalid polygons are not fetched",async t=>{
 const store=temporary(t),calls=[],client=createMapillaryClient("test",async url=>{calls.push(String(url));return response({data:[{value:f.classification,geometry:geometry(),image:{id:"456",width:1024,height:512,thumb_1024_url:"https://127.0.0.1/private"}},{value:f.classification,geometry:"bad",image:{id:"456",width:1024,height:512,thumb_1024_url:"https://scontent-test.fbcdn.net/a"}}]})});
 await assert.rejects(()=>client.photo(f,store),/no-usable-photo/);assert.equal(calls.length,1);assert.equal(store.asset("123"),null);
});
test("oversized images never enter the local image cache",async t=>{
 const store=temporary(t),client=createMapillaryClient("test",async url=>new URL(url).hostname==="graph.mapillary.com"?response({data:[{value:f.classification,geometry:geometry(),image:{id:"456",width:1024,height:512,thumb_1024_url:"https://scontent-test.fbcdn.net/a"}}]}):new Response("x",{headers:{"Content-Type":"image/jpeg","Content-Length":String(MAX_IMAGE_BYTES+1)}}));
 await assert.rejects(()=>client.photo(f,store),/response-too-large/);assert.equal(store.asset("123"),null);
});
test("route mismatch and forged selection fail before making external requests",async t=>{
 const store=temporary(t),client=createMapillaryClient("test",async()=>{throw Error("must not fetch")});
 await assert.rejects(()=>operateWorkbench({action:"prepare",source:"sample",datasetId:"wrong",targetKey:target.key},store,client),/external-fetch-disabled/);
 await assert.rejects(()=>operateWorkbench({action:"save",source:"sample",datasetId:data.id,expectedRevision:0,choices:{"1|mapillary:unknown":true}},store,client),/invalid-choices/);assert.equal(store.review(data.id).revision,0);
});
test("saved operator choices survive reload while target cache remains reusable",async t=>{
 const store=temporary(t),candidate=data.cards.flatMap(c=>c.osm)[0],card=data.cards.find(c=>c.osm.some(x=>x.id===candidate.id)),key=choiceKey(card.map.sequence,candidate.id);
 const state=await operateWorkbench({action:"save",source:"sample",datasetId:data.id,expectedRevision:0,choices:{[key]:!initialAccepted(candidate)}},store);assert.equal(state.review.revision,1);assert.equal(workbenchState(data,createLandmarkStorage(store.root)).review.choices[key],!initialAccepted(candidate));
});
test("runtime acquisition stays disabled even for parallel calls",async t=>{
 const store=temporary(t);let calls=0;const client=createMapillaryClient("test",async()=>{calls++;return response({data:[]})}),input={action:"prepare",source:"sample",datasetId:data.id,targetKey:target.key};
 await Promise.all([assert.rejects(()=>operateWorkbench(input,store,client),/external-fetch-disabled/),assert.rejects(()=>operateWorkbench(input,store,client),/external-fetch-disabled/)]);assert.equal(calls,0);
});

test("tiny detections are rejected before downloading misleading blurry icons",async t=>{const store=temporary(t);let requests=0;const client=createMapillaryClient("test",async()=>{requests++;return response({data:[{value:f.classification,geometry:geometry(400,800,30,20),image:{id:"456",width:1024,height:512,thumb_1024_url:"https://scontent-test.fbcdn.net/a"}}]})});await assert.rejects(()=>client.photo(f,store),/no-usable-photo/);assert.equal(requests,1);assert.equal(store.asset("123"),null)});

test("long thin signs are not converted into misleading line-like map icons",async t=>{const store=temporary(t);let calls=0;const client=createMapillaryClient("test",async()=>{calls++;return response({data:[{value:f.classification,geometry:geometry(400,800,2000,300),image:{id:"456",width:1024,height:512,thumb_1024_url:"https://scontent-test.fbcdn.net/a"}}]})});await assert.rejects(()=>client.photo(f,store),/no-usable-photo/);assert.equal(calls,1)});
test("review count cap preserves already saved routes and prevents unbounded growth",t=>{const store=temporary(t);for(let i=0;i<50;i++)store.saveReview(i.toString(16).padStart(64,"0"),0,{});assert.throws(()=>store.saveReview("f".repeat(64),0,{}),/Review cache limit/);assert.equal(store.saveReview("0".repeat(64),1,{}).revision,2)});

test("photo processing version changes invalidate previous exploratory crops",async t=>{
 const store=temporary(t);let calls=0;const client=createMapillaryClient("test",async url=>{calls++;return new URL(url).hostname==="graph.mapillary.com"?response({data:[{value:f.classification,geometry:geometry(),image:{id:"456",width:1024,height:512,thumb_1024_url:"https://scontent-test.fbcdn.net/a"}}]}):new Response(new Uint8Array([255,216,255,...Array(30).fill(0)]),{headers:{"Content-Type":"image/jpeg"}})});
 const meta=await client.photo(f,store);assert.equal(meta.policyVersion,2);const file=path.join(store.root,"asset-123.json");fs.writeFileSync(file,JSON.stringify({...meta,policyVersion:1}));assert.equal(store.asset("123"),null);await client.photo(f,store);assert.equal(calls,4);assert.equal(store.asset("123").policyVersion,2);
});
