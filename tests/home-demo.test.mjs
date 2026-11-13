import test from "node:test";
import assert from "node:assert/strict";
import {createHomeDemo} from "../lib/home-demo.ts";
import {createMisakiReviewPoc} from "../lib/misaki-review.ts";
import {distanceMeters} from "../lib/route/graph.ts";
import selection from "../data/ui/home-examples.json" with {type:"json"};

test("home demo uses configured unmodified generated cards in the selected order",()=>{
 const demo=createHomeDemo(),source=createMisakiReviewPoc();
 assert.equal(demo.cards.length,3);assert.deepEqual(demo.cards.map(c=>c.map.sequence),selection.phoneSequences);
 for(const card of [...demo.cards,demo.introduction]){
  const original=source.koma.find(c=>c.map.sequence===card.map.sequence);
  assert.equal(card.map.state,"ready");assert.equal(card.map.kind,"junction");assert.equal(card.map.shortGeometry,undefined);
  assert.deepEqual(card.map,original.map);assert.deepEqual(card.context,original.context);assert.deepEqual(card.center,original.candidate.point);
 }
});
test("phone examples may be nonconsecutive and do not change the photo's diagram",()=>{
 const custom={...selection,phoneSequences:[6,27,5]},result=createHomeDemo(custom);
 assert.deepEqual(result.cards.map(c=>c.map.sequence),[6,27,5]);
 assert.deepEqual(result.introduction,createHomeDemo().introduction);
});
test("invalid example settings fail instead of silently showing other intersections",()=>{
 for(const change of [{schemaVersion:2},{phoneSequences:[2,3]},{phoneSequences:[2,2,4]},{phoneSequences:[2,3,9999]},{phoneSequences:[1,3,4]},{introductionSequence:9999}]){
  assert.throws(()=>createHomeDemo({...selection,...change}),/Home examples|Unavailable home diagram/);
 }
});
test("introduction uses the actual nearby junction requested for the street photograph",()=>{
 const {introduction}=createHomeDemo(),source=createMisakiReviewPoc(),target={lat:35.14143652320008,lon:139.61838070052278};
 assert.equal(introduction.map.nodeId,2159253432);
 assert.ok(distanceMeters(target,introduction.center)<7);
 const nearest=source.koma.filter(c=>c.map.kind==="junction"&&c.map.state==="ready").sort((a,b)=>distanceMeters(a.candidate.point,target)-distanceMeters(b.candidate.point,target))[0];
 assert.equal(introduction.map.nodeId,nearest.map.nodeId);
});
test("generation-flow example follows every original route node and its stop positions",()=>{
 const demo=createHomeDemo(),source=createMisakiReviewPoc(),ids=source.route.legs.flatMap((leg,i)=>leg.nodeIds.slice(i?1:0));
 assert.equal(demo.route.points.length,ids.length);assert.equal(demo.route.stops.length,source.route.stops.length);
 for(const p of demo.route.points){assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));assert.ok(p.x>=19.99&&p.x<=280.01&&p.y>=19.99&&p.y<=160.01)}
 for(const [i,stop]of source.route.stops.entries()){const routeIndex=ids.indexOf(stop.nodeId);assert.ok(routeIndex>=0);assert.deepEqual(demo.route.stops[i],demo.route.points[routeIndex])}
 assert.deepEqual(demo.route.points[0],demo.route.stops[0]);assert.deepEqual(demo.route.points.at(-1),demo.route.stops.at(-1));
 assert.ok(new Set(demo.route.points.map(p=>p.x+","+p.y)).size>10);
});
test("home examples are deterministic and do not require a draft or publication",()=>{
 const a=createHomeDemo(),b=createHomeDemo();assert.deepEqual(a,b);assert.equal(Object.hasOwn(a,"participation"),false);assert.equal(Object.hasOwn(a,"publication"),false);
});
