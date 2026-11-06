import assert from "node:assert/strict";
import test from "node:test";
import { buildWalkingGraph, distanceMeters } from "../lib/route/graph.ts";
import { extractJunctions } from "../lib/route/junctions.ts";
import { routeThroughStops } from "../lib/route/routing.ts";
import { createKomaMaps, projectKomaPoint, arrowPath, KOMA_VIEW } from "../lib/route/koma.ts";
import { createMisakiKomaPoc, bindKomaCards } from "../lib/misaki-koma.ts";
import { readFileSync } from "node:fs";

const node=(id,lat,lon,tags)=>({type:"node",id,lat,lon,tags});
const way=(id,nodes,tags={})=>({type:"way",id,nodes,tags:{highway:"residential",...tags}});
const stop=(id,nodeId)=>({id,name:id,nodeId,note:"test"});
const graphOf=elements=>buildWalkingGraph({schemaVersion:1,bounds:{south:-1,west:-1,north:1,east:1},elements});
const routeOf=(graph,visits)=>routeThroughStops(graph,visits.map((id,i)=>stop(String(i),id)));
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const tee=()=>graphOf([node(1,0,-.001),node(2,0,0),node(3,.001,0),node(4,0,.001),way(11,[1,2]),way(12,[2,3]),way(13,[2,4])]);

test("projection rotates heading to the top, with right/left and source distances preserved",()=>{
  const center={lat:0,lon:0};
  const incoming=projectKomaPoint(center,{lat:0,lon:-.001},90);
  close(incoming.x,0);assert.ok(incoming.y>0);
  const left=projectKomaPoint(center,{lat:.001,lon:0},90);
  assert.ok(left.x<0);close(left.y,0);
  const right=projectKomaPoint(center,{lat:-.001,lon:0},90);
  assert.ok(right.x>0);close(right.y,0);
  close(Math.hypot(left.x,left.y),distanceMeters(center,{lat:.001,lon:0}));
  assert.throws(()=>projectKomaPoint(center,center,NaN),/Invalid diagram heading/);
});
test("all branches and the selected inlet/exit survive rotation",()=>{
  const graph=tee(),route=routeOf(graph,[1,3]);
  const cards=createKomaMaps(graph,extractJunctions(graph,route));
  const c=cards.find(c=>c.nodeId===2);
  assert.equal(c.state,"ready");assert.equal(c.branches.length,3);
  const inlet=c.branches.find(b=>b.arrival),exit=c.branches.find(b=>b.departure);
  assert.equal(inlet.neighborNodeId,1);assert.equal(exit.neighborNodeId,3);
  close(inlet.points.at(-1).x,KOMA_VIEW.centerX);
  assert.ok(inlet.points.at(-1).y>KOMA_VIEW.centerY);
  assert.ok(exit.points.at(-1).x<KOMA_VIEW.centerX);
});
test("local clipping retains source-edge provenance instead of extending roads",()=>{
  const graph=tee(),analysis=extractJunctions(graph,routeOf(graph,[1,3]));
  const c=createKomaMaps(graph,analysis).find(c=>c.nodeId===2);
  const b=c.branches.find(b=>b.neighborNodeId===1);
  assert.equal(b.endReason,"limit");
  assert.equal(b.sourceSegments.length,1);
  const edge=b.sourceSegments[0];
  assert.deepEqual([edge.from,edge.to,edge.wayIds],[2,1,[11]]);
  close(edge.fraction*distanceMeters(graph.nodes.get(2),graph.nodes.get(1)),30);
  assert.equal(b.points.at(-1).nodeId,null);
  close(Math.hypot(b.points.at(-1).x-KOMA_VIEW.centerX,b.points.at(-1).y-KOMA_VIEW.centerY),KOMA_VIEW.radius);
});
test("degree-two curves retain original shape points and stop at the next branch",()=>{
  const graph=graphOf([
    node(1,0,-.001),node(2,0,0),node(3,.001,0),node(4,0,.00008),node(5,.00008,.00008),node(6,.00008,.00015),node(7,.00015,.00008),
    way(11,[1,2,3]),way(12,[2,4,5]),way(13,[5,6]),way(14,[5,7]),
  ]);
  const card=createKomaMaps(graph,extractJunctions(graph,routeOf(graph,[1,3]))).find(c=>c.nodeId===2);
  assert.equal(card.state,"ready");
  const branch=card.branches.find(b=>b.neighborNodeId===4);
  assert.deepEqual(branch.points.map(p=>p.nodeId),[2,4,5]);
  assert.equal(branch.endReason,"junction");
  assert.equal(branch.sourceSegments.length,2);
  assert.notEqual(branch.points[1].x,branch.points[2].x);
  assert.notEqual(branch.points[0].y,branch.points[1].y);
});
test("start points up, finish has no exit, and a return reuses the same branch",()=>{
  const graph=tee(),analysis=extractJunctions(graph,routeOf(graph,[1,3,1]));
  const cards=createKomaMaps(graph,analysis);
  assert.equal(cards[0].kind,"start");assert.ok(!cards[0].branches.some(b=>b.arrival));
  close(cards[0].branches.find(b=>b.departure).points[1].x,KOMA_VIEW.centerX);
  assert.ok(cards[0].branches.find(b=>b.departure).points[1].y<KOMA_VIEW.centerY);
  assert.equal(cards.at(-1).kind,"finish");assert.ok(!cards.at(-1).branches.some(b=>b.departure));
  const returned=cards.find(c=>c.kind==="return");
  assert.equal(returned.branches.length,1);
  assert.equal(returned.branches[0].arrival,true);assert.equal(returned.branches[0].departure,true);
});
test("excluded branches remain present in the diagram model",()=>{
  const graph=graphOf([node(1,0,-.001),node(2,0,0),node(3,.001,0),node(4,0,.001),way(11,[1,2,3]),way(12,[2,4],{foot:"no"})]);
  const c=createKomaMaps(graph,extractJunctions(graph,routeOf(graph,[1,3]))).find(c=>c.nodeId===2);
  assert.equal(c.state,"ready");assert.equal(c.branches.find(b=>b.neighborNodeId===4).exit,"excluded");
});
test("short selected arms remain as held cards without a misleading partial intersection",()=>{
  const graph=graphOf([node(1,0,-.001),node(2,0,0),node(3,.00002,0),node(4,0,.001),way(11,[1,2]),way(12,[2,3]),way(13,[2,4])]);
  const card=createKomaMaps(graph,extractJunctions(graph,routeOf(graph,[1,3]))).find(c=>c.nodeId===2);
  assert.equal(card.state,"held");assert.deepEqual(card.branches,[]);
  assert.ok(card.issues.some(s=>s.includes("too short")));
});
test("unknown direction and mismatched branch sets hold the entire diagram",()=>{
  const graph=tee(),analysis=extractJunctions(graph,routeOf(graph,[1,3]));
  const missing=structuredClone(analysis);missing.candidates.find(c=>c.nodeId===2).branches.pop();
  assert.equal(createKomaMaps(graph,missing).find(c=>c.nodeId===2).state,"held");
  const unknown=structuredClone(analysis);unknown.candidates.find(c=>c.nodeId===2).arrival.bearingDegrees=null;
  const held=createKomaMaps(graph,unknown).find(c=>c.nodeId===2);
  assert.equal(held.state,"held");assert.deepEqual(held.branches,[]);
});
test("arrow trimming follows bent geometry and never cuts across a corner",()=>{
  const points=[{x:0,y:0,nodeId:1},{x:10,y:0,nodeId:2},{x:10,y:20,nodeId:3}];
  const p=arrowPath(points,.5);
  assert.deepEqual(p.slice(0,2),points.slice(0,2));
  close(p.at(-1).x,10);close(p.at(-1).y,5);
  assert.throws(()=>arrowPath(points,0),/Invalid arrow path/);
});
test("invalid drawing extent fails explicitly",()=>{
  const graph=tee(),analysis=extractJunctions(graph,routeOf(graph,[1,3]));
  assert.throws(()=>createKomaMaps(graph,analysis,0),/Invalid local drawing extent/);
});
test("all generated Misaki occurrences retain source branches and distances",()=>{
  const {koma,junctions}=createMisakiKomaPoc();
  assert.equal(koma.length,junctions.candidates.length);
  for(const [i,card] of koma.entries()){
    assert.equal(card.map.state,"ready");
    assert.equal(card.map.sequence,i+1);
    assert.equal(card.map.metersToNext,junctions.candidates[i].metersToNext);
    assert.deepEqual(card.map.branches.map(b=>b.neighborNodeId),junctions.candidates[i].branches.map(b=>b.neighborNodeId));
    for(const branch of card.map.branches)for(const p of branch.points){
      assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));
      assert.ok(p.x>=0&&p.x<=KOMA_VIEW.width&&p.y>=0&&p.y<=KOMA_VIEW.height);
    }
  }
  assert.equal(koma.reduce((sum,c)=>sum+(c.map.metersToNext??0),0).toFixed(6),"1026.679649");
});
test("fixed pre-extraction reference still matches the rendered generated arm sets",()=>{
  const {koma}=createMisakiKomaPoc();
  const reference=JSON.parse(readFileSync(new URL("../data/misaki/junction-reference.json",import.meta.url),"utf8"));
  for(const item of reference.cases)for(const pass of item.generatedPasses){
    const map=koma.find(c=>c.map.pathIndex===pass.pathIndex).map;
    assert.deepEqual(map.branches.map(b=>b.neighborNodeId),[...item.neighbors].sort((a,b)=>a-b));
    assert.equal(map.branches.find(b=>b.arrival)?.neighborNodeId??null,pass.previous);
    assert.equal(map.branches.find(b=>b.departure)?.neighborNodeId??null,pass.next);
  }
});
test("checkpoint and waypoint bindings follow occurrences instead of node IDs alone",()=>{
  const p=createMisakiKomaPoc();
  assert.deepEqual(p.koma.flatMap(c=>c.stops.map(s=>s.id)),["S","C1","W1","C2","G"]);
  assert.deepEqual(p.koma.filter(c=>c.map.kind==="return").flatMap(c=>c.stops.map(s=>s.id)),["C1","W1","C2"]);
  assert.equal(p.koma[0].map.nodeId,p.koma.at(-1).map.nodeId);
  assert.deepEqual(p.koma[0].stops.map(s=>s.id),["S"]);assert.deepEqual(p.koma.at(-1).stops.map(s=>s.id),["G"]);
  assert.throws(()=>bindKomaCards(p.route,p.junctions,[]),/count mismatch/);
});
test("reference retains every occurrence including held close junctions",()=>{
  const p=createMisakiKomaPoc();
  assert.equal(p.referenceKoma.length,p.referenceJunctions.candidates.length);
  assert.ok(p.referenceKoma.some(c=>c.map.state==="held"));
  for(const [i,c] of p.referenceKoma.entries()){
    assert.equal(c.map.sequence,i+1);
    assert.equal(c.map.metersToNext,p.referenceJunctions.candidates[i].metersToNext);
    if(c.map.state==="held")assert.deepEqual(c.map.branches,[]);
  }
});
