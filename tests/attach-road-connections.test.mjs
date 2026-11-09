import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {buildWalkingGraph,distanceMeters} from "../lib/route/graph.ts";
import {walkingSegments} from "../lib/route/road-connection.ts";
import {attachRoadConnections} from "../lib/route/attach-road-connections.ts";
import {shortestPath,routeThroughStops} from "../lib/route/routing.ts";
import {buildRoadBranches,extractJunctions} from "../lib/route/junctions.ts";
import {prepareExpandedRoadConnections,getExpandedSegments,expandedRoadSource} from "../lib/miura-road-connections.ts";
import {mergeSpotEdits} from "../lib/spots/editing.ts";
import {getBrowserSpots} from "../lib/spots/browser-catalog.ts";
const source={snapshotSha256:"a".repeat(64),osmBaseTimestamp:"2026-11-08T16:11:34Z"};
const node=(id,lat,lon,tags)=>({type:"node",id,lat,lon,...(tags?{tags}:{})});
const way=(id,nodes,tags={})=>({type:"way",id,nodes,tags:{highway:"residential",...tags}});
const nodes=[node(1,35.14,139.62),node(2,35.14,139.622)];
const graph=(tags={},elements=[...nodes,way(10,[1,2],tags)])=>buildWalkingGraph({schemaVersion:1,bounds:{south:35,west:139,north:36,east:140},elements});
function connection(g,id,fraction,wayId=10){
 const segment=walkingSegments(g).find(s=>s.wayId===wayId),point={lat:segment.from.lat+(segment.to.lat-segment.from.lat)*fraction,lon:segment.from.lon+(segment.to.lon-segment.from.lon)*fraction};
 const facility={lat:point.lat+.00005,lon:point.lon};
 return {spotId:"osm-node-"+(100+id),spotRevision:0,facility,point,fraction,distanceMeters:distanceMeters(facility,point),segment,...source};
}
const attach=(g,cs)=>attachRoadConnections(g,cs,source);
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-6,actual+" != "+expected);
const path=(r,a,b)=>shortestPath(r.graph,r.nodeIdsBySpot.get(a.spotId),r.nodeIdsBySpot.get(b.spotId));
const normalized=g=>JSON.stringify({nodes:[...g.nodes],ways:[...g.ways],adjacency:[...g.adjacency],diagnostics:g.diagnostics});
test("interior candidates split an edge with its original distance, geometry and provenance",()=>{
 const g=graph(),a=connection(g,1,.25),b=connection(g,2,.75),r=attach(g,[a,b]),p=path(r,a,b),meters=g.adjacency.get(1)[0].meters;
 near(p.meters,meters*.5);near(path(r,b,a).meters,meters*.5);
 near(shortestPath(r.graph,1,2).meters,meters);
 assert.equal(r.splits.size,2);assert.deepEqual(r.graph.ways.get(10).nodes,[1,r.nodeIdsBySpot.get(a.spotId),r.nodeIdsBySpot.get(b.spotId),2]);
 for(const [id,split]of r.splits){assert.ok(id<0);assert.equal(split.wayId,10);assert.equal(split.fromNodeId,1);assert.equal(split.toNodeId,2);assert.ok(r.graph.nodes.has(id))}
 assert.equal(r.graph.adjacency.get(1).some(e=>e.to===2),false);
});
test("facility-to-road gaps are not inserted as walkable edges or included in road distance",()=>{
 const g=graph(),a=connection(g,1,.2),b=connection(g,2,.8),r=attach(g,[a,b]);
 near(path(r,a,b).meters,g.adjacency.get(1)[0].meters*.6);
 assert.equal(r.graph.nodes.size,g.nodes.size+2);
 for(const n of r.graph.nodes.values())assert.notDeepEqual({lat:n.lat,lon:n.lon},a.facility);
});
test("endpoint candidates reuse original IDs without creating zero-length edges",()=>{
 const g=graph(),a=connection(g,1,0),b=connection(g,2,1),r=attach(g,[a,b]);
 assert.equal(r.nodeIdsBySpot.get(a.spotId),1);assert.equal(r.nodeIdsBySpot.get(b.spotId),2);assert.equal(r.splits.size,0);
 assert.equal(normalized(r.graph),normalized(g));
});
test("multiple spots on the same represented point share a node and allow a zero-distance visit leg",()=>{
 const g=graph(),a=connection(g,1,.5),b=connection(g,2,.5),r=attach(g,[a,b]);
 assert.equal(r.splits.size,1);assert.equal(r.nodeIdsBySpot.get(a.spotId),r.nodeIdsBySpot.get(b.spotId));assert.equal(path(r,a,b).meters,0);
 const stops=[a,b,a].map((c,i)=>({id:"visit-"+i,name:c.spotId,nodeId:r.nodeIdsBySpot.get(c.spotId),note:"unverified"}));
 const route=routeThroughStops(r.graph,stops);assert.equal(route.legs.length,2);assert.equal(route.meters,0);assert.equal(extractJunctions(r.graph,route).totalMeters,0);
});
for(const reverse of [false,true])test("foot one-way direction survives splitting: "+(reverse?"reverse":"forward"),()=>{
 const g=reverse?graph({},[...nodes,way(10,[2,1],{"oneway:foot":"yes"})]):graph({"oneway:foot":"yes"});
 const a=connection(g,1,.25),b=connection(g,2,.75),r=attach(g,[a,b]);
 near(path(r,reverse?b:a,reverse?a:b).meters,distanceMeters(nodes[0],nodes[1])*.5);
 assert.throws(()=>path(r,reverse?a:b,reverse?b:a),/No walking path/);
 assert.deepEqual(r.graph.ways.get(10).nodes,reverse?[2,r.nodeIdsBySpot.get(b.spotId),r.nodeIdsBySpot.get(a.spotId),1]:[1,r.nodeIdsBySpot.get(a.spotId),r.nodeIdsBySpot.get(b.spotId),2]);
});
test("vehicle-only one-way does not create a new pedestrian restriction",()=>{
 const g=graph({oneway:"yes"}),a=connection(g,1,.2),b=connection(g,2,.8),r=attach(g,[a,b]);near(path(r,a,b).meters,path(r,b,a).meters);
});
test("parallel roads sharing endpoints do not merge interior candidate points",()=>{
 const g=graph({},[...nodes,way(10,[1,2]),way(20,[1,2])]),a=connection(g,1,.5,10),b=connection(g,2,.5,20),r=attach(g,[a,b]);
 assert.notEqual(r.nodeIdsBySpot.get(a.spotId),r.nodeIdsBySpot.get(b.spotId));near(path(r,a,b).meters,distanceMeters(nodes[0],nodes[1]));
});
test("coincident bridge/tunnel geometries with distinct OSM nodes stay disconnected",()=>{
 const g=graph({},[...nodes,node(3,35.14,139.62),node(4,35.14,139.622),way(10,[1,2],{bridge:"yes",layer:"1"}),way(20,[3,4],{tunnel:"yes",layer:"-1"})]);
 const a=connection(g,1,.5,10),b=connection(g,2,.5,20),r=attach(g,[a,b]);assert.notEqual(r.nodeIdsBySpot.get(a.spotId),r.nodeIdsBySpot.get(b.spotId));
 assert.throws(()=>path(r,a,b),/No walking path/);
});
test("permission, barrier and boundary exclusions cannot be bypassed with a supplied candidate",()=>{
 const base=graph(),c=connection(base,1,.5);
 for(const tags of [{foot:"no"},{access:"private"},{motorroad:"yes"},{"foot:conditional":"no @ (Mo)"}])assert.throws(()=>attach(graph(tags),[c]),/allowed source segment/);
 const blocked=graph({},[nodes[0],{...nodes[1],tags:{barrier:"wall"}},way(10,[1,2])]);assert.throws(()=>attach(blocked,[c]),/allowed source segment/);
 const outside=buildWalkingGraph({schemaVersion:1,bounds:{south:35,west:139,north:35.14,east:139.621},elements:[...nodes,way(10,[1,2])]});assert.throws(()=>attach(outside,[c]),/allowed source segment/);
});
test("stale source version, wrong geometry/direction and duplicated spot identities are rejected",()=>{
 const g=graph(),a=connection(g,1,.5);
 for(const mutate of [
  v=>v.snapshotSha256="b".repeat(64),v=>v.osmBaseTimestamp="2026-11-07T00:00:00Z",
  v=>v.segment.forward=false,v=>v.segment.to.lat+=.01,v=>v.point.lon+=.01,v=>v.fraction=NaN
 ]){const c=structuredClone(a);mutate(c);assert.throws(()=>attach(g,[c]))}
 assert.throws(()=>attach(g,[a,a]),/Duplicate spot/);assert.throws(()=>attachRoadConnections(g,[a],{...source,snapshotSha256:"bad"}),/Invalid road source/);
});
test("virtual IDs and graph output are deterministic regardless of candidate input order",()=>{
 const g=graph(),cs=[connection(g,4,.75),connection(g,1,.25),connection(g,2,.5)];
 assert.deepEqual(attach(g,cs),attach(g,[...cs].reverse()));
});
test("no candidates preserve the graph and returned graph data never alias the input",()=>{
 const g=graph(),original=structuredClone(g),a=connection(g,1,.5),r=attach(g,[a]);
 assert.deepEqual(g,original);
 r.graph.nodes.get(1).lat=0;r.graph.ways.get(10).tags.highway="bad";r.graph.ways.get(10).nodes.push(999);r.graph.adjacency.get(1)[0].meters=0;
 assert.deepEqual(g,original);assert.deepEqual(attach(g,[]).graph,g);
});
test("a repeated source segment is split in every physical occurrence",()=>{
 const g=graph({},[...nodes,way(10,[1,2,1])]),a=connection(g,1,.5),r=attach(g,[a]),id=r.nodeIdsBySpot.get(a.spotId);
 assert.deepEqual(r.graph.ways.get(10).nodes,[1,id,2,id,1]);near(shortestPath(r.graph,1,2).meters,distanceMeters(nodes[0],nodes[1]));
});
test("split points retain two physical branches and preserve genuine junctions",()=>{
 const g=graph({},[...nodes,node(3,35.141,139.622),node(4,35.139,139.622),way(10,[1,2]),way(20,[3,2,4])]),a=connection(g,1,.5),r=attach(g,[a]),branches=buildRoadBranches(r.graph);
 assert.equal(branches.get(r.nodeIdsBySpot.get(a.spotId)).length,2);assert.equal(branches.get(2).length,3);
 const stops=[{id:"S",name:"S",nodeId:1,note:""},{id:"G",name:"G",nodeId:3,note:""}],route=routeThroughStops(r.graph,stops),junctions=extractJunctions(r.graph,route);
 assert.equal(junctions.candidates.some(c=>c.nodeId===r.nodeIdsBySpot.get(a.spotId)),false);assert.ok(junctions.candidates.some(c=>c.nodeId===2));
});
const spots=mergeSpotEdits(getBrowserSpots(),[]),roadData=JSON.parse(readFileSync(new URL("../data/miura-expanded/roads.json",import.meta.url)));
test("all 178 fixed candidates attach to actual allowed source edges without altering source data",()=>{
 const before=JSON.stringify(roadData),r=prepareExpandedRoadConnections(spots),original=buildWalkingGraph(roadData);
 assert.equal(r.nodeIdsBySpot.size,178);assert.equal(r.connections.length,178);
 for(const c of r.connections){
  const id=r.nodeIdsBySpot.get(c.spotId),point=r.graph.nodes.get(id);
  near(distanceMeters(point,c.point),0);
  if(id<0){const p=r.splits.get(id);assert.equal(p.wayId,c.segment.wayId);assert.equal(p.fraction,c.fraction)}
  assert.equal(c.snapshotSha256,expandedRoadSource.roadSnapshotSha256);
 }
 assert.equal(JSON.stringify(roadData),before);assert.deepEqual(getExpandedSegments(),walkingSegments(original));
 for(const edges of r.graph.adjacency.values())for(const edge of edges){
  const sourceEnds=id=>r.splits.has(id)?[r.splits.get(id).fromNodeId,r.splits.get(id).toNodeId]:[id];
  const valid=sourceEnds(edge.from).some(a=>sourceEnds(edge.to).some(b=>original.adjacency.get(a)?.some(e=>e.to===b&&e.wayId===edge.wayId)));
  assert.ok(valid);assert.ok(edge.meters>0);
 }
});
test("adapter supports a shared start/finish spot, rejects conflicting versions and keeps its cache isolated",()=>{
 const spot=spots[0],a=prepareExpandedRoadConnections([spot,spot]),id=a.nodeIdsBySpot.get(spot.id),before={...a.graph.nodes.get(id)};
 assert.equal(a.connections.length,1);assert.throws(()=>prepareExpandedRoadConnections([spot,{...spot,revision:1}]),/Conflicting versions/);
 a.graph.nodes.get(id).lat=0;const b=prepareExpandedRoadConnections([spot]);assert.deepEqual(b.graph.nodes.get(b.nodeIdsBySpot.get(spot.id)),before);
});

test("split lengths retain each source direction's original weight",()=>{
 const g=graph();g.adjacency.get(2)[0].meters*=2;const a=connection(g,1,.25),b=connection(g,2,.75),r=attach(g,[a,b]);
 near(path(r,a,b).meters,g.adjacency.get(1)[0].meters*.5);near(path(r,b,a).meters,g.adjacency.get(2)[0].meters*.5);
});
test("rounding-coincident fractions share a node, and a rounded endpoint creates no tiny zero edge",()=>{
 const g=graph(),a=connection(g,1,.5),b=connection(g,2,.5+Number.EPSILON),c=connection(g,3,1e-25),r=attach(g,[a,b,c]);
 assert.deepEqual(a.point,b.point);assert.equal(r.nodeIdsBySpot.get(a.spotId),r.nodeIdsBySpot.get(b.spotId));assert.equal(r.nodeIdsBySpot.get(c.spotId),1);
 assert.equal(r.splits.size,1);for(const es of r.graph.adjacency.values())for(const e of es)assert.ok(e.meters>0);
});
test("virtual node IDs cannot collide with existing graph IDs",()=>{
 const g=graph();g.nodes.set(-1,node(-1,35.15,139.63));const a=connection(g,1,.5),r=attach(g,[a]);assert.equal(r.nodeIdsBySpot.get(a.spotId),-2);assert.deepEqual(r.graph.nodes.get(-1),g.nodes.get(-1));
});
let liveGraph;
const live=()=>liveGraph??=prepareExpandedRoadConnections(spots);
const liveStops=ids=>ids.map((spotId,i)=>({id:"visit-"+i,name:spots.find(s=>s.id===spotId).name,nodeId:live().nodeIdsBySpot.get(spotId),note:"unverified candidate"}));
test("real road routes retain the requested visit order and cross the recorded bridge footway",()=>{
 const ids=["osm-way-384676338","osm-way-394752558","osm-node-2046962408","osm-way-384676338"],r=live(),route=routeThroughStops(r.graph,liveStops(ids));
 assert.deepEqual(route.stops.map(s=>s.name),ids.map(id=>spots.find(s=>s.id===id).name));assert.equal(route.legs.length,3);near(route.meters,1231.9926403365716);
 const cross=routeThroughStops(r.graph,liveStops(["osm-node-2046962408","osm-node-1211621029"]));
 near(cross.meters,3313.8439428446814);assert.ok(cross.legs[0].edges.some(e=>e.wayId===787877796));
 const bridge=r.graph.ways.get(787877796);assert.equal(bridge.tags.bridge,"yes");assert.equal(bridge.tags.highway,"footway");
 assert.ok(distanceMeters(r.graph.nodes.get(bridge.nodes[0]),r.graph.nodes.get(bridge.nodes.at(-1)))>500);
});
test("unconnected real candidates fail without skipping the requested stop or creating a straight route",()=>{
 const r=live(),ids=["osm-node-1211621029","osm-node-12364319660"];
 assert.throws(()=>routeThroughStops(r.graph,liveStops(ids)),/No walking path/);
 assert.throws(()=>routeThroughStops(r.graph,liveStops(ids.reverse())),/No walking path/);
});
test("offline report is deterministic, covers every ordered pair and distinguishes unreachable from zero distance",()=>{
 const once=execFileSync(process.execPath,["scripts/connection-route-report.mjs"],{encoding:"utf8"}),again=execFileSync(process.execPath,["scripts/connection-route-report.mjs"],{encoding:"utf8"});
 assert.equal(once,again);const r=JSON.parse(once);
 assert.equal(r.candidateSpots,178);assert.equal(r.orderedPairs,31506);assert.equal(r.reachablePairs,26470);assert.equal(r.unreachablePairs,5036);
 assert.deepEqual(r.mutualReachabilityGroupSizes,[163,7,5,2,1]);assert.equal(r.spotsOutsideLargestMutualGroup.length,15);
 const cross=r.examples.find(e=>e.label==="三崎から城ヶ島灯台");assert.equal(cross.status,"reachable-on-road-data");assert.ok(cross.bridgeWays.some(w=>w.id===787877796));
 const held=r.examples.find(e=>e.label==="城ヶ島の灯台間");assert.equal(held.status,"unreachable-on-road-data");assert.equal(held.roadMeters,null);assert.equal(held.roadMinutes,null);
 assert.equal(r.state,"local-verification-unverified-candidates");assert.equal(r.source.snapshotSha256,expandedRoadSource.roadSnapshotSha256);
});
