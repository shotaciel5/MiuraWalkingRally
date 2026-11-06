import assert from "node:assert/strict";
import test from "node:test";
import { nodePolicy, wayPolicy } from "../lib/route/walking-policy.ts";
import { buildWalkingGraph, distanceMeters } from "../lib/route/graph.ts";
import { routeThroughStops, shortestPath } from "../lib/route/routing.ts";

const road = tags => wayPolicy({ highway: "residential", ...tags });
const candidates = [
  ["no sidewalk", { sidewalk: "no" }],
  ["missing sidewalk and foot tags", {}],
  ["vehicle prohibition does not prohibit pedestrians", { vehicle: "no" }],
  ["mode-specific permission overrides general access", { access: "private", foot: "yes" }],
  ["ordinary trunk is not automatically motor-only", { highway: "trunk" }],
  ["foot-only path", { highway: "footway" }],
  ["steps", { highway: "steps" }],
  ["cycleway with explicit permission", { highway: "cycleway", foot: "yes" }],
];
for (const [label, tags] of candidates) test("walking candidate: " + label, () => assert.equal(road(tags).state, "allowed"));
const exclusions = [
  ["foot prohibited despite vehicle permission", { foot: "no", motor_vehicle: "yes" }],
  ["private access", { access: "private" }],
  ["motorroad with contradictory foot permission", { motorroad: "yes", foot: "yes" }],
  ["motorway", { highway: "motorway" }],
  ["area perimeter", { area: "yes", foot: "yes" }],
  ["construction", { highway: "construction" }],
  ["separate footway required", { foot: "use_sidepath" }],
];
for (const [label, tags] of exclusions) test("excluded: " + label, () => assert.equal(road(tags).state, "excluded"));
for (const tags of [
  { "access:forward": "no" }, { "oneway:foot:conditional": "yes @ (Mo-Fr)" },
  { foot: "no", "foot:forward": "yes" },
  { "foot:conditional": "no @ (sunset-sunrise)" }, { access: "destination" },
  { foot: "customers" }, { highway: "cycleway" }, { access: "designated" },
  { barrier: "gate" }, { barrier: "wall", foot: "yes" },
  { "oneway:foot": "reversible" }, { "foot:lanes": "yes" },
  { "oneway:foot": "yes", "foot:backward": "yes" },
]) test("unresolved restrictions are held: " + JSON.stringify(tags), () => assert.equal(road(tags).state, "review"));
test("barriers respect pedestrian access without assuming gates open", () => {
  assert.equal(nodePolicy({ barrier: "gate" }).state, "review");
  assert.equal(nodePolicy({ barrier: "gate", foot: "yes" }).state, "allowed");
  assert.equal(nodePolicy({ barrier: "bollard" }).state, "allowed");
  assert.equal(nodePolicy({ barrier: "gate", foot: "no" }).state, "excluded");
});
test("vehicle oneway is independent of pedestrian direction", () => {
  assert.deepEqual([road({ oneway: "yes" }).forward, road({ oneway: "yes" }).backward], [true, true]);
  assert.deepEqual([road({ "oneway:foot": "yes" }).forward, road({ "oneway:foot": "yes" }).backward], [true, false]);
  assert.deepEqual([road({ "oneway:foot": "-1" }).forward, road({ "oneway:foot": "-1" }).backward], [false, true]);
  assert.deepEqual([road({ "foot:forward": "no" }).forward, road({ "foot:forward": "no" }).backward], [false, true]);
});

const node = (id, lat, lon, tags) => ({ type: "node", id, lat, lon, ...(tags ? {tags} : {}) });
const way = (id, nodes, tags = {}) => ({ type: "way", id, nodes, tags: {highway:"residential",...tags} });
const snapshot = elements => ({ schemaVersion:1, bounds:{south:-1,west:-1,north:1,east:1}, elements });
const stop = (id, nodeId) => ({id,name:id,nodeId,note:"test"});
const square = () => [
  node(1,0,0),node(2,0,.001),node(3,.001,.001),node(4,.001,0),
  way(11,[1,2]),way(12,[2,3]),way(13,[1,4]),way(14,[4,3]),
];
test("haversine uses a known equatorial arc and rejects invalid coordinates", () => {
  assert.ok(Math.abs(distanceMeters({lat:0,lon:0},{lat:0,lon:1}) - 111195.0802335329) < 0.00001);
  assert.equal(distanceMeters({lat:35,lon:139},{lat:35,lon:139}),0);
  assert.throws(() => distanceMeters({lat:NaN,lon:139},{lat:0,lon:0}),/Invalid coordinates/);
});
test("shortest path avoids an explicit foot prohibition and detours on connected roads", () => {
  const elements = square();
  elements.find(x => x.id===12 && x.type==="way").tags.foot="no";
  const graph=buildWalkingGraph(snapshot(elements));
  assert.deepEqual(shortestPath(graph,1,3).nodeIds,[1,4,3]);
  assert.equal(graph.diagnostics.find(x=>x.id===12).state,"excluded");
});
test("equal coordinates and geometric crossings do not create shared node IDs", () => {
  const graph=buildWalkingGraph(snapshot([
    node(1,0,0),node(2,0,.001),node(3,0,.001),node(4,.001,.001),
    way(11,[1,2],{bridge:"yes",layer:"1"}),way(12,[3,4]),
  ]));
  assert.throws(()=>shortestPath(graph,1,4),/No walking path/);
});
test("blocked nodes cannot be crossed or selected as stops", () => {
  const graph=buildWalkingGraph(snapshot([node(1,0,0),node(2,0,.001,{barrier:"gate"}),node(3,0,.002),way(11,[1,2,3])]));
  assert.throws(()=>shortestPath(graph,1,3),/Stop is missing/);
});
test("missing references and pedestrian turn restrictions fail explicitly", () => {
  assert.throws(()=>buildWalkingGraph(snapshot([node(1,0,0),way(11,[1,2])])),/Missing node reference/);
  assert.throws(()=>buildWalkingGraph(snapshot([{type:"relation",id:1,members:[],tags:{type:"restriction","restriction:foot":"no_left_turn"}}])),/Pedestrian turn restriction/);
});
test("extract boundary is not extrapolated and missing stops are not snapped", () => {
  const graph=buildWalkingGraph(snapshot([node(1,0,0),node(2,0,.001),node(3,2,.001),way(11,[1,2,3])]));
  assert.throws(()=>shortestPath(graph,1,3),/Stop is missing/);
  assert.throws(()=>shortestPath(graph,1,999),/Stop is missing/);
});
test("pedestrian oneway permits only the specified direction", () => {
  const graph=buildWalkingGraph(snapshot([node(1,0,0),node(2,0,.001),way(11,[1,2],{"oneway:foot":"-1"})]));
  assert.deepEqual(shortestPath(graph,2,1).nodeIds,[2,1]);
  assert.throws(()=>shortestPath(graph,1,2),/No walking path/);
});
test("fixed intermediate visits preserve a nonzero loop and unrounded totals", () => {
  const graph=buildWalkingGraph(snapshot(square()));
  const route=routeThroughStops(graph,[stop("S",1),stop("C",3),stop("G",1)],4);
  assert.equal(route.legs.length,2);
  assert.ok(route.meters>400);
  assert.equal(route.legs[0].nodeIds.at(-1),3);
  assert.equal(route.meters,route.legs.reduce((sum,l)=>sum+l.meters,0));
  assert.ok(Math.abs(route.minutes-route.meters/1000/4*60)<1e-12);
  assert.throws(()=>routeThroughStops(graph,[stop("S",1),stop("C",3)],0),/Walking speed/);
});
test("a later disconnected leg throws instead of returning partial success", () => {
  const graph=buildWalkingGraph(snapshot([...square(),node(5,.01,.01),node(6,.01,.011),way(15,[5,6])]));
  assert.throws(()=>routeThroughStops(graph,[stop("S",1),stop("C",3),stop("G",5)]),/No walking path/);
});
