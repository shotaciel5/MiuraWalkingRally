import test from "node:test";
import assert from "node:assert/strict";
import {planLandmarkCache} from "../lib/landmark-cache-plan.ts";
import {createMisakiReviewPoc} from "../lib/misaki-review.ts";
const card=(nodeId,sequence,approach=1,angles=[0,90,180])=>({candidate:{point:{lat:35.14,lon:139.62}},map:{nodeId,sequence,branches:angles.map((a,i)=>({neighborNodeId:i===0?approach:i+20,arrival:i===0,points:[{x:150,y:140},{x:150+60*Math.cos(a*Math.PI/180),y:140+60*Math.sin(a*Math.PI/180)}]}))}});
test("same physical junction reuses a target but retains distinct incoming directions",()=>{
 const a=card(100,1,10),b=card(100,5,20),c=card(100,7,10),source=[a,b,c],before=structuredClone(source),r=planLandmarkCache(source);
 assert.equal(r.selected.length,1);assert.deepEqual(r.selected[0].sequences,[1,5,7]);assert.deepEqual(r.selected[0].approaches,[10,20]);assert.equal(r.viewSlots,2);assert.equal(r.exampleImageCeiling,4);assert.deepEqual(source,before);
});
test("straight roads and virtual nodes are excluded; close branch reference is eligible",()=>{
 const a=card(100,1,1,[0,180]),b=card(-9,2),c=card(300,3,1,[0,180]);c.map.shortGeometry={branches:c.map.branches};
 assert.deepEqual(planLandmarkCache([a,b,c]).selected.map(j=>j.nodeId),[300]);assert.equal(planLandmarkCache([]).selected.length,0);
});
test("priority and bounds are deterministic without a network or storage dependency",()=>{
 const cards=[card(8,1),card(6,2),card(4,3,1,[0,15,180]),card(2,4,1,[0,90,180,270])];
 const a=planLandmarkCache(cards,3),b=planLandmarkCache([...cards].reverse(),3);
 assert.deepEqual(a.selected,b.selected);assert.deepEqual(a.selected.map(j=>j.nodeId),[4,2,6]);assert.equal(a.candidates.length,4);
 for(const limit of [0,21,1.5,NaN])assert.throws(()=>planLandmarkCache(cards,limit),RangeError);
});
test("fixed route planning is reproducible, bounded and does not alter saved input",()=>{
 const cards=createMisakiReviewPoc().koma,before=structuredClone(cards),r=planLandmarkCache(cards,5);
 assert.equal(r.courseCards,31);assert.ok(r.candidates.length>5);assert.equal(r.selected.length,5);assert.equal(new Set(r.selected.map(j=>j.nodeId)).size,5);
 assert.deepEqual(r,planLandmarkCache(cards,5));assert.deepEqual(cards,before);
});
