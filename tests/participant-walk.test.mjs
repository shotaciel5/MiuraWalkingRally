import test from "node:test";
import assert from "node:assert/strict";
import {mkdirSync,mkdtempSync,rmSync} from "node:fs";
import {resolve,join,sep} from "node:path";
import {createDraftRepository} from "../lib/operator/draft-repository.ts";
import {createRallyPreview} from "../lib/operator/rally-preview.ts";
import {createCourseService,prepareCourseSave} from "../lib/operator/course-save.ts";
import {createPublicationRepository} from "../lib/operator/publication-repository.ts";
import {projectPublishedCourse,publishedSummary} from "../lib/published-course.ts";
import {walkCard,swipeStep} from "../lib/participant-walk.ts";
import {checkPublishedCourse} from "../lib/published-availability.ts";
const M="osm-node-2046962408",S="osm-way-384676338",W="osm-way-394752554",C="osm-way-394752558";
function fixture(t){
 const parent=resolve(".tools/photo-walk-tests");mkdirSync(parent,{recursive:true});const dir=mkdtempSync(join(parent,"case-"));t.after(()=>{assert.ok(resolve(dir).startsWith(parent+sep));rmSync(dir,{recursive:true,force:true})});
 const path=join(dir,"db.sqlite"),repo=createDraftRepository(path),state=repo.save({title:"三崎フォトさんぽ",expectedRevision:0,start:{id:M,revision:0},finish:{id:M,revision:0},stops:[{kind:"checkpoint",spot:{id:S,revision:0}},{kind:"waypoint",spot:{id:W,revision:0}},{kind:"checkpoint",spot:{id:C,revision:0}}]});
 const saved=createCourseService(path).save(prepareCourseSave(state,createRallyPreview(state.draft,state.spots,state.corrections)).receipt),publication=createPublicationRepository(path).publish({courseId:saved.id,fingerprint:saved.fingerprint,expectedRevision:0});
 return {saved,publication,course:projectPublishedCourse(saved,publication)};
}
test("photo prompts appear only on their assigned checkpoint cards",t=>{
 const {course}=fixture(t),cp=course.stops.filter(s=>s.kind==="checkpoint");assert.equal(course.cards.length,41);assert.equal(cp[0].komaIndex,13);
 for(let i=0;i<course.cards.length;i++){const view=walkCard(course,i),expected=cp.filter(s=>s.komaIndex===i);assert.deepEqual(view.checkpoints.map(s=>s.id),expected.map(s=>s.id));assert.equal(view.name,expected.length?expected.map(s=>s.name).join(" / "):"コマ地図")}
 assert.deepEqual(walkCard(course,cp[0].komaIndex).checkpoints.map(s=>s.ordinal),[1]);assert.deepEqual(walkCard(course,cp[1].komaIndex).checkpoints.map(s=>s.ordinal),[2]);
});
test("future checkpoint labels are masked in primary and reference context without mutating saved data",t=>{
 const {course}=fixture(t),cp=course.stops.filter(s=>s.kind==="checkpoint"),base=course.cards[0].context.landmarks[0]??{id:"fixture",point:{lat:35.14,lon:139.62},kind:"神社",symbol:"shrine",anchor:"node",x:120,y:100,meters:10};
 const add=card=>{card.context.landmarks.push({...base,name:cp[0].name+"・"+cp[1].name,detail:cp[1].name});card.context.roads.push({id:99,name:cp[0].name+"への道",highway:"footway"});if(card.referenceContext)card.referenceContext.landmarks.push({...base,name:cp[0].name+"・"+cp[1].name})};
 add(course.cards[0]);add(course.cards[cp[0].komaIndex]);const before=structuredClone(course),early=walkCard(course,0);
 assert.ok(early.context.landmarks.every(l=>!l.name.includes(cp[0].name)&&!l.name.includes(cp[1].name)));assert.ok(early.context.roads.every(r=>!r.name.includes(cp[0].name)));
 const arrived=walkCard(course,cp[0].komaIndex);assert.ok(arrived.context.landmarks.some(l=>l.name.includes(cp[0].name)));assert.ok(arrived.context.landmarks.every(l=>!l.name.includes(cp[1].name)));
 if(arrived.referenceContext)assert.ok(arrived.referenceContext.landmarks.every(l=>!l.name.includes(cp[1].name)));
 assert.deepEqual(course,before);
});
test("all diagram branches source segments distances and feature positions survive participant presentation",t=>{
 const {course}=fixture(t),before=structuredClone(course);
 for(let i=0;i<course.cards.length;i++){const view=walkCard(course,i),source=course.cards[i];assert.strictEqual(view.map,source.map);assert.deepEqual(view.context.buildings,source.context.buildings);assert.deepEqual(view.context.steps,source.context.steps);assert.deepEqual(view.context.landmarks.map(({id,x,y,point,symbol})=>({id,x,y,point,symbol})),source.context.landmarks.map(({id,x,y,point,symbol})=>({id,x,y,point,symbol})));if(source.referenceContext)assert.deepEqual(view.referenceContext.landmarks.map(l=>[l.id,l.x,l.y]),source.referenceContext.landmarks.map(l=>[l.id,l.x,l.y]))}
 assert.deepEqual(course,before);
});
test("start finish and waypoint visits do not create photo achievements",t=>{
 const {course}=fixture(t),waypoint=course.stops.find(s=>s.kind==="waypoint");
 assert.deepEqual(walkCard(course,0).checkpoints,[]);assert.deepEqual(walkCard(course,waypoint.komaIndex).checkpoints,[]);assert.equal(walkCard(course,course.cards.length-1).isFinish,true);assert.equal(walkCard(course,0).isFinish,false);
 const noCp={...course,rally:{...course.rally,checkpointIds:[]},stops:course.stops.filter(s=>s.kind!=="checkpoint")};assert.deepEqual(walkCard(noCp,noCp.cards.length-1).checkpoints,[]);
});
test("coincident checkpoint and goal keep their roles and a current name remains visible on repeat visits",t=>{
 const {course}=fixture(t),original=course.stops.find(s=>s.kind==="checkpoint"),last=course.cards.length-1;
 course.stops.push({...original,id:"repeat",komaIndex:last});course.rally.checkpointIds.push("repeat");
 assert.equal(walkCard(course,last).isFinish,true);assert.equal(walkCard(course,last).checkpoints[0].id,"repeat");
 assert.equal(walkCard(course,original.komaIndex).name,original.name);
});
test("catalog endpoint names cannot disclose a registered checkpoint with the same name",t=>{
 const {saved,publication}=fixture(t),copy=structuredClone(saved),name=copy.payload.input.draft.stops[0].spot.name;
 copy.payload.input.draft.start.name=name;copy.payload.input.draft.finish.name=name;copy.payload.preview.title=name+"で写真を撮ろう";
 const summary=publishedSummary(copy,publication);assert.equal(summary.title,"チェックポイントで写真を撮ろう");assert.equal(copy.payload.preview.title,name+"で写真を撮ろう");assert.equal(summary.startName,"スタート地点");assert.equal(summary.finishName,"終了地点");assert.equal(summary.checkpointIds.length,2);
});
test("invalid card indices and accidental vertical swipes cannot advance",t=>{
 const {course}=fixture(t);for(const n of [-1,NaN,Infinity,1.1,41])assert.throws(()=>walkCard(course,n),RangeError);
 for(const [dx,dy]of [[0,0],[47,0],[80,100],[50,40],[NaN,0],[50,Infinity]])assert.equal(swipeStep(dx,dy),0);
 assert.equal(swipeStep(-48,0),1);assert.equal(swipeStep(48,0),-1);assert.equal(swipeStep(-100,20),1);
});
const edition={id:"course-00000000-0000-4000-8000-000000000001",revision:"published-v1-"+"a".repeat(64)};
test("availability checks use no-store and verify the exact course edition",async()=>{
 const controller=new AbortController();let request;
 const result=await checkPublishedCourse(edition,controller.signal,async(url,options)=>{request={url,options};return Response.json({status:"published",revision:edition.revision})});
 assert.equal(result,"ready");assert.equal(request.url,"/api/rallies/"+edition.id+"/availability");assert.equal(request.options.cache,"no-store");assert.strictEqual(request.options.signal,controller.signal);assert.equal(request.options.body,undefined);
});
test("withdrawal missing and unavailable states remain distinct and malformed replies never allow start",async()=>{
 const controller=new AbortController();
 for(const [status,body,expected]of [[410,{status:"withdrawn"},"withdrawn"],[404,{status:"missing"},"missing"],[503,{status:"unavailable"},"unavailable"],[200,{status:"published",revision:"wrong"},"unavailable"],[200,{status:"withdrawn"},"unavailable"],[200,[],"unavailable"]])assert.equal(await checkPublishedCourse(edition,controller.signal,async()=>Response.json(body,{status})),expected);
 assert.equal(await checkPublishedCourse(edition,controller.signal,async()=>new Response("{bad")),"unavailable");assert.equal(await checkPublishedCourse(edition,controller.signal,async()=>{throw Error("offline")}),"unavailable");
});
