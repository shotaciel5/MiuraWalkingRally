import assert from "node:assert/strict";
import test from "node:test";
import { distanceMeters, buildWalkingGraph } from "../lib/route/graph.ts";
import { routeThroughStops } from "../lib/route/routing.ts";
import { bearingDegrees, relativeDegrees, buildRoadBranches, extractJunctions } from "../lib/route/junctions.ts";
import { createMisakiJunctionPoc } from "../lib/misaki-junctions.ts";
import { readFileSync } from "node:fs";

const node = (id, lat, lon, tags) => ({type:"node",id,lat,lon,tags});
const way = (id, nodes, tags={}) => ({type:"way",id,nodes,tags:{highway:"residential",...tags}});
const stop = (id, nodeId) => ({id,name:id,nodeId,note:"test"});
const graphOf = elements => buildWalkingGraph({schemaVersion:1,bounds:{south:-1,west:-1,north:1,east:1},elements});
const tee = (tags={}) => graphOf([
  node(1,0,-.001),node(2,0,0),node(3,.001,0),node(4,0,.001),
  way(11,[1,2]),way(12,[2,3]),way(13,[2,4],tags),
]);
const getRoute = (graph, visits=[1,3]) => routeThroughStops(graph,visits.map((id,i)=>stop(String(i),id)));
const close = (a,b) => assert.ok(Math.abs(a-b)<1e-8,`${a} differs from ${b}`);

test("cardinal bearings, signed turns and north wrap are defined",()=>{
  close(bearingDegrees({lat:0,lon:0},{lat:.001,lon:0}),0);
  close(bearingDegrees({lat:0,lon:0},{lat:0,lon:.001}),90);
  close(bearingDegrees({lat:0,lon:0},{lat:-.001,lon:0}),180);
  close(bearingDegrees({lat:0,lon:0},{lat:0,lon:-.001}),270);
  assert.equal(bearingDegrees({lat:0,lon:0},{lat:0,lon:0}),null);
  assert.equal(relativeDegrees(350,10),20);
  assert.equal(relativeDegrees(10,350),-20);
  assert.equal(relativeDegrees(0,180),-180);
  assert.throws(()=>bearingDegrees({lat:NaN,lon:0},{lat:0,lon:0}),/Invalid coordinates/);
  assert.throws(()=>relativeDegrees(NaN,0),/Invalid bearing/);
});
test("arrival follows travel into the junction and each branch uses its outward bearing",()=>{
  const graph=tee(), route=getRoute(graph);
  const center=extractJunctions(graph,route).candidates.find(c=>c.nodeId===2);
  close(center.arrival.bearingDegrees,90);
  close(center.departure.bearingDegrees,0);
  close(center.turnDegrees,-90);
  close(center.branches.find(b=>b.neighborNodeId===1).relativeDegrees,-180);
  assert.equal(center.branches.filter(b=>b.arrival).length,1);
  assert.equal(center.branches.filter(b=>b.departure).length,1);
  assert.equal(center.branches.length,3);
});
test("same node on return keeps separate occurrences, distances and reversed approaches",()=>{
  const graph=tee();
  const route=getRoute(graph,[1,3,1]);
  const analysis=extractJunctions(graph,route);
  const center=analysis.candidates.filter(c=>c.nodeId===2);
  assert.equal(center.length,2);
  assert.notEqual(center[0].pathIndex,center[1].pathIndex);
  assert.equal(center[0].arrival.neighborNodeId,1);
  assert.equal(center[1].arrival.neighborNodeId,3);
  close(center[0].turnDegrees,-90);close(center[1].turnDegrees,90);
  const reversal=analysis.candidates.find(c=>c.nodeId===3);
  assert.ok(reversal.reasons.includes("return"));
  assert.deepEqual(reversal.stopIds,["1"]);
  close(reversal.turnDegrees,-180);
  assert.equal(analysis.candidates[0].arrival,null);
  assert.equal(analysis.candidates.at(-1).departure,null);
  assert.equal(analysis.candidates.at(-1).metersToNext,null);
  close(analysis.candidates.reduce((sum,c)=>sum+(c.metersToNext??0),0),route.meters);
  assert.equal(analysis.candidates[0].nodeId,analysis.candidates.at(-1).nodeId);
});
test("leg boundary is one occurrence, while a later revisit stays separate",()=>{
  const graph=tee(), route=getRoute(graph,[1,2,3,1]);
  const centers=extractJunctions(graph,route).candidates.filter(c=>c.nodeId===2);
  assert.equal(centers.length,2);
  assert.deepEqual(centers[0].stopIds,["1"]);
  assert.deepEqual(centers[1].stopIds,[]);
  assert.ok(centers[0].arrival && centers[0].departure);
});
test("return bearing is measured at the junction, including non-equatorial oblique edges",()=>{
  const graph=graphOf([node(1,.1,.1),node(2,.2,.3),way(11,[1,2])]);
  const c=extractJunctions(graph,getRoute(graph,[1,2,1])).candidates.find(c=>c.nodeId===2);
  close(c.turnDegrees,-180);
  close(c.branches[0].relativeDegrees,-180);
});
test("degree-two shape points and way splits do not create junctions",()=>{
  const graph=graphOf([node(1,0,0),node(2,.001,0),node(3,.001,.001),way(11,[1,2]),way(12,[2,3])]);
  assert.deepEqual(extractJunctions(graph,getRoute(graph,[1,3])).candidates.map(c=>c.nodeId),[1,3]);
});
test("restricted physical branch remains visible instead of disappearing with the walking graph",()=>{
  const graph=tee({foot:"no"});
  const center=extractJunctions(graph,getRoute(graph)).candidates.find(c=>c.nodeId===2);
  const branch=center.branches.find(b=>b.neighborNodeId===4);
  assert.equal(center.branches.length,3);
  assert.equal(branch.exit,"excluded");assert.equal(branch.entry,"excluded");
  assert.equal(branch.departure,false);
});
test("pedestrian direction restrictions distinguish entry from exit",()=>{
  const graph=tee({"oneway:foot":"-1"});
  const b=buildRoadBranches(graph).get(2).find(b=>b.neighborNodeId===4);
  assert.equal(b.entry,"candidate");assert.equal(b.exit,"excluded");
});
test("unknown gate and extract cut retain review status",()=>{
  const graph=graphOf([
    node(1,0,-.001),node(2,0,0),node(3,.001,0),node(4,0,.001,{barrier:"gate"}),node(5,2,0),
    way(11,[1,2,3]),way(12,[2,4]),way(13,[2,5]),
  ]);
  const c=extractJunctions(graph,getRoute(graph)).candidates.find(c=>c.nodeId===2);
  assert.equal(c.branches.find(b=>b.neighborNodeId===4).exit,"review");
  assert.equal(c.branches.find(b=>b.neighborNodeId===5).exit,"review");
  assert.ok(c.issues.includes("branch-access-or-extract-unresolved"));
});
test("multiple ways to the same neighbor produce one arm with retained source evidence",()=>{
  const graph=graphOf([node(1,0,-.001),node(2,0,0),node(3,0,.001),way(11,[1,2]),way(12,[1,2]),way(13,[2,3])]);
  const branches=buildRoadBranches(graph).get(2);
  assert.equal(branches.length,2);
  assert.deepEqual(branches.find(b=>b.neighborNodeId===1).evidence.map(e=>e.wayId),[11,12]);
  assert.ok(!extractJunctions(graph,getRoute(graph)).candidates.some(c=>c.nodeId===2));
});
test("a geometric crossing with different node IDs never adds a connected branch",()=>{
  const graph=graphOf([
    node(1,0,-.001),node(2,0,0),node(3,0,.001),node(4,0,0),node(5,-.001,0),node(6,.001,0),
    way(11,[1,2,3],{bridge:"yes",layer:"1"}),way(12,[5,4,6]),
  ]);
  assert.equal(buildRoadBranches(graph).get(2).length,2);
  assert.ok(!extractJunctions(graph,getRoute(graph)).candidates.some(c=>c.nodeId===2));
});
test("area boundaries are not mistaken for linear road branches",()=>{
  const graph=graphOf([
    node(1,0,-.001),node(2,0,0),node(3,0,.001),node(4,-.001,0),node(5,-.001,.001),
    way(11,[1,2,3]),way(12,[2,4,5,2],{highway:"pedestrian",area:"yes"}),
  ]);
  assert.equal(buildRoadBranches(graph).get(2).length,2);
});
test("coincident source coordinates remain indeterminate rather than invented angles",()=>{
  const graph=tee();
  graph.nodes.set(5,node(5,0,0));
  graph.ways.set(15,way(15,[2,5]));
  const c=extractJunctions(graph,getRoute(graph)).candidates.find(c=>c.nodeId===2);
  assert.equal(c.branches.find(b=>b.neighborNodeId===5).bearingDegrees,null);
  assert.ok(c.issues.includes("indeterminate-branch-bearing"));
});
test("malformed/restricted route input fails before returning a partial analysis",()=>{
  const graph=tee(),route=getRoute(graph);
  const bad=structuredClone(route);bad.legs[0].edges[0].wayId=999;
  assert.throws(()=>extractJunctions(graph,bad),/missing\/restricted\/mismatched/);
  const mismatch=structuredClone(route);mismatch.meters+=1;
  assert.throws(()=>extractJunctions(graph,mismatch),/total distance mismatch/);
  const discontinuous=structuredClone(route);discontinuous.legs[0].nodeIds[1]=4;
  assert.throws(()=>extractJunctions(graph,discontinuous),/mismatched/);
});
test("Misaki branches and visits match the independently fixed pre-extraction reference",()=>{
  const manual=JSON.parse(readFileSync(new URL("../data/misaki/junction-reference.json",import.meta.url),"utf8"));
  const {junctions,referenceJunctions,source}=createMisakiJunctionPoc();
  assert.equal(manual.snapshotSha256,source.snapshotSha256);
  for(const item of manual.cases){
    const actual=junctions.candidates.filter(c=>c.nodeId===item.nodeId);
    assert.equal(actual.length,item.generatedPasses.length,item.id);
    for(const [i,expected] of item.generatedPasses.entries()){
      const c=actual[i];
      assert.equal(c.pathIndex,expected.pathIndex,item.id);
      assert.equal(c.arrival?.neighborNodeId??null,expected.previous,item.id);
      assert.equal(c.departure?.neighborNodeId??null,expected.next,item.id);
      assert.deepEqual(c.branches.map(b=>b.neighborNodeId),[...item.neighbors].sort((a,b)=>a-b),item.id);
      if(expected.stopIds)assert.deepEqual(c.stopIds,expected.stopIds,item.id);
    }
    if(item.referencePasses){
      const ref=referenceJunctions.candidates.filter(c=>c.nodeId===item.nodeId);
      assert.equal(ref.length,item.referencePasses.length,item.id);
      assert.deepEqual(ref.map(c=>({previous:c.arrival.neighborNodeId,next:c.departure.neighborNodeId})),item.referencePasses);
      assert.deepEqual(ref[0].branches.map(b=>b.neighborNodeId),[...item.neighbors].sort((a,b)=>a-b));
    }
  }
});
test("all extracted Misaki distances partition the original route and every chosen arm has source evidence",()=>{
  const {junctions,referenceJunctions,route}=createMisakiJunctionPoc();
  for(const analysis of [junctions,referenceJunctions]){
    close(analysis.candidates.reduce((sum,c)=>sum+(c.metersToNext??0),0),analysis.totalMeters);
    assert.deepEqual(analysis.candidates.map(c=>c.sequence),analysis.candidates.map((_,i)=>i+1));
    for(const c of analysis.candidates){
      if(c.departure)assert.ok(c.branches.some(b=>b.departure && b.evidence.some(e=>e.wayId===c.departure.wayId && e.exit==="candidate")));
      if(c.arrival)assert.ok(c.branches.some(b=>b.arrival && b.evidence.some(e=>e.wayId===c.arrival.wayId && e.entry==="candidate")));
    }
  }
  close(junctions.totalMeters,route.meters);
  assert.equal(junctions.candidates.filter(c=>c.reasons.includes("return")).length,3);
});

test("candidate interval follows all road shape points rather than a straight shortcut",()=>{
  const graph=graphOf([node(1,0,0),node(2,.001,0),node(3,.001,.001),way(11,[1,2,3])]);
  const route=getRoute(graph,[1,3]);
  const analysis=extractJunctions(graph,route);
  assert.equal(analysis.candidates.length,2);
  const expected=distanceMeters(graph.nodes.get(1),graph.nodes.get(2))+distanceMeters(graph.nodes.get(2),graph.nodes.get(3));
  close(analysis.candidates[0].metersToNext,expected);
  assert.ok(analysis.candidates[0].metersToNext>distanceMeters(graph.nodes.get(1),graph.nodes.get(3)));
});
test("each Misaki interval matches its exact occurrence slice including omitted shape points",()=>{
  const {junctions,referenceJunctions,route,reference}=createMisakiJunctionPoc();
  for(const [analysis,legs] of [[junctions,route.legs],[referenceJunctions,reference]]){
    const edges=legs.flatMap(leg=>leg.edges);
    for(const [i,c] of analysis.candidates.entries()){
      close(c.metersFromStart,edges.slice(0,c.pathIndex).reduce((sum,e)=>sum+e.meters,0));
      const next=analysis.candidates[i+1];
      if(next)close(c.metersToNext,edges.slice(c.pathIndex,next.pathIndex).reduce((sum,e)=>sum+e.meters,0));
    }
  }
});
