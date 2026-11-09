import test from "node:test";
import assert from "node:assert/strict";
import {createRallyPreview} from "../lib/operator/rally-preview.ts";
import {expandShortKoma} from "../lib/route/koma-display.ts";
import {createKomaMaps} from "../lib/route/koma.ts";
import {extractJunctions} from "../lib/route/junctions.ts";
import {routeThroughStops} from "../lib/route/routing.ts";
import {getBrowserSpots} from "../lib/spots/browser-catalog.ts";
import {mergeSpotEdits} from "../lib/spots/editing.ts";
import {prepareExpandedRoadConnections} from "../lib/miura-road-connections.ts";
import {AUDIT_CASES} from "../scripts/expanded-route-audit.mjs";
const spots=mergeSpotEdits(getBrowserSpots(),[]),byId=new Map(spots.map(s=>[s.id,s])),previews=AUDIT_CASES.filter(s=>!["separated","museum"].includes(s.id)).map(s=>{
 const ids=s.ids.map(id=>byId.get(id));return createRallyPreview({title:s.label,start:ids[0],finish:ids.at(-1),stops:ids.slice(1,-1).map(spot=>({kind:"waypoint",spot})),revision:1,updatedAt:"2026-11-09T00:00:00.000Z"},spots);
}),cards=previews.flatMap(p=>p.cards).filter(c=>c.map.shortGeometry);
const length=ps=>ps.slice(1).reduce((n,p,i)=>n+Math.hypot(p.x-ps[i].x,p.y-ps[i].y),0);
test("only operator opt-in retains short-arm geometry and ordinary generated maps keep the legacy shape",()=>{
 assert.equal(cards.length,45);
 const ids=AUDIT_CASES[0].ids.map(id=>byId.get(id)),p=prepareExpandedRoadConnections(ids),route=routeThroughStops(p.graph,ids.map((s,i)=>({id:"v"+i,name:s.name,nodeId:p.nodeIdsBySpot.get(s.id),note:"test"}))),a=extractJunctions(p.graph,route);
 const ordinary=createKomaMaps(p.graph,a),opt=createKomaMaps(p.graph,a,30,{retainShortGeometry:true});
 assert.equal(ordinary.filter(m=>m.state==="held").length,12);
 for(const [i,m]of ordinary.entries()){const {shortGeometry,...same}=opt[i];assert.equal(m.shortGeometry,undefined);assert.deepEqual(m,same)}
 const unknown={...a,candidates:[{...a.candidates[0],issues:["indeterminate source direction"]}]};
 assert.equal(createKomaMaps(p.graph,unknown,30,{retainShortGeometry:true})[0].shortGeometry,undefined);
});
test("all 45 measured real diagrams keep selected arms at least 30 screen pixels at desktop and narrow widths",()=>{
 for(const width of [300,260,220,180])for(const c of cards){
  const display=expandShortKoma(c.map,c.referenceContext,width);assert.ok(display,"Missing expansion at "+width+" / "+c.map.sequence);
  assert.ok(display.map.branches.filter(b=>b.arrival||b.departure).every(b=>length(b.points)*width/300>=35.99));
  assert.equal(display.map.headingDegrees,c.map.headingDegrees);assert.equal(c.map.state,"held");assert.deepEqual(c.map.branches,[]);
 }
});
test("cropping is a uniform transform of real source prefixes and preserves all branches, roles and distances",()=>{
 for(const c of cards){
  const d=expandShortKoma(c.map,c.referenceContext,220),f=d.zoomFactor,g=c.map.shortGeometry;
  assert.deepEqual(d.map.branches.map(b=>[b.neighborNodeId,b.arrival,b.departure,b.entry,b.exit]),g.branches.map(b=>[b.neighborNodeId,b.arrival,b.departure,b.entry,b.exit]));
  for(const b of d.map.branches){const source=g.branches.find(s=>s.neighborNodeId===b.neighborNodeId);
   for(const [j,s]of b.sourceSegments.entries()){
    const old=source.sourceSegments[j],t=s.fraction/old.fraction,a=source.points[j],z=source.points[j+1];
    assert.equal(s.from,old.from);assert.equal(s.to,old.to);assert.deepEqual(s.wayIds,old.wayIds);assert.ok(t>0&&t<=1+1e-10);
    assert.ok(Math.abs(b.points[j+1].x-(150+(a.x+(z.x-a.x)*t-150)*f))<1e-7);
    assert.ok(Math.abs(b.points[j+1].y-(140+(a.y+(z.y-a.y)*t-140)*f))<1e-7);
   }
   assert.ok(b.points.every(p=>p.x>=52-1e-7&&p.x<=248+1e-7&&p.y>=42-1e-7&&p.y<=238+1e-7));
  }
  assert.equal(d.map.metersToNext,c.map.metersToNext);assert.equal(d.map.metersFromStart,c.map.metersFromStart);assert.deepEqual(d.map.stopIds,c.map.stopIds);
 }
});
test("buildings, selected landmarks and steps align with the same zoom and references retain clipped information",()=>{
 let buildings=0,landmarks=0,steps=0,clipped=0;
 for(const c of cards){const before=structuredClone(c),d=expandShortKoma(c.map,c.referenceContext,220),f=d.zoomFactor;
  for(const [i,b]of c.referenceContext.buildings.entries())for(const [j,p]of b.points.entries()){const q=d.context.buildings[i].points[j];assert.equal(q.x,150+(p.x-150)*f);assert.equal(q.y,140+(p.y-140)*f);buildings++}
  for(const q of d.context.landmarks){const p=c.referenceContext.landmarks.find(p=>p.id===q.id);assert.ok(p);assert.equal(q.x,150+(p.x-150)*f);assert.equal(q.meters,p.meters);landmarks++}
  for(const s of d.context.steps){assert.ok(d.map.branches.some(b=>b.points.some(p=>p.x===s.from.x&&p.y===s.from.y)&&b.points.some(p=>p.x===s.to.x&&p.y===s.to.y)));steps++}
  clipped+=d.hiddenLandmarks;assert.deepEqual(c,before);
 }
 assert.ok(buildings&&landmarks&&steps&&clipped);
});
test("missing geometry, other held reasons, unusable widths and invalid geometry stay held",()=>{
 const c=cards[0];for(const width of [0,159,301,NaN,Infinity])assert.equal(expandShortKoma(c.map,c.referenceContext,width),null);
 assert.equal(expandShortKoma({...c.map,issues:["Missing geometry"]},c.referenceContext,300),null);
 assert.equal(expandShortKoma({...c.map,shortGeometry:undefined},c.referenceContext,300),null);
 assert.equal(expandShortKoma({...c.map,shortGeometry:{...c.map.shortGeometry,headingDegrees:null}},c.referenceContext,300),null);
 const bad=structuredClone(c.map);bad.shortGeometry.branches[0].points[0].x=NaN;assert.equal(expandShortKoma(bad,c.referenceContext,300),null);
});
test("close competing branches and overlapping return markers are conservatively kept held",()=>{
 const c=structuredClone(cards[0]),arm=c.map.shortGeometry.branches[0],segment=arm.sourceSegments[0];
 const make=(id,points,arrival,departure)=>({...arm,neighborNodeId:id,arrival,departure,points,sourceSegments:[segment]});
 c.map.shortGeometry.branches=[make(11,[{x:150,y:140,nodeId:1},{x:150,y:147,nodeId:11}],true,false),make(12,[{x:150,y:140,nodeId:1},{x:150.1,y:147,nodeId:12}],false,true)];
 assert.equal(expandShortKoma(c.map,c.referenceContext,300),null);
 c.map.shortGeometry.branches=[make(11,[{x:150,y:140,nodeId:1},{x:150,y:147,nodeId:11}],true,true)];
 assert.equal(expandShortKoma(c.map,c.referenceContext,300),null);
});
test("access warnings survive expansion and start and finish do not invent arrival or departure branches",()=>{
 const flagged=cards.filter(c=>c.candidate.issues.length);assert.equal(flagged.length,2);
 for(const c of flagged)assert.ok(expandShortKoma(c.map,c.referenceContext,300).map.issues.includes("Source access or extract needs review"));
 const start=cards.find(c=>c.map.kind==="start"),finish=cards.find(c=>c.map.kind==="finish");
 assert.equal(expandShortKoma(start.map,start.referenceContext,300).map.branches.some(b=>b.arrival),false);
 assert.equal(expandShortKoma(finish.map,finish.referenceContext,300).map.branches.some(b=>b.departure),false);
});
test("reference context does not replace original held context or change the saved course inputs",()=>{
 const p=previews[0];assert.equal(p.cards.length,39);assert.ok(Math.abs(p.meters-1231.9926403365716)<1e-6);
 for(const c of cards){assert.equal(c.context.landmarks.length,0);assert.ok(c.referenceContext);assert.equal(c.referenceContext.roads.length>0,true)}
 assert.deepEqual(p.visits.map(v=>v.spotId),AUDIT_CASES[0].ids);assert.equal(p.visits[0].komaIndex,0);assert.equal(p.visits.at(-1).komaIndex,38);
});
