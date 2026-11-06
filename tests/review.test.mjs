import assert from "node:assert/strict";
import test from "node:test";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {createMisakiKomaPoc} from "../lib/misaki-koma.ts";
import {createMisakiReviewPoc} from "../lib/misaki-review.ts";
import {extractContext,createKomaContext,polygonLabelPoint,landmarkPriority} from "../lib/route/context.ts";
import {projectKomaPoint,KOMA_VIEW,arrowPath} from "../lib/route/koma.ts";
import {layoutLandmarks,landmarkLabelLines} from "../lib/route/landmark-layout.ts";
import {nextOccurrenceIndex} from "../lib/route/review.ts";

const poc=createMisakiReviewPoc();
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const hash=file=>createHash("sha256").update(readFileSync(new URL(file,import.meta.url))).digest("hex");
test("fixed context and routing snapshots match recorded checksums and date",()=>{
 const source=JSON.parse(readFileSync(new URL("../data/misaki/context-source.json",import.meta.url),"utf8"));
 assert.equal(hash("../data/misaki/context.json"),source.snapshotSha256);
 assert.equal(hash("../data/misaki/osm.json"),source.routingSnapshotSha256);
 assert.equal(source.routingSnapshotSha256,"13cd793e7ba64c3fdfd1d86438a5eddfa37befaba5458f544a75dca388a65c84");
 assert.equal(source.requestedSnapshotAt,poc.source.osmBaseTimestamp);
});
test("same fixed inputs produce identical route, diagrams and context without changing road results",()=>{
 const original=createMisakiKomaPoc(),again=createMisakiReviewPoc();
 for(const key of ["koma","referenceKoma"]){
  assert.deepEqual(poc[key],again[key]);
  assert.deepEqual(poc[key].map(({context,...card})=>card),original[key]);
 }
 assert.equal(poc.koma.length,31);assert.equal(poc.referenceKoma.length,35);
 assert.equal(poc.referenceKoma.filter(c=>c.map.state==="held").length,10);
 assert.equal(poc.context.buildings.length,778);
});
test("map pins cycle actual occurrences, including start and finish at one node",()=>{
 const candidates=poc.koma.map(c=>c.candidate);
 assert.equal(nextOccurrenceIndex(candidates,0,candidates[0].nodeId),30);
 assert.equal(nextOccurrenceIndex(candidates,30,candidates[0].nodeId),0);
 const node=poc.koma[5].map.nodeId;
 assert.equal(nextOccurrenceIndex(candidates,0,node),5);
 assert.equal(nextOccurrenceIndex(candidates,5,node),11);
 assert.equal(nextOccurrenceIndex(candidates,11,node),25);
 assert.equal(nextOccurrenceIndex(candidates,25,node),5);
 assert.throws(()=>nextOccurrenceIndex(candidates,0,-1),/Unknown map pin/);
});
test("nearby landmarks and buildings use the same rotation and scale as the roads",()=>{
 for(const card of poc.koma){
  assert.ok(card.context.landmarks.length<=4);
  assert.ok(card.context.buildings.length<=12);
  const center=poc.graph.nodes.get(card.map.nodeId);
  for(const landmark of card.context.landmarks){
   assert.ok(landmark.meters<=30);
   const p=projectKomaPoint(center,landmark.point,card.map.headingDegrees);
   close(landmark.x,KOMA_VIEW.centerX+p.x*KOMA_VIEW.radius/30);
   close(landmark.y,KOMA_VIEW.centerY+p.y*KOMA_VIEW.radius/30);
   assert.ok(poc.context.landmarks.some(l=>l.id===landmark.id));
  }
  for(const building of card.context.buildings){
   const source=poc.context.buildings.find(b=>b.id===building.id);
   assert.equal(source.points.length,building.points.length);
   source.points.forEach((point,i)=>{const p=projectKomaPoint(center,point,card.map.headingDegrees);close(building.points[i].x,150+p.x*98/30);close(building.points[i].y,140+p.y*98/30)});
  }
 }
});
test("stairs are marked only on original steps segments; unknown road names stay empty",()=>{
 let count=0;
 for(const card of poc.koma){
  for(const step of card.context.steps){
   count++;
   assert.ok(step.wayIds.every(id=>poc.graph.ways.get(id).tags.highway==="steps"));
   assert.ok(card.map.branches.some(b=>b.sourceSegments.some((s,i)=>s.wayIds.some(id=>step.wayIds.includes(id))&&b.points[i]===step.from&&b.points[i+1]===step.to)));
  }
  for(const road of card.context.roads){
   const tags=poc.graph.ways.get(road.id).tags??{};
   assert.equal(road.name,tags["name:ja"]||tags.name||tags.ref||"");
  }
 }
 assert.ok(count>0);
});
test("held diagrams receive no partial context drawing",()=>{
 for(const card of poc.referenceKoma.filter(c=>c.map.state==="held")){
  assert.deepEqual(card.context,{buildings:[],landmarks:[],roads:[],steps:[],availableLandmarks:0,availableBuildings:0});
 }
});
test("concave polygon label stays in its area and is distinguished from an entrance",()=>{
 const points=[{lat:0,lon:0},{lat:0,lon:3},{lat:1,lon:3},{lat:1,lon:1},{lat:3,lon:1},{lat:3,lon:0},{lat:0,lon:0}];
 const p=polygonLabelPoint(points);
 assert.ok(p.lat>0&&p.lon>0&&(p.lat<1||p.lon<1));
 const elements=points.slice(0,-1).map((p,i)=>({type:"node",id:i+1,...p}));
 elements.push({type:"way",id:20,nodes:[1,2,3,4,5,6,1],tags:{amenity:"place_of_worship",religion:"shinto",name:"test"}});
 const data=extractContext({elements},{nodes:new Map()});
 assert.equal(data.landmarks[0].anchor,"area-label");
 assert.equal(data.landmarks[0].kind,"\u795e\u793e");
 assert.deepEqual(data.landmarks[0].point,p);
 assert.deepEqual(data,extractContext({elements:[...elements].reverse()},{nodes:new Map()}));
 assert.throws(()=>extractContext({elements:elements.filter(e=>e.id!==2)},{nodes:new Map()}),/Missing context coordinates/);
});
test("a building edge near the center is included even when all vertices lie outside the local radius",()=>{
 const card=poc.koma[0],center=poc.graph.nodes.get(card.map.nodeId);
 const points=[[-.001,.0001],[.001,.0001],[.001,.0002],[-.001,.0002],[-.001,.0001]].map(([lat,lon])=>({lat:center.lat+lat,lon:center.lon+lon}));
 const context=createKomaContext(poc.graph,card.map,{landmarks:[],buildings:[{id:"way/test",points}]});
 assert.equal(context.buildings.length,1);
});


test("direct names fit two lines, while category-only landmarks use a recognizable symbol",()=>{
 assert.deepEqual(landmarkLabelLines("signal","signal"),[]);
 assert.deepEqual(landmarkLabelLines("一時停止点","一時停止点"),["停止点"]);
 const lines=landmarkLabelLines("とても長い施設の名称をそのまま確認したい","施設");
 assert.equal(lines.length,2);assert.ok(lines.every(line=>Array.from(line).length<=8));
 assert.ok(lines[1].endsWith("…"));
});
test("direct landmark labels remain bounded and distinct without moving their OSM source",()=>{
 const features=Array.from({length:4},(_,i)=>({id:"node/"+i,name:"店舗"+i,kind:"店舗",x:150,y:140}));
 const before=structuredClone(features),road=[[{x:150,y:40},{x:150,y:240}]];
 const labels=layoutLandmarks(features,300,280,road);
 assert.deepEqual(features,before);assert.deepEqual(labels,layoutLandmarks(features,300,280,road));
 labels.forEach((label,i)=>{
  assert.deepEqual(label.source,{x:150,y:140});
  assert.ok(label.x>=8&&label.x+label.width<=292&&label.y>=8&&label.y+label.height<=258);
  labels.slice(i+1).forEach(other=>{
   const overlap=Math.max(0,Math.min(label.x+label.width,other.x+other.width)-Math.max(label.x,other.x))*Math.max(0,Math.min(label.y+label.height,other.y+other.height)-Math.max(label.y,other.y));
   assert.equal(overlap,0);
  });
 });
});
test("stop sign tags, stopping points and unrecognized signs have distinct semantics",()=>{
 const nodes=[
  {id:1,tags:{traffic_sign:"JP:330-A"}},
  {id:2,tags:{traffic_sign:"JP:330-B"}},
  {id:3,tags:{highway:"stop",direction:"forward"}},
  {id:4,tags:{"traffic_sign:backward":"JP:330;JP:316"}},
  {id:5,tags:{traffic_sign:"JP:3300"}},
  {id:6,tags:{traffic_sign:"no"}},
  {id:7,tags:{highway:"give_way"}},
  {id:8,tags:{traffic_sign:"US:R1-1"}},
 ].map(n=>({type:"node",lat:0,lon:n.id*.00001,...n}));
 const data=extractContext({elements:nodes},{nodes:new Map()});
 const byId=id=>data.landmarks.find(l=>l.id==="node/"+id);
 for(const id of [1,2,4])assert.equal(byId(id).symbol,"stop-sign");
 assert.equal(byId(3).symbol,"stop-control");assert.equal(byId(3).sourceTags.direction,"forward");
 assert.match(byId(3).detail,/標識そのものの位置/);
 assert.equal(byId(5).symbol,"sign");assert.equal(byId(6),undefined);
 assert.equal(byId(7).symbol,"give-way-control");assert.equal(byId(8).symbol,"sign");
});
test("sign overlay preserves tags and rejects incompatible or invented source coordinates",()=>{
 const original={type:"node",id:1,lat:1,lon:2,tags:{name:"known",amenity:"cafe"}};
 const supplement={...original,tags:{traffic_sign:"JP:330-A"}};
 const data=extractContext({elements:[original]},{nodes:new Map()},{elements:[supplement]});
 assert.equal(data.landmarks.length,1);assert.equal(data.landmarks[0].name,"known");assert.equal(data.landmarks[0].symbol,"stop-sign");
 assert.throws(()=>extractContext({elements:[original]},{nodes:new Map()},{elements:[{...supplement,lat:2}]}),/coordinate mismatch/);
 assert.throws(()=>extractContext({elements:[]},{nodes:new Map()},{elements:[{type:"way",id:2,nodes:[]}]}),/must contain nodes/);
});
test("recognizable road controls and map symbols have priority over general nearby facilities",()=>{
 assert.ok(landmarkPriority({symbol:"signal"})<landmarkPriority({symbol:"shop"}));
 assert.ok(landmarkPriority({symbol:"stop-sign"})<landmarkPriority({symbol:"tourism"}));
 assert.ok(landmarkPriority({symbol:"temple"})<landmarkPriority({symbol:"shop"}));
 const graph={nodes:new Map([[1,{lat:0,lon:0}]]),ways:new Map()};
 const map={state:"ready",headingDegrees:0,nodeId:1,branches:[]};
 const features=Array.from({length:4},(_,i)=>({id:"node/"+i,name:"shop",kind:"店舗",symbol:"shop",anchor:"node",point:{lat:.000001*(i+1),lon:0}}));
 const signal={id:"node/10",name:"信号",kind:"信号",symbol:"signal",anchor:"node",point:{lat:.00015,lon:0}};
 const result=createKomaContext(graph,map,{buildings:[],landmarks:[...features,signal]});
 assert.equal(result.landmarks[0].id,signal.id);assert.equal(result.landmarks.length,4);
});
test("a stop control is visible near the original Misaki junction without altering its route",()=>{
 for(const sequence of [6,12,26]){
  const card=poc.koma[sequence-1];
  assert.ok(card.context.landmarks.some(l=>l.symbol==="stop-control"));
 }
});
test("fixed sign supplement matches its source and preserves the road/context snapshots",()=>{
 const source=JSON.parse(readFileSync(new URL("../data/misaki/signs-source.json",import.meta.url),"utf8"));
 assert.equal(hash("../data/misaki/signs.json"),source.snapshotSha256);
 assert.equal(hash("../data/misaki/osm.json"),source.routingSnapshotSha256);
 assert.equal(hash("../data/misaki/context.json"),source.contextSnapshotSha256);
 assert.equal(source.requestedSnapshotAt,poc.source.osmBaseTimestamp);
});

test("labels stay local on the overview and leave Misaki inlet dots and exit arrow tips uncovered",()=>{
 const clustered=Array.from({length:4},(_,i)=>({id:String(i),name:"近い店舗の名称",kind:"店舗",x:240+i,y:300+i}));
 const overview=layoutLandmarks(clustered,800,600,[[{x:0,y:300},{x:800,y:300}],[{x:240,y:0},{x:240,y:600}]]);
 for(const label of overview)assert.ok(Math.hypot(label.x+label.width/2-label.source.x,label.y+label.height/2-label.source.y)<110);
 for(const card of [...poc.koma,...poc.referenceKoma].filter(c=>c.map.state==="ready")){
  const labels=layoutLandmarks(card.context.landmarks,300,280,card.map.branches.map(b=>b.points));
  const protectedPoints=card.map.branches.flatMap(branch=>[...(branch.arrival?[branch.points.at(-1)]:[]),...(branch.departure?[arrowPath(branch.points).at(-1)]:[])]);
  for(const point of protectedPoints)for(const label of labels){
   assert.ok(!(point.x>=label.x&&point.x<=label.x+label.width&&point.y>=label.y&&point.y<=label.y+label.height),"Navigation symbol covered at koma "+card.map.sequence);
  }
 }
});
