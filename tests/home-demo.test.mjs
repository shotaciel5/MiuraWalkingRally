import test from "node:test";
import assert from "node:assert/strict";
import {createHomeDemo} from "../lib/home-demo.ts";
import {createMisakiReviewPoc} from "../lib/misaki-review.ts";

test("home demo uses three consecutive unmodified generated cards",()=>{
 const demo=createHomeDemo(),source=createMisakiReviewPoc(),start=source.koma.findIndex(c=>c.map.sequence===demo.cards[0].map.sequence);
 assert.equal(demo.cards.length,3);assert.ok(start>=0);
 for(const [i,card]of demo.cards.entries()){
  assert.equal(card.map.state,"ready");assert.equal(card.map.kind,"junction");assert.equal(card.map.shortGeometry,undefined);
  assert.deepEqual(card.map,source.koma[start+i].map);assert.deepEqual(card.context,source.koma[start+i].context);
 }
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
 assert.deepEqual(a.cards.map(c=>c.map.sequence),[a.cards[0].map.sequence,a.cards[0].map.sequence+1,a.cards[0].map.sequence+2]);
});
