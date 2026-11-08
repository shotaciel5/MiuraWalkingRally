import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,mkdtempSync,mkdirSync,rmSync} from "node:fs";
import {resolve,join,sep} from "node:path";
import {createHash} from "node:crypto";
import {buildWalkingGraph,distanceMeters} from "../lib/route/graph.ts";
import {closestPointOnSegment,walkingSegments,nearestWalkingSegment,decodeRoadConnection,connectionMatchesSpot} from "../lib/route/road-connection.ts";
import {EXPANDED_BOUNDS,expandedQuery,normalizeExpandedSnapshot,encodeExpandedSnapshot,expandedRoutingSnapshot} from "../lib/expanded-osm.ts";
import {getExpandedSegments,roadConnectionForSpot} from "../lib/miura-road-connections.ts";
import {getBrowserSpots} from "../lib/spots/browser-catalog.ts";
import {mergeSpotEdits} from "../lib/spots/editing.ts";
import {createSpotRepository} from "../lib/spots/local-repository.ts";
const point={lat:35.14,lon:139.62},from={lat:35.139,lon:139.619},to={lat:35.139,lon:139.621};
const segment=(extra={})=>({wayId:10,fromNodeId:1,toNodeId:2,from,to,forward:true,backward:true,name:"Test road",highway:"residential",...extra});
const snapshot=(tags={},nodeTags={})=>({schemaVersion:1,bounds:{south:35,west:139,north:36,east:140},elements:[{type:"node",id:1,...from,tags:nodeTags},{type:"node",id:2,...to},{type:"way",id:10,nodes:[1,2],tags:{highway:"residential",...tags}}]});
const sha=x=>createHash("sha256").update(x).digest("hex"),read=f=>readFileSync(new URL("../data/miura-expanded/"+f,import.meta.url));
test("nearest point projects onto a road segment rather than a distant OSM node",()=>{
 const value=closestPointOnSegment(point,from,to);assert.ok(Math.abs(value.fraction-.5)<1e-9);
 assert.ok(value.distanceMeters<distanceMeters(point,from));assert.ok(Math.abs(value.point.lon-point.lon)<1e-12);
 assert.equal(value.distanceMeters,distanceMeters(point,value.point));
});
test("segment projection clamps endpoints, handles degenerate segments and rejects invalid positions",()=>{
 assert.equal(closestPointOnSegment({lat:35.14,lon:139.61},from,to).fraction,0);
 assert.equal(closestPointOnSegment({lat:35.14,lon:139.63},from,to).fraction,1);
 assert.equal(closestPointOnSegment(point,from,from).fraction,0);
 assert.throws(()=>closestPointOnSegment({lat:NaN,lon:0},from,to));
 assert.throws(()=>nearestWalkingSegment({lat:91,lon:0},[]));
 assert.equal(nearestWalkingSegment(point,[]),null);
});
test("distance ties are stable irrespective of segment order",()=>{
 const a=segment({wayId:20}),b=segment();
 assert.equal(nearestWalkingSegment(point,[a,b]).segment.wayId,10);
 assert.deepEqual(nearestWalkingSegment(point,[a,b]),nearestWalkingSegment(point,[b,a]));
});
test("candidate roads reuse walking permissions including no-sidewalk roads and foot direction",()=>{
 assert.equal(walkingSegments(buildWalkingGraph(snapshot())).length,1);
 for(const tags of [{foot:"no"},{access:"private"},{motorroad:"yes"},{highway:"motorway"},{highway:"construction"},{foot:"yes","foot:conditional":"no @ (sunset-sunrise)"}])
  assert.equal(walkingSegments(buildWalkingGraph(snapshot(tags))).length,0,JSON.stringify(tags));
 assert.equal(walkingSegments(buildWalkingGraph(snapshot({},{barrier:"gate",access:"private"}))).length,0);
 const s=walkingSegments(buildWalkingGraph(snapshot({"oneway:foot":"yes"})))[0];assert.equal(s.forward,true);assert.equal(s.backward,false);
 const reverse=walkingSegments(buildWalkingGraph({...snapshot(),elements:[{type:"node",id:1,...from},{type:"node",id:2,...to},{type:"way",id:10,nodes:[2,1],tags:{highway:"residential","oneway:foot":"yes"}}]}))[0];
 assert.equal(reverse.forward,false);assert.equal(reverse.backward,true);
});
test("normalization is deterministic, strips private metadata and preserves restrictions/context",()=>{
 const raw={elements:[...snapshot().elements,{type:"node",id:3,...point,user:"private",uid:123,tags:{"contact:phone":"secret","addr:housenumber":"123",name:"Cafe",amenity:"cafe","foot:conditional":"no @ (Mo)","traffic_sign:backward":"JP:330"}}]};
 const value=normalizeExpandedSnapshot(raw);assert.deepEqual(value,normalizeExpandedSnapshot({elements:[...raw.elements].reverse()}));
 const n=value.elements.find(x=>x.id===3);assert.equal(n.user,undefined);assert.equal(n.tags["contact:phone"],undefined);assert.equal(n.tags["addr:housenumber"],undefined);
 assert.equal(n.tags["foot:conditional"],"no @ (Mo)");assert.equal(n.tags["traffic_sign:backward"],"JP:330");assert.equal(n.tags.amenity,"cafe");
 assert.equal(expandedRoutingSnapshot(value).elements.some(x=>x.id===3),false);
 assert.deepEqual(value.bounds,EXPANDED_BOUNDS);assert.match(expandedQuery(),/35.122,139.604,35.16,139.642/);
 assert.match(expandedQuery(),/rel\(bw.roads\)/);assert.match(expandedQuery(),/way\["building"\]/);
});
test("normalization refuses incomplete/conflicting data and does not remove unsupported foot restrictions",()=>{
 for(const raw of [{elements:[]},{remark:"timeout",elements:snapshot().elements},{elements:snapshot().elements.slice(1)},{elements:[...snapshot().elements,{...snapshot().elements[0],lat:34}]}])
  assert.throws(()=>normalizeExpandedSnapshot(raw));
 const value=normalizeExpandedSnapshot({elements:[...snapshot().elements,{type:"relation",id:20,members:[],tags:{type:"restriction:foot","restriction:foot":"no_left_turn"}}]});
 assert.throws(()=>buildWalkingGraph(expandedRoutingSnapshot(value)),/Pedestrian turn restriction/);
});
const full=JSON.parse(read("osm.json")),roads=JSON.parse(read("roads.json")),source=JSON.parse(read("source.json")),spots=mergeSpotEdits(getBrowserSpots(),[]);
test("full and derived fixed snapshots match recorded hashes and identical walking edges",()=>{
 assert.equal(sha(read("osm.json")),source.snapshotSha256);assert.equal(sha(read("roads.json")),source.roadSnapshotSha256);
 assert.equal(encodeExpandedSnapshot(full),read("osm.json").toString());
 assert.deepEqual(expandedRoutingSnapshot(full),roads);
 assert.deepEqual(walkingSegments(buildWalkingGraph(full)),getExpandedSegments());
 assert.equal(source.counts.highways,1436);assert.equal(source.roadCounts.routableNodes,8656);
});
test("all 178 seed spots have geometric candidates on allowed source edges without becoming confirmed entrances",()=>{
 const segments=getExpandedSegments(),keys=new Set(segments.map(s=>s.wayId+"/"+s.fromNodeId+"/"+s.toNodeId));
 for(const spot of spots){
  assert.ok(spot.position.lat>=EXPANDED_BOUNDS.south&&spot.position.lat<=EXPANDED_BOUNDS.north&&spot.position.lon>=EXPANDED_BOUNDS.west&&spot.position.lon<=EXPANDED_BOUNDS.east);
  const value=roadConnectionForSpot(spot);assert.ok(value);assert.ok(keys.has(value.segment.wayId+"/"+value.segment.fromNodeId+"/"+value.segment.toNodeId));
  assert.deepEqual(decodeRoadConnection(value),value);assert.ok(connectionMatchesSpot(value,spot));
  assert.equal(value.snapshotSha256,source.roadSnapshotSha256);assert.equal(value.distanceMeters,distanceMeters(spot.position,value.point));assert.equal(spot.reviewStatus,"unverified");
 }
});
test("candidate decoder rejects wrong geometry, distance, directions, identity and nonfinite values",()=>{
 const value=roadConnectionForSpot(spots[0]);
 for(const mutate of [v=>v.point.lat+=.001,v=>v.distanceMeters+=1,v=>v.fraction=2,v=>v.spotRevision=-1,v=>v.snapshotSha256="bad",v=>v.segment.forward=v.segment.backward=false,v=>v.segment.from.lat=Infinity,v=>v.spotId="bad"]){
  const bad=structuredClone(value);mutate(bad);assert.equal(decodeRoadConnection(bad),null);
 }
 assert.equal(connectionMatchesSpot(value,{...spots[0],revision:1}),false);
 assert.equal(connectionMatchesSpot(value,{...spots[0],position:{...spots[0].position,lat:spots[0].position.lat+.001}}),false);
 assert.equal(connectionMatchesSpot(value,spots[1]),false);
});
test("new and moved spots recompute candidates with no road ID input or saved connection fields",t=>{
 const parent=resolve(".tools/connection-tests");mkdirSync(parent,{recursive:true});const dir=mkdtempSync(join(parent,"case-"));
 t.after(()=>{assert.ok(resolve(dir).startsWith(parent+sep));rmSync(dir,{recursive:true,force:true})});
 const repo=createSpotRepository(join(dir,"spots.sqlite")),id="local-11111111-2222-4333-8444-555555555555";
 const input={id,expectedRevision:0,name:"New cafe",category:"cafe",position:{lat:35.141,lon:139.62},description:""};
 const first=repo.save(input),a=roadConnectionForSpot(first),changed=repo.save({...input,expectedRevision:1,position:{lat:35.128,lon:139.614}}),b=roadConnectionForSpot(changed);
 assert.ok(a&&b);assert.notDeepEqual(a.point,b.point);assert.equal(b.spotRevision,2);
 assert.equal(connectionMatchesSpot(a,changed),false);assert.equal("connection" in repo.list().find(s=>s.id===id),false);
 repo.remove({id,expectedRevision:2});assert.equal(repo.list().some(s=>s.id===id),false);
});
