import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {buildExpandedAudit,verifyRouteSource,AUDIT_CASES} from "../scripts/expanded-route-audit.mjs";
import {renderExpandedAudit} from "../scripts/render-expanded-audit.mjs";
import {buildWalkingGraph,distanceMeters} from "../lib/route/graph.ts";
import {walkingSegments} from "../lib/route/road-connection.ts";
const result=buildExpandedAudit(),r=result.report;
test("pinned expanded audit accounts for every directed pair and all fifteen outlying candidates",()=>{
 assert.equal(r.candidateSpots,178);assert.equal(r.orderedPairs,31506);assert.equal(r.reachablePairs,26470);assert.equal(r.unreachablePairs,5036);
 assert.deepEqual(r.mutualGroupSizes,[163,7,5,2,1]);assert.equal(r.groups.reduce((n,g)=>n+g.spots,0),178);
 const outside=r.groups.slice(1).flatMap(g=>g.members.map(s=>s.id));assert.equal(outside.length,15);assert.equal(new Set(outside).size,15);
 assert.equal(r.source.roadSha256,"136cee0ede7985d7abef29be66aab80b0fbc3454130999b0cf3502fee287e0f0");
});
test("component diagnosis retains foot destination and gate evidence without adopting nearby bridge candidates",()=>{
 const cuts=r.groups.flatMap(g=>g.cuts),reviewWays=cuts.filter(c=>c.wayPolicy.state!=="allowed");
 assert.deepEqual([...new Set(reviewWays.map(c=>c.wayId))].sort((a,b)=>a-b),[133520266,133524349,420040236,420040241,1491198923]);
 assert.ok(reviewWays.every(c=>c.tags.foot==="destination"&&c.wayPolicy.state==="review"));
 assert.ok(cuts.some(c=>c.nodes.some(n=>n.id===2705336266&&n.tags.barrier==="gate"&&n.state==="review")));
 const museum=r.groups.find(g=>g.id==="G4");assert.equal(museum.diagnosis,"no-shared-source-road-link");assert.deepEqual(museum.sourceWayIds,[892124899,892124900]);assert.equal(museum.cuts.length,0);
 const s=museum.members.find(s=>s.name==="白秋記念館");assert.equal(s.automatic.wayId,892124899);assert.equal(s.nearestMajorForInspectionOnly.wayId,1412777255);assert.equal(s.nearestMajorForInspectionOnly.tags.bridge,"yes");assert.equal(s.nearestMajorForInspectionOnly.tags.layer,"1");
 assert.ok(s.nearestMajorForInspectionOnly.gapMeters<13);
});
test("seven representative inputs include bridge geometry both ways and explicit unreachable cases",()=>{
 assert.deepEqual(r.cases.map(c=>c.id),AUDIT_CASES.map(c=>c.id));
 assert.equal(r.cases.filter(c=>c.state==="ready").length,5);
 const out=r.cases.find(c=>c.id==="bridge-out"),back=r.cases.find(c=>c.id==="bridge-back");
 assert.ok(Math.abs(out.meters-3313.8439428446814)<1e-6&&Math.abs(out.meters-back.meters)<1e-6);
 assert.ok(out.bridgeWays.some(w=>w.id===787877796&&w.tags.bridge==="yes"&&w.tags.highway==="footway"));
 assert.deepEqual(out.bridgeWays,back.bridgeWays);assert.equal(out.cards,69);assert.equal(back.cards,69);
 assert.deepEqual(r.cases.filter(c=>c.state==="blocked").map(c=>c.id),["separated","museum"]);
 assert.deepEqual(r.checks,{checkedSourceEdges:481,checkedCards:186,checkedReadyContexts:141});
});
test("held occurrences expose actual short arms and keep source-access warnings separately",()=>{
 const held=r.cases.flatMap(c=>c.held??[]);assert.equal(held.length,45);
 for(const h of held){assert.ok(h.nodeId!==0);assert.ok(h.selectedArms.some(a=>a.pathPixels<30&&a.meters>0));assert.ok(h.selectedArms.every(a=>Math.abs(a.pathPixels-a.meters*98/30)<1e-9))}
 const loop=r.cases[0];assert.equal(loop.cards,39);assert.deepEqual(loop.held.map(h=>h.sequence),[1,2,21,22,24,25,27,28,30,31,38,39]);
 assert.ok(r.cases.find(c=>c.id==="coast").sourceIssues.some(c=>c.sequence===2&&c.nodeId===1469278868));
});
test("source verification rejects forged way identities, positions, distances and walking direction",()=>{
 const graph=buildWalkingGraph({schemaVersion:1,bounds:{south:-1,north:1,west:-1,east:1},elements:[
  {type:"node",id:1,lat:0,lon:0},{type:"node",id:2,lat:0,lon:.001},{type:"way",id:3,nodes:[1,2],tags:{highway:"path","oneway:foot":"yes"}}
 ]}),segments=walkingSegments(graph),edge=graph.adjacency.get(1)[0],route={legs:[{edges:[edge]}]},saved=structuredClone(graph);
 assert.equal(verifyRouteSource(graph,route,new Map(),segments),1);
 assert.throws(()=>verifyRouteSource(graph,{legs:[{edges:[{...edge,wayId:99}]}]},new Map(),segments),/original segment/);
 assert.throws(()=>verifyRouteSource(graph,{legs:[{edges:[{...edge,from:2,to:1}]}]},new Map(),segments),/walking direction/);
 assert.throws(()=>verifyRouteSource(graph,{legs:[{edges:[{...edge,meters:edge.meters+10}]}]},new Map(),segments),/source distance/);
 graph.nodes.get(2).lat=.1;assert.throws(()=>verifyRouteSource(graph,route,new Map(),segments),/original geometry/);
 graph.nodes.get(2).lat=0;assert.deepEqual(graph,saved);assert.ok(distanceMeters(graph.nodes.get(1),graph.nodes.get(2))>100);
});
test("standalone evidence escapes source text and has no scripts, tile requests or external assets",()=>{
 const poisoned=structuredClone(result);poisoned.report.groups[1].members[0].name='<script src="https://invalid.test/x">bad</script>';poisoned.groupFigures[0].spots[0].name='<img src="https://invalid.test/x">';
 const html=renderExpandedAudit(poisoned);
 assert.match(html,/&lt;script/);assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<script\b|<img\b|<iframe\b|<link\b|url\(https?:/i);
 assert.match(html,/Content-Security-Policy/);assert.match(html,/default-src 'none'/);assert.match(html,/現地未確認/);
 for(const c of r.cases)assert.ok(html.includes('id="'+c.id+'"'));
 assert.equal((html.match(/案内図は保留/g)??[]).length,45);
 assert.equal(readFileSync(new URL("../data/miura-expanded/source.json",import.meta.url),"utf8").includes(r.source.roadSha256),true);
});
