import test from "node:test";
import assert from "node:assert/strict";
import {cropPixels,containCrop} from "../lib/landmark-crop.ts";
test("manual percentages become bounded source pixels without mutating selection",()=>{
 const crop={left:62,top:2,width:35,height:29},before={...crop},r=cropPixels(crop,1920,1440);
 assert.deepEqual(r,{left:1190,top:29,width:672,height:418});assert.deepEqual(crop,before);
 assert.deepEqual(cropPixels({left:99,top:99,width:20,height:20},100,100),{left:99,top:99,width:1,height:1});
 assert.deepEqual(cropPixels({left:-20,top:-10,width:200,height:200},100,80),{left:0,top:0,width:100,height:80});
});
test("invalid crops and dimensions fail; minimum area is one source pixel",()=>{
 for(const [w,h]of [[0,10],[10,-1],[1.2,10],[NaN,5]])assert.throws(()=>cropPixels({left:0,top:0,width:20,height:20},w,h),RangeError);
 assert.throws(()=>cropPixels({left:NaN,top:0,width:20,height:20},100,100),RangeError);
 assert.deepEqual(cropPixels({left:100,top:100,width:0,height:0},100,50),{left:99,top:49,width:1,height:1});
});
test("display sizes preserve aspect ratio and use transparent letterboxing",()=>{
 for(const size of [32,48,64])for(const [w,h]of [[672,418],[200,400],[400,400]]){
  const r=containCrop(w,h,size);assert.ok(Math.abs(r.width/r.height-w/h)<1e-12);assert.ok(r.left>=0&&r.top>=0);assert.ok(Math.max(r.width,r.height)===size);
  assert.equal(r.left*2+r.width,size);assert.equal(r.top*2+r.height,size);
 }
 assert.throws(()=>containCrop(0,100,32),RangeError);
});
