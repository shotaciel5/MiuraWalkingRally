import test from "node:test";
import assert from "node:assert/strict";
import {isVisualLandmark,visualLandmarks} from "../lib/route/visual-landmarks.ts";
import {createMisakiReviewPoc} from "../lib/misaki-review.ts";
const context=landmarks=>({landmarks,buildings:[],steps:[],roads:[],availableLandmarks:landmarks.length,availableBuildings:0});
const feature=(id,symbol,x=230,y=50,lat=35.14)=>({id,symbol,x,y,point:{lat,lon:139.62},meters:12,anchor:"node",name:"非表示の名称",kind:"目印"});
const road={points:[{x:150,y:230},{x:150,y:35}]};
test("symbols require a physical class and explicit Japanese stop-sign evidence",()=>{
 for(const symbol of ["shop","food","shrine","temple","historic","tourism","crossing","stop-control","give-way-control","sign"])assert.equal(isVisualLandmark(feature(symbol,symbol)),false);
 assert.equal(isVisualLandmark(feature("signal","signal")),true);assert.equal(isVisualLandmark(feature("bus","bus")),true);
 assert.equal(isVisualLandmark(feature("stop","stop-sign")),false);
 for(const key of ["traffic_sign","traffic_sign:forward","traffic_sign:backward"])assert.equal(isVisualLandmark({...feature("stop","stop-sign"),sourceTags:{[key]:"JP:301; JP:330-A"}}),true);
 assert.equal(isVisualLandmark({...feature("area","signal"),anchor:"area-label"}),false);
});
test("cap and evidence priority are deterministic and preserve the input",()=>{
 const items=[feature("bus","bus",65,50,35.142),feature("signal","signal",230,50,35.141),{...feature("stop","stop-sign",230,180),sourceTags:{traffic_sign:"JP:330"}}],source=context(items),before=structuredClone(source);
 for(const limit of [1,2,3]){
  const a=visualLandmarks(source,[road],limit),b=visualLandmarks(context([...items].reverse()),[road],limit);
  assert.equal(a.placements.length,limit);assert.deepEqual(a.placements,b.placements);assert.equal(a.placements[0].feature.id,"stop");
 }
 assert.deepEqual(source,before);assert.throws(()=>visualLandmarks(source,[],0),RangeError);
});
test("duplicates are removed by recorded world position even across different symbols",()=>{
 const a=feature("a","signal"),b=feature("b","bus",50,80,35.14001),c=feature("c","bus",50,190,35.142);
 const r=visualLandmarks(context([a,b,c]),[road],3);
 assert.equal(r.placements.length,2);assert.ok(r.omitted.some(o=>o.id==="b"&&o.reason==="near-duplicate"));
});
test("invalid projected or world points never become displayed symbols",()=>{
 const a=feature("a","signal"),items=[{...a,id:"nan",x:NaN},{...a,id:"out",x:292},{...a,id:"world",point:{lat:Infinity,lon:139.62}},{...a,id:"distance",meters:-1}];
 const r=visualLandmarks(context(items),[road],2);assert.equal(r.placements.length,0);assert.equal(r.omitted.length,4);assert.ok(r.omitted.every(o=>o.reason==="invalid-position"));
});
test("no clear area omits an icon rather than covering roads or moving its world anchor",()=>{
 const a=feature("a","signal",150,120),roads=Array.from({length:30},(_,i)=>({points:[{x:9,y:9+i*8},{x:291,y:9+i*8}]})),before=structuredClone(a);
 const r=visualLandmarks(context([a]),roads);assert.deepEqual(r.placements,[]);assert.equal(r.omitted[0].reason,"no-clear-space");assert.deepEqual(a,before);
});
test("badges and their padding do not overlap a road or one another",()=>{
 const r=visualLandmarks(context([feature("a","signal",150,80),feature("b","bus",210,150,35.142)]),[road],2);assert.equal(r.placements.length,2);
 for(const p of r.placements)assert.ok(p.x+p.size+7<150||p.x-7>150);
 const [a,b]=r.placements;assert.ok(a.x+a.size+6<=b.x||b.x+b.size+6<=a.x||a.y+a.size+6<=b.y||b.y+b.size+6<=a.y);
});
test("real fixed cards keep their geometry and only eligible symbols in all limits",()=>{
 const cards=createMisakiReviewPoc().koma,before=structuredClone(cards);
 for(const card of cards)for(const limit of [1,2,3]){
  const r=visualLandmarks(card.context,card.map.branches,limit);assert.ok(r.placements.length<=limit);
  for(const p of r.placements){assert.ok(isVisualLandmark(p.feature));assert.ok(card.context.landmarks.includes(p.feature));assert.ok(p.x>=9&&p.y>=9&&p.x+p.size<=291&&p.y+p.size<=241)}
 }
 assert.deepEqual(cards,before);
});
