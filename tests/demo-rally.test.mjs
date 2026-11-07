import assert from "node:assert/strict";
import test from "node:test";
import {getDemoRally,DEMO_RALLY_ID,DEMO_RALLY_HREF} from "../lib/demo-rally.ts";
import {createMisakiPoc} from "../lib/misaki.ts";

test("participant overview derives its distance, walking estimate and stops from the same PoC route",()=>{
  const {route,graph}=createMisakiPoc(),rally=getDemoRally();
  assert.equal(rally.id,DEMO_RALLY_ID);assert.equal(rally.href,DEMO_RALLY_HREF);
  assert.equal(rally.distanceMeters,route.meters);
  assert.equal(rally.walkingMinutes,Math.ceil(route.minutes));
  assert.equal(rally.walkingSpeedKmh,route.speedKmh);
  assert.equal(rally.hasSteps,route.legs.some(leg=>leg.edges.some(edge=>graph.ways.get(edge.wayId).tags.highway==="steps")));
  assert.deepEqual(rally.stops.map(s=>({id:s.id,name:s.name})),route.stops.map(s=>({id:s.id,name:s.name})));
  assert.equal(rally.status,"development");
});
test("participant stop roles distinguish start/goal visits and checkpoints from the waypoint",()=>{
  const rally=getDemoRally(),byId=id=>rally.stops.find(s=>s.id===id);
  assert.equal(byId("S").name,byId("G").name);
  assert.equal(byId("S").role,"スタート");assert.equal(byId("G").role,"ゴール");
  assert.equal(byId("W1").role,"経由地候補");
  assert.deepEqual(rally.stops.filter(s=>s.role==="チェックポイント候補").map(s=>s.id),["C1","C2"]);
});

test("the fixed demo exposes a stable content revision for participation binding",()=>{
  const a=getDemoRally(),b=getDemoRally();
  assert.match(a.revision,/^demo-v1-[0-9a-f]{64}$/);
  assert.equal(a.revision,b.revision);
});
